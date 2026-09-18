-- 08: Storage Buckets and Access Policies
-- Private buckets with UUID-based path authorization

-- Insert private storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('project-assets', 'project-assets', false, 524288000, NULL), -- 500MB limit
  ('project-deliverables', 'project-deliverables', false, 1073741824, NULL) -- 1GB limit
ON CONFLICT (id) DO UPDATE SET
  public = false;


-- 1. Read Policy: project-assets
CREATE POLICY "storage_assets_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-assets'
    AND is_active_user()
    AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(((storage.foldername(name))[1])::uuid)
    )
  );

-- 2. Read Policy: project-deliverables
CREATE POLICY "storage_deliverables_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-deliverables'
    AND is_active_user()
    AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(((storage.foldername(name))[1])::uuid)
    )
  );

-- 3. Write Policy: project-assets (Admin and Owning SMS only)
CREATE POLICY "storage_assets_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-assets'
    AND is_active_user()
    AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()
        )
      )
    )
  );

-- 4. Write Policy: project-deliverables (Admin, Owning SMS, and Active Assignee)
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
      )
    )
  );

-- 5. Delete Policy: project-deliverables (Draft soft-delete only, Admin or owning SMS)
CREATE POLICY "storage_deliverables_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    is_active_user()
    AND (
      auth_user_role() = 'ADMIN'
      OR (
        auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
        AND ((storage.foldername(name))[1])::uuid IN (
          SELECT id FROM public.projects WHERE sms_owner_id = auth.uid()
        )
      )
    )
  );
