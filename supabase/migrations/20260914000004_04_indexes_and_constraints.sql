-- 04: Indexes and Partial Constraints
-- Single active assignment constraint and query performance indexes

-- Exactly one active assignment per task
CREATE UNIQUE INDEX idx_task_assignments_one_active
  ON task_assignments (task_id)
  WHERE ended_at IS NULL;

-- Clients & Brands
CREATE INDEX idx_clients_is_active ON clients (is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_brands_client_id ON brands (client_id) WHERE deleted_at IS NULL;

-- Projects
CREATE INDEX idx_projects_status ON projects (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deadline ON projects (deadline) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_sms_owner ON projects (sms_owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_brand_id ON projects (brand_id) WHERE deleted_at IS NULL;

-- Project Members
CREATE INDEX idx_project_members_user_id ON project_members (user_id);
CREATE INDEX idx_project_members_project_id ON project_members (project_id);

-- Tasks
CREATE INDEX idx_tasks_project_id ON tasks (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON tasks (current_assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status ON tasks (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_deadline ON tasks (deadline) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_requires_qc ON tasks (requires_qc) WHERE deleted_at IS NULL;

-- Task Assignments
CREATE INDEX idx_task_assignments_assignee_id ON task_assignments (assignee_id);
CREATE INDEX idx_task_assignments_task_id ON task_assignments (task_id);

-- Briefs, Plans, Scripts
CREATE INDEX idx_content_plans_project_id ON content_plans (project_id);
CREATE INDEX idx_scripts_project_id ON scripts (project_id);

-- Project Files
CREATE INDEX idx_project_files_project_id ON project_files (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_files_task_id ON project_files (task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_files_asset_group ON project_files (asset_group_id);

-- QC Reviews
CREATE INDEX idx_qc_reviews_project_id ON qc_reviews (project_id);
CREATE INDEX idx_qc_reviews_task_id ON qc_reviews (task_id);
CREATE INDEX idx_qc_reviews_file_id ON qc_reviews (file_id);

-- Revision Requests
CREATE INDEX idx_revision_requests_project_id ON revision_requests (project_id);
CREATE INDEX idx_revision_requests_task_id ON revision_requests (task_id);
CREATE INDEX idx_revision_requests_assigned_to ON revision_requests (assigned_to);
CREATE INDEX idx_revision_requests_status ON revision_requests (status);

-- Client Reviews & Items
CREATE INDEX idx_client_reviews_project_id ON client_reviews (project_id);
CREATE INDEX idx_client_review_items_review_id ON client_review_items (client_review_id);
CREATE INDEX idx_client_review_items_task_id ON client_review_items (task_id);

-- Status History & Activity Logs
CREATE INDEX idx_project_status_history_project_id ON project_status_history (project_id);
CREATE INDEX idx_activity_logs_project_id ON activity_logs (project_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;
