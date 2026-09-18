-- ==============================================================================
-- LOCO TRACK: Task Start Authority Hardening (Phase 12.2)
-- Enforces that transition to IN_PROGRESS can ONLY be performed by the
-- active assigned creative PIC (GRAPHIC_DESIGNER or VIDEO_EDITOR).
-- ==============================================================================

CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id uuid,
  p_new_status task_status
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_assignee boolean;
  v_is_owner boolean;
  v_latest_file record;
  v_last_revised_version integer;
  v_event_type text;
  v_internal_rev_version integer;
  v_client_rev_version integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock task to prevent concurrent state transitions
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  SELECT (sms_owner_id = auth.uid()) INTO v_is_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  -- Authority validation
  IF NOT (
    v_caller_role = 'ADMIN'
    OR (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner)
    OR v_is_assignee
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not assigned to this task or authorized to manage it';
  END IF;

  -- Disallow direct transition out of APPROVED state via transition_task_status
  IF v_task.status = 'APPROVED' AND p_new_status != 'APPROVED' THEN
    RAISE EXCEPTION 'Invalid status transition from APPROVED to %', p_new_status;
  END IF;

  -- State Transition Rules:
  -- 1. TODO -> IN_PROGRESS: Strictly restricted to assigned creative PIC
  IF v_task.status = 'TODO' AND p_new_status = 'IN_PROGRESS' THEN
    IF NOT (v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) THEN
      RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat memulai pengerjaan tugas.';
    END IF;

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

  -- 2. REVISION_REQUESTED -> IN_PROGRESS: Strictly restricted to assigned creative PIC
  ELSIF v_task.status = 'REVISION_REQUESTED' AND p_new_status = 'IN_PROGRESS' THEN
    IF NOT (v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) THEN
      RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat memulai pengerjaan revisi.';
    END IF;

    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;

    -- Transition open revision requests (both INTERNAL_QC and CLIENT) to IN_PROGRESS
    UPDATE public.revision_requests
    SET status = 'IN_PROGRESS'
    WHERE task_id = p_task_id AND status = 'OPEN';

    -- Record REVISION_STARTED activity log
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'REVISION_STARTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'from_status', 'REVISION_REQUESTED',
        'to_status', 'IN_PROGRESS'
      )
    );
    RETURN;

  -- 3. IN_PROGRESS -> IN_REVIEW
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
    -- Verify active deliverable file exists
    SELECT * INTO v_latest_file
    FROM public.project_files
    WHERE task_id = p_task_id AND deleted_at IS NULL
    ORDER BY version DESC
    LIMIT 1;

    IF v_latest_file.id IS NULL THEN
      RAISE EXCEPTION 'Cannot transition to IN_REVIEW: No deliverable files uploaded for task %', p_task_id;
    END IF;

    -- New Version Gate Check:
    SELECT COALESCE(
      (
        SELECT target_version
        FROM public.revision_requests
        WHERE task_id = p_task_id
          AND revision_type = 'INTERNAL_QC'
          AND status IN ('OPEN', 'IN_PROGRESS')
        ORDER BY target_version DESC
        LIMIT 1
      ),
      (
        SELECT target_version
        FROM public.revision_requests
        WHERE task_id = p_task_id
          AND revision_type = 'CLIENT'
          AND status IN ('OPEN', 'IN_PROGRESS')
        ORDER BY target_version DESC
        LIMIT 1
      )
    ) INTO v_last_revised_version;

    IF v_last_revised_version IS NOT NULL AND v_latest_file.version <= v_last_revised_version THEN
      RAISE EXCEPTION 'New version required: latest file is version %, but revision was requested on version %',
        v_latest_file.version, v_last_revised_version;
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    -- Close revision requests as RESOLVED
    UPDATE public.revision_requests
    SET status = 'RESOLVED', updated_at = now()
    WHERE task_id = p_task_id AND status IN ('OPEN', 'IN_PROGRESS');

    -- Audit activity event
    IF v_last_revised_version IS NOT NULL THEN
      v_event_type := 'TASK_RESUBMITTED_FOR_REVIEW';
    ELSE
      v_event_type := 'TASK_SUBMITTED_FOR_REVIEW';
    END IF;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), v_event_type,
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'from_status', 'IN_PROGRESS',
        'to_status', 'IN_REVIEW',
        'file_id', v_latest_file.id,
        'version', v_latest_file.version
      )
    );

    -- Evaluate project macro transition PRODUCTION -> INTERNAL_QC (if in PRODUCTION)
    PERFORM evaluate_project_qc_readiness(v_task.project_id);

    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;
