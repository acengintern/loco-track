-- ==============================================================================
-- LOCO TRACK: Deliverable Authority Hardening (Phase 12.3)
-- Hardens deliverable upload, commit, delete, and review submission.
-- Strictly restricts creative deliverable mutations to active assigned creatives
-- (GRAPHIC_DESIGNER or VIDEO_EDITOR).
-- Restricts SOCIAL_MEDIA_SPECIALIST to read/monitoring access only.
-- ==============================================================================

-- 1. Hardened allocate_deliverable_upload RPC
CREATE OR REPLACE FUNCTION allocate_deliverable_upload(
  p_task_id uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_file_type file_category
) RETURNS jsonb AS $$
DECLARE
  v_task record;
  v_project record;
  v_caller_role user_role;
  v_is_assignee boolean;
  v_asset_group_id uuid;
  v_next_version integer;
  v_file_id uuid;
  v_sanitized_name text;
  v_storage_path text;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  -- Lock task row to serialize concurrent uploads to the same task
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

  -- Check project status: blocked on terminal projects
  IF v_project.status IN ('PUBLISHED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'Upload deliverable dibekukan untuk project yang telah selesai atau dibatalkan.';
  END IF;

  -- Freeze check: uploads are blocked while task is in review
  IF v_task.status = 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Uploads are frozen while task is in review';
  END IF;

  IF v_task.status NOT IN ('IN_PROGRESS', 'REVISION_REQUESTED') THEN
    RAISE EXCEPTION 'Task must be IN_PROGRESS to upload deliverables (current: %)', v_task.status;
  END IF;

  v_caller_role := auth_user_role();
  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  -- Strict Creative Authority: Only active assigned creative or admin can allocate
  IF NOT ((v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) OR v_caller_role = 'ADMIN') THEN
    RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat mengunggah deliverable tugas ini.';
  END IF;

  -- One-task-one-asset-group: look up existing asset group for this task (including soft-deleted)
  SELECT asset_group_id INTO v_asset_group_id
  FROM public.project_files
  WHERE task_id = p_task_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_asset_group_id IS NULL THEN
    v_asset_group_id := gen_random_uuid();
  END IF;

  -- Sequential version allocation across all records in asset group
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.project_files
  WHERE asset_group_id = v_asset_group_id;

  v_file_id := gen_random_uuid();

  -- Sanitize filename: strip directory traversal paths and extract basename
  v_sanitized_name := regexp_replace(p_file_name, '^.*[/\\\\]', '');
  v_sanitized_name := regexp_replace(v_sanitized_name, '[^a-zA-Z0-9._-]', '_', 'g');
  v_sanitized_name := regexp_replace(v_sanitized_name, '\.+', '.', 'g');
  v_sanitized_name := regexp_replace(v_sanitized_name, '^[\._-]+', '');
  IF length(v_sanitized_name) = 0 THEN
    v_sanitized_name := 'deliverable';
  END IF;

  -- Canonical storage path: {project_id}/{task_id}/{asset_group_id}/v{version}/{file_id}_{sanitized_filename}
  v_storage_path := v_project.id || '/' || v_task.id || '/' || v_asset_group_id || '/v' || v_next_version || '/' || v_file_id || '_' || v_sanitized_name;

  RETURN jsonb_build_object(
    'file_id', v_file_id,
    'task_id', p_task_id,
    'asset_group_id', v_asset_group_id,
    'version', v_next_version,
    'storage_bucket', 'project-deliverables',
    'storage_path', v_storage_path,
    'file_name', v_sanitized_name,
    'file_type', p_file_type,
    'mime_type', p_mime_type,
    'file_size_bytes', p_file_size_bytes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION allocate_deliverable_upload(uuid, text, text, bigint, file_category) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION allocate_deliverable_upload(uuid, text, text, bigint, file_category) TO authenticated;


-- 2. Hardened commit_deliverable_file RPC
CREATE OR REPLACE FUNCTION commit_deliverable_file(
  p_file_id uuid,
  p_task_id uuid,
  p_asset_group_id uuid,
  p_version integer,
  p_storage_path text,
  p_file_name text,
  p_file_type file_category,
  p_mime_type text,
  p_file_size_bytes bigint
) RETURNS uuid AS $$
DECLARE
  v_task record;
  v_project record;
  v_caller_role user_role;
  v_is_assignee boolean;
  v_existing_group uuid;
  v_expected_version integer;
  v_expected_prefix text;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  -- Lock task
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

  IF v_project.status IN ('PUBLISHED', 'DONE', 'CANCELLED') THEN
    RAISE EXCEPTION 'Pencatatan deliverable dibekukan untuk project yang telah selesai atau dibatalkan.';
  END IF;

  IF v_task.status = 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Uploads are frozen while task is in review';
  END IF;

  IF v_task.status NOT IN ('IN_PROGRESS', 'REVISION_REQUESTED') THEN
    RAISE EXCEPTION 'Task must be IN_PROGRESS to commit deliverables (current: %)', v_task.status;
  END IF;

  v_caller_role := auth_user_role();
  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  -- Strict Creative Authority: Only active assigned creative or admin can commit
  IF NOT ((v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) OR v_caller_role = 'ADMIN') THEN
    RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat mencatat file deliverable tugas ini.';
  END IF;

  -- Validate asset group
  SELECT asset_group_id INTO v_existing_group
  FROM public.project_files
  WHERE task_id = p_task_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_group IS NOT NULL AND v_existing_group != p_asset_group_id THEN
    RAISE EXCEPTION 'Mismatched asset_group_id: task % is locked to asset group %', p_task_id, v_existing_group;
  END IF;

  -- Validate version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_expected_version
  FROM public.project_files
  WHERE asset_group_id = p_asset_group_id;

  IF p_version != v_expected_version THEN
    RAISE EXCEPTION 'Version conflict: expected version %, got %', v_expected_version, p_version;
  END IF;

  -- Validate canonical storage path prefix
  v_expected_prefix := v_project.id || '/' || v_task.id || '/' || p_asset_group_id || '/v' || p_version || '/';
  IF NOT p_storage_path LIKE (v_expected_prefix || '%') THEN
    RAISE EXCEPTION 'Invalid storage path: does not conform to canonical path hierarchy %', v_expected_prefix;
  END IF;

  -- Insert metadata into public.project_files
  INSERT INTO public.project_files (
    id,
    project_id,
    task_id,
    asset_group_id,
    version,
    storage_bucket,
    storage_path,
    file_name,
    file_type,
    mime_type,
    file_size_bytes,
    uploaded_by
  ) VALUES (
    p_file_id,
    v_project.id,
    p_task_id,
    p_asset_group_id,
    p_version,
    'project-deliverables',
    p_storage_path,
    p_file_name,
    p_file_type,
    p_mime_type,
    p_file_size_bytes,
    auth.uid()
  );

  -- Record audit log
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project.id,
    auth.uid(),
    'DELIVERABLE_UPLOADED',
    jsonb_build_object(
      'file_id', p_file_id,
      'task_id', p_task_id,
      'asset_group_id', p_asset_group_id,
      'version', p_version,
      'file_name', p_file_name,
      'file_size_bytes', p_file_size_bytes
    )
  );

  RETURN p_file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION commit_deliverable_file(uuid, uuid, uuid, integer, text, text, file_category, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commit_deliverable_file(uuid, uuid, uuid, integer, text, text, file_category, text, bigint) TO authenticated;


-- 3. Hardened soft_delete_project_file RPC
-- Admin can soft-delete any for governance.
-- Active assigned creative can soft-delete their own file ONLY while task is in IN_PROGRESS.
-- SMS cannot delete committed creative deliverables.
CREATE OR REPLACE FUNCTION soft_delete_project_file(
  p_file_id uuid
) RETURNS void AS $$
DECLARE
  v_file record;
  v_task record;
  v_caller_role user_role;
  v_is_assignee boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_file FROM public.project_files WHERE id = p_file_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found or already deleted';
  END IF;

  v_caller_role := auth_user_role();

  IF v_caller_role = 'ADMIN' THEN
    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  -- Creative uploader check: must be the active assignee and role must be creative
  IF v_file.uploaded_by = auth.uid() AND v_file.task_id IS NOT NULL THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = v_file.task_id AND deleted_at IS NULL;
    IF FOUND THEN
      v_is_assignee := (v_task.current_assignee_id = auth.uid());
      IF NOT (v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) THEN
        RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat menghapus file deliverable ini.';
      END IF;
      IF v_task.status != 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Tidak dapat menghapus file deliverable setelah tugas diajukan untuk review.';
      END IF;

      UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
      INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
      VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
      RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Unauthorized to delete this file';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION soft_delete_project_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_project_file(uuid) TO authenticated;


-- 4. Hardened transition_task_status for IN_REVIEW submission
-- Transition to IN_REVIEW must be strictly restricted to the assigned creative.
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
  v_internal_rev_version integer;
  v_client_rev_version integer;
  v_event_type text;
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
  WHERE id = v_task.project_id AND deleted_at IS NULL;

  -- Authorization Check: Only assignee, SMS owner, or ADMIN can transition status
  IF NOT (v_is_assignee OR v_is_owner OR v_caller_role = 'ADMIN') THEN
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

  -- 3. IN_PROGRESS -> IN_REVIEW: Strictly restricted to assigned creative PIC
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
    IF NOT (v_is_assignee AND v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')) THEN
      RAISE EXCEPTION 'Hanya PIC kreatif yang ditugaskan yang dapat mengajukan deliverable untuk review QC.';
    END IF;

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

    IF v_last_revised_version IS NOT NULL AND v_latest_file.version <= v_last_revised_version THEN
      RAISE EXCEPTION 'Cannot submit task to review without uploading a new version addressing the requested revision (current: v%, reviewed: v%)',
        v_latest_file.version, v_last_revised_version;
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    -- Close revision requests as RESOLVED
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


-- 5. Storage RLS Policies Hardening for project-deliverables
-- Removes SOCIAL_MEDIA_SPECIALIST write/delete access.
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
        auth_user_role() IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')
        AND ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND project_id = ((storage.foldername(name))[1])::uuid
            AND status = 'IN_PROGRESS'
            AND deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "storage_deliverables_delete" ON storage.objects;
CREATE POLICY "storage_deliverables_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')
        AND owner = auth.uid()
        AND ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND status = 'IN_PROGRESS'
            AND deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "project_files_insert" ON public.project_files;
CREATE POLICY "project_files_insert"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR')
        AND task_id IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND status = 'IN_PROGRESS'
            AND deleted_at IS NULL
        )
      )
    )
  );
