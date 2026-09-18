-- 10: Security Hardening, Anti-Forgery, Self-Approval Defense, and Atomicity
-- Hardened triggers, RLS policies, and atomic RPCs

-- 1. Anti-Self-Approval & Governance Guard on Tasks
CREATE OR REPLACE FUNCTION trg_check_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_has_deliverable boolean;
BEGIN
  -- Allow background/system/seed operations without auth context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project SMS ownership
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = NEW.project_id;

  -- 1.1 Protect governance fields from creative assignees
  IF v_caller_role NOT IN ('ADMIN') AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    IF NEW.deadline IS DISTINCT FROM OLD.deadline OR
       NEW.requires_qc IS DISTINCT FROM OLD.requires_qc OR
       NEW.priority IS DISTINCT FROM OLD.priority OR
       NEW.current_assignee_id IS DISTINCT FROM OLD.current_assignee_id OR
       NEW.project_id IS DISTINCT FROM OLD.project_id OR
       NEW.task_type IS DISTINCT FROM OLD.task_type THEN
      RAISE EXCEPTION 'Unauthorized: creative assignees cannot modify task governance fields';
    END IF;
  END IF;

  -- 1.2 Status transition validation
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Admin has full status transition authority
    IF v_caller_role = 'ADMIN' THEN
      RETURN NEW;
    END IF;

    -- SMS owner authority
    IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE THEN
      -- SMS cannot approve a task requiring QC if no approved QC review exists
      IF NEW.status IN ('APPROVED', 'COMPLETED') AND OLD.status NOT IN ('APPROVED', 'COMPLETED') AND NEW.requires_qc THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.qc_reviews
          WHERE task_id = NEW.id AND result = 'APPROVED'
        ) THEN
          RAISE EXCEPTION 'Cannot approve task requiring QC without an approved QC review';
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- Creative assignee checks
    IF OLD.current_assignee_id = auth.uid() THEN
      -- STRICT SELF-APPROVAL DEFENSE: Assignee can NEVER approve or complete task
      IF NEW.status IN ('APPROVED', 'COMPLETED') THEN
        RAISE EXCEPTION 'Unauthorized: task assignee cannot approve or complete their own task';
      END IF;

      IF OLD.status = 'TODO' AND NEW.status = 'IN_PROGRESS' THEN
        RETURN NEW;
      ELSIF OLD.status = 'IN_PROGRESS' AND NEW.status = 'IN_REVIEW' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.project_files
          WHERE task_id = NEW.id AND deleted_at IS NULL
        ) INTO v_has_deliverable;

        IF NOT v_has_deliverable THEN
          RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
        END IF;
        RETURN NEW;
      ELSIF OLD.status = 'REVISION_REQUESTED' AND NEW.status = 'IN_PROGRESS' THEN
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Invalid status transition from % to % for task assignee', OLD.status, NEW.status;
      END IF;
    END IF;

    -- Anyone else is rejected
    RAISE EXCEPTION 'Unauthorized to modify task status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_status_transition_guard ON tasks;
CREATE TRIGGER trg_tasks_status_transition_guard
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_task_status_transition();


-- 2. Atomic Task Reassignment RPC
CREATE OR REPLACE FUNCTION reassign_task(
  p_task_id uuid,
  p_new_assignee_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_new_assignee_active boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can reassign tasks';
  END IF;

  -- Validate new assignee exists and is active
  SELECT is_active INTO v_new_assignee_active
  FROM public.profiles
  WHERE id = p_new_assignee_id;

  IF v_new_assignee_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot assign task to inactive user';
  END IF;

  -- 1. End previous active assignment
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- 2. Insert new active assignment
  INSERT INTO public.task_assignments (
    task_id,
    assignee_id,
    assigned_by,
    assigned_at
  ) VALUES (
    p_task_id,
    p_new_assignee_id,
    auth.uid(),
    now()
  );

  -- 3. Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


-- 3. Brand Soft-Delete Admin-Only Check (T-003)
CREATE OR REPLACE FUNCTION trg_check_brand_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth_user_role() != 'ADMIN' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: only administrators can soft-delete brands (T-003)';
    END IF;
    IF EXISTS (SELECT 1 FROM projects WHERE brand_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot delete brand %: active or historical projects exist', NEW.code;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 4. Content Lock Enforcement in Production (T-004)
CREATE OR REPLACE FUNCTION trg_check_content_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_project_status project_phase;
BEGIN
  -- Background/seed operations bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if running within approved exceptional revision context
  IF current_setting('loco.exceptional_revision', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_project_status
  FROM projects
  WHERE id = NEW.project_id;

  IF v_project_status IN ('PRODUCTION', 'INTERNAL_QC', 'CLIENT_REVIEW', 'APPROVED', 'PUBLISHED', 'DONE') THEN
    IF auth_user_role() != 'ADMIN' THEN
      RAISE EXCEPTION 'Content is locked during % phase (T-004)', v_project_status;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Exceptional In-Flight Content Revision RPC (T-004)
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
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    UPDATE public.content_plans
    SET 
      post_title = COALESCE(p_patch->>'post_title', post_title),
      copywriting_draft = COALESCE(p_patch->>'copywriting_draft', copywriting_draft),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    UPDATE public.scripts
    SET 
      scene_breakdown = COALESCE(p_patch->>'scene_breakdown', scene_breakdown),
      visual_cues = COALESCE(p_patch->>'visual_cues', visual_cues),
      voiceover_text = COALESCE(p_patch->>'voiceover_text', voiceover_text),
      updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  -- Record audit event in activity_logs
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
      'reason', p_reason
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) TO authenticated;


-- 6. Activity Log Anti-Forgery Defense
-- Normal authenticated roles cannot directly insert arbitrary audit logs
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND auth_user_role() = 'ADMIN'
  );


-- 7. Notification RPC Anti-Spam / Anti-Forgery
-- Arbitrary notification creation is restricted to administrators
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_user_id uuid,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
  v_recipient_active boolean;
  v_caller_role user_role;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  IF v_caller_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: arbitrary notification creation is restricted to administrators';
  END IF;

  SELECT is_active INTO v_recipient_active
  FROM public.profiles
  WHERE id = p_recipient_user_id;

  IF v_recipient_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot dispatch notification to inactive user';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url,
    is_read
  ) VALUES (
    p_recipient_user_id,
    p_title,
    p_message,
    p_link_url,
    false
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 8. Automated Domain Event Notifications (Legitimate Event Dispatch)
CREATE OR REPLACE FUNCTION trg_notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title text;
  v_project_id uuid;
BEGIN
  SELECT title, project_id INTO v_task_title, v_project_id
  FROM public.tasks
  WHERE id = NEW.task_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url
  ) VALUES (
    NEW.assignee_id,
    'New Task Assigned',
    'You have been assigned to task: ' || COALESCE(v_task_title, 'Untitled'),
    '/projects/' || v_project_id::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_task_assignments_notifier ON task_assignments;
CREATE TRIGGER trg_task_assignments_notifier
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_on_task_assignment();


-- 9. Cross-Entity Task and Project Matching for Project Files
CREATE OR REPLACE FUNCTION trg_check_project_file_task_match()
RETURNS TRIGGER AS $$
DECLARE
  v_task_project_id uuid;
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT project_id INTO v_task_project_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    IF v_task_project_id IS NULL OR v_task_project_id != NEW.project_id THEN
      RAISE EXCEPTION 'Project file project (%) does not match task project (%)', NEW.project_id, v_task_project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_project_files_task_match_guard ON project_files;
CREATE TRIGGER trg_project_files_task_match_guard
  BEFORE INSERT OR UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_project_file_task_match();


-- 10. Storage Policy Hardening: Asset Group ID & Task Verification
DROP POLICY IF EXISTS "storage_deliverables_write" ON storage.objects;

CREATE POLICY "storage_deliverables_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()
        )
      )
      OR (
        ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND project_id = ((storage.foldername(name))[1])::uuid
            AND status IN ('TODO', 'IN_PROGRESS', 'REVISION_REQUESTED')
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.project_files WHERE task_id = ((storage.foldername(name))[2])::uuid
          )
          OR ((storage.foldername(name))[3])::uuid = (
            SELECT asset_group_id FROM public.project_files WHERE task_id = ((storage.foldername(name))[2])::uuid LIMIT 1
          )
        )
      )
    )
  );
