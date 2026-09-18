-- ==============================================================================
-- LOCO TRACK: Task-Level Client Review and Independent Publication (Phase 13)
-- Enables per-task client review and independent publication for approved tasks,
-- removing the bottleneck where all tasks in a project had to wait for each other.
-- ==============================================================================

-- 1. Add publication tracking columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS publication_url text NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS published_at timestamptz NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS published_by uuid NULL REFERENCES public.profiles(id);

-- 2. RPC: record_task_client_verdict
-- Allows SMS or Admin to record client review verdict on any individual task
-- that has passed internal QC (APPROVED), without requiring the whole project to be in CLIENT_REVIEW.
CREATE OR REPLACE FUNCTION record_task_client_verdict(
  p_task_id uuid,
  p_verdict qc_verdict,
  p_feedback text DEFAULT ''
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_task record;
  v_project record;
  v_file record;
  v_review_id uuid;
  v_rev_round integer;
  v_active_round record;
  v_unresolved_revs integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock task to prevent race conditions
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  -- Verify project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_task.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Block on cancelled or completed projects
  IF v_project.status IN ('CANCELLED', 'DONE') THEN
    RAISE EXCEPTION 'Cannot record client review for cancelled or closed project';
  END IF;

  -- Authority: ADMIN or assigned project SMS owner
  IF NOT (
    v_caller_role = 'ADMIN' OR
    (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only ADMIN or assigned SMS owner can record client review';
  END IF;

  -- Task status check: must be internally APPROVED or COMPLETED
  IF v_task.status NOT IN ('APPROVED', 'COMPLETED') THEN
    RAISE EXCEPTION 'Task must be internally APPROVED before recording client verdict (current: %)', v_task.status;
  END IF;

  -- If task requires QC, verify approved QC review exists
  IF v_task.requires_qc IS TRUE THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.qc_reviews
      WHERE task_id = p_task_id AND result = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'Task does not have an approved internal QC review';
    END IF;
  END IF;

  -- Resolve latest deliverable file with an APPROVED internal QC review
  SELECT pf.* INTO v_file
  FROM public.project_files pf
  WHERE pf.task_id = p_task_id
    AND pf.deleted_at IS NULL
    AND (
      v_task.requires_qc IS NOT TRUE OR
      EXISTS (
        SELECT 1 FROM public.qc_reviews qr
        WHERE qr.task_id = p_task_id
          AND qr.file_id = pf.id
          AND qr.result = 'APPROVED'
      )
    )
  ORDER BY pf.version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot record client verdict: deliverable file not found';
  END IF;

  -- Check unresolved revision requests for this task
  SELECT COUNT(*) INTO v_unresolved_revs
  FROM public.revision_requests
  WHERE task_id = p_task_id AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_unresolved_revs > 0 THEN
    RAISE EXCEPTION 'Task already has an active unresolved revision request';
  END IF;

  -- Find or create client_reviews header for project
  SELECT * INTO v_active_round
  FROM public.client_reviews
  WHERE project_id = v_project.id AND overall_verdict = 'PENDING'
  ORDER BY round_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Create new round
    INSERT INTO public.client_reviews (
      project_id,
      submitted_by,
      round_number,
      overall_verdict,
      created_at
    ) VALUES (
      v_project.id,
      auth.uid(),
      COALESCE((SELECT MAX(round_number) FROM public.client_reviews WHERE project_id = v_project.id), 0) + 1,
      'PENDING',
      now()
    ) RETURNING id INTO v_review_id;
  ELSE
    v_review_id := v_active_round.id;
  END IF;

  -- Insert or update client_review_items for this task
  IF EXISTS (
    SELECT 1 FROM public.client_review_items
    WHERE client_review_id = v_review_id AND task_id = p_task_id
  ) THEN
    UPDATE public.client_review_items
    SET file_id = v_file.id,
        verdict = p_verdict,
        feedback_notes = COALESCE(trim(p_feedback), ''),
        created_at = now()
    WHERE client_review_id = v_review_id AND task_id = p_task_id;
  ELSE
    INSERT INTO public.client_review_items (
      client_review_id,
      task_id,
      file_id,
      verdict,
      feedback_notes,
      created_at
    ) VALUES (
      v_review_id,
      p_task_id,
      v_file.id,
      p_verdict,
      COALESCE(trim(p_feedback), ''),
      now()
    );
  END IF;

  -- Handle verdict branch
  IF p_verdict = 'APPROVED' THEN
    -- Task remains APPROVED
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_project.id, auth.uid(), 'CLIENT_APPROVED_ITEM',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'file_id', v_file.id,
        'version', v_file.version,
        'client_review_id', v_review_id
      )
    );

  ELSIF p_verdict = 'REVISION_REQUESTED' THEN
    IF p_feedback IS NULL OR trim(p_feedback) = '' THEN
      RAISE EXCEPTION 'Catatan feedback revisi klien wajib diisi';
    END IF;

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
    );

    -- Transition task to REVISION_REQUESTED
    UPDATE public.tasks
    SET status = 'REVISION_REQUESTED', updated_at = now()
    WHERE id = p_task_id;

    -- Log activity
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_project.id, auth.uid(), 'CLIENT_REVISION_REQUESTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'round_number', v_rev_round,
        'notes', trim(p_feedback)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'verdict', p_verdict,
    'client_review_id', v_review_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_task_client_verdict(uuid, qc_verdict, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_task_client_verdict(uuid, qc_verdict, text) TO authenticated;


-- 3. RPC: publish_task
-- Allows SMS or Admin to publish an individual client-approved task and record its live URL.
CREATE OR REPLACE FUNCTION publish_task(
  p_task_id uuid,
  p_publication_url text,
  p_publish_note text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_task record;
  v_project record;
  v_clean_url text;
  v_all_tasks_completed boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_clean_url := trim(p_publication_url);

  IF v_clean_url = '' OR v_clean_url IS NULL THEN
    RAISE EXCEPTION 'Tautan publikasi (URL) wajib diisi';
  END IF;

  -- Check URL format
  IF NOT (v_clean_url ~* '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$') THEN
    RAISE EXCEPTION 'Format tautan publikasi tidak valid. Harus diawali http:// atau https://';
  END IF;

  -- Row-lock task
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or archived';
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_task.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Authority: ADMIN or assigned project SMS owner
  IF NOT (
    v_caller_role = 'ADMIN' OR
    (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only ADMIN or assigned SMS owner can publish tasks';
  END IF;

  -- Verify task is APPROVED or COMPLETED
  IF v_task.status NOT IN ('APPROVED', 'COMPLETED') THEN
    RAISE EXCEPTION 'Task must be APPROVED before publication';
  END IF;

  -- Verify deliverable has received client approval
  IF NOT EXISTS (
    SELECT 1 FROM public.client_review_items cri
    WHERE cri.task_id = p_task_id AND cri.verdict = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Tugas belum mendapatkan persetujuan (APPROVED) dari klien';
  END IF;

  -- Update task to COMPLETED with publication URL
  UPDATE public.tasks
  SET status = 'COMPLETED',
      publication_url = v_clean_url,
      published_at = now(),
      published_by = auth.uid(),
      updated_at = now()
  WHERE id = p_task_id;

  -- Log TASK_PUBLISHED activity
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_project.id, auth.uid(), 'TASK_PUBLISHED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'publication_url', v_clean_url,
      'publish_note', trim(COALESCE(p_publish_note, ''))
    )
  );

  -- Check if all active tasks in this project are now COMPLETED
  SELECT (COUNT(*) = 0) INTO v_all_tasks_completed
  FROM public.tasks
  WHERE project_id = v_project.id
    AND deleted_at IS NULL
    AND status != 'COMPLETED';

  IF v_all_tasks_completed IS TRUE THEN
    UPDATE public.projects
    SET status = 'PUBLISHED',
        publication_url = COALESCE(publication_url, v_clean_url),
        published_at = COALESCE(published_at, now()),
        published_by = COALESCE(published_by, auth.uid()),
        updated_at = now()
    WHERE id = v_project.id;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_project.id, auth.uid(), 'PROJECT_PUBLISHED',
      jsonb_build_object(
        'project_id', v_project.id,
        'publication_url', v_clean_url,
        'triggered_by_task', p_task_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'status', 'COMPLETED',
    'publication_url', v_clean_url,
    'project_completed', v_all_tasks_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION publish_task(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_task(uuid, text, text) TO authenticated;
