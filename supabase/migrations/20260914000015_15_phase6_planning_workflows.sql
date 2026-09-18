-- 15: Phase 6 Brief, Content Plan & Script Workflows
-- 1. Add script_not_required column to projects
-- 2. Update mutation boundaries trigger for script_not_required
-- 3. Controlled transition_project_phase RPC
-- 4. Controlled set_project_script_not_required RPC
-- 5. Updated log_project_activity whitelist with planning events
-- 6. Updated exceptional_content_update RPC column mapping

-- -------------------------------------------------------------
-- 1. Add script_not_required column to projects
-- -------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS script_not_required boolean NOT NULL DEFAULT false;

-- -------------------------------------------------------------
-- 2. Update Mutation Boundaries Trigger (projects)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_protect_project_mutation_boundaries()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_caller_id uuid;
BEGIN
  v_role := auth_user_role();
  v_caller_id := auth.uid();

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

  -- 5. script_not_required can only be modified by ADMIN or owning SMS during planning
  IF NEW.script_not_required IS DISTINCT FROM OLD.script_not_required THEN
    IF v_role != 'ADMIN' AND (v_role != 'SOCIAL_MEDIA_SPECIALIST' OR OLD.sms_owner_id != v_caller_id) THEN
      RAISE EXCEPTION 'Only administrators or assigned project owner can change script_not_required';
    END IF;
    IF OLD.status NOT IN ('BRIEF_RECEIVED', 'CONTENT_PLANNING') THEN
      RAISE EXCEPTION 'script_not_required cannot be changed after project has passed planning phases';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- -------------------------------------------------------------
-- 3. Controlled Phase Transition RPC (Section 24, 25, 27)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_project_phase(
  p_project_id uuid,
  p_target_phase project_phase
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_project record;
  v_has_brief boolean;
  v_content_count integer;
  v_script_count integer;
  v_unready_script_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  -- Retrieve project
  SELECT id, status, sms_owner_id, script_not_required, project_code
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Role boundary: only ADMIN or project's SMS owner can transition planning phases
  IF v_caller_role != 'ADMIN' AND (v_caller_role != 'SOCIAL_MEDIA_SPECIALIST' OR v_project.sms_owner_id != v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can transition project phase';
  END IF;

  -- Phase Transition 1: BRIEF_RECEIVED -> CONTENT_PLANNING
  IF v_project.status = 'BRIEF_RECEIVED' AND p_target_phase = 'CONTENT_PLANNING' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.briefs WHERE project_id = p_project_id
    ) INTO v_has_brief;

    IF NOT v_has_brief THEN
      RAISE EXCEPTION 'Brief must be created before transitioning to Content Planning';
    END IF;

    UPDATE public.projects
    SET status = 'CONTENT_PLANNING', updated_at = now()
    WHERE id = p_project_id;

    -- Audit Activity Log
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      p_project_id, v_caller_id, 'PLANNING_STARTED',
      jsonb_build_object(
        'from_phase', 'BRIEF_RECEIVED',
        'to_phase', 'CONTENT_PLANNING'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'from_phase', 'BRIEF_RECEIVED',
      'to_phase', 'CONTENT_PLANNING'
    );

  -- Phase Transition 2: CONTENT_PLANNING -> SCRIPT_READY
  ELSIF v_project.status = 'CONTENT_PLANNING' AND p_target_phase = 'SCRIPT_READY' THEN
    -- 1. Brief must exist
    SELECT EXISTS (
      SELECT 1 FROM public.briefs WHERE project_id = p_project_id
    ) INTO v_has_brief;

    IF NOT v_has_brief THEN
      RAISE EXCEPTION 'Brief is required before advancing to Script Ready';
    END IF;

    -- 2. At least one content plan item must exist
    SELECT COUNT(*) INTO v_content_count
    FROM public.content_plans
    WHERE project_id = p_project_id;

    IF v_content_count = 0 THEN
      RAISE EXCEPTION 'At least one content plan item is required before advancing to Script Ready';
    END IF;

    -- 3. Script validation based on script_not_required
    SELECT COUNT(*) INTO v_script_count
    FROM public.scripts
    WHERE project_id = p_project_id;

    SELECT COUNT(*) INTO v_unready_script_count
    FROM public.scripts
    WHERE project_id = p_project_id AND status != 'READY';

    IF v_project.script_not_required IS NOT TRUE THEN
      IF v_script_count = 0 THEN
        RAISE EXCEPTION 'Project requires at least one script, or script must be explicitly marked not required';
      END IF;
      IF v_unready_script_count > 0 THEN
        RAISE EXCEPTION 'All project scripts must be in READY status before advancing to Script Ready';
      END IF;
    ELSE
      IF v_unready_script_count > 0 THEN
        RAISE EXCEPTION 'Existing scripts must be in READY status before advancing to Script Ready';
      END IF;
    END IF;

    UPDATE public.projects
    SET status = 'SCRIPT_READY', updated_at = now()
    WHERE id = p_project_id;

    -- Audit Activity Log
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      p_project_id, v_caller_id, 'PLANNING_COMPLETED',
      jsonb_build_object(
        'from_phase', 'CONTENT_PLANNING',
        'to_phase', 'SCRIPT_READY',
        'content_count', v_content_count,
        'script_count', v_script_count,
        'script_not_required', v_project.script_not_required
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'from_phase', 'CONTENT_PLANNING',
      'to_phase', 'SCRIPT_READY'
    );

  ELSE
    RAISE EXCEPTION 'Invalid or unauthorized phase transition from % to %', v_project.status, p_target_phase;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_project_phase(uuid, project_phase) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_project_phase(uuid, project_phase) TO authenticated;


-- -------------------------------------------------------------
-- 4. Script Not Required Toggle RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_project_script_not_required(
  p_project_id uuid,
  p_not_required boolean
) RETURNS void AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_project record;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  SELECT id, status, sms_owner_id
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  IF v_caller_role != 'ADMIN' AND (v_caller_role != 'SOCIAL_MEDIA_SPECIALIST' OR v_project.sms_owner_id != v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can change script_not_required';
  END IF;

  IF v_project.status NOT IN ('BRIEF_RECEIVED', 'CONTENT_PLANNING') THEN
    RAISE EXCEPTION 'script_not_required cannot be changed after planning phases';
  END IF;

  UPDATE public.projects
  SET script_not_required = p_not_required, updated_at = now()
  WHERE id = p_project_id;

  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, v_caller_id, 'SCRIPT_NOT_REQUIRED_TOGGLED',
    jsonb_build_object('script_not_required', p_not_required)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION set_project_script_not_required(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_project_script_not_required(uuid, boolean) TO authenticated;


-- -------------------------------------------------------------
-- 5. Hardened log_project_activity RPC (Updated Whitelist)
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
    IF p_event_type NOT IN (
      'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
      'BRIEF_CREATED', 'BRIEF_UPDATED',
      'CONTENT_PLAN_CREATED', 'CONTENT_PLAN_UPDATED',
      'SCRIPT_CREATED', 'SCRIPT_UPDATED', 'SCRIPT_READY',
      'SCRIPT_NOT_REQUIRED_TOGGLED',
      'PLANNING_STARTED', 'PLANNING_COMPLETED'
    ) THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSIF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner THEN
    IF p_event_type NOT IN (
      'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
      'BRIEF_CREATED', 'BRIEF_UPDATED',
      'CONTENT_PLAN_CREATED', 'CONTENT_PLAN_UPDATED',
      'SCRIPT_CREATED', 'SCRIPT_UPDATED', 'SCRIPT_READY',
      'SCRIPT_NOT_REQUIRED_TOGGLED',
      'PLANNING_STARTED', 'PLANNING_COMPLETED'
    ) THEN
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
-- 6. Updated exceptional_content_update RPC (T-004)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION exceptional_content_update(
  p_entity_type text,
  p_entity_id uuid,
  p_patch jsonb,
  p_reason text
) RETURNS void AS $$
DECLARE
  v_project_id uuid;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A non-empty revision reason is required for exceptional in-flight updates';
  END IF;

  v_caller_role := auth_user_role();

  IF p_entity_type = 'brief' THEN
    SELECT project_id INTO v_project_id FROM public.briefs WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    SELECT project_id INTO v_project_id FROM public.content_plans WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    SELECT project_id INTO v_project_id FROM public.scripts WHERE id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Entity not found';
  END IF;

  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can perform exceptional content revisions';
  END IF;

  -- Set transaction-local override for content lock trigger
  PERFORM set_config('loco.exceptional_revision', 'on', true);

  IF p_entity_type = 'brief' THEN
    UPDATE public.briefs
    SET 
      objective = COALESCE(p_patch->>'objective', objective),
      target_audience = COALESCE(p_patch->>'target_audience', target_audience),
      key_message = COALESCE(p_patch->>'key_message', key_message),
      deliverables_summary = COALESCE(p_patch->>'deliverables_summary', deliverables_summary),
      reference_links = COALESCE(p_patch->>'reference_links', reference_links),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    UPDATE public.content_plans
    SET 
      title = COALESCE(p_patch->>'title', title),
      channel = COALESCE(p_patch->>'channel', channel),
      planned_post_date = CASE WHEN p_patch->>'planned_post_date' IS NOT NULL THEN (p_patch->>'planned_post_date')::date ELSE planned_post_date END,
      pillar = COALESCE(p_patch->>'pillar', pillar),
      copy_draft = COALESCE(p_patch->>'copy_draft', copy_draft),
      status = COALESCE(p_patch->>'status', status),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    UPDATE public.scripts
    SET 
      title = COALESCE(p_patch->>'title', title),
      hook = COALESCE(p_patch->>'hook', hook),
      body = COALESCE(p_patch->>'body', body),
      visual_cues = COALESCE(p_patch->>'visual_cues', visual_cues),
      call_to_action = COALESCE(p_patch->>'call_to_action', call_to_action),
      status = COALESCE(p_patch->>'status', status),
      updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  -- Log audit event
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project_id,
    auth.uid(),
    'EXCEPTIONAL_CONTENT_REVISION',
    jsonb_build_object(
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'reason', p_reason,
      'patch', p_patch
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) TO authenticated;
