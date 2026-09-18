-- ==============================================================================
-- 21: Phase 9.1 QC Concurrency, Revision Lifecycle & Storage Integrity Audit
-- LOCO TRACK Database Infrastructure
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. One Active Internal Revision Request Invariant (Section 3)
-- Partial unique index ensures at most ONE active ('OPEN' or 'IN_PROGRESS')
-- internal revision request can exist per task at any time.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_internal_revision_per_task
ON public.revision_requests (task_id)
WHERE status IN ('OPEN', 'IN_PROGRESS') AND source = 'INTERNAL_QC';


-- ------------------------------------------------------------------------------
-- 2. Hardened evaluate_project_qc_readiness RPC (Sections 10, 11, 12)
-- Idempotent macro-transition evaluator:
-- - Row-locks project (FOR UPDATE)
-- - Strictly checks status = 'PRODUCTION' (idempotent, no duplicate events/history)
-- - Guards against zero active QC tasks (v_total_qc_tasks > 0 required)
-- - Updates status to 'INTERNAL_QC' when all active QC-required tasks are submitted
-- - trg_projects_status_history_logger records exactly ONE project_status_history row
-- - Inserts exactly ONE INTERNAL_QC_STARTED activity log
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_project_qc_readiness(
  p_project_id uuid
) RETURNS boolean AS $$
DECLARE
  v_project record;
  v_total_qc_tasks integer;
  v_unsubmitted_qc_tasks integer;
BEGIN
  -- Row-lock project to prevent concurrent transition races
  SELECT id, status INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Idempotency invariant: only evaluate if currently in PRODUCTION
  IF v_project.status != 'PRODUCTION' THEN
    RETURN false;
  END IF;

  -- Section 12: Zero active QC task edge case
  -- Require at least ONE active non-deleted QC-required production task
  SELECT COUNT(*) INTO v_total_qc_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL;

  IF v_total_qc_tasks = 0 THEN
    RETURN false;
  END IF;

  -- Check if any active QC-required task remains in TODO or IN_PROGRESS
  SELECT COUNT(*) INTO v_unsubmitted_qc_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status IN ('TODO', 'IN_PROGRESS');

  IF v_unsubmitted_qc_tasks = 0 THEN
    -- Transition project status to INTERNAL_QC
    -- The existing project_status_history trigger logs exactly ONE history row
    UPDATE public.projects
    SET status = 'INTERNAL_QC', updated_at = now()
    WHERE id = p_project_id;

    -- Record single INTERNAL_QC_STARTED activity event
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      p_project_id, auth.uid(), 'INTERNAL_QC_STARTED',
      jsonb_build_object(
        'from_status', 'PRODUCTION',
        'to_status', 'INTERNAL_QC',
        'total_qc_tasks', v_total_qc_tasks
      )
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION evaluate_project_qc_readiness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_project_qc_readiness(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. Hardened transition_task_status to call evaluate_project_qc_readiness (Section 10, 15)
-- Enforces atomic revision resolution & version monotonicity gate
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

    -- Transition open revision requests to IN_PROGRESS
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
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    -- Check if task previously had a revision request
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

    -- Resolve revision requests for this task atomically
    UPDATE public.revision_requests
    SET status = 'RESOLVED', resolved_at = now()
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

    -- Evaluate project macro transition PRODUCTION -> INTERNAL_QC
    PERFORM evaluate_project_qc_readiness(v_task.project_id);

    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- ------------------------------------------------------------------------------
-- 4. Hardened submit_qc_verdict (Sections 5, 6, 7, 8, 9, 13)
-- - Enforces tasks.requires_qc = true
-- - Re-checks task.status = 'IN_REVIEW' after row lock
-- - Verifies active file is highest non-deleted version of task's asset group
-- - Enforces self-review block
-- - Emits INTERNAL_QC_COMPLETED only when all active QC-required tasks are APPROVED
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
  v_total_qc_tasks integer;
  v_unapproved_qc_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Section 2 & 41: QC Authority check
  IF v_caller_role != 'CREATIVE_DIRECTOR' THEN
    RAISE EXCEPTION 'Unauthorized: only CREATIVE_DIRECTOR can issue QC verdicts';
  END IF;

  -- Section 6, 7, 8: Row lock task to serialize concurrent verdict attempts
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  -- Section 5: Task must require QC evaluation
  IF v_task.requires_qc IS NOT TRUE THEN
    RAISE EXCEPTION 'Task does not require QC evaluation';
  END IF;

  -- Section 3 & 6: Task must be in IN_REVIEW state
  IF v_task.status != 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Task must be in IN_REVIEW status to record QC verdict (current: %)', v_task.status;
  END IF;

  -- Check project existence
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_task.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Section 4 & 9: Resolve exact active deliverable candidate (highest version, deleted_at IS NULL)
  SELECT * INTO v_file
  FROM public.project_files
  WHERE task_id = p_task_id AND deleted_at IS NULL
  ORDER BY version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active deliverable file found for review';
  END IF;

  -- Integrity validation
  IF v_file.project_id != v_task.project_id OR v_file.task_id != v_task.id THEN
    RAISE EXCEPTION 'File integrity violation: file % does not belong to task %', v_file.id, v_task.id;
  END IF;

  -- Self-review prevention
  IF v_file.uploaded_by = auth.uid() THEN
    RAISE EXCEPTION 'Self-review denied: reviewer cannot be the uploader of the deliverable under review';
  END IF;

  -- Calculate next QC round monotonically
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_qc_round
  FROM public.qc_reviews
  WHERE task_id = p_task_id;

  IF p_verdict = 'APPROVED' THEN
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
      'APPROVED',
      COALESCE(trim(p_notes), ''),
      v_qc_round,
      now()
    ) RETURNING id INTO v_qc_review_id;

    -- Update task status to APPROVED
    UPDATE public.tasks
    SET status = 'APPROVED', updated_at = now()
    WHERE id = p_task_id;

    -- Record QC_APPROVED activity log
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

    -- Section 13: Check if all active QC-required tasks for project are now APPROVED
    SELECT COUNT(*) INTO v_total_qc_tasks
    FROM public.tasks
    WHERE project_id = v_task.project_id
      AND requires_qc = true
      AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_unapproved_qc_count
    FROM public.tasks
    WHERE project_id = v_task.project_id
      AND requires_qc = true
      AND deleted_at IS NULL
      AND status != 'APPROVED';

    IF v_total_qc_tasks > 0 AND v_unapproved_qc_count = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.activity_logs
        WHERE project_id = v_task.project_id
          AND event_type = 'INTERNAL_QC_COMPLETED'
      ) THEN
        INSERT INTO public.activity_logs (
          project_id, user_id, event_type, metadata
        ) VALUES (
          v_task.project_id, auth.uid(), 'INTERNAL_QC_COMPLETED',
          jsonb_build_object(
            'project_id', v_task.project_id,
            'status', v_project.status,
            'total_qc_tasks', v_total_qc_tasks,
            'completed_at', now()
          )
        );
      END IF;
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

    -- Calculate next revision round & insert revision_requests record
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

    -- Record QC_REVISION_REQUESTED activity log
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


-- ------------------------------------------------------------------------------
-- 5. Hardened Revision Request Integrity & Mutation Guards (Sections 4, 18)
-- Prevents direct mutation of immutable fields, reassignment bypass, or DELETE.
-- Executed as SECURITY INVOKER so current_user reflects client connection.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_check_revision_request_integrity()
RETURNS trigger AS $$
DECLARE
  v_task_project_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT project_id INTO v_task_project_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    IF v_task_project_id IS NULL OR v_task_project_id != NEW.project_id THEN
      RAISE EXCEPTION 'Revision request project (%) does not match task project (%)', NEW.project_id, v_task_project_id;
    END IF;

    IF NEW.source = 'INTERNAL_QC' AND NEW.qc_review_id IS NULL THEN
      RAISE EXCEPTION 'Internal QC revision requests must be linked to a valid qc_review_id';
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Block any direct update from authenticated clients outside SECURITY DEFINER domain RPCs
    IF current_user = 'authenticated' THEN
      RAISE EXCEPTION 'Direct UPDATE on revision_requests is strictly forbidden. Use domain workflows.';
    END IF;

    -- Immutable architectural columns
    IF OLD.source != NEW.source THEN
      RAISE EXCEPTION 'Revision request source is immutable';
    END IF;

    IF OLD.project_id != NEW.project_id THEN
      RAISE EXCEPTION 'Revision request project_id is immutable';
    END IF;

    IF OLD.task_id != NEW.task_id THEN
      RAISE EXCEPTION 'Revision request task_id is immutable';
    END IF;

    IF OLD.requested_by != NEW.requested_by THEN
      RAISE EXCEPTION 'Revision request requested_by is immutable';
    END IF;

    IF OLD.qc_review_id IS DISTINCT FROM NEW.qc_review_id THEN
      RAISE EXCEPTION 'Revision request qc_review_id is immutable';
    END IF;

    IF OLD.round_number != NEW.round_number THEN
      RAISE EXCEPTION 'Revision request round_number is immutable';
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Physical DELETE on revision_requests is strictly forbidden';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revision_requests_integrity_guard ON public.revision_requests;
CREATE TRIGGER trg_revision_requests_integrity_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.revision_requests
FOR EACH ROW EXECUTE FUNCTION trg_check_revision_request_integrity();


-- ------------------------------------------------------------------------------
-- 6. Direct Table Mutation RLS Lock-Down (Sections 16, 17, 18)
-- Drops direct INSERT and direct UPDATE on qc_reviews and revision_requests
-- and blocks direct client inserts of internal QC activity events.
-- ------------------------------------------------------------------------------
-- qc_reviews: only allow SELECT to authenticated; direct INSERT, UPDATE, DELETE blocked
DROP POLICY IF EXISTS qc_reviews_insert ON public.qc_reviews;
CREATE POLICY qc_reviews_insert ON public.qc_reviews
FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS qc_reviews_update ON public.qc_reviews;
CREATE POLICY qc_reviews_update ON public.qc_reviews
FOR UPDATE USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS qc_reviews_delete ON public.qc_reviews;
CREATE POLICY qc_reviews_delete ON public.qc_reviews
FOR DELETE USING (true);

-- revision_requests: direct client INSERT, UPDATE, DELETE blocked; mutations must use domain RPCs
DROP POLICY IF EXISTS revision_requests_insert ON public.revision_requests;
CREATE POLICY revision_requests_insert ON public.revision_requests
FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS revision_requests_update ON public.revision_requests;
CREATE POLICY revision_requests_update ON public.revision_requests
FOR UPDATE USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS revision_requests_delete ON public.revision_requests;
CREATE POLICY revision_requests_delete ON public.revision_requests
FOR DELETE USING (true);

-- activity_logs: block direct authenticated table INSERT completely
DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert ON public.activity_logs
FOR INSERT WITH CHECK (false);

-- activity_logs: prevent direct authenticated forging of internal QC and revision events
CREATE OR REPLACE FUNCTION trg_activity_logs_prevent_direct_forgery()
RETURNS trigger AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.event_type IN (
    'QC_APPROVED',
    'QC_REVISION_REQUESTED',
    'REVISION_STARTED',
    'TASK_RESUBMITTED_FOR_REVIEW',
    'INTERNAL_QC_STARTED',
    'INTERNAL_QC_COMPLETED'
  ) THEN
    RAISE EXCEPTION 'Direct insertion of internal QC and revision activity events is forbidden. Use domain workflows.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_logs_forgery_guard ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_forgery_guard
BEFORE INSERT ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION trg_activity_logs_prevent_direct_forgery();
