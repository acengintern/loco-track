-- 07: Row Level Security Policies (All 18 Tables)
-- Strictly non-recursive via STABLE SECURITY DEFINER helper functions

-- Enable RLS across all 18 tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. profiles
CREATE POLICY "profiles_select_active"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_active_user());

CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_role() = 'ADMIN');

CREATE POLICY "profiles_update_self_or_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_active_user() AND (auth.uid() = id OR auth_user_role() = 'ADMIN'))
  WITH CHECK (is_active_user() AND (auth.uid() = id OR auth_user_role() = 'ADMIN'));

-- 2. clients
CREATE POLICY "clients_select"
  ON clients FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR id IN (
        SELECT b.client_id
        FROM brands b
        JOIN projects p ON b.id = p.brand_id
        WHERE is_project_member(p.id)
      )
    )
  );

CREATE POLICY "clients_insert"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'));

CREATE POLICY "clients_update"
  ON clients FOR UPDATE
  TO authenticated
  USING (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'))
  WITH CHECK (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'));

-- 3. brands
CREATE POLICY "brands_select"
  ON brands FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR id IN (
        SELECT p.brand_id
        FROM projects p
        WHERE is_project_member(p.id)
      )
    )
  );

CREATE POLICY "brands_insert"
  ON brands FOR INSERT
  TO authenticated
  WITH CHECK (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'));

CREATE POLICY "brands_update"
  ON brands FOR UPDATE
  TO authenticated
  USING (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'))
  WITH CHECK (is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST'));

-- 4. projects
CREATE POLICY "projects_select"
  ON projects FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(id)
      OR id IN (SELECT project_id FROM tasks WHERE current_assignee_id = auth.uid())
    )
  );

CREATE POLICY "projects_insert"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user()
    AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST')
    AND created_by = auth.uid()
  );

CREATE POLICY "projects_update"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND sms_owner_id = auth.uid())
    )
  )
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND sms_owner_id = auth.uid())
    )
  );

-- 5. project_members
CREATE POLICY "project_members_select"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "project_members_insert"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "project_members_delete"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

-- 6. tasks
CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
      OR current_assignee_id = auth.uid()
    )
  );

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      OR current_assignee_id = auth.uid()
    )
  )
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      OR current_assignee_id = auth.uid()
    )
  );

-- 7. task_assignments
CREATE POLICY "task_assignments_select"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR task_id IN (SELECT id FROM tasks WHERE is_project_member(project_id) OR current_assignee_id = auth.uid())
    )
  );

CREATE POLICY "task_assignments_insert"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND task_id IN (
        SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.sms_owner_id = auth.uid()
      ))
    )
  );

CREATE POLICY "task_assignments_update"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND task_id IN (
        SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.sms_owner_id = auth.uid()
      ))
    )
  );

-- 8. briefs
CREATE POLICY "briefs_select"
  ON briefs FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "briefs_insert"
  ON briefs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "briefs_update"
  ON briefs FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

-- 9. content_plans
CREATE POLICY "content_plans_select"
  ON content_plans FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "content_plans_insert"
  ON content_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "content_plans_update"
  ON content_plans FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

-- 10. scripts
CREATE POLICY "scripts_select"
  ON scripts FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "scripts_insert"
  ON scripts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "scripts_update"
  ON scripts FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

-- 11. project_files
CREATE POLICY "project_files_select"
  ON project_files FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "project_files_insert"
  ON project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      OR (task_id IN (SELECT id FROM tasks WHERE current_assignee_id = auth.uid()))
    )
  );

CREATE POLICY "project_files_update"
  ON project_files FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      OR (uploaded_by = auth.uid() AND task_id IN (SELECT id FROM tasks WHERE status = 'IN_PROGRESS'))
    )
  );

-- 12. qc_reviews (append-only)
CREATE POLICY "qc_reviews_select"
  ON qc_reviews FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "qc_reviews_insert"
  ON qc_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR')
  );

-- 13. revision_requests
CREATE POLICY "revision_requests_select"
  ON revision_requests FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "revision_requests_insert"
  ON revision_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      (source = 'INTERNAL_QC' AND auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR'))
      OR (source = 'CLIENT' AND (
        auth_user_role() = 'ADMIN'
        OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      ))
    )
  );

CREATE POLICY "revision_requests_update"
  ON revision_requests FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
      OR assigned_to = auth.uid()
    )
  );

-- 14. client_reviews
CREATE POLICY "client_reviews_select"
  ON client_reviews FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "client_reviews_insert"
  ON client_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

CREATE POLICY "client_reviews_update"
  ON client_reviews FOR UPDATE
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR (auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST' AND project_id IN (SELECT id FROM projects WHERE sms_owner_id = auth.uid()))
    )
  );

-- 15. client_review_items (append-only)
CREATE POLICY "client_review_items_select"
  ON client_review_items FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR client_review_id IN (SELECT cr.id FROM client_reviews cr WHERE is_project_member(cr.project_id))
    )
  );

CREATE POLICY "client_review_items_insert"
  ON client_review_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      auth_user_role() = 'ADMIN'
      OR client_review_id IN (
        SELECT cr.id FROM client_reviews cr
        JOIN projects p ON cr.project_id = p.id
        WHERE p.sms_owner_id = auth.uid() AND auth_user_role() = 'SOCIAL_MEDIA_SPECIALIST'
      )
    )
  );

-- 16. project_status_history (append-only)
CREATE POLICY "project_status_history_select"
  ON project_status_history FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "project_status_history_insert"
  ON project_status_history FOR INSERT
  TO authenticated
  WITH CHECK (is_active_user());

-- 17. activity_logs (append-only)
CREATE POLICY "activity_logs_select"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    is_active_user() AND (
      auth_user_role() IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
      OR is_project_member(project_id)
    )
  );

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND auth_user_role() IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST', 'CREATIVE_DIRECTOR', 'GRAPHIC_DESIGNER', 'VIDEO_EDITOR')
  );

-- 18. notifications (strictly self-scoped)
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (is_active_user() AND user_id = auth.uid());

CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (is_active_user() AND user_id = auth.uid())
  WITH CHECK (is_active_user() AND user_id = auth.uid());

CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (is_active_user() AND user_id = auth.uid());
