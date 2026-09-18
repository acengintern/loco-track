-- 19: Phase 8.1 Final Storage & Deliverable Integrity Audit Hardening
-- Hardens Storage DELETE policies against committed object bypass,
-- blocks soft-deleted file downloads at the Storage layer, enforces
-- review freeze on storage writes for all roles, ensures the last-deliverable
-- invariant during IN_REVIEW, and guarantees project_files metadata immutability.

-- 1. Helper Functions to Check Committed Deliverable State (Security Definer)
CREATE OR REPLACE FUNCTION is_committed_deliverable(p_storage_path text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_files
    WHERE storage_path = p_storage_path
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_active_committed_deliverable(p_storage_path text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_files
    WHERE storage_path = p_storage_path
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION is_committed_deliverable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_committed_deliverable(text) TO authenticated;

REVOKE ALL ON FUNCTION is_active_committed_deliverable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_active_committed_deliverable(text) TO authenticated;


-- 2. Storage DELETE Policy Hardening (Compensation vs Committed Protection)
-- Direct Storage DELETE is strictly prohibited for any object that has a committed project_files row.
-- Only uncommitted orphaned binaries may be deleted by the uploader (active assignee), owning SMS, or Admin.
DROP POLICY IF EXISTS "storage_deliverables_delete" ON storage.objects;
CREATE POLICY "storage_deliverables_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    -- Direct delete is strictly forbidden if a project_files record exists
    AND NOT is_committed_deliverable(name)
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
        AND ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND status = 'IN_PROGRESS'
            AND deleted_at IS NULL
        )
      )
    )
  );


-- 3. Storage SELECT Policy Hardening (Soft-Deleted File Read Block)
-- Objects are only readable if they have an active (non-deleted) committed metadata row,
-- or if the object is uncommitted and read by its uploader during the upload transaction.
DROP POLICY IF EXISTS "storage_deliverables_read" ON storage.objects;
CREATE POLICY "storage_deliverables_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    AND (
      -- Committed active deliverables
      (
        is_active_committed_deliverable(name)
        AND (
          auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE')
          OR (
            auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
            AND ((storage.foldername(name))[1])::uuid IN (
              SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()
            )
          )
          OR (
            ((storage.foldername(name))[2])::uuid IN (
              SELECT id FROM public.tasks WHERE current_assignee_id = auth.uid()
            )
          )
          OR is_project_member(((storage.foldername(name))[1])::uuid)
        )
      )
      OR (
        -- Uncommitted temporary upload read by its uploader
        owner = auth.uid()
        AND NOT is_committed_deliverable(name)
      )
    )
  );


-- 4. Storage INSERT Policy Hardening (Review Freeze Enforced for All Roles)
-- Direct Storage write requires target task to be in IN_PROGRESS and unarchived.
DROP POLICY IF EXISTS "storage_deliverables_write" ON storage.objects;
CREATE POLICY "storage_deliverables_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    -- Freezes uploads in IN_REVIEW for all roles including Admin
    AND ((storage.foldername(name))[2])::uuid IN (
      SELECT id FROM public.tasks
      WHERE status = 'IN_PROGRESS'
        AND deleted_at IS NULL
    )
    AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid() AND deleted_at IS NULL
        )
      )
      OR (
        ((storage.foldername(name))[2])::uuid IN (
          SELECT id FROM public.tasks
          WHERE current_assignee_id = auth.uid()
            AND project_id = ((storage.foldername(name))[1])::uuid
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


-- 5. Hardened soft_delete_project_file RPC (IN_REVIEW Last-Deliverable Invariant)
CREATE OR REPLACE FUNCTION soft_delete_project_file(
  p_file_id uuid
) RETURNS void AS $$
DECLARE
  v_file record;
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_active_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_file FROM public.project_files WHERE id = p_file_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found or already deleted';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = v_file.task_id;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_file.project_id;

  -- Enforce review invariants when task is in IN_REVIEW
  IF v_task.status = 'IN_REVIEW' THEN
    IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
      RAISE EXCEPTION 'Cannot delete deliverable file after submission to review';
    END IF;

    -- Admin or SMS owner can only delete if at least one other active deliverable remains on the task
    SELECT COUNT(*) INTO v_active_count
    FROM public.project_files
    WHERE task_id = v_file.task_id
      AND deleted_at IS NULL
      AND id != p_file_id;

    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'Cannot delete the only remaining deliverable file while task is in review';
    END IF;
  END IF;

  -- Authorization check outside of review
  IF v_caller_role = 'ADMIN' THEN
    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE THEN
    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  IF v_file.uploaded_by = auth.uid() THEN
    IF v_task.status != 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'Cannot delete deliverable file after submission to review';
    END IF;

    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
    INSERT INTO public.activity_logs (project_id, user_id, event_type, metadata)
    VALUES (v_file.project_id, auth.uid(), 'DELIVERABLE_DELETED', jsonb_build_object('file_id', p_file_id, 'task_id', v_file.task_id, 'version', v_file.version));
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unauthorized to delete this file';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 6. project_files Metadata Immutability Trigger
CREATE OR REPLACE FUNCTION trg_prevent_project_files_metadata_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != OLD.id
     OR NEW.project_id != OLD.project_id
     OR NEW.task_id != OLD.task_id
     OR NEW.asset_group_id != OLD.asset_group_id
     OR NEW.version != OLD.version
     OR NEW.storage_bucket != OLD.storage_bucket
     OR NEW.storage_path != OLD.storage_path
     OR NEW.uploaded_by != OLD.uploaded_by
     OR NEW.created_at != OLD.created_at
     OR (NEW.file_name IS DISTINCT FROM OLD.file_name)
     OR (NEW.file_type IS DISTINCT FROM OLD.file_type)
     OR (NEW.mime_type IS DISTINCT FROM OLD.mime_type)
     OR (NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes)
  THEN
    RAISE EXCEPTION 'project_files metadata is immutable. Only deleted_at lifecycle mutation is permitted via soft_delete_project_file() RPC.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_files_metadata_immutability ON public.project_files;
CREATE TRIGGER trg_project_files_metadata_immutability
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_project_files_metadata_mutation();

-- Re-enable project_files_update policy so that update attempts trigger the immutability guard
DROP POLICY IF EXISTS "project_files_update" ON public.project_files;
CREATE POLICY "project_files_update"
  ON public.project_files FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()))
      OR (uploaded_by = auth.uid())
    )
  );
