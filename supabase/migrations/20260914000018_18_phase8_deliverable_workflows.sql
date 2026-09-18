-- 18: Phase 8 Deliverable Files, Asset Lineage & Versioning Workflows
-- Enforces one-task-one-asset-group, sequential versioning, upload freezing,
-- transition logging, physical delete prevention, and storage hardening.

-- 1. Physical DELETE Prevention Trigger on project_files
-- Physical deletion of project_files metadata is strictly forbidden in standard workflows.
CREATE OR REPLACE FUNCTION trg_prevent_project_files_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Physical DELETE on project_files is strictly forbidden. Use soft_delete_project_file() RPC.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_files_no_physical_delete ON public.project_files;
CREATE TRIGGER trg_project_files_no_physical_delete
  BEFORE DELETE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_project_files_physical_delete();


-- 2. Concurrency-Safe Deliverable Upload Allocation RPC
-- Locks the task, validates permissions and status, derives next version, and returns canonical storage path.
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
  v_is_sms_owner boolean;
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

  -- Freeze check: uploads are blocked while task is in review
  IF v_task.status = 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Uploads are frozen while task is in review';
  END IF;

  IF v_task.status NOT IN ('IN_PROGRESS', 'REVISION_REQUESTED') THEN
    RAISE EXCEPTION 'Task must be IN_PROGRESS to upload deliverables (current: %)', v_task.status;
  END IF;

  -- Task-based authorization (Decision P-03):
  -- Only Admin, project SMS owner, or the active task assignee can upload deliverables
  v_caller_role := auth_user_role();
  v_is_sms_owner := (v_project.sms_owner_id = auth.uid());
  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) AND NOT v_is_assignee THEN
    RAISE EXCEPTION 'Unauthorized: caller is not authorized to upload deliverables for this task';
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

  -- Sequential version allocation across all records in asset group (soft-deleted versions still consume their version number)
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
    'project_id', v_project.id,
    'task_id', v_task.id,
    'asset_group_id', v_asset_group_id,
    'version', v_next_version,
    'storage_bucket', 'project-deliverables',
    'storage_path', v_storage_path,
    'file_name', p_file_name,
    'sanitized_name', v_sanitized_name,
    'file_type', p_file_type,
    'mime_type', p_mime_type,
    'file_size_bytes', p_file_size_bytes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION allocate_deliverable_upload(uuid, text, text, bigint, file_category) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION allocate_deliverable_upload(uuid, text, text, bigint, file_category) TO authenticated;


-- 3. Commit Deliverable File Metadata RPC
-- Validates that the uploaded file matches the allocated canonical path and registers it in public.project_files.
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
  v_is_sms_owner boolean;
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

  IF v_task.status = 'IN_REVIEW' THEN
    RAISE EXCEPTION 'Uploads are frozen while task is in review';
  END IF;

  IF v_task.status NOT IN ('IN_PROGRESS', 'REVISION_REQUESTED') THEN
    RAISE EXCEPTION 'Task must be IN_PROGRESS to commit deliverables (current: %)', v_task.status;
  END IF;

  -- Authorization check
  v_caller_role := auth_user_role();
  v_is_sms_owner := (v_project.sms_owner_id = auth.uid());
  v_is_assignee := (v_task.current_assignee_id = auth.uid());

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) AND NOT v_is_assignee THEN
    RAISE EXCEPTION 'Unauthorized: caller is not authorized to commit deliverables for this task';
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

  -- Log activity
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project.id,
    auth.uid(),
    CASE WHEN p_version = 1 THEN 'DELIVERABLE_UPLOADED' ELSE 'DELIVERABLE_VERSION_UPLOADED' END,
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'file_id', p_file_id,
      'file_name', p_file_name,
      'version', p_version,
      'asset_group_id', p_asset_group_id
    )
  );

  RETURN p_file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION commit_deliverable_file(uuid, uuid, uuid, integer, text, text, file_category, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commit_deliverable_file(uuid, uuid, uuid, integer, text, text, file_category, text, bigint) TO authenticated;


-- 4. Hardened soft_delete_project_file RPC
-- Enforces soft-delete rules: Admin can soft-delete any; owning SMS can soft-delete project files;
-- uploader can soft-delete ONLY while task is in IN_PROGRESS. Once in IN_REVIEW, uploader cannot delete.
CREATE OR REPLACE FUNCTION soft_delete_project_file(
  p_file_id uuid
) RETURNS void AS $$
DECLARE
  v_file record;
  v_task_status task_status;
  v_caller_role user_role;
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

  IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_file.project_id AND sms_owner_id = auth.uid()
  ) THEN
    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  -- Creative uploader check
  IF v_file.uploaded_by = auth.uid() THEN
    IF v_file.task_id IS NOT NULL THEN
      SELECT status INTO v_task_status FROM public.tasks WHERE id = v_file.task_id;
      IF v_task_status != 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Cannot delete deliverable file after submission to review';
      END IF;
    END IF;

    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unauthorized to delete this file';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION soft_delete_project_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_project_file(uuid) TO authenticated;


-- 5. Hardened transition_task_status RPC
-- Unlocks IN_PROGRESS -> IN_REVIEW transition ONLY when >= 1 non-deleted deliverable exists on task.
-- Logs TASK_SUBMITTED_FOR_REVIEW upon successful transition.
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

  -- State machine enforcement
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
    -- Verify non-deleted deliverable file has been uploaded (prerequisite for review entry)
    SELECT EXISTS (
      SELECT 1 FROM public.project_files
      WHERE task_id = p_task_id AND deleted_at IS NULL
    ) INTO v_has_deliverable;

    IF NOT v_has_deliverable THEN
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'TASK_SUBMITTED_FOR_REVIEW',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'from_status', 'IN_PROGRESS',
        'to_status', 'IN_REVIEW'
      )
    );
    RETURN;
  ELSIF v_task.status = 'REVISION_REQUESTED' AND p_new_status = 'IN_PROGRESS' THEN
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;

    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      v_task.project_id, auth.uid(), 'TASK_STARTED',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_title', v_task.title,
        'from_status', 'REVISION_REQUESTED',
        'to_status', 'IN_PROGRESS'
      )
    );
    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;


-- 6. Storage RLS Policy Hardening for project-deliverables
-- Enforces upload freeze in IN_REVIEW, task-based authorization, and compensation deletion.
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
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid() AND deleted_at IS NULL
        )
        AND ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks WHERE status = 'IN_PROGRESS' AND deleted_at IS NULL
        )
      )
      OR (
        ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND project_id = ((storage.foldername(name))[1])::uuid
            AND status = 'IN_PROGRESS'
            AND deleted_at IS NULL
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
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()
        )
      )
      OR (
        owner = auth.uid()
      )
    )
  );

-- 7. RLS Policy Hardening on public.project_files for INSERT
DROP POLICY IF EXISTS "project_files_insert" ON public.project_files;
CREATE POLICY "project_files_insert"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND project_id IN (SELECT id FROM public.projects WHERE sms_owner_id = auth.uid() AND deleted_at IS NULL)
        AND task_id IN (SELECT id FROM public.tasks WHERE status = 'IN_PROGRESS' AND deleted_at IS NULL)
      )
      OR (
        task_id IN (SELECT id FROM public.tasks WHERE current_assignee_id = auth.uid() AND status = 'IN_PROGRESS' AND deleted_at IS NULL)
      )
    )
  );
