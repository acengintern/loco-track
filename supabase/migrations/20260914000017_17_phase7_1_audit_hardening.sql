-- =============================================================
-- Migration 17: Phase 7.1 Final Task State & Production Integrity Hardening
-- Single-source status history verification, strict task state machine,
-- archive consistency, and lifecycle guards.
-- =============================================================

-- 1. Hardened Task Status Transition RPC
-- In Phase 7, ONLY TODO -> IN_PROGRESS is allowed for active tasks.
-- IN_PROGRESS -> IN_REVIEW requires deliverable file upload (Phase 8).
-- Any attempts to jump to APPROVED, COMPLETED, or REVISION_REQUESTED
-- are strictly blocked for ALL roles (Admin, SMS, Assignee).
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id uuid,
  p_new_status task_status
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_is_assignee boolean;
  v_has_deliverable boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  -- Authority check: only Admin, owning SMS, or the task assignee can transition status
  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) AND NOT v_is_assignee THEN
    RAISE EXCEPTION 'Unauthorized: caller is not assigned to this task or authorized to manage it';
  END IF;

  -- State machine enforcement (applies uniformly to ALL roles: Admin, SMS, and Assignee)
  -- Phase 7 boundary: ONLY TODO -> IN_PROGRESS is allowed.
  IF v_task.status = 'TODO' AND p_new_status = 'IN_PROGRESS' THEN
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'TASK_STARTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'from_status', 'TODO',
        'to_status', 'IN_PROGRESS'
      )
    );
    RETURN;
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
    -- Verify deliverable file has been uploaded (prerequisite for review entry)
    SELECT EXISTS (
      SELECT 1 FROM public.project_files
      WHERE task_id = p_task_id AND deleted_at IS NULL
    ) INTO v_has_deliverable;

    IF NOT v_has_deliverable THEN
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;
    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;


-- 2. Hardened Atomic Task Reassignment RPC
-- Prevents reassignment of archived tasks or completed tasks.
CREATE OR REPLACE FUNCTION reassign_task(
  p_task_id uuid,
  p_new_assignee_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_new_assignee record;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  IF v_task.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Cannot reassign completed task';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can reassign tasks';
  END IF;

  -- Validate new assignee exists and is active
  SELECT id, is_active, role INTO v_new_assignee
  FROM public.profiles
  WHERE id = p_new_assignee_id;

  IF v_new_assignee.id IS NULL THEN
    RAISE EXCEPTION 'Assignee profile not found';
  END IF;

  IF v_new_assignee.is_active IS NOT TRUE THEN
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

  -- 3. Atomically ensure project membership exists for new assignee
  INSERT INTO public.project_members (project_id, user_id)
  VALUES (v_task.project_id, p_new_assignee_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- 4. Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;

  -- 5. Record activity log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_REASSIGNED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'previous_assignee_id', v_task.current_assignee_id,
      'new_assignee_id', p_new_assignee_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


-- 3. Hardened Task Archival RPC
-- Clears current_assignee_id and ends active task assignment on archival.
CREATE OR REPLACE FUNCTION archive_task(
  p_task_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or already archived';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can archive tasks';
  END IF;

  -- End active assignment if any
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- Soft delete task and clear active assignee reference
  UPDATE public.tasks
  SET deleted_at = now(), current_assignee_id = NULL, updated_at = now()
  WHERE id = p_task_id;

  -- Log activity
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_UPDATED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'action', 'ARCHIVED'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION archive_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_task(uuid) TO authenticated;


-- 4. Hardened Task Metadata Update RPC
-- Rejects metadata mutations on archived tasks.
CREATE OR REPLACE FUNCTION update_task_metadata(
  p_task_id uuid,
  p_title text,
  p_priority priority_level,
  p_deadline timestamptz,
  p_notes text DEFAULT NULL,
  p_content_plan_id uuid DEFAULT NULL,
  p_script_id uuid DEFAULT NULL,
  p_task_type task_type DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_task record;
  v_project record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  SELECT id, sms_owner_id, deadline INTO v_project
  FROM public.projects
  WHERE id = v_task.project_id;

  v_caller_role := auth_user_role();
  v_is_sms_owner := (v_project.sms_owner_id = auth.uid());

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can edit task metadata';
  END IF;

  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RAISE EXCEPTION 'Task title cannot be empty';
  END IF;

  IF p_deadline > v_project.deadline THEN
    RAISE EXCEPTION 'Task deadline cannot exceed project deadline (%)', v_project.deadline;
  END IF;

  IF p_content_plan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.content_plans WHERE id = p_content_plan_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked content plan does not belong to the same project';
    END IF;
  END IF;

  IF p_script_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scripts WHERE id = p_script_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked script does not belong to the same project';
    END IF;
  END IF;

  IF p_task_type IS NOT NULL AND p_task_type IS DISTINCT FROM v_task.task_type THEN
    IF v_task.status != 'TODO' THEN
      RAISE EXCEPTION 'Task type cannot be changed once work has begun (status: %)', v_task.status;
    END IF;
  END IF;

  UPDATE public.tasks
  SET
    title = TRIM(p_title),
    priority = p_priority,
    deadline = p_deadline,
    notes = p_notes,
    content_plan_id = p_content_plan_id,
    script_id = p_script_id,
    task_type = COALESCE(p_task_type, task_type),
    updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_UPDATED',
    jsonb_build_object(
      'task_id', p_task_id,
      'title', TRIM(p_title),
      'priority', p_priority,
      'deadline', p_deadline
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) TO authenticated;
