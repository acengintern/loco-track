-- ==============================================================================
-- LOCO TRACK - Phase 10: Client Review, Revision Loop, Approval & Publication
-- Migration 22: RPCs, Constraints, Lifecycle Guards & Immutability Triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Check if Deliverable was Client-Presented
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_client_presented_deliverable(p_file_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_review_items
    WHERE file_id = p_file_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;


-- ------------------------------------------------------------------------------
-- 2. Client Review Audit Entity Preservation & Direct Mutation Guards
-- ------------------------------------------------------------------------------
-- Physical DELETE Guard on client_reviews
CREATE OR REPLACE FUNCTION trg_prevent_client_reviews_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Physical DELETE on client_reviews is strictly forbidden. Client review history is immutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_reviews_delete_guard ON public.client_reviews;
CREATE TRIGGER trg_client_reviews_delete_guard
BEFORE DELETE ON public.client_reviews
FOR EACH ROW EXECUTE FUNCTION trg_prevent_client_reviews_delete();

-- Section 1: Single Active (PENDING) Client Review Round Per Project
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_reviews_one_active_per_project
ON public.client_reviews (project_id)
WHERE overall_verdict = 'PENDING';

-- Section 7: One Active Revision Request Across All Sources
DROP INDEX IF EXISTS public.uq_one_active_internal_revision_per_task;
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_revision_per_task
ON public.revision_requests (task_id)
WHERE status IN ('OPEN', 'IN_PROGRESS');

-- Section 2 & 23: Direct Mutation Guard on client_reviews
CREATE OR REPLACE FUNCTION trg_client_reviews_mutation_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user = 'authenticated' THEN
      RAISE EXCEPTION 'Direct INSERT on client_reviews is strictly forbidden. Use start_client_review() or start_client_re_presentation().';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_user = 'authenticated' THEN
      RAISE EXCEPTION 'Direct UPDATE on client_reviews is strictly forbidden. Use domain workflows.';
    END IF;
    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'client_reviews project_id is immutable';
    END IF;
    IF NEW.round_number IS DISTINCT FROM OLD.round_number THEN
      RAISE EXCEPTION 'client_reviews round_number is immutable';
    END IF;
    IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN
      RAISE EXCEPTION 'client_reviews submitted_by is immutable';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'client_reviews created_at is immutable';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_reviews_mutation_guard ON public.client_reviews;
CREATE TRIGGER trg_client_reviews_mutation_guard
  BEFORE INSERT OR UPDATE ON public.client_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trg_client_reviews_mutation_guard();

-- Section 23: Direct INSERT Guard on client_review_items
CREATE OR REPLACE FUNCTION trg_client_review_items_insert_guard()
RETURNS trigger AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Direct INSERT on client_review_items is strictly forbidden. Use record_client_item_verdict().';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_review_items_insert_guard ON public.client_review_items;
CREATE TRIGGER trg_client_review_items_insert_guard
  BEFORE INSERT ON public.client_review_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_client_review_items_insert_guard();


-- ------------------------------------------------------------------------------
-- 3. Hardened Deliverable Soft-Delete RPC (Protect Client-Presented Artifacts)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION soft_delete_project_file(
  p_file_id uuid
) RETURNS void AS $$
DECLARE
  v_file record;
  v_task record;
  v_project record;
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

  SELECT * INTO v_project FROM public.projects WHERE id = v_file.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated project not found';
  END IF;

  v_caller_role := auth_user_role();
  v_is_sms_owner := (v_project.sms_owner_id = auth.uid());

  -- Section 49 & 50: Protect client-presented and client-reviewed deliverable files
  IF is_client_presented_deliverable(p_file_id) THEN
    RAISE EXCEPTION 'Cannot delete deliverable file that has been presented for client review';
  END IF;

  -- Phase 9: Protect QC-approved deliverable files
  IF EXISTS (
    SELECT 1 FROM public.qc_reviews
    WHERE file_id = p_file_id AND result = 'APPROVED'
  ) OR v_task.status = 'APPROVED' THEN
    RAISE EXCEPTION 'Cannot delete deliverable file that has received an approved QC verdict';
  END IF;

  -- Freeze files if project is in CLIENT_REVIEW or APPROVED or PUBLISHED
  IF v_project.status IN ('CLIENT_REVIEW', 'APPROVED', 'PUBLISHED') THEN
    RAISE EXCEPTION 'Cannot delete deliverable files while project is in % phase', v_project.status;
  END IF;

  -- Authority and review state checks
  IF v_task.status = 'IN_REVIEW' THEN
    -- Find current review candidate (latest active version)
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
-- 4. Hardened Task Status Transitions (Section 16, 17, 18)
--    Enforces New Version Gate across both Internal QC & Client Revisions
-- ------------------------------------------------------------------------------
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
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    -- Find latest rejected version from INTERNAL_QC reviews
    SELECT MAX(pf.version) INTO v_internal_rev_version
    FROM public.qc_reviews qr
    JOIN public.project_files pf ON qr.file_id = pf.id
    WHERE qr.task_id = p_task_id AND qr.result = 'REVISION_REQUESTED';

    -- Find latest rejected version from CLIENT review items
    SELECT MAX(pf.version) INTO v_client_rev_version
    FROM public.client_review_items cri
    JOIN public.project_files pf ON cri.file_id = pf.id
    WHERE cri.task_id = p_task_id AND cri.verdict = 'REVISION_REQUESTED';

    -- Greatest rejected version across both internal and client reviews
    IF v_internal_rev_version IS NOT NULL AND v_client_rev_version IS NOT NULL THEN
      v_last_revised_version := GREATEST(v_internal_rev_version, v_client_rev_version);
    ELSIF v_internal_rev_version IS NOT NULL THEN
      v_last_revised_version := v_internal_rev_version;
    ELSE
      v_last_revised_version := v_client_rev_version;
    END IF;

    -- Gate: Must upload higher version than last rejected version
    IF v_last_revised_version IS NOT NULL AND v_latest_file.version <= v_last_revised_version THEN
      RAISE EXCEPTION 'Cannot submit task to review without uploading a new version addressing the requested revision (current: v%, reviewed: v%)', v_latest_file.version, v_last_revised_version;
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    -- Resolve all open/in-progress revision requests for this task atomically
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


-- ------------------------------------------------------------------------------
-- 5. RPC: start_client_review (Sections 5, 6, 7, 8, 9)
--    Atomically transitions INTERNAL_QC -> CLIENT_REVIEW and creates round 1
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION start_client_review(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
  v_total_qc_tasks integer;
  v_unapproved_count integer;
  v_unresolved_revs integer;
  v_active_pending_rounds integer;
  v_next_round integer;
  v_review_id uuid;
  v_missing_files_count integer;
  v_missing_qc_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row lock project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can start client review';
  END IF;

  -- Phase Check: Project must be in INTERNAL_QC
  IF v_project.status != 'INTERNAL_QC' THEN
    RAISE EXCEPTION 'Project must be in INTERNAL_QC phase to enter client review (current: %)', v_project.status;
  END IF;

  -- Section 5: At least one active QC-required production task exists
  SELECT COUNT(*) INTO v_total_qc_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL;

  IF v_total_qc_tasks = 0 THEN
    RAISE EXCEPTION 'Cannot start client review: project has no QC-evaluated production tasks';
  END IF;

  -- Section 5: Every active QC-required task must be APPROVED
  SELECT COUNT(*) INTO v_unapproved_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_count > 0 THEN
    RAISE EXCEPTION 'Cannot start client review: % task(s) are not yet internally APPROVED', v_unapproved_count;
  END IF;

  -- Section 5: Every task has a valid active approved deliverable with an APPROVED qc_review
  SELECT COUNT(*) INTO v_missing_files_count
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.project_files pf
      WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    );

  IF v_missing_files_count > 0 THEN
    RAISE EXCEPTION 'Cannot start client review: deliverable files missing for % approved task(s)', v_missing_files_count;
  END IF;

  -- Section 8: Each task latest file must have an APPROVED qc_review
  SELECT COUNT(*) INTO v_missing_qc_count
  FROM public.tasks t
  CROSS JOIN LATERAL (
    SELECT pf.id AS file_id FROM public.project_files pf
    WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    ORDER BY pf.version DESC LIMIT 1
  ) lf
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.qc_reviews qr
      WHERE qr.task_id = t.id AND qr.file_id = lf.file_id AND qr.result = 'APPROVED'
    );

  IF v_missing_qc_count > 0 THEN
    RAISE EXCEPTION 'Cannot start client review: % task deliverable(s) lack approved QC verdict binding', v_missing_qc_count;
  END IF;

  -- Section 5: No unresolved revision requests exist
  SELECT COUNT(*) INTO v_unresolved_revs
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_unresolved_revs > 0 THEN
    RAISE EXCEPTION 'Cannot start client review: % unresolved revision request(s) remain active', v_unresolved_revs;
  END IF;

  -- Section 9: Enforce at most one active (PENDING) round per project
  SELECT COUNT(*) INTO v_active_pending_rounds
  FROM public.client_reviews
  WHERE project_id = p_project_id AND overall_verdict = 'PENDING';

  IF v_active_pending_rounds > 0 THEN
    RAISE EXCEPTION 'Cannot start client review: an active client review round is already pending';
  END IF;

  -- Calculate next round number
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next_round
  FROM public.client_reviews
  WHERE project_id = p_project_id;

  -- Insert client_reviews header
  INSERT INTO public.client_reviews (
    project_id,
    submitted_by,
    round_number,
    overall_verdict,
    general_feedback,
    created_at
  ) VALUES (
    p_project_id,
    auth.uid(),
    v_next_round,
    'PENDING',
    NULL,
    now()
  ) RETURNING id INTO v_review_id;

  -- Transition project status: INTERNAL_QC -> CLIENT_REVIEW
  -- The existing trg_log_project_status_change trigger creates exactly one project_status_history row
  UPDATE public.projects
  SET status = 'CLIENT_REVIEW', updated_at = now()
  WHERE id = p_project_id;

  -- Log legitimate CLIENT_REVIEW_STARTED event
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, auth.uid(), 'CLIENT_REVIEW_STARTED',
    jsonb_build_object(
      'project_id', p_project_id,
      'round_number', v_next_round,
      'client_review_id', v_review_id,
      'total_tasks', v_total_qc_tasks
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_review_id', v_review_id,
    'round_number', v_next_round,
    'project_status', 'CLIENT_REVIEW'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_client_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_client_review(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 6. RPC: record_client_item_verdict (Sections 10, 11, 12, 13, 14, 15)
--    Records client verdict per task/artifact in active review round
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_client_item_verdict(
  p_review_id uuid,
  p_task_id uuid,
  p_verdict qc_verdict,
  p_feedback text DEFAULT ''
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_review record;
  v_project record;
  v_task record;
  v_file record;
  v_existing_item record;
  v_rev_round integer;
  v_rev_request_id uuid;
  v_active_qc_count integer;
  v_evaluated_count integer;
  v_has_revision boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Verify client_reviews header
  SELECT * INTO v_review
  FROM public.client_reviews
  WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client review session not found';
  END IF;

  IF v_review.overall_verdict != 'PENDING' THEN
    RAISE EXCEPTION 'Client review session round % is already finalized with verdict %', v_review.round_number, v_review.overall_verdict;
  END IF;

  -- Verify project and check ownership
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_review.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  IF v_project.status != 'CLIENT_REVIEW' THEN
    RAISE EXCEPTION 'Project must be in CLIENT_REVIEW phase to record client verdicts (current: %)', v_project.status;
  END IF;

  -- Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can record client feedback';
  END IF;

  -- Row-lock task to prevent concurrency anomalies
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND project_id = v_project.id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or does not belong to reviewed project';
  END IF;

  -- Section 29: Check if item already evaluated in this review round
  SELECT * INTO v_existing_item
  FROM public.client_review_items
  WHERE client_review_id = p_review_id AND task_id = p_task_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Verdict already recorded for task in this review round (verdict: %)', v_existing_item.verdict;
  END IF;

  -- Sections 3 & 4: Resolve exact latest deliverable file with an APPROVED internal QC review
  SELECT pf.* INTO v_file
  FROM public.project_files pf
  WHERE pf.task_id = p_task_id
    AND pf.project_id = v_project.id
    AND pf.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.qc_reviews qr
      WHERE qr.task_id = p_task_id
        AND qr.file_id = pf.id
        AND qr.result = 'APPROVED'
    )
  ORDER BY pf.version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot present or record client verdict on deliverable without internal QC approval';
  END IF;

  -- Section 15: One active revision per task invariant
  IF EXISTS (
    SELECT 1 FROM public.revision_requests
    WHERE task_id = p_task_id AND status IN ('OPEN', 'IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'Task already has an active unresolved revision request';
  END IF;

  -- Insert append-only client_review_items record
  INSERT INTO public.client_review_items (
    client_review_id,
    task_id,
    file_id,
    verdict,
    feedback_notes,
    created_at
  ) VALUES (
    p_review_id,
    p_task_id,
    v_file.id,
    p_verdict,
    COALESCE(trim(p_feedback), ''),
    now()
  );

  -- Branch: APPROVED vs REVISION_REQUESTED
  IF p_verdict = 'APPROVED' THEN
    -- Task remains APPROVED.
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_project.id, auth.uid(), 'CLIENT_APPROVED_ITEM',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'file_id', v_file.id,
        'version', v_file.version,
        'round_number', v_review.round_number
      )
    );

  ELSIF p_verdict = 'REVISION_REQUESTED' THEN
    IF p_feedback IS NULL OR trim(p_feedback) = '' THEN
      RAISE EXCEPTION 'Actionable client feedback notes are required when requesting revision';
    END IF;

    IF length(trim(p_feedback)) > 5000 THEN
      RAISE EXCEPTION 'Client feedback notes exceed maximum length of 5000 characters';
    END IF;

    -- Calculate next revision round for task
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_rev_round
    FROM public.revision_requests
    WHERE task_id = p_task_id;

    -- Section 13: Create revision_requests with source = 'CLIENT'
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
      v_project.id,
      p_task_id,
      v_task.current_assignee_id,
      NULL,
      auth.uid(),
      'CLIENT',
      v_rev_round,
      trim(p_feedback),
      'OPEN',
      now()
    ) RETURNING id INTO v_rev_request_id;

    -- Section 13: Task transitions APPROVED -> REVISION_REQUESTED
    UPDATE public.tasks
    SET status = 'REVISION_REQUESTED', updated_at = now()
    WHERE id = p_task_id;

    -- Log CLIENT_REVISION_REQUESTED event
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_project.id, auth.uid(), 'CLIENT_REVISION_REQUESTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'file_id', v_file.id,
        'version', v_file.version,
        'round_number', v_review.round_number,
        'revision_request_id', v_rev_request_id,
        'notes', trim(p_feedback)
      )
    );
  END IF;

  -- Check if all presented tasks in this review round have been evaluated
  SELECT COUNT(*) INTO v_active_qc_count
  FROM public.tasks
  WHERE project_id = v_project.id AND requires_qc = true AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_evaluated_count
  FROM public.client_review_items
  WHERE client_review_id = p_review_id;

  -- If every task has a recorded verdict in this round, finalize round overall_verdict
  IF v_evaluated_count >= v_active_qc_count THEN
    SELECT EXISTS (
      SELECT 1 FROM public.client_review_items
      WHERE client_review_id = p_review_id AND verdict = 'REVISION_REQUESTED'
    ) INTO v_has_revision;

    IF v_has_revision THEN
      UPDATE public.client_reviews
      SET overall_verdict = 'REVISION_REQUESTED', reviewed_at = now()
      WHERE id = p_review_id;
    ELSE
      UPDATE public.client_reviews
      SET overall_verdict = 'APPROVED', reviewed_at = now()
      WHERE id = p_review_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'verdict', p_verdict,
    'file_id', v_file.id,
    'version', v_file.version
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_client_item_verdict(uuid, uuid, qc_verdict, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_client_item_verdict(uuid, uuid, qc_verdict, text) TO authenticated;


-- ------------------------------------------------------------------------------
-- 7. RPC: start_client_re_presentation (Sections 22, 23, 56, 57)
--    Initiates subsequent client presentation round after CD re-QC approval
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION start_client_re_presentation(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
  v_total_qc_tasks integer;
  v_unapproved_count integer;
  v_unresolved_revs integer;
  v_active_pending_rounds integer;
  v_next_round integer;
  v_review_id uuid;
  v_missing_qc_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can re-present to client';
  END IF;

  IF v_project.status != 'CLIENT_REVIEW' THEN
    RAISE EXCEPTION 'Project must be in CLIENT_REVIEW phase to re-present (current: %)', v_project.status;
  END IF;

  -- Enforce at most one active (PENDING) round per project
  SELECT COUNT(*) INTO v_active_pending_rounds
  FROM public.client_reviews
  WHERE project_id = p_project_id AND overall_verdict = 'PENDING';

  IF v_active_pending_rounds > 0 THEN
    RAISE EXCEPTION 'Cannot start re-presentation: a client review round is already pending';
  END IF;

  -- Section 23: Re-presentation gate - Every active task MUST be internally APPROVED
  SELECT COUNT(*) INTO v_unapproved_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task(s) are not internally APPROVED (still undergoing revision or internal QC)', v_unapproved_count;
  END IF;

  -- Section 23: Each task latest file must have an APPROVED qc_review (Decision D-002)
  SELECT COUNT(*) INTO v_missing_qc_count
  FROM public.tasks t
  CROSS JOIN LATERAL (
    SELECT pf.id AS file_id FROM public.project_files pf
    WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    ORDER BY pf.version DESC LIMIT 1
  ) lf
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.qc_reviews qr
      WHERE qr.task_id = t.id AND qr.file_id = lf.file_id AND qr.result = 'APPROVED'
    );

  IF v_missing_qc_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task deliverable(s) lack approved QC verdict binding (mandatory re-QC per D-002)', v_missing_qc_count;
  END IF;

  -- No unresolved revision requests
  SELECT COUNT(*) INTO v_unresolved_revs
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_unresolved_revs > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % unresolved revision request(s) remain active', v_unresolved_revs;
  END IF;

  -- Calculate next round number
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next_round
  FROM public.client_reviews
  WHERE project_id = p_project_id;

  -- Insert next client_reviews header
  INSERT INTO public.client_reviews (
    project_id,
    submitted_by,
    round_number,
    overall_verdict,
    general_feedback,
    created_at
  ) VALUES (
    p_project_id,
    auth.uid(),
    v_next_round,
    'PENDING',
    NULL,
    now()
  ) RETURNING id INTO v_review_id;

  -- Log CLIENT_REVIEW_RESUBMITTED event
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, auth.uid(), 'CLIENT_REVIEW_RESUBMITTED',
    jsonb_build_object(
      'project_id', p_project_id,
      'round_number', v_next_round,
      'client_review_id', v_review_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_review_id', v_review_id,
    'round_number', v_next_round
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_client_re_presentation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_client_re_presentation(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 8. RPC: finalize_client_approval (Sections 25, 26, 27, 28, 30)
--    Atomically transitions CLIENT_REVIEW -> APPROVED when all artifacts approved
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_client_approval(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
  v_total_qc_tasks integer;
  v_unapproved_tasks integer;
  v_unapproved_client_items integer;
  v_active_revisions integer;
  v_pending_round_id uuid;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock project to serialize concurrent finalize attempts
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Concurrency check: If already APPROVED, no-op cleanly
  IF v_project.status = 'APPROVED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'APPROVED',
      'message', 'Project is already in APPROVED phase'
    );
  END IF;

  IF v_project.status != 'CLIENT_REVIEW' THEN
    RAISE EXCEPTION 'Project must be in CLIENT_REVIEW phase to finalize client approval (current: %)', v_project.status;
  END IF;

  -- Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can finalize client approval';
  END IF;

  -- Check active production tasks count
  SELECT COUNT(*) INTO v_total_qc_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL;

  IF v_total_qc_tasks = 0 THEN
    RAISE EXCEPTION 'Cannot finalize approval: project has no QC-evaluated production tasks';
  END IF;

  -- Section 26: Every active production task must be internally APPROVED
  SELECT COUNT(*) INTO v_unapproved_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_tasks > 0 THEN
    RAISE EXCEPTION 'Cannot finalize approval: % task(s) are not internally APPROVED', v_unapproved_tasks;
  END IF;

  -- Section 26: No active revision requests of ANY source
  SELECT COUNT(*) INTO v_active_revisions
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_active_revisions > 0 THEN
    RAISE EXCEPTION 'Cannot finalize approval: % revision request(s) remain active', v_active_revisions;
  END IF;

  -- Section 25: Deterministic Check:
  -- Every active QC-required task MUST have its latest active deliverable file approved by client
  SELECT COUNT(*) INTO v_unapproved_client_items
  FROM public.tasks t
  CROSS JOIN LATERAL (
    SELECT pf.id AS file_id FROM public.project_files pf
    WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    ORDER BY pf.version DESC LIMIT 1
  ) lf
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.client_review_items cri
      WHERE cri.task_id = t.id
        AND cri.file_id = lf.file_id
        AND cri.verdict = 'APPROVED'
    );

  IF v_unapproved_client_items > 0 THEN
    RAISE EXCEPTION 'Cannot finalize approval: % task(s) do not have client approval on their latest deliverable version', v_unapproved_client_items;
  END IF;

  -- Finalize any pending review round as APPROVED
  SELECT id INTO v_pending_round_id
  FROM public.client_reviews
  WHERE project_id = p_project_id AND overall_verdict = 'PENDING';

  IF v_pending_round_id IS NOT NULL THEN
    UPDATE public.client_reviews
    SET overall_verdict = 'APPROVED', reviewed_at = now()
    WHERE id = v_pending_round_id;
  END IF;

  -- Transition project status: CLIENT_REVIEW -> APPROVED
  -- Status change trigger automatically writes exactly one row in project_status_history
  UPDATE public.projects
  SET status = 'APPROVED', updated_at = now()
  WHERE id = p_project_id;

  -- Log CLIENT_APPROVED event
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, auth.uid(), 'CLIENT_APPROVED',
    jsonb_build_object(
      'project_id', p_project_id,
      'total_tasks_approved', v_total_qc_tasks,
      'approved_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'APPROVED',
    'project_id', p_project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION finalize_client_approval(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_client_approval(uuid) TO authenticated;


-- ------------------------------------------------------------------------------
-- 9. RPC: publish_project (Sections 41, 42, 43, 44, 45, 46, 47, 48)
--    Atomically transitions APPROVED -> PUBLISHED with validated publication URL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION publish_project(
  p_project_id uuid,
  p_publication_url text,
  p_publish_note text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
  v_unapproved_tasks integer;
  v_active_revisions integer;
  v_clean_url text;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Concurrency check: If already PUBLISHED, no-op cleanly
  IF v_project.status = 'PUBLISHED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'PUBLISHED',
      'message', 'Project is already published'
    );
  END IF;

  -- Section 42: Project status must be APPROVED
  IF v_project.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Project must be in APPROVED phase to be published (current: %)', v_project.status;
  END IF;

  -- Section 41: Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can publish project';
  END IF;

  -- Section 44: Publication URL Validation
  v_clean_url := trim(COALESCE(p_publication_url, ''));

  IF v_clean_url = '' THEN
    RAISE EXCEPTION 'Publication URL is required';
  END IF;

  IF NOT (v_clean_url ~* '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$') THEN
    RAISE EXCEPTION 'Invalid publication URL: must be a valid HTTP or HTTPS web address';
  END IF;

  IF v_clean_url ~* '^(javascript|data):' THEN
    RAISE EXCEPTION 'Invalid publication URL protocol';
  END IF;

  -- Invariant: No active revisions
  SELECT COUNT(*) INTO v_active_revisions
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_active_revisions > 0 THEN
    RAISE EXCEPTION 'Cannot publish project: % revision request(s) remain active', v_active_revisions;
  END IF;

  -- Invariant: No production tasks in non-APPROVED state
  SELECT COUNT(*) INTO v_unapproved_tasks
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_tasks > 0 THEN
    RAISE EXCEPTION 'Cannot publish project: % production task(s) are not in APPROVED state', v_unapproved_tasks;
  END IF;

  -- Update project to PUBLISHED
  -- Status change trigger automatically writes exactly one row in project_status_history
  UPDATE public.projects
  SET status = 'PUBLISHED',
      publication_url = v_clean_url,
      publish_note = NULLIF(trim(COALESCE(p_publish_note, '')), ''),
      published_at = now(),
      published_by = auth.uid(),
      updated_at = now()
  WHERE id = p_project_id;

  -- Log PROJECT_PUBLISHED event
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, auth.uid(), 'PROJECT_PUBLISHED',
    jsonb_build_object(
      'project_id', p_project_id,
      'publication_url', v_clean_url,
      'publish_note', p_publish_note,
      'published_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PUBLISHED',
    'publication_url', v_clean_url,
    'project_id', p_project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION publish_project(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_project(uuid, text, text) TO authenticated;


-- ------------------------------------------------------------------------------
-- 10. Project Mutation Boundaries Trigger Hardening (Section 46: Publication Immutability)
-- ------------------------------------------------------------------------------
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

  -- 6. Section 46: Publication Immutability
  -- Once published, publication fields and status cannot be arbitrarily mutated
  IF OLD.status = 'PUBLISHED' THEN
    IF NEW.status != 'PUBLISHED' THEN
      RAISE EXCEPTION 'Cannot revert or change status of a PUBLISHED project';
    END IF;
    IF NEW.publication_url IS DISTINCT FROM OLD.publication_url THEN
      RAISE EXCEPTION 'publication_url is immutable once project is published';
    END IF;
    IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'published_at timestamp is immutable';
    END IF;
    IF NEW.published_by IS DISTINCT FROM OLD.published_by THEN
      RAISE EXCEPTION 'published_by is immutable';
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


-- ------------------------------------------------------------------------------
-- 11. Activity Logs Anti-Forgery Trigger Hardening (Section 34)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_activity_logs_prevent_direct_forgery()
RETURNS trigger AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.event_type IN (
    'QC_APPROVED',
    'QC_REVISION_REQUESTED',
    'REVISION_STARTED',
    'TASK_RESUBMITTED_FOR_REVIEW',
    'INTERNAL_QC_STARTED',
    'INTERNAL_QC_COMPLETED',
    'CLIENT_REVIEW_STARTED',
    'CLIENT_APPROVED_ITEM',
    'CLIENT_REVISION_REQUESTED',
    'CLIENT_REVIEW_RESUBMITTED',
    'CLIENT_APPROVED',
    'PROJECT_PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'Direct insertion of protected activity events is forbidden. Use domain workflows.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_logs_forgery_guard ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_forgery_guard
BEFORE INSERT ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION trg_activity_logs_prevent_direct_forgery();


-- ------------------------------------------------------------------------------
-- 12. Immutability Policies for Direct Mutation Rejection
-- Routes all direct authenticated mutations to triggers to produce domain exceptions
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_reviews_insert" ON public.client_reviews;
CREATE POLICY "client_reviews_insert"
  ON public.client_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_reviews_update" ON public.client_reviews;
CREATE POLICY "client_reviews_update"
  ON public.client_reviews FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "client_reviews_delete" ON public.client_reviews;
CREATE POLICY "client_reviews_delete"
  ON public.client_reviews FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "client_review_items_insert" ON public.client_review_items;
CREATE POLICY "client_review_items_insert"
  ON public.client_review_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_review_items_update" ON public.client_review_items;
CREATE POLICY "client_review_items_update"
  ON public.client_review_items FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "client_review_items_delete" ON public.client_review_items;
CREATE POLICY "client_review_items_delete"
  ON public.client_review_items FOR DELETE
  TO authenticated
  USING (true);

