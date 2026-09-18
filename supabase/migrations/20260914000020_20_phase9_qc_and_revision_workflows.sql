-- ==============================================================================
-- 20: Phase 9 Creative Director QC & Internal Revision Workflows
-- LOCO TRACK Database Infrastructure
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. QC Verdict RPC: submit_qc_verdict
-- Evaluates the active review candidate for an IN_REVIEW task.
-- Restricted to CREATIVE_DIRECTOR role.
-- Atomic execution with task row locking and immutable audit generation.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_qc_verdict(
  p_task_id uuid,
  p_verdict qc_verdict,
  p_notes text DEFAULT ''
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_task record;
  v_project record;
  v_file record;
  v_qc_round integer;
  v_rev_round integer;
  v_qc_review_id uuid;
  v_rev_request_id uuid;
  v_unapproved_qc_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- SECTION 2 & 41: QC Authority check
  -- Only active CREATIVE_DIRECTOR can issue normal QC verdicts
  IF v_caller_role != 'CREATIVE_DIRECTOR' THEN
    RAISE EXCEPTION 'Unauthorized: only CREATIVE_DIRECTOR can issue QC verdicts';
  END IF;

  -- SECTION 39: Row lock task to ensure concurrency safety against double submits
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  -- SECTION 3: Task must be in IN_REVIEW state
  IF v_task.status != 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Task must be in IN_REVIEW status to record QC verdict (current: %)', v_task.status;
  END IF;

  -- SECTION 8: Task must require QC
  IF v_task.requires_qc IS NOT TRUE THEN
    RAISE EXCEPTION 'Task does not require QC evaluation';
  END IF;

  -- Check project existence
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_task.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- SECTION 4: Resolve exact active deliverable candidate (highest version, deleted_at IS NULL)
  SELECT * INTO v_file
  FROM public.project_files
  WHERE task_id = p_task_id AND deleted_at IS NULL
  ORDER BY version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active deliverable file found for review';
  END IF;

  -- SECTION 37: Integrity validation
  IF v_file.project_id != v_task.project_id OR v_file.task_id != v_task.id THEN
    RAISE EXCEPTION 'File integrity violation: file % does not belong to task %', v_file.id, v_task.id;
  END IF;

  -- SECTION 36: Self-review prevention
  IF v_file.uploaded_by = auth.uid() THEN
    RAISE EXCEPTION 'Self-review denied: reviewer cannot be the uploader of the deliverable under review';
  END IF;

  -- SECTION 6 & 7: Calculate next QC round
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_qc_round
  FROM public.qc_reviews
  WHERE task_id = p_task_id;

  IF p_verdict = 'APPROVED' THEN
    -- SECTION 8: Insert append-only qc_reviews record
    INSERT INTO public.qc_reviews (
      project_id,
      task_id,
      file_id,
      reviewer_id,
      result,
      notes,
      round_number,
      reviewed_at
    ) VALUES (
      v_task.project_id,
      v_task.id,
      v_file.id,
      auth.uid(),
      'APPROVED',
      COALESCE(trim(p_notes), ''),
      v_qc_round,
      now()
    ) RETURNING id INTO v_qc_review_id;

    -- Update task status to APPROVED
    UPDATE public.tasks
    SET status = 'APPROVED', updated_at = now()
    WHERE id = p_task_id;

    -- SECTION 42: Record QC_APPROVED activity log
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'QC_APPROVED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'file_id', v_file.id,
        'version', v_file.version,
        'round_number', v_qc_round,
        'qc_review_id', v_qc_review_id
      )
    );

    -- Check if all active QC-required tasks for project are now APPROVED
    SELECT COUNT(*) INTO v_unapproved_qc_count
    FROM public.tasks
    WHERE project_id = v_task.project_id
      AND requires_qc = true
      AND deleted_at IS NULL
      AND status != 'APPROVED';

    IF v_unapproved_qc_count = 0 THEN
      INSERT INTO public.activity_logs (
        project_id, user_id, event_type, metadata
      ) VALUES (
        v_task.project_id, auth.uid(), 'INTERNAL_QC_COMPLETED',
        jsonb_build_object(
          'project_id', v_task.project_id,
          'status', v_project.status,
          'completed_at', now()
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'verdict', 'APPROVED',
      'task_id', p_task_id,
      'file_id', v_file.id,
      'version', v_file.version,
      'round_number', v_qc_round,
      'qc_review_id', v_qc_review_id
    );

  ELSIF p_verdict = 'REVISION_REQUESTED' THEN
    -- SECTION 10: Require actionable revision notes
    IF p_notes IS NULL OR trim(p_notes) = '' THEN
      RAISE EXCEPTION 'Actionable revision notes are required when requesting a revision';
    END IF;

    IF length(trim(p_notes)) > 5000 THEN
      RAISE EXCEPTION 'Revision notes exceed maximum length of 5000 characters';
    END IF;

    -- Insert append-only qc_reviews record
    INSERT INTO public.qc_reviews (
      project_id,
      task_id,
      file_id,
      reviewer_id,
      result,
      notes,
      round_number,
      reviewed_at
    ) VALUES (
      v_task.project_id,
      v_task.id,
      v_file.id,
      auth.uid(),
      'REVISION_REQUESTED',
      trim(p_notes),
      v_qc_round,
      now()
    ) RETURNING id INTO v_qc_review_id;

    -- SECTION 11: Calculate next revision round & insert revision_requests record
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_rev_round
    FROM public.revision_requests
    WHERE task_id = p_task_id;

    INSERT INTO public.revision_requests (
      project_id,
      task_id,
      assigned_to,
      qc_review_id,
      requested_by,
      source,
      round_number,
      notes,
      status,
      requested_at
    ) VALUES (
      v_task.project_id,
      v_task.id,
      v_task.current_assignee_id,
      v_qc_review_id,
      auth.uid(),
      'INTERNAL_QC',
      v_rev_round,
      trim(p_notes),
      'OPEN',
      now()
    ) RETURNING id INTO v_rev_request_id;

    -- Update task status to REVISION_REQUESTED
    UPDATE public.tasks
    SET status = 'REVISION_REQUESTED', updated_at = now()
    WHERE id = p_task_id;

    -- SECTION 42: Record QC_REVISION_REQUESTED activity log
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'QC_REVISION_REQUESTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'file_id', v_file.id,
        'version', v_file.version,
        'round_number', v_qc_round,
        'revision_round', v_rev_round,
        'qc_review_id', v_qc_review_id,
        'revision_request_id', v_rev_request_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'verdict', 'REVISION_REQUESTED',
      'task_id', p_task_id,
      'file_id', v_file.id,
      'version', v_file.version,
      'round_number', v_qc_round,
      'revision_round', v_rev_round,
      'qc_review_id', v_qc_review_id,
      'revision_request_id', v_rev_request_id
    );

  ELSE
    RAISE EXCEPTION 'Invalid QC verdict: %', p_verdict;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION submit_qc_verdict(uuid, qc_verdict, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_qc_verdict(uuid, qc_verdict, text) TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. Hardened Task Status Transition: transition_task_status
-- Unlocks:
--   TODO -> IN_PROGRESS
--   IN_PROGRESS -> IN_REVIEW (requires deliverable, enforces new version if revised)
--   REVISION_REQUESTED -> IN_PROGRESS (updates revision_requests to IN_PROGRESS)
-- Evaluates macro transition: PRODUCTION -> INTERNAL_QC when all active QC-required tasks submitted
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id uuid,
  p_new_status task_status
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_is_assignee boolean;
  v_latest_file record;
  v_last_revised_version integer;
  v_event_type text;
  v_proj_status project_phase;
  v_unsubmitted_qc_tasks integer;
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

  -- 1. TODO -> IN_PROGRESS
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

  -- 2. REVISION_REQUESTED -> IN_PROGRESS
  ELSIF v_task.status = 'REVISION_REQUESTED' AND p_new_status = 'IN_PROGRESS' THEN
    -- Assigned creative (or Admin/SMS) resumes work
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;

    -- SECTION 12: Transition open revision requests to IN_PROGRESS
    UPDATE public.revision_requests
    SET status = 'IN_PROGRESS'
    WHERE task_id = p_task_id AND status = 'OPEN';

    -- SECTION 42: Record REVISION_STARTED activity log
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
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    -- SECTION 16: Check if task previously had a revision request
    SELECT pf.version INTO v_last_revised_version
    FROM public.qc_reviews qr
    JOIN public.project_files pf ON qr.file_id = pf.id
    WHERE qr.task_id = p_task_id AND qr.result = 'REVISION_REQUESTED'
    ORDER BY qr.round_number DESC
    LIMIT 1;

    IF v_last_revised_version IS NOT NULL AND v_latest_file.version <= v_last_revised_version THEN
      RAISE EXCEPTION 'Cannot submit task to review without uploading a new version addressing the requested revision (current: v%, reviewed: v%)', v_latest_file.version, v_last_revised_version;
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    -- SECTION 12: Resolve revision requests for this task
    UPDATE public.revision_requests
    SET status = 'RESOLVED', resolved_at = now()
    WHERE task_id = p_task_id AND status IN ('OPEN', 'IN_PROGRESS');

    -- SECTION 42: Audit activity event
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

    -- SECTION 21 & 22: Evaluate project macro transition PRODUCTION -> INTERNAL_QC
    SELECT status INTO v_proj_status FROM public.projects WHERE id = v_task.project_id;
    IF v_proj_status = 'PRODUCTION' THEN
      SELECT COUNT(*) INTO v_unsubmitted_qc_tasks
      FROM public.tasks
      WHERE project_id = v_task.project_id
        AND requires_qc = true
        AND deleted_at IS NULL
        AND status IN ('TODO', 'IN_PROGRESS');

      -- If all active QC-required tasks are now submitted (none in TODO or IN_PROGRESS)
      IF v_unsubmitted_qc_tasks = 0 THEN
        UPDATE public.projects
        SET status = 'INTERNAL_QC', updated_at = now()
        WHERE id = v_task.project_id;

        INSERT INTO public.activity_logs (
          project_id, user_id, event_type, metadata
        ) VALUES (
          v_task.project_id, auth.uid(), 'INTERNAL_QC_STARTED',
          jsonb_build_object(
            'from_status', 'PRODUCTION',
            'to_status', 'INTERNAL_QC'
          )
        );
      END IF;
    END IF;

    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. Hardened Project Phase Transition: transition_project_phase
-- Supports:
--   BRIEF_RECEIVED -> CONTENT_PLANNING
--   CONTENT_PLANNING -> SCRIPT_READY
--   PRODUCTION -> INTERNAL_QC (verifies all active QC tasks are submitted)
-- ------------------------------------------------------------------------------
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
  v_qc_tasks_total integer;
  v_qc_tasks_unsubmitted integer;
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

  -- Role boundary: only ADMIN or project's SMS owner can transition project phases
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
    SELECT EXISTS (
      SELECT 1 FROM public.briefs WHERE project_id = p_project_id
    ) INTO v_has_brief;

    IF NOT v_has_brief THEN
      RAISE EXCEPTION 'Brief is required before advancing to Script Ready';
    END IF;

    SELECT COUNT(*) INTO v_content_count
    FROM public.content_plans
    WHERE project_id = p_project_id;

    IF v_content_count = 0 THEN
      RAISE EXCEPTION 'At least one content plan item is required before advancing to Script Ready';
    END IF;

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

  -- Phase Transition 3: PRODUCTION -> INTERNAL_QC (SECTION 21 & 22)
  ELSIF v_project.status = 'PRODUCTION' AND p_target_phase = 'INTERNAL_QC' THEN
    SELECT COUNT(*) INTO v_qc_tasks_total
    FROM public.tasks
    WHERE project_id = p_project_id
      AND requires_qc = true
      AND deleted_at IS NULL;

    IF v_qc_tasks_total = 0 THEN
      RAISE EXCEPTION 'Project requires at least one active QC task before advancing to Internal QC';
    END IF;

    SELECT COUNT(*) INTO v_qc_tasks_unsubmitted
    FROM public.tasks
    WHERE project_id = p_project_id
      AND requires_qc = true
      AND deleted_at IS NULL
      AND status IN ('TODO', 'IN_PROGRESS');

    IF v_qc_tasks_unsubmitted > 0 THEN
      RAISE EXCEPTION 'All active tasks requiring QC must be submitted to review before advancing to Internal QC (% task(s) remaining in progress)', v_qc_tasks_unsubmitted;
    END IF;

    UPDATE public.projects
    SET status = 'INTERNAL_QC', updated_at = now()
    WHERE id = p_project_id;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      p_project_id, v_caller_id, 'INTERNAL_QC_STARTED',
      jsonb_build_object(
        'from_phase', 'PRODUCTION',
        'to_phase', 'INTERNAL_QC'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'from_phase', 'PRODUCTION',
      'to_phase', 'INTERNAL_QC'
    );

  ELSE
    RAISE EXCEPTION 'Invalid or unauthorized phase transition from % to %', v_project.status, p_target_phase;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_project_phase(uuid, project_phase) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_project_phase(uuid, project_phase) TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. Hardened Deliverable Soft-Delete: soft_delete_project_file
-- Invariants enforced:
--   - Approved files cannot be deleted (Section 18 & 48)
--   - Latest active version cannot be deleted during IN_REVIEW (Section 5)
--   - Task in IN_REVIEW must retain >= 1 active deliverable (Section 5)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION soft_delete_project_file(
  p_file_id uuid
) RETURNS void AS $$
DECLARE
  v_file record;
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_active_count integer;
  v_latest_active_file_id uuid;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_file FROM public.project_files WHERE id = p_file_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found or already deleted';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = v_file.task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated task not found';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_file.project_id;

  -- SECTION 18 & 48: Protect approved deliverable files
  IF EXISTS (
    SELECT 1 FROM public.qc_reviews
    WHERE file_id = p_file_id AND result = 'APPROVED'
  ) OR v_task.status = 'APPROVED' THEN
    RAISE EXCEPTION 'Cannot delete deliverable file that has received an approved QC verdict';
  END IF;

  -- Authority and review state checks
  IF v_task.status = 'IN_REVIEW' THEN
    -- SECTION 5: Find current review candidate (latest active version)
    SELECT id INTO v_latest_active_file_id
    FROM public.project_files
    WHERE task_id = v_file.task_id AND deleted_at IS NULL
    ORDER BY version DESC
    LIMIT 1;

    -- The latest reviewed version cannot be soft-deleted by ANY role during review
    IF v_file.id = v_latest_active_file_id THEN
      RAISE EXCEPTION 'Cannot soft-delete the current review deliverable (v%) while task is in review', v_file.version;
    END IF;

    -- Creatives cannot delete files after submission to review
    IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
      RAISE EXCEPTION 'Cannot delete deliverable file after submission to review';
    END IF;

    -- Invariant: Tasks in IN_REVIEW must retain at least 1 active deliverable file
    SELECT COUNT(*) INTO v_active_count
    FROM public.project_files
    WHERE task_id = v_file.task_id AND deleted_at IS NULL;

    IF v_active_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the only remaining deliverable file while task is in review';
    END IF;
  ELSE
    -- For tasks not in IN_REVIEW (e.g. IN_PROGRESS)
    IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) AND v_file.uploaded_by != auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: only Admin, project SMS owner, or original uploader can delete file';
    END IF;
  END IF;

  -- Mark file as soft-deleted
  UPDATE public.project_files
  SET deleted_at = now()
  WHERE id = p_file_id;

  -- Audit log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_file.project_id, auth.uid(), 'FILE_SOFT_DELETED',
    jsonb_build_object(
      'file_id', p_file_id,
      'task_id', v_file.task_id,
      'version', v_file.version,
      'file_name', v_file.file_name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION soft_delete_project_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_project_file(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. Hardened Task Reassignment & Metadata Protection: Section 19
-- Tasks in APPROVED state cannot be reassigned or have metadata mutated.
-- ------------------------------------------------------------------------------
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

  -- SECTION 19: Approved tasks cannot be reassigned
  IF v_task.status IN ('COMPLETED', 'APPROVED') THEN
    RAISE EXCEPTION 'Cannot reassign % task', v_task.status;
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can reassign tasks';
  END IF;

  -- Verify new assignee
  SELECT * INTO v_new_assignee FROM public.profiles WHERE id = p_new_assignee_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignee profile not found or inactive';
  END IF;

  -- End prior assignment if any
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- Insert new assignment
  INSERT INTO public.task_assignments (
    task_id, assignee_id, assigned_by, assigned_at
  ) VALUES (
    p_task_id, p_new_assignee_id, auth.uid(), now()
  );

  -- Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_REASSIGNED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'new_assignee_id', p_new_assignee_id,
      'new_assignee_name', v_new_assignee.full_name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


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

  -- SECTION 19: Approved tasks cannot have metadata modified
  IF v_task.status IN ('COMPLETED', 'APPROVED') THEN
    RAISE EXCEPTION 'Cannot modify metadata for % task', v_task.status;
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
    IF NOT EXISTS (SELECT 1 FROM public.content_plans WHERE id = p_content_plan_id AND project_id = v_task.project_id) THEN
      RAISE EXCEPTION 'Content plan item does not belong to project';
    END IF;
  END IF;

  IF p_script_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scripts WHERE id = p_script_id AND project_id = v_task.project_id) THEN
      RAISE EXCEPTION 'Script does not belong to project';
    END IF;
  END IF;

  UPDATE public.tasks
  SET
    title = p_title,
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
      'title', p_title
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) TO authenticated;


-- ------------------------------------------------------------------------------
-- 6. Hardened RLS Policy for qc_reviews & revision_requests: Section 35
-- Direct SQL INSERT restricted strictly to CREATIVE_DIRECTOR (and ADMIN for system)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "qc_reviews_insert" ON qc_reviews;
CREATE POLICY "qc_reviews_insert"
  ON qc_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND auth_user_role() = 'CREATIVE_DIRECTOR'
  );

DROP POLICY IF EXISTS "revision_requests_insert" ON revision_requests;
CREATE POLICY "revision_requests_insert"
  ON revision_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      (source = 'INTERNAL_QC' AND auth_user_role() = 'CREATIVE_DIRECTOR')
      OR (source = 'CLIENT' AND (
        auth_user_role() = 'ADMIN'
        OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      ))
    )
  );

-- ------------------------------------------------------------------------------
-- 7. Hardened Task Status Transition Trigger for Phase 9: Section 41
-- Authorize CREATIVE_DIRECTOR to transition task status from IN_REVIEW to
-- APPROVED or REVISION_REQUESTED.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_check_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_has_deliverable boolean;
BEGIN
  -- Allow background/system/seed/service_role operations without auth context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_role := auth_user_role();

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

    -- Creative assignee checks (always prioritized for the assigned PIC)
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

    -- Creative Director authority (Phase 9 QC verdicts on other creatives' tasks)
    IF v_caller_role = 'CREATIVE_DIRECTOR' THEN
      IF OLD.status = 'IN_REVIEW' AND NEW.status IN ('APPROVED', 'REVISION_REQUESTED') THEN
        IF NEW.status = 'APPROVED' AND NEW.requires_qc THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.qc_reviews
            WHERE task_id = NEW.id AND result = 'APPROVED'
          ) THEN
            RAISE EXCEPTION 'Cannot approve task requiring QC without an approved QC review';
          END IF;
        END IF;
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Unauthorized status transition for Creative Director: cannot change % to %', OLD.status, NEW.status;
      END IF;
    END IF;

    -- Anyone else is rejected
    RAISE EXCEPTION 'Unauthorized to modify task status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

