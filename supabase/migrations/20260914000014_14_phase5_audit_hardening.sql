-- 14: Phase 5.1 Final Core Consistency and Security Hardening
-- 1. Canonical projects.name (drop title and sync trigger)
-- 2. Atomic create_project RPC
-- 3. Hardened log_project_activity RPC (anti-forgery, strict whitelist)
-- 4. Project mutation boundaries trigger
-- 5. Project member removal active-task guard trigger

-- -------------------------------------------------------------
-- 1. Canonical projects.name
-- -------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_projects_name_title_sync ON public.projects;
DROP FUNCTION IF EXISTS trg_sync_project_name_title();

-- Ensure all rows have name populated from title if any is null
UPDATE public.projects SET name = title WHERE name IS NULL;

-- Drop title column so projects.name is the ONLY canonical project name field
ALTER TABLE public.projects DROP COLUMN IF EXISTS title;
ALTER TABLE public.projects ALTER COLUMN name SET NOT NULL;


-- -------------------------------------------------------------
-- 1b. Resilient generate_project_code (T-001 collision-free)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_project_code(
  p_brand_id uuid
) RETURNS text AS $$
DECLARE
  v_brand_code text;
  v_year text;
  v_seq integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  SELECT code INTO v_brand_code FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  v_year := TO_CHAR(now(), 'YYYY');

  LOOP
    v_seq := nextval('project_code_seq');
    v_candidate := v_brand_code || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE project_code = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_project_code(uuid) TO authenticated;


-- -------------------------------------------------------------
-- 2. Atomic create_project RPC (Section 5 & 6)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_project(
  p_brand_id uuid,
  p_name text,
  p_description text,
  p_priority priority_level,
  p_start_date date,
  p_deadline timestamptz,
  p_sms_owner_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_sms_owner_id uuid;
  v_sms_active boolean;
  v_sms_role user_role;
  v_project_code text;
  v_project_id uuid;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  -- Rule: Only ADMIN and SOCIAL_MEDIA_SPECIALIST can create projects (D-001)
  IF v_caller_role NOT IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST') THEN
    RAISE EXCEPTION 'Unauthorized: only ADMIN and SOCIAL_MEDIA_SPECIALIST can create projects';
  END IF;

  -- Section 6: SMS OWNER RULE
  IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' THEN
    -- SMS must be self; cannot create on behalf of another SMS
    IF p_sms_owner_id IS NOT NULL AND p_sms_owner_id != v_caller_id THEN
      RAISE EXCEPTION 'Unauthorized: SOCIAL_MEDIA_SPECIALIST cannot assign project to another user';
    END IF;
    v_sms_owner_id := v_caller_id;
  ELSE
    -- ADMIN may select SMS owner, must be active SOCIAL_MEDIA_SPECIALIST
    IF p_sms_owner_id IS NULL THEN
      RAISE EXCEPTION 'Invalid request: ADMIN must designate an SMS owner';
    END IF;
    
    SELECT role, is_active INTO v_sms_role, v_sms_active
    FROM public.profiles
    WHERE id = p_sms_owner_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Designated SMS owner not found';
    END IF;

    IF v_sms_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Designated SMS owner is inactive';
    END IF;

    IF v_sms_role != 'SOCIAL_MEDIA_SPECIALIST' THEN
      RAISE EXCEPTION 'Designated owner must have role SOCIAL_MEDIA_SPECIALIST, found %', v_sms_role;
    END IF;

    v_sms_owner_id := p_sms_owner_id;
  END IF;

  -- Verify brand exists and is not deleted
  IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Invalid brand: brand does not exist or is archived';
  END IF;

  -- Generate atomic project code
  v_project_code := generate_project_code(p_brand_id);

  -- 1. Insert Project Row
  INSERT INTO public.projects (
    project_code,
    brand_id,
    name,
    description,
    status,
    priority,
    start_date,
    deadline,
    sms_owner_id,
    created_by
  ) VALUES (
    v_project_code,
    p_brand_id,
    p_name,
    p_description,
    'BRIEF_RECEIVED',
    p_priority,
    p_start_date,
    p_deadline,
    v_sms_owner_id,
    v_caller_id
  ) RETURNING id INTO v_project_id;

  -- 2. Insert SMS owner into project_members
  INSERT INTO public.project_members (
    project_id,
    user_id
  ) VALUES (
    v_project_id,
    v_sms_owner_id
  );

  -- If Admin created and assigned someone else, also register Admin as member
  IF v_caller_role = 'ADMIN' AND v_caller_id != v_sms_owner_id THEN
    INSERT INTO public.project_members (
      project_id,
      user_id
    ) VALUES (
      v_project_id,
      v_caller_id
    );
  END IF;

  -- 3. Atomic Activity Log Record
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project_id,
    v_caller_id,
    'PROJECT_CREATED',
    jsonb_build_object(
      'project_code', v_project_code,
      'name', p_name,
      'priority', p_priority,
      'sms_owner_id', v_sms_owner_id
    )
  );

  RETURN jsonb_build_object(
    'id', v_project_id,
    'project_code', v_project_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_project(uuid, text, text, priority_level, date, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_project(uuid, text, text, priority_level, date, timestamptz, uuid) TO authenticated;


-- -------------------------------------------------------------
-- 3. Hardened log_project_activity RPC (Section 4)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_caller_role user_role;
  v_is_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project exists and check owner
  SELECT (sms_owner_id = auth.uid()) INTO v_is_owner
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Strictly reject arbitrary or unauthorized events
  -- Read-only roles (AE, CD) and creative roles (Designer, Editor) cannot log project management events
  IF v_caller_role = 'ADMIN' THEN
    IF p_event_type NOT IN ('PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED') THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSIF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner THEN
    IF p_event_type NOT IN ('PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED') THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have permission to record project activity logs';
  END IF;

  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_event_type,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION log_project_activity(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_project_activity(uuid, text, jsonb) TO authenticated;


-- -------------------------------------------------------------
-- 4. Project Mutation Boundaries Trigger (Section 8)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_protect_project_mutation_boundaries()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := auth_user_role();

  -- 1. project_code is immutable for all users
  IF NEW.project_code IS DISTINCT FROM OLD.project_code THEN
    RAISE EXCEPTION 'project_code is immutable';
  END IF;

  -- 2. created_by is immutable for all users
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;

  -- 3. brand_id is locked after BRIEF_RECEIVED phase for all callers
  IF NEW.brand_id IS DISTINCT FROM OLD.brand_id THEN
    IF OLD.status != 'BRIEF_RECEIVED' THEN
      RAISE EXCEPTION 'brand_id can only be changed while project is in BRIEF_RECEIVED phase';
    END IF;
  END IF;

  -- 4. sms_owner_id can only be reassigned by ADMIN
  IF NEW.sms_owner_id IS DISTINCT FROM OLD.sms_owner_id THEN
    IF v_role != 'ADMIN' THEN
      RAISE EXCEPTION 'Only administrators can reassign project sms_owner_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_projects_mutation_boundaries ON public.projects;
CREATE TRIGGER trg_projects_mutation_boundaries
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_project_mutation_boundaries();


-- -------------------------------------------------------------
-- 5. Membership Integrity Active Task Guard (Section 7)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_check_project_member_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent removing a member if they have active uncompleted tasks in the project
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE project_id = OLD.project_id
      AND current_assignee_id = OLD.user_id
      AND status NOT IN ('APPROVED', 'COMPLETED')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot remove member: user is currently assigned to active tasks in this project. Reassign tasks first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_project_members_removal_guard ON public.project_members;
CREATE TRIGGER trg_project_members_removal_guard
  BEFORE DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_project_member_removal();
