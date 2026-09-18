
-- ==========================================
-- FILE: 20260914000001_01_enums_and_extensions.sql
-- ==========================================
-- 01: Enums, Extensions, and Core Sequences
-- LOCO TRACK Database Infrastructure

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Invariant agency operational roles
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'CREATIVE_DIRECTOR',
  'ACCOUNT_EXECUTIVE',
  'SOCIAL_MEDIA_SPECIALIST',
  'GRAPHIC_DESIGNER',
  'VIDEO_EDITOR'
);

-- Macro project lifecycle phase
CREATE TYPE project_phase AS ENUM (
  'BRIEF_RECEIVED',
  'CONTENT_PLANNING',
  'SCRIPT_READY',
  'PRODUCTION',
  'INTERNAL_QC',
  'CLIENT_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'DONE',
  'CANCELLED'
);

-- Operational task discipline classification
CREATE TYPE task_type AS ENUM (
  'CONTENT_PLAN',
  'SCRIPT',
  'GRAPHIC_DESIGN',
  'VIDEO_EDITING',
  'PUBLISHING',
  'OTHER'
);

-- Task state machine statuses
CREATE TYPE task_status AS ENUM (
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'REVISION_REQUESTED',
  'APPROVED',
  'COMPLETED'
);

-- Urgency and scheduling priority
CREATE TYPE priority_level AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- File category taxonomy
CREATE TYPE file_category AS ENUM (
  'BRIEF',
  'REFERENCE',
  'RAW_FOOTAGE',
  'AUDIO',
  'DESIGN',
  'VIDEO',
  'DOCUMENT'
);

-- QC review and deliverable verdict
CREATE TYPE qc_verdict AS ENUM (
  'APPROVED',
  'REVISION_REQUESTED'
);

-- Revision origin classification
CREATE TYPE revision_source AS ENUM (
  'INTERNAL_QC',
  'CLIENT'
);

-- Revision iteration status
CREATE TYPE revision_status AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED'
);

-- Client review session outcome
CREATE TYPE client_review_verdict AS ENUM (
  'PENDING',
  'APPROVED',
  'REVISION_REQUESTED'
);

-- Concurrency-safe project code counter
CREATE SEQUENCE IF NOT EXISTS project_code_seq START WITH 1 INCREMENT BY 1;


-- ==========================================
-- FILE: 20260914000002_02_core_tables.sql
-- ==========================================
-- 02: Core Organizational Tables
-- profiles, clients, brands, projects, project_members

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'GRAPHIC_DESIGNER',
  avatar_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text NULL,
  contact_email text NULL,
  contact_phone text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status project_phase NOT NULL DEFAULT 'BRIEF_RECEIVED',
  sms_owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  deadline timestamptz NOT NULL,
  published_at timestamptz NULL,
  published_by uuid NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  publication_url text NULL,
  publish_note text NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
);


-- ==========================================
-- FILE: 20260914000003_03_workflow_tables.sql
-- ==========================================
-- 03: Workflow and Production Tables
-- content_plans, scripts, tasks, task_assignments, briefs, project_files,
-- qc_reviews, revision_requests, client_reviews, client_review_items,
-- project_status_history, activity_logs, notifications

CREATE TABLE content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  channel text NOT NULL,
  planned_post_date date NOT NULL,
  pillar text NULL,
  copy_draft text NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_plan_id uuid NULL REFERENCES content_plans(id) ON DELETE SET NULL,
  title text NOT NULL,
  hook text NOT NULL,
  body text NOT NULL,
  visual_cues text NOT NULL,
  call_to_action text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_plan_id uuid NULL REFERENCES content_plans(id) ON DELETE SET NULL,
  script_id uuid NULL REFERENCES scripts(id) ON DELETE SET NULL,
  title text NOT NULL,
  task_type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'TODO',
  requires_qc boolean NOT NULL DEFAULT false,
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  current_assignee_id uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  deadline timestamptz NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL
);

CREATE TABLE briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  objective text NOT NULL,
  target_audience text NOT NULL,
  key_message text NOT NULL,
  deliverables_summary text NOT NULL,
  reference_links text NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NULL REFERENCES tasks(id) ON DELETE SET NULL,
  asset_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_type file_category NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT uq_project_files_asset_version UNIQUE (asset_group_id, version)
);

CREATE TABLE qc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES project_files(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  result qc_verdict NOT NULL,
  notes text NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qc_reviews_task_round UNIQUE (task_id, round_number)
);

CREATE TABLE revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  qc_review_id uuid NULL REFERENCES qc_reviews(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source revision_source NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  notes text NOT NULL,
  status revision_status NOT NULL DEFAULT 'OPEN',
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  round_number integer NOT NULL DEFAULT 1,
  overall_verdict client_review_verdict NOT NULL DEFAULT 'PENDING',
  general_feedback text NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_reviews_project_round UNIQUE (project_id, round_number)
);

CREATE TABLE client_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_review_id uuid NOT NULL REFERENCES client_reviews(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES project_files(id) ON DELETE RESTRICT,
  verdict qc_verdict NOT NULL,
  feedback_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_review_items_review_task UNIQUE (client_review_id, task_id)
);

CREATE TABLE project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status project_phase NOT NULL,
  to_status project_phase NOT NULL,
  changed_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link_url text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ==========================================
-- FILE: 20260914000004_04_indexes_and_constraints.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000005_05_helper_functions.sql
-- ==========================================
-- 05: Hardened Helper Functions
-- Bypasses recursive RLS lookups safely using STABLE SECURITY DEFINER

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Restrict public execute privileges
REVOKE ALL ON FUNCTION auth_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_project_member(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_member(uuid) TO authenticated;


-- ==========================================
-- FILE: 20260914000006_06_integrity_triggers.sql
-- ==========================================
-- 06: Cross-Entity Integrity, Immutability, and Automated Triggers

-- 1. Profile Privilege Escalation Defense
CREATE OR REPLACE FUNCTION trg_check_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    IF auth_user_role() != 'ADMIN' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: only administrators can modify user role or active status';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_profiles_privilege_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_profile_privilege_escalation();

-- 2. Task Deadline Constraint (task.deadline <= project.deadline)
CREATE OR REPLACE FUNCTION trg_check_task_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_project_deadline timestamptz;
BEGIN
  SELECT deadline INTO v_project_deadline
  FROM projects
  WHERE id = NEW.project_id;

  IF v_project_deadline IS NOT NULL AND NEW.deadline > v_project_deadline THEN
    RAISE EXCEPTION 'Task deadline (%) cannot exceed project deadline (%)', NEW.deadline, v_project_deadline;
  END IF;

  -- Validate linked content_plan project match
  IF NEW.content_plan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM content_plans WHERE id = NEW.content_plan_id AND project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Linked content plan does not belong to the same project';
    END IF;
  END IF;

  -- Validate linked script project match
  IF NEW.script_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM scripts WHERE id = NEW.script_id AND project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Linked script does not belong to the same project';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_tasks_deadline_guard
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_task_deadline();

-- 3. One Task = One Logical Deliverable (Asset Group Consistency)
CREATE OR REPLACE FUNCTION trg_check_asset_group_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_group uuid;
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    -- Check if this task already has an established asset group
    SELECT asset_group_id INTO v_existing_group
    FROM project_files
    WHERE task_id = NEW.task_id
    LIMIT 1;

    IF v_existing_group IS NOT NULL AND NEW.asset_group_id != v_existing_group THEN
      RAISE EXCEPTION 'Mismatched asset_group_id: task % is locked to asset group %', NEW.task_id, v_existing_group;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_project_files_asset_group_guard
  BEFORE INSERT ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_asset_group_consistency();

-- 4. QC Review Integrity
CREATE OR REPLACE FUNCTION trg_check_qc_review_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_file_task_id uuid;
  v_task_project_id uuid;
BEGIN
  SELECT task_id INTO v_file_task_id
  FROM project_files
  WHERE id = NEW.file_id;

  IF v_file_task_id IS NULL OR v_file_task_id != NEW.task_id THEN
    RAISE EXCEPTION 'QC review file (%) does not belong to evaluated task (%)', NEW.file_id, NEW.task_id;
  END IF;

  SELECT project_id INTO v_task_project_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF v_task_project_id IS NULL OR v_task_project_id != NEW.project_id THEN
    RAISE EXCEPTION 'QC review project (%) does not match task project (%)', NEW.project_id, v_task_project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_qc_reviews_integrity_guard
  BEFORE INSERT ON qc_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_qc_review_integrity();

-- 5. Client Review Item Integrity
CREATE OR REPLACE FUNCTION trg_check_client_review_item_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_file_task_id uuid;
  v_review_project_id uuid;
  v_task_project_id uuid;
BEGIN
  SELECT task_id INTO v_file_task_id
  FROM project_files
  WHERE id = NEW.file_id;

  IF v_file_task_id IS NULL OR v_file_task_id != NEW.task_id THEN
    RAISE EXCEPTION 'Client review file (%) does not belong to evaluated task (%)', NEW.file_id, NEW.task_id;
  END IF;

  SELECT project_id INTO v_review_project_id
  FROM client_reviews
  WHERE id = NEW.client_review_id;

  SELECT project_id INTO v_task_project_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF v_task_project_id != v_review_project_id THEN
    RAISE EXCEPTION 'Task project does not match client review project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_client_review_items_integrity_guard
  BEFORE INSERT ON client_review_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_client_review_item_integrity();

-- 6. Revision Request Integrity
CREATE OR REPLACE FUNCTION trg_check_revision_request_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_task_project_id uuid;
BEGIN
  SELECT project_id INTO v_task_project_id
  FROM tasks
  WHERE id = NEW.task_id;

  IF v_task_project_id IS NULL OR v_task_project_id != NEW.project_id THEN
    RAISE EXCEPTION 'Revision request project (%) does not match task project (%)', NEW.project_id, v_task_project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_revision_requests_integrity_guard
  BEFORE INSERT ON revision_requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_revision_request_integrity();

-- 7. Task Assignment Active User Invariant
CREATE OR REPLACE FUNCTION trg_check_assignment_active_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_active boolean;
BEGIN
  SELECT is_active INTO v_is_active
  FROM profiles
  WHERE id = NEW.assignee_id;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot assign task to inactive user (%)', NEW.assignee_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_task_assignments_active_guard
  BEFORE INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_assignment_active_user();

-- 8. Strict Immutability for Audit Entities
CREATE OR REPLACE FUNCTION trg_block_mutation_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operation denied: table % is strict append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qc_reviews_immutable
  BEFORE UPDATE OR DELETE ON qc_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_append_only();

CREATE TRIGGER trg_client_review_items_immutable
  BEFORE UPDATE OR DELETE ON client_review_items
  FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_append_only();

CREATE TRIGGER trg_project_status_history_immutable
  BEFORE UPDATE OR DELETE ON project_status_history
  FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_append_only();

CREATE TRIGGER trg_activity_logs_immutable
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_append_only();

-- 9. Automated Project Status History Logging
CREATE OR REPLACE FUNCTION trg_log_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_status_history (
      project_id,
      from_status,
      to_status,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      'Automated transition capture'
    );
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_projects_status_history_logger
  AFTER UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_log_project_status_change();

-- 10. Content Lock in Production (T-004)
CREATE OR REPLACE FUNCTION trg_check_content_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_project_status project_phase;
BEGIN
  SELECT status INTO v_project_status
  FROM projects
  WHERE id = NEW.project_id;

  IF v_project_status IN ('PRODUCTION', 'INTERNAL_QC', 'CLIENT_REVIEW', 'APPROVED', 'PUBLISHED', 'DONE') THEN
    IF auth_user_role() != 'ADMIN' AND auth_user_role() != 'SOCIAL_MEDIA_SPECIALIST' THEN
      RAISE EXCEPTION 'Content is locked during % phase', v_project_status;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_briefs_content_lock
  BEFORE UPDATE ON briefs
  FOR EACH ROW EXECUTE FUNCTION trg_check_content_lock();

CREATE TRIGGER trg_content_plans_content_lock
  BEFORE UPDATE ON content_plans
  FOR EACH ROW EXECUTE FUNCTION trg_check_content_lock();

CREATE TRIGGER trg_scripts_content_lock
  BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION trg_check_content_lock();

-- 11. Brand Deletion Guard (T-003)
CREATE OR REPLACE FUNCTION trg_check_brand_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM projects WHERE brand_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot delete brand %: active or historical projects exist', NEW.code;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_brands_deletion_guard
  BEFORE UPDATE OF deleted_at ON brands
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_brand_deletion();


-- ==========================================
-- FILE: 20260914000007_07_row_level_security.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000008_08_storage_buckets_and_policies.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000009_09_rpcs.sql
-- ==========================================
-- 09: Controlled Application Domain RPCs
-- Hardened SECURITY DEFINER functions with safe search_path and parameter validation

-- 1. Canonical Notification Creation (T-002)
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_user_id uuid,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
  v_recipient_active boolean;
BEGIN
  -- Verify caller is authenticated and active
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  -- Validate recipient existence and active status
  SELECT is_active INTO v_recipient_active
  FROM public.profiles
  WHERE id = p_recipient_user_id;

  IF v_recipient_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot dispatch notification to inactive user';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url,
    is_read
  ) VALUES (
    p_recipient_user_id,
    p_title,
    p_message,
    p_link_url,
    false
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_notification(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text) TO authenticated;

-- 2. Controlled Task Status Transition
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id uuid,
  p_new_status task_status
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_has_deliverable boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_caller_role := auth_user_role();

  -- Admin and owning SMS have broad management rights
  IF v_caller_role = 'ADMIN' OR (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND EXISTS (
      SELECT 1 FROM public.projects WHERE id = v_task.project_id AND sms_owner_id = auth.uid()
    )
  ) THEN
    UPDATE public.tasks
    SET status = p_new_status, updated_at = now()
    WHERE id = p_task_id;
    RETURN;
  END IF;

  -- Active creative assignee transitions
  IF v_task.current_assignee_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user is not assigned to this task';
  END IF;

  -- Creative assignee permitted paths
  IF v_task.status = 'TODO' AND p_new_status = 'IN_PROGRESS' THEN
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
    -- Verify deliverable file has been uploaded
    SELECT EXISTS (
      SELECT 1 FROM public.project_files
      WHERE task_id = p_task_id AND deleted_at IS NULL
    ) INTO v_has_deliverable;

    IF NOT v_has_deliverable THEN
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;
  ELSIF v_task.status = 'REVISION_REQUESTED' AND p_new_status = 'IN_PROGRESS' THEN
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to % for task assignee', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;

-- 3. Controlled Project File Soft Delete
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
    RETURN;
  END IF;

  IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_file.project_id AND sms_owner_id = auth.uid()
  ) THEN
    UPDATE public.project_files SET deleted_at = now() WHERE id = p_file_id;
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
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unauthorized to delete this file';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION soft_delete_project_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_project_file(uuid) TO authenticated;

-- 4. Controlled Revision Request Resolution
CREATE OR REPLACE FUNCTION resolve_revision_request(
  p_revision_id uuid
) RETURNS void AS $$
DECLARE
  v_rev record;
  v_caller_role user_role;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_rev FROM public.revision_requests WHERE id = p_revision_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision request not found';
  END IF;

  v_caller_role := auth_user_role();

  IF v_caller_role = 'ADMIN' OR v_rev.assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_rev.project_id AND sms_owner_id = auth.uid()
  ) THEN
    UPDATE public.revision_requests
    SET status = 'RESOLVED', resolved_at = now()
    WHERE id = p_revision_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized to resolve this revision request';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION resolve_revision_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_revision_request(uuid) TO authenticated;

-- 5. Mark Notification Read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id uuid
) RETURNS void AS $$
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid) TO authenticated;

-- 6. Atomic Project Code Generation (T-001)
CREATE OR REPLACE FUNCTION generate_project_code(
  p_brand_id uuid
) RETURNS text AS $$
DECLARE
  v_brand_code text;
  v_year text;
  v_seq integer;
BEGIN
  SELECT code INTO v_brand_code FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  v_year := TO_CHAR(now(), 'YYYY');
  v_seq := nextval('project_code_seq');

  RETURN v_brand_code || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_project_code(uuid) TO authenticated;


-- ==========================================
-- FILE: 20260914000010_10_security_hardening.sql
-- ==========================================
-- 10: Security Hardening, Anti-Forgery, Self-Approval Defense, and Atomicity
-- Hardened triggers, RLS policies, and atomic RPCs

-- 1. Anti-Self-Approval & Governance Guard on Tasks
CREATE OR REPLACE FUNCTION trg_check_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_has_deliverable boolean;
BEGIN
  -- Allow background/system/seed operations without auth context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project SMS ownership
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

    -- Creative assignee checks
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

    -- Anyone else is rejected
    RAISE EXCEPTION 'Unauthorized to modify task status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_status_transition_guard ON tasks;
CREATE TRIGGER trg_tasks_status_transition_guard
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_task_status_transition();


-- 2. Atomic Task Reassignment RPC
CREATE OR REPLACE FUNCTION reassign_task(
  p_task_id uuid,
  p_new_assignee_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
  v_new_assignee_active boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can reassign tasks';
  END IF;

  -- Validate new assignee exists and is active
  SELECT is_active INTO v_new_assignee_active
  FROM public.profiles
  WHERE id = p_new_assignee_id;

  IF v_new_assignee_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot assign task to inactive user';
  END IF;

  -- 1. End previous active assignment
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- 2. Insert new active assignment
  INSERT INTO public.task_assignments (
    task_id,
    assignee_id,
    assigned_by,
    assigned_at
  ) VALUES (
    p_task_id,
    p_new_assignee_id,
    auth.uid(),
    now()
  );

  -- 3. Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


-- 3. Brand Soft-Delete Admin-Only Check (T-003)
CREATE OR REPLACE FUNCTION trg_check_brand_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth_user_role() != 'ADMIN' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: only administrators can soft-delete brands (T-003)';
    END IF;
    IF EXISTS (SELECT 1 FROM projects WHERE brand_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot delete brand %: active or historical projects exist', NEW.code;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 4. Content Lock Enforcement in Production (T-004)
CREATE OR REPLACE FUNCTION trg_check_content_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_project_status project_phase;
BEGIN
  -- Background/seed operations bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if running within approved exceptional revision context
  IF current_setting('loco.exceptional_revision', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_project_status
  FROM projects
  WHERE id = NEW.project_id;

  IF v_project_status IN ('PRODUCTION', 'INTERNAL_QC', 'CLIENT_REVIEW', 'APPROVED', 'PUBLISHED', 'DONE') THEN
    IF auth_user_role() != 'ADMIN' THEN
      RAISE EXCEPTION 'Content is locked during % phase (T-004)', v_project_status;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Exceptional In-Flight Content Revision RPC (T-004)
CREATE OR REPLACE FUNCTION exceptional_content_update(
  p_entity_type text,
  p_entity_id uuid,
  p_patch jsonb,
  p_reason text
) RETURNS void AS $$
DECLARE
  v_project_id uuid;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A non-empty revision reason is required for exceptional in-flight updates';
  END IF;

  v_caller_role := auth_user_role();

  IF p_entity_type = 'brief' THEN
    SELECT project_id INTO v_project_id FROM public.briefs WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    SELECT project_id INTO v_project_id FROM public.content_plans WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    SELECT project_id INTO v_project_id FROM public.scripts WHERE id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Entity not found';
  END IF;

  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can perform exceptional content revisions';
  END IF;

  -- Set transaction-local override for content lock trigger
  PERFORM set_config('loco.exceptional_revision', 'on', true);

  IF p_entity_type = 'brief' THEN
    UPDATE public.briefs
    SET 
      objective = COALESCE(p_patch->>'objective', objective),
      target_audience = COALESCE(p_patch->>'target_audience', target_audience),
      key_message = COALESCE(p_patch->>'key_message', key_message),
      deliverables_summary = COALESCE(p_patch->>'deliverables_summary', deliverables_summary),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    UPDATE public.content_plans
    SET 
      post_title = COALESCE(p_patch->>'post_title', post_title),
      copywriting_draft = COALESCE(p_patch->>'copywriting_draft', copywriting_draft),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    UPDATE public.scripts
    SET 
      scene_breakdown = COALESCE(p_patch->>'scene_breakdown', scene_breakdown),
      visual_cues = COALESCE(p_patch->>'visual_cues', visual_cues),
      voiceover_text = COALESCE(p_patch->>'voiceover_text', voiceover_text),
      updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  -- Record audit event in activity_logs
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project_id,
    auth.uid(),
    'EXCEPTIONAL_CONTENT_REVISION',
    jsonb_build_object(
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'reason', p_reason
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) TO authenticated;


-- 6. Activity Log Anti-Forgery Defense
-- Normal authenticated roles cannot directly insert arbitrary audit logs
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND auth_user_role() = 'ADMIN'
  );


-- 7. Notification RPC Anti-Spam / Anti-Forgery
-- Arbitrary notification creation is restricted to administrators
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_user_id uuid,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
  v_recipient_active boolean;
  v_caller_role user_role;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  IF v_caller_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: arbitrary notification creation is restricted to administrators';
  END IF;

  SELECT is_active INTO v_recipient_active
  FROM public.profiles
  WHERE id = p_recipient_user_id;

  IF v_recipient_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot dispatch notification to inactive user';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url,
    is_read
  ) VALUES (
    p_recipient_user_id,
    p_title,
    p_message,
    p_link_url,
    false
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 8. Automated Domain Event Notifications (Legitimate Event Dispatch)
CREATE OR REPLACE FUNCTION trg_notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title text;
  v_project_id uuid;
BEGIN
  SELECT title, project_id INTO v_task_title, v_project_id
  FROM public.tasks
  WHERE id = NEW.task_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url
  ) VALUES (
    NEW.assignee_id,
    'New Task Assigned',
    'You have been assigned to task: ' || COALESCE(v_task_title, 'Untitled'),
    '/projects/' || v_project_id::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_task_assignments_notifier ON task_assignments;
CREATE TRIGGER trg_task_assignments_notifier
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_on_task_assignment();


-- 9. Cross-Entity Task and Project Matching for Project Files
CREATE OR REPLACE FUNCTION trg_check_project_file_task_match()
RETURNS TRIGGER AS $$
DECLARE
  v_task_project_id uuid;
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT project_id INTO v_task_project_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    IF v_task_project_id IS NULL OR v_task_project_id != NEW.project_id THEN
      RAISE EXCEPTION 'Project file project (%) does not match task project (%)', NEW.project_id, v_task_project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_project_files_task_match_guard ON project_files;
CREATE TRIGGER trg_project_files_task_match_guard
  BEFORE INSERT OR UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_project_file_task_match();


-- 10. Storage Policy Hardening: Asset Group ID & Task Verification
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


-- ==========================================
-- FILE: 20260914000011_11_phase5_fields.sql
-- ==========================================
-- 11: Phase 5 Schema Alignment with DATABASE.md
-- Adds description to clients & brands, and description, priority, start_date, name to projects.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS description text NULL;

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS description text NULL;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description text NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority priority_level NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE;

-- Synchronize name and title on projects for seamless backward compatibility
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name text NULL;
UPDATE public.projects SET name = title WHERE name IS NULL;
ALTER TABLE public.projects ALTER COLUMN name SET NOT NULL;

CREATE OR REPLACE FUNCTION trg_sync_project_name_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL AND (NEW.title IS NULL OR NEW.name IS DISTINCT FROM OLD.name) THEN
    NEW.title := NEW.name;
  ELSIF NEW.title IS NOT NULL AND (NEW.name IS NULL OR NEW.title IS DISTINCT FROM OLD.title) THEN
    NEW.name := NEW.title;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_name_title_sync ON public.projects;
CREATE TRIGGER trg_projects_name_title_sync
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_project_name_title();


-- ==========================================
-- FILE: 20260914000012_12_log_activity_rpc.sql
-- ==========================================
-- 12: Controlled Activity Logging RPC
-- Provides secure, tamper-proof activity logging for authenticated users with project access

CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  -- Ensure caller has access to the project
  IF auth_user_role() NOT IN ('ADMIN', 'CREATIVE_DIRECTOR', 'ACCOUNT_EXECUTIVE', 'SOCIAL_MEDIA_SPECIALIST')
     AND NOT is_project_member(p_project_id) THEN
    RAISE EXCEPTION 'Unauthorized: caller has no access to project %', p_project_id;
  END IF;

  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_event_type,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION log_project_activity(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_project_activity(uuid, text, jsonb) TO authenticated;


-- ==========================================
-- FILE: 20260914000013_13_client_brand_archive_guard.sql
-- ==========================================
-- 13: Client and Brand Archive Guard
-- Enforces Section 36: Only administrators may soft-delete / archive clients and brands

CREATE OR REPLACE FUNCTION trg_check_client_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth_user_role() != 'ADMIN' THEN
      RAISE EXCEPTION 'Unauthorized: only administrators can archive clients';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_clients_deletion_guard ON clients;
CREATE TRIGGER trg_clients_deletion_guard
  BEFORE UPDATE OF deleted_at ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_client_deletion();

-- Hardening Brand Archive Guard to also enforce Admin-only
CREATE OR REPLACE FUNCTION trg_check_brand_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth_user_role() != 'ADMIN' THEN
      RAISE EXCEPTION 'Unauthorized: only administrators can archive brands';
    END IF;
    IF EXISTS (SELECT 1 FROM projects WHERE brand_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot delete brand %: active or historical projects exist', NEW.code;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- ==========================================
-- FILE: 20260914000014_14_phase5_audit_hardening.sql
-- ==========================================
-- 14: Phase 5.1 Final Core Consistency and Security Hardening
-- 1. Canonical projects.name (drop title and sync trigger)
-- 2. Atomic create_project RPC
-- 3. Hardened log_project_activity RPC (anti-forgery, strict whitelist)
-- 4. Project mutation boundaries trigger
-- 5. Project member removal active-task guard trigger

-- -------------------------------------------------------------
-- 1. Canonical projects.name
-- -------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_projects_name_title_sync ON public.projects;
DROP FUNCTION IF EXISTS trg_sync_project_name_title();

-- Ensure all rows have name populated from title if any is null
UPDATE public.projects SET name = title WHERE name IS NULL;

-- Drop title column so projects.name is the ONLY canonical project name field
ALTER TABLE public.projects DROP COLUMN IF EXISTS title;
ALTER TABLE public.projects ALTER COLUMN name SET NOT NULL;


-- -------------------------------------------------------------
-- 1b. Resilient generate_project_code (T-001 collision-free)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_project_code(
  p_brand_id uuid
) RETURNS text AS $$
DECLARE
  v_brand_code text;
  v_year text;
  v_seq integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  SELECT code INTO v_brand_code FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  v_year := TO_CHAR(now(), 'YYYY');

  LOOP
    v_seq := nextval('project_code_seq');
    v_candidate := v_brand_code || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE project_code = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_project_code(uuid) TO authenticated;


-- -------------------------------------------------------------
-- 2. Atomic create_project RPC (Section 5 & 6)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_project(
  p_brand_id uuid,
  p_name text,
  p_description text,
  p_priority priority_level,
  p_start_date date,
  p_deadline timestamptz,
  p_sms_owner_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_sms_owner_id uuid;
  v_sms_active boolean;
  v_sms_role user_role;
  v_project_code text;
  v_project_id uuid;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  -- Rule: Only ADMIN and SOCIAL_MEDIA_SPECIALIST can create projects (D-001)
  IF v_caller_role NOT IN ('ADMIN', 'SOCIAL_MEDIA_SPECIALIST') THEN
    RAISE EXCEPTION 'Unauthorized: only ADMIN and SOCIAL_MEDIA_SPECIALIST can create projects';
  END IF;

  -- Section 6: SMS OWNER RULE
  IF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' THEN
    -- SMS must be self; cannot create on behalf of another SMS
    IF p_sms_owner_id IS NOT NULL AND p_sms_owner_id != v_caller_id THEN
      RAISE EXCEPTION 'Unauthorized: SOCIAL_MEDIA_SPECIALIST cannot assign project to another user';
    END IF;
    v_sms_owner_id := v_caller_id;
  ELSE
    -- ADMIN may select SMS owner, must be active SOCIAL_MEDIA_SPECIALIST
    IF p_sms_owner_id IS NULL THEN
      RAISE EXCEPTION 'Invalid request: ADMIN must designate an SMS owner';
    END IF;
    
    SELECT role, is_active INTO v_sms_role, v_sms_active
    FROM public.profiles
    WHERE id = p_sms_owner_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Designated SMS owner not found';
    END IF;

    IF v_sms_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Designated SMS owner is inactive';
    END IF;

    IF v_sms_role != 'SOCIAL_MEDIA_SPECIALIST' THEN
      RAISE EXCEPTION 'Designated owner must have role SOCIAL_MEDIA_SPECIALIST, found %', v_sms_role;
    END IF;

    v_sms_owner_id := p_sms_owner_id;
  END IF;

  -- Verify brand exists and is not deleted
  IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Invalid brand: brand does not exist or is archived';
  END IF;

  -- Generate atomic project code
  v_project_code := generate_project_code(p_brand_id);

  -- 1. Insert Project Row
  INSERT INTO public.projects (
    project_code,
    brand_id,
    name,
    description,
    status,
    priority,
    start_date,
    deadline,
    sms_owner_id,
    created_by
  ) VALUES (
    v_project_code,
    p_brand_id,
    p_name,
    p_description,
    'BRIEF_RECEIVED',
    p_priority,
    p_start_date,
    p_deadline,
    v_sms_owner_id,
    v_caller_id
  ) RETURNING id INTO v_project_id;

  -- 2. Insert SMS owner into project_members
  INSERT INTO public.project_members (
    project_id,
    user_id
  ) VALUES (
    v_project_id,
    v_sms_owner_id
  );

  -- If Admin created and assigned someone else, also register Admin as member
  IF v_caller_role = 'ADMIN' AND v_caller_id != v_sms_owner_id THEN
    INSERT INTO public.project_members (
      project_id,
      user_id
    ) VALUES (
      v_project_id,
      v_caller_id
    );
  END IF;

  -- 3. Atomic Activity Log Record
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project_id,
    v_caller_id,
    'PROJECT_CREATED',
    jsonb_build_object(
      'project_code', v_project_code,
      'name', p_name,
      'priority', p_priority,
      'sms_owner_id', v_sms_owner_id
    )
  );

  RETURN jsonb_build_object(
    'id', v_project_id,
    'project_code', v_project_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_project(uuid, text, text, priority_level, date, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_project(uuid, text, text, priority_level, date, timestamptz, uuid) TO authenticated;


-- -------------------------------------------------------------
-- 3. Hardened log_project_activity RPC (Section 4)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_caller_role user_role;
  v_is_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project exists and check owner
  SELECT (sms_owner_id = auth.uid()) INTO v_is_owner
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Strictly reject arbitrary or unauthorized events
  -- Read-only roles (AE, CD) and creative roles (Designer, Editor) cannot log project management events
  IF v_caller_role = 'ADMIN' THEN
    IF p_event_type NOT IN ('PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED') THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSIF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner THEN
    IF p_event_type NOT IN ('PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED') THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have permission to record project activity logs';
  END IF;

  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_event_type,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION log_project_activity(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_project_activity(uuid, text, jsonb) TO authenticated;


-- -------------------------------------------------------------
-- 4. Project Mutation Boundaries Trigger (Section 8)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_protect_project_mutation_boundaries()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := auth_user_role();

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_projects_mutation_boundaries ON public.projects;
CREATE TRIGGER trg_projects_mutation_boundaries
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_protect_project_mutation_boundaries();


-- -------------------------------------------------------------
-- 5. Membership Integrity Active Task Guard (Section 7)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_check_project_member_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent removing a member if they have active uncompleted tasks in the project
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE project_id = OLD.project_id
      AND current_assignee_id = OLD.user_id
      AND status NOT IN ('APPROVED', 'COMPLETED')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot remove member: user is currently assigned to active tasks in this project. Reassign tasks first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_project_members_removal_guard ON public.project_members;
CREATE TRIGGER trg_project_members_removal_guard
  BEFORE DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_project_member_removal();


-- ==========================================
-- FILE: 20260914000015_15_phase6_planning_workflows.sql
-- ==========================================
-- 15: Phase 6 Brief, Content Plan & Script Workflows
-- 1. Add script_not_required column to projects
-- 2. Update mutation boundaries trigger for script_not_required
-- 3. Controlled transition_project_phase RPC
-- 4. Controlled set_project_script_not_required RPC
-- 5. Updated log_project_activity whitelist with planning events
-- 6. Updated exceptional_content_update RPC column mapping

-- -------------------------------------------------------------
-- 1. Add script_not_required column to projects
-- -------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS script_not_required boolean NOT NULL DEFAULT false;

-- -------------------------------------------------------------
-- 2. Update Mutation Boundaries Trigger (projects)
-- -------------------------------------------------------------
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- -------------------------------------------------------------
-- 3. Controlled Phase Transition RPC (Section 24, 25, 27)
-- -------------------------------------------------------------
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

  -- Role boundary: only ADMIN or project's SMS owner can transition planning phases
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

    -- Audit Activity Log
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
    -- 1. Brief must exist
    SELECT EXISTS (
      SELECT 1 FROM public.briefs WHERE project_id = p_project_id
    ) INTO v_has_brief;

    IF NOT v_has_brief THEN
      RAISE EXCEPTION 'Brief is required before advancing to Script Ready';
    END IF;

    -- 2. At least one content plan item must exist
    SELECT COUNT(*) INTO v_content_count
    FROM public.content_plans
    WHERE project_id = p_project_id;

    IF v_content_count = 0 THEN
      RAISE EXCEPTION 'At least one content plan item is required before advancing to Script Ready';
    END IF;

    -- 3. Script validation based on script_not_required
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

    -- Audit Activity Log
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

  ELSE
    RAISE EXCEPTION 'Invalid or unauthorized phase transition from % to %', v_project.status, p_target_phase;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_project_phase(uuid, project_phase) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_project_phase(uuid, project_phase) TO authenticated;


-- -------------------------------------------------------------
-- 4. Script Not Required Toggle RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_project_script_not_required(
  p_project_id uuid,
  p_not_required boolean
) RETURNS void AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_project record;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  SELECT id, status, sms_owner_id
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  IF v_caller_role != 'ADMIN' AND (v_caller_role != 'SOCIAL_MEDIA_SPECIALIST' OR v_project.sms_owner_id != v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can change script_not_required';
  END IF;

  IF v_project.status NOT IN ('BRIEF_RECEIVED', 'CONTENT_PLANNING') THEN
    RAISE EXCEPTION 'script_not_required cannot be changed after planning phases';
  END IF;

  UPDATE public.projects
  SET script_not_required = p_not_required, updated_at = now()
  WHERE id = p_project_id;

  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, v_caller_id, 'SCRIPT_NOT_REQUIRED_TOGGLED',
    jsonb_build_object('script_not_required', p_not_required)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION set_project_script_not_required(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_project_script_not_required(uuid, boolean) TO authenticated;


-- -------------------------------------------------------------
-- 5. Hardened log_project_activity RPC (Updated Whitelist)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_caller_role user_role;
  v_is_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project exists and check owner
  SELECT (sms_owner_id = auth.uid()) INTO v_is_owner
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Strictly reject arbitrary or unauthorized events
  -- Read-only roles (AE, CD) and creative roles (Designer, Editor) cannot log project management events
  IF v_caller_role = 'ADMIN' THEN
    IF p_event_type NOT IN (
      'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
      'BRIEF_CREATED', 'BRIEF_UPDATED',
      'CONTENT_PLAN_CREATED', 'CONTENT_PLAN_UPDATED',
      'SCRIPT_CREATED', 'SCRIPT_UPDATED', 'SCRIPT_READY',
      'SCRIPT_NOT_REQUIRED_TOGGLED',
      'PLANNING_STARTED', 'PLANNING_COMPLETED'
    ) THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSIF v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner THEN
    IF p_event_type NOT IN (
      'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
      'BRIEF_CREATED', 'BRIEF_UPDATED',
      'CONTENT_PLAN_CREATED', 'CONTENT_PLAN_UPDATED',
      'SCRIPT_CREATED', 'SCRIPT_UPDATED', 'SCRIPT_READY',
      'SCRIPT_NOT_REQUIRED_TOGGLED',
      'PLANNING_STARTED', 'PLANNING_COMPLETED'
    ) THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have permission to record project activity logs';
  END IF;

  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_event_type,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION log_project_activity(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_project_activity(uuid, text, jsonb) TO authenticated;


-- -------------------------------------------------------------
-- 6. Updated exceptional_content_update RPC (T-004)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION exceptional_content_update(
  p_entity_type text,
  p_entity_id uuid,
  p_patch jsonb,
  p_reason text
) RETURNS void AS $$
DECLARE
  v_project_id uuid;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A non-empty revision reason is required for exceptional in-flight updates';
  END IF;

  v_caller_role := auth_user_role();

  IF p_entity_type = 'brief' THEN
    SELECT project_id INTO v_project_id FROM public.briefs WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    SELECT project_id INTO v_project_id FROM public.content_plans WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    SELECT project_id INTO v_project_id FROM public.scripts WHERE id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Entity not found';
  END IF;

  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can perform exceptional content revisions';
  END IF;

  -- Set transaction-local override for content lock trigger
  PERFORM set_config('loco.exceptional_revision', 'on', true);

  IF p_entity_type = 'brief' THEN
    UPDATE public.briefs
    SET 
      objective = COALESCE(p_patch->>'objective', objective),
      target_audience = COALESCE(p_patch->>'target_audience', target_audience),
      key_message = COALESCE(p_patch->>'key_message', key_message),
      deliverables_summary = COALESCE(p_patch->>'deliverables_summary', deliverables_summary),
      reference_links = COALESCE(p_patch->>'reference_links', reference_links),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'content_plan' THEN
    UPDATE public.content_plans
    SET 
      title = COALESCE(p_patch->>'title', title),
      channel = COALESCE(p_patch->>'channel', channel),
      planned_post_date = CASE WHEN p_patch->>'planned_post_date' IS NOT NULL THEN (p_patch->>'planned_post_date')::date ELSE planned_post_date END,
      pillar = COALESCE(p_patch->>'pillar', pillar),
      copy_draft = COALESCE(p_patch->>'copy_draft', copy_draft),
      status = COALESCE(p_patch->>'status', status),
      updated_at = now()
    WHERE id = p_entity_id;
  ELSIF p_entity_type = 'script' THEN
    UPDATE public.scripts
    SET 
      title = COALESCE(p_patch->>'title', title),
      hook = COALESCE(p_patch->>'hook', hook),
      body = COALESCE(p_patch->>'body', body),
      visual_cues = COALESCE(p_patch->>'visual_cues', visual_cues),
      call_to_action = COALESCE(p_patch->>'call_to_action', call_to_action),
      status = COALESCE(p_patch->>'status', status),
      updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  -- Log audit event
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    v_project_id,
    auth.uid(),
    'EXCEPTIONAL_CONTENT_REVISION',
    jsonb_build_object(
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'reason', p_reason,
      'patch', p_patch
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exceptional_content_update(text, uuid, jsonb, text) TO authenticated;


-- ==========================================
-- FILE: 20260914000016_16_phase7_task_workflows.sql
-- ==========================================
-- 16: Phase 7 Production Task Management, Assignment, and Controlled Production Entry
-- Enforces task invariants, atomic creation/reassignment, and narrow SCRIPT_READY -> PRODUCTION transition

-- -------------------------------------------------------------
-- 1. Invariant Trigger: Enforce requires_qc on Tasks
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_enforce_task_requires_qc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING') THEN
    NEW.requires_qc := true;
  ELSE
    NEW.requires_qc := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_tasks_requires_qc_guard ON tasks;
CREATE TRIGGER trg_tasks_requires_qc_guard
  BEFORE INSERT OR UPDATE OF task_type, requires_qc ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_enforce_task_requires_qc();


-- -------------------------------------------------------------
-- 2. Invariant Trigger: Protect Task Type & Metadata Mutability
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_tasks_metadata_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  v_caller_role := auth_user_role();

  -- Rule: task_type can only be changed while status = 'TODO'
  IF OLD.status != 'TODO' AND NEW.task_type IS DISTINCT FROM OLD.task_type THEN
    RAISE EXCEPTION 'Task type cannot be changed once work has begun (status: %)', OLD.status;
  END IF;

  -- Rule: creative roles (GRAPHIC_DESIGNER, VIDEO_EDITOR) cannot mutate task metadata
  IF v_caller_role IN ('GRAPHIC_DESIGNER', 'VIDEO_EDITOR') THEN
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.task_type IS DISTINCT FROM OLD.task_type
      OR NEW.deadline IS DISTINCT FROM OLD.deadline
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.content_plan_id IS DISTINCT FROM OLD.content_plan_id
      OR NEW.script_id IS DISTINCT FROM OLD.script_id
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.requires_qc IS DISTINCT FROM OLD.requires_qc
      OR NEW.current_assignee_id IS DISTINCT FROM OLD.current_assignee_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
    THEN
      RAISE EXCEPTION 'Unauthorized: creative roles cannot modify task metadata';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_metadata_guard ON tasks;
CREATE TRIGGER trg_tasks_metadata_guard
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_tasks_metadata_guard();


-- -------------------------------------------------------------
-- 3. Atomic Task Creation RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_production_task(
  p_project_id uuid,
  p_title text,
  p_task_type task_type,
  p_priority priority_level,
  p_deadline timestamptz,
  p_notes text DEFAULT NULL,
  p_content_plan_id uuid DEFAULT NULL,
  p_script_id uuid DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_project record;
  v_new_task_id uuid;
  v_assignee record;
  v_requires_qc boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  SELECT id, status, sms_owner_id, deadline
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Authority: only ADMIN or project SMS owner can create tasks
  IF v_caller_role != 'ADMIN' AND (v_caller_role != 'SOCIAL_MEDIA_SPECIALIST' OR v_project.sms_owner_id != v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can create tasks';
  END IF;

  -- Title validation
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RAISE EXCEPTION 'Task title is required';
  END IF;

  -- Deadline validation: task.deadline <= project.deadline
  IF p_deadline > v_project.deadline THEN
    RAISE EXCEPTION 'Task deadline cannot exceed project deadline (%)', v_project.deadline;
  END IF;

  -- Linked content plan validation: must belong to the same project
  IF p_content_plan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.content_plans WHERE id = p_content_plan_id AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'Linked content plan does not belong to the same project';
    END IF;
  END IF;

  -- Linked script validation: must belong to the same project
  IF p_script_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scripts WHERE id = p_script_id AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'Linked script does not belong to the same project';
    END IF;
  END IF;

  -- Enforce requires_qc rule: GRAPHIC_DESIGN and VIDEO_EDITING = true, others = false
  IF p_task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING') THEN
    v_requires_qc := true;
  ELSE
    v_requires_qc := false;
  END IF;

  -- Validate assignee if provided
  IF p_assignee_id IS NOT NULL THEN
    SELECT id, is_active, role INTO v_assignee
    FROM public.profiles
    WHERE id = p_assignee_id;

    IF v_assignee.id IS NULL THEN
      RAISE EXCEPTION 'Assignee profile not found';
    END IF;

    IF v_assignee.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot assign task to inactive user';
    END IF;

    -- Ensure project membership exists for assignee atomically
    INSERT INTO public.project_members (project_id, user_id)
    VALUES (p_project_id, p_assignee_id)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  -- 1. Insert Task
  INSERT INTO public.tasks (
    project_id,
    title,
    task_type,
    priority,
    status,
    requires_qc,
    deadline,
    notes,
    content_plan_id,
    script_id,
    current_assignee_id
  ) VALUES (
    p_project_id,
    TRIM(p_title),
    p_task_type,
    p_priority,
    'TODO',
    v_requires_qc,
    p_deadline,
    p_notes,
    p_content_plan_id,
    p_script_id,
    p_assignee_id
  ) RETURNING id INTO v_new_task_id;

  -- 2. Insert initial assignment if assignee provided
  IF p_assignee_id IS NOT NULL THEN
    INSERT INTO public.task_assignments (
      task_id,
      assignee_id,
      assigned_by,
      assigned_at
    ) VALUES (
      v_new_task_id,
      p_assignee_id,
      v_caller_id,
      now()
    );
  END IF;

  -- 3. Record Activity Log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, v_caller_id, 'TASK_CREATED',
    jsonb_build_object(
      'task_id', v_new_task_id,
      'title', p_title,
      'task_type', p_task_type,
      'priority', p_priority,
      'assignee_id', p_assignee_id,
      'requires_qc', v_requires_qc
    )
  );

  IF p_assignee_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (
      project_id, user_id, event_type, metadata
    ) VALUES (
      p_project_id, v_caller_id, 'TASK_ASSIGNED',
      jsonb_build_object(
        'task_id', v_new_task_id,
        'title', p_title,
        'assignee_id', p_assignee_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', v_new_task_id,
    'project_id', p_project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_production_task(uuid, text, task_type, priority_level, timestamptz, text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_task(uuid, text, task_type, priority_level, timestamptz, text, uuid, uuid, uuid) TO authenticated;


-- -------------------------------------------------------------
-- 4. Updated Atomic Task Reassignment RPC
-- -------------------------------------------------------------
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
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can reassign tasks';
  END IF;

  -- Validate new assignee exists and is active
  SELECT id, is_active, role INTO v_new_assignee
  FROM public.profiles
  WHERE id = p_new_assignee_id;

  IF v_new_assignee.id IS NULL THEN
    RAISE EXCEPTION 'Assignee profile not found';
  END IF;

  IF v_new_assignee.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot assign task to inactive user';
  END IF;

  -- 1. End previous active assignment
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- 2. Insert new active assignment
  INSERT INTO public.task_assignments (
    task_id,
    assignee_id,
    assigned_by,
    assigned_at
  ) VALUES (
    p_task_id,
    p_new_assignee_id,
    auth.uid(),
    now()
  );

  -- 3. Atomically ensure project membership exists for new assignee
  INSERT INTO public.project_members (project_id, user_id)
  VALUES (v_task.project_id, p_new_assignee_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- 4. Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;

  -- 5. Record activity log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_REASSIGNED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'previous_assignee_id', v_task.current_assignee_id,
      'new_assignee_id', p_new_assignee_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


-- -------------------------------------------------------------
-- 5. Updated Task Status Transition RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id uuid,
  p_new_status task_status
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_has_deliverable boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_caller_role := auth_user_role();

  -- Admin and owning SMS have broad management rights
  IF v_caller_role = 'ADMIN' OR (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND EXISTS (
      SELECT 1 FROM public.projects WHERE id = v_task.project_id AND sms_owner_id = auth.uid()
    )
  ) THEN
    UPDATE public.tasks
    SET status = p_new_status, updated_at = now()
    WHERE id = p_task_id;

    IF p_new_status = 'IN_PROGRESS' AND v_task.status = 'TODO' THEN
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
    END IF;
    RETURN;
  END IF;

  -- Active creative assignee transitions
  IF v_task.current_assignee_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user is not assigned to this task';
  END IF;

  -- Creative assignee permitted paths
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
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
    -- Verify deliverable file has been uploaded
    SELECT EXISTS (
      SELECT 1 FROM public.project_files
      WHERE task_id = p_task_id AND deleted_at IS NULL
    ) INTO v_has_deliverable;

    IF NOT v_has_deliverable THEN
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;
  ELSIF v_task.status = 'REVISION_REQUESTED' AND p_new_status = 'IN_PROGRESS' THEN
    UPDATE public.tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = p_task_id;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to % for task assignee', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;


-- -------------------------------------------------------------
-- 6. Controlled Production Entry RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION start_production(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id uuid;
  v_project record;
  v_has_brief boolean;
  v_content_count integer;
  v_script_count integer;
  v_unready_script_count integer;
  v_prod_task_count integer;
  v_unassigned_prod_task_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();
  v_caller_id := auth.uid();

  SELECT id, status, sms_owner_id, script_not_required, project_code, deadline
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- 1. Authority: only ADMIN or project SMS owner can start production
  IF v_caller_role != 'ADMIN' AND (v_caller_role != 'SOCIAL_MEDIA_SPECIALIST' OR v_project.sms_owner_id != v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators or project SMS owner can start production';
  END IF;

  -- 2. Phase precondition: current status must be SCRIPT_READY
  IF v_project.status != 'SCRIPT_READY' THEN
    RAISE EXCEPTION 'Project must be in SCRIPT_READY phase to enter production (current status: %)', v_project.status;
  END IF;

  -- 3. Planning preconditions must remain valid
  SELECT EXISTS (
    SELECT 1 FROM public.briefs WHERE project_id = p_project_id
  ) INTO v_has_brief;
  IF NOT v_has_brief THEN
    RAISE EXCEPTION 'Project brief is required';
  END IF;

  SELECT COUNT(*) INTO v_content_count
  FROM public.content_plans
  WHERE project_id = p_project_id;
  IF v_content_count = 0 THEN
    RAISE EXCEPTION 'At least one content plan item is required';
  END IF;

  SELECT COUNT(*) INTO v_script_count
  FROM public.scripts
  WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_unready_script_count
  FROM public.scripts
  WHERE project_id = p_project_id AND status != 'READY';

  IF v_project.script_not_required IS NOT TRUE THEN
    IF v_script_count = 0 THEN
      RAISE EXCEPTION 'Project requires at least one script';
    END IF;
    IF v_unready_script_count > 0 THEN
      RAISE EXCEPTION 'All project scripts must be in READY status';
    END IF;
  ELSE
    IF v_unready_script_count > 0 THEN
      RAISE EXCEPTION 'All existing scripts must be in READY status';
    END IF;
  END IF;

  -- 4. Precondition: At least ONE production task exists (GRAPHIC_DESIGN or VIDEO_EDITING)
  SELECT COUNT(*) INTO v_prod_task_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND deleted_at IS NULL
    AND task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING');

  IF v_prod_task_count = 0 THEN
    RAISE EXCEPTION 'Project requires at least one production task (GRAPHIC_DESIGN or VIDEO_EDITING) before entering production';
  END IF;

  -- 5. Precondition: Every production task must have an active assignee
  SELECT COUNT(*) INTO v_unassigned_prod_task_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND deleted_at IS NULL
    AND task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING')
    AND current_assignee_id IS NULL;

  IF v_unassigned_prod_task_count > 0 THEN
    RAISE EXCEPTION 'All production tasks must have an active assignee before entering production';
  END IF;

  -- 6. Precondition: Every assignee profile must be active
  IF EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.profiles p ON t.current_assignee_id = p.id
    WHERE t.project_id = p_project_id
      AND t.deleted_at IS NULL
      AND t.task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING')
      AND p.is_active IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'All task assignees must be active users';
  END IF;

  -- 7. Precondition: Every assigned task must have matching active task_assignments record
  IF EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.project_id = p_project_id
      AND t.deleted_at IS NULL
      AND t.task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING')
      AND t.current_assignee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.task_assignments ta
        WHERE ta.task_id = t.id
          AND ta.assignee_id = t.current_assignee_id
          AND ta.ended_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Task assignment state is inconsistent with active assignment records';
  END IF;

  -- 8. Precondition: Task deadline <= project deadline
  IF EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.project_id = p_project_id
      AND t.deleted_at IS NULL
      AND t.deadline > v_project.deadline
  ) THEN
    RAISE EXCEPTION 'One or more task deadlines exceed the project deadline';
  END IF;

  -- 9. Atomically update project status to PRODUCTION
  -- Existing trigger trg_projects_status_history_logger will automatically append 1 row to project_status_history
  UPDATE public.projects
  SET status = 'PRODUCTION', updated_at = now()
  WHERE id = p_project_id;

  -- 10. Record legitimate PRODUCTION_STARTED activity log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    p_project_id, v_caller_id, 'PRODUCTION_STARTED',
    jsonb_build_object(
      'from_phase', 'SCRIPT_READY',
      'to_phase', 'PRODUCTION',
      'production_task_count', v_prod_task_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'from_phase', 'SCRIPT_READY',
    'to_phase', 'PRODUCTION',
    'production_task_count', v_prod_task_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_production(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_production(uuid) TO authenticated;


-- -------------------------------------------------------------
-- 7. Task Archive RPC
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_task(
  p_task_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or already archived';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can archive tasks';
  END IF;

  -- End active assignment if any
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- Soft delete task
  UPDATE public.tasks
  SET deleted_at = now(), current_assignee_id = NULL, updated_at = now()
  WHERE id = p_task_id;

  -- Log activity
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_UPDATED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'action', 'ARCHIVED'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION archive_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_task(uuid) TO authenticated;


-- -------------------------------------------------------------
-- 8. Task Metadata Update RPC
-- -------------------------------------------------------------
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
    IF NOT EXISTS (
      SELECT 1 FROM public.content_plans WHERE id = p_content_plan_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked content plan does not belong to the same project';
    END IF;
  END IF;

  IF p_script_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scripts WHERE id = p_script_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked script does not belong to the same project';
    END IF;
  END IF;

  IF p_task_type IS NOT NULL AND p_task_type IS DISTINCT FROM v_task.task_type THEN
    IF v_task.status != 'TODO' THEN
      RAISE EXCEPTION 'Task type cannot be changed once work has begun (status: %)', v_task.status;
    END IF;
  END IF;

  UPDATE public.tasks
  SET
    title = TRIM(p_title),
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
      'title', TRIM(p_title),
      'priority', p_priority,
      'deadline', p_deadline
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) TO authenticated;


-- -------------------------------------------------------------
-- 9. Updated log_project_activity Whitelist (Phase 7 Events)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_caller_role user_role;
  v_is_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Verify project exists and check owner
  SELECT (sms_owner_id = auth.uid()) INTO v_is_owner
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Strictly reject arbitrary or unauthorized events
  -- Read-only roles (AE, CD) and creative roles (Designer, Editor) cannot log project management events
  IF v_caller_role = 'ADMIN' OR (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_owner) THEN
    IF p_event_type NOT IN (
      'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
      'BRIEF_CREATED', 'BRIEF_UPDATED',
      'CONTENT_PLAN_CREATED', 'CONTENT_PLAN_UPDATED',
      'SCRIPT_CREATED', 'SCRIPT_UPDATED', 'SCRIPT_READY',
      'SCRIPT_NOT_REQUIRED_TOGGLED',
      'PLANNING_STARTED', 'PLANNING_COMPLETED',
      'TASK_CREATED', 'TASK_UPDATED', 'TASK_ASSIGNED', 'TASK_REASSIGNED', 'TASK_STARTED',
      'PRODUCTION_STARTED'
    ) THEN
      RAISE EXCEPTION 'Invalid event_type for activity log: %', p_event_type;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have permission to record project activity logs';
  END IF;

  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_event_type,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION log_project_activity(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_project_activity(uuid, text, jsonb) TO authenticated;


-- ==========================================
-- FILE: 20260914000017_17_phase7_1_audit_hardening.sql
-- ==========================================
-- =============================================================
-- Migration 17: Phase 7.1 Final Task State & Production Integrity Hardening
-- Single-source status history verification, strict task state machine,
-- archive consistency, and lifecycle guards.
-- =============================================================

-- 1. Hardened Task Status Transition RPC
-- In Phase 7, ONLY TODO -> IN_PROGRESS is allowed for active tasks.
-- IN_PROGRESS -> IN_REVIEW requires deliverable file upload (Phase 8).
-- Any attempts to jump to APPROVED, COMPLETED, or REVISION_REQUESTED
-- are strictly blocked for ALL roles (Admin, SMS, Assignee).
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

  -- State machine enforcement (applies uniformly to ALL roles: Admin, SMS, and Assignee)
  -- Phase 7 boundary: ONLY TODO -> IN_PROGRESS is allowed.
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
    -- Verify deliverable file has been uploaded (prerequisite for review entry)
    SELECT EXISTS (
      SELECT 1 FROM public.project_files
      WHERE task_id = p_task_id AND deleted_at IS NULL
    ) INTO v_has_deliverable;

    IF NOT v_has_deliverable THEN
      RAISE EXCEPTION 'Cannot submit task to review without an uploaded deliverable file';
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;
    RETURN;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_new_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION transition_task_status(uuid, task_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_task_status(uuid, task_status) TO authenticated;


-- 2. Hardened Atomic Task Reassignment RPC
-- Prevents reassignment of archived tasks or completed tasks.
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

  IF v_task.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Cannot reassign completed task';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can reassign tasks';
  END IF;

  -- Validate new assignee exists and is active
  SELECT id, is_active, role INTO v_new_assignee
  FROM public.profiles
  WHERE id = p_new_assignee_id;

  IF v_new_assignee.id IS NULL THEN
    RAISE EXCEPTION 'Assignee profile not found';
  END IF;

  IF v_new_assignee.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot assign task to inactive user';
  END IF;

  -- 1. End previous active assignment
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- 2. Insert new active assignment
  INSERT INTO public.task_assignments (
    task_id,
    assignee_id,
    assigned_by,
    assigned_at
  ) VALUES (
    p_task_id,
    p_new_assignee_id,
    auth.uid(),
    now()
  );

  -- 3. Atomically ensure project membership exists for new assignee
  INSERT INTO public.project_members (project_id, user_id)
  VALUES (v_task.project_id, p_new_assignee_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- 4. Update task current_assignee_id
  UPDATE public.tasks
  SET current_assignee_id = p_new_assignee_id, updated_at = now()
  WHERE id = p_task_id;

  -- 5. Record activity log
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_REASSIGNED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'previous_assignee_id', v_task.current_assignee_id,
      'new_assignee_id', p_new_assignee_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reassign_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reassign_task(uuid, uuid) TO authenticated;


-- 3. Hardened Task Archival RPC
-- Clears current_assignee_id and ends active task assignment on archival.
CREATE OR REPLACE FUNCTION archive_task(
  p_task_id uuid
) RETURNS void AS $$
DECLARE
  v_task record;
  v_caller_role user_role;
  v_is_sms_owner boolean;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or already archived';
  END IF;

  v_caller_role := auth_user_role();
  SELECT (sms_owner_id = auth.uid()) INTO v_is_sms_owner
  FROM public.projects
  WHERE id = v_task.project_id;

  IF v_caller_role != 'ADMIN' AND NOT (v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_is_sms_owner IS TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: only Admin or project SMS owner can archive tasks';
  END IF;

  -- End active assignment if any
  UPDATE public.task_assignments
  SET ended_at = now()
  WHERE task_id = p_task_id AND ended_at IS NULL;

  -- Soft delete task and clear active assignee reference
  UPDATE public.tasks
  SET deleted_at = now(), current_assignee_id = NULL, updated_at = now()
  WHERE id = p_task_id;

  -- Log activity
  INSERT INTO public.activity_logs (
    project_id, user_id, event_type, metadata
  ) VALUES (
    v_task.project_id, auth.uid(), 'TASK_UPDATED',
    jsonb_build_object(
      'task_id', p_task_id,
      'task_title', v_task.title,
      'action', 'ARCHIVED'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION archive_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_task(uuid) TO authenticated;


-- 4. Hardened Task Metadata Update RPC
-- Rejects metadata mutations on archived tasks.
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
    IF NOT EXISTS (
      SELECT 1 FROM public.content_plans WHERE id = p_content_plan_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked content plan does not belong to the same project';
    END IF;
  END IF;

  IF p_script_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scripts WHERE id = p_script_id AND project_id = v_task.project_id
    ) THEN
      RAISE EXCEPTION 'Linked script does not belong to the same project';
    END IF;
  END IF;

  IF p_task_type IS NOT NULL AND p_task_type IS DISTINCT FROM v_task.task_type THEN
    IF v_task.status != 'TODO' THEN
      RAISE EXCEPTION 'Task type cannot be changed once work has begun (status: %)', v_task.status;
    END IF;
  END IF;

  UPDATE public.tasks
  SET
    title = TRIM(p_title),
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
      'title', TRIM(p_title),
      'priority', p_priority,
      'deadline', p_deadline
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_task_metadata(uuid, text, priority_level, timestamptz, text, uuid, uuid, task_type) TO authenticated;


-- ==========================================
-- FILE: 20260914000018_18_phase8_deliverable_workflows.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000019_19_phase8_1_storage_deliverable_integrity.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000020_20_phase9_qc_and_revision_workflows.sql
-- ==========================================
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



-- ==========================================
-- FILE: 20260914000021_21_phase9_1_concurrency_and_lifecycle_audit.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260914000022_22_phase10_client_review_and_publication.sql
-- ==========================================
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



-- ==========================================
-- FILE: 20260914000023_23_phase11_dashboard_and_notifications.sql
-- ==========================================
-- Migration 23: Phase 11 Dashboard, Workload, Activity and In-App Notifications
-- Enforces notification security, duplicate protection, domain event dispatch, and index optimizations

-- ------------------------------------------------------------------------------
-- 1. Index Optimizations for Query Performance (Section 53)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_desc
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_status_active
  ON public.projects (status)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- 2. Notification Immutability & Security Guards (Sections 28, 31, 34, 54)
-- ------------------------------------------------------------------------------
-- Core payload fields (user_id, title, message, link_url, created_at) are immutable
CREATE OR REPLACE FUNCTION trg_notifications_mutation_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'notifications user_id is immutable';
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'notifications title is immutable';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'notifications message is immutable';
  END IF;
  IF NEW.link_url IS DISTINCT FROM OLD.link_url THEN
    RAISE EXCEPTION 'notifications link_url is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_mutation_guard ON public.notifications;
CREATE TRIGGER trg_notifications_mutation_guard
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trg_notifications_mutation_guard();

-- Direct INSERT on notifications from authenticated users is blocked
CREATE OR REPLACE FUNCTION trg_notifications_insert_guard()
RETURNS trigger AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Direct INSERT on notifications is strictly forbidden. Use domain triggers or admin create_notification().';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_insert_guard ON public.notifications;
CREATE TRIGGER trg_notifications_insert_guard
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trg_notifications_insert_guard();

-- Physical DELETE on notifications from authenticated users is blocked
CREATE OR REPLACE FUNCTION trg_notifications_delete_guard()
RETURNS trigger AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Physical DELETE on notifications is strictly forbidden.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_delete_guard ON public.notifications;
CREATE TRIGGER trg_notifications_delete_guard
  BEFORE DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trg_notifications_delete_guard();

-- ------------------------------------------------------------------------------
-- 3. Duplicate-Protected Domain Notification Dispatcher (Sections 28, 43)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dispatch_domain_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  -- Validate active profile existence
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id AND is_active = true) THEN
    RETURN NULL;
  END IF;

  -- Duplicate protection (Section 43):
  -- Suppress duplicate notification to same user for same link/title within 5 minutes
  SELECT id INTO v_existing
  FROM public.notifications
  WHERE user_id = p_recipient_id
    AND title = p_title
    AND link_url = p_link_url
    AND created_at > (now() - interval '5 minutes')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url,
    is_read
  ) VALUES (
    p_recipient_id,
    p_title,
    p_message,
    p_link_url,
    false
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION dispatch_domain_notification(uuid, text, text, text) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 4. Mark All Notifications Read RPC (Section 33)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Automated Domain Event Notification Triggers (Sections 29, 44, 45, 46, 47)
-- ------------------------------------------------------------------------------

-- 5a. Revision Requests Trigger (Handles both INTERNAL_QC and CLIENT sources)
CREATE OR REPLACE FUNCTION trg_notify_on_revision_request()
RETURNS trigger AS $$
DECLARE
  v_task record;
  v_title text;
  v_message text;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.source = 'CLIENT' THEN
    v_title := 'Revisi dari Client';
    v_message := 'Client meminta revisi untuk task: ' || COALESCE(v_task.title, 'Untitled');
  ELSE
    v_title := 'Revisi Internal Diminta';
    v_message := 'Creative Director meminta revisi internal untuk task: ' || COALESCE(v_task.title, 'Untitled');
  END IF;

  PERFORM dispatch_domain_notification(
    NEW.assigned_to,
    v_title,
    v_message,
    '/projects/' || NEW.project_id::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_revision_requests_notifier ON public.revision_requests;
CREATE TRIGGER trg_revision_requests_notifier
  AFTER INSERT ON public.revision_requests
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_revision_request();

-- 5b. QC Approved Review Trigger
CREATE OR REPLACE FUNCTION trg_notify_on_qc_review()
RETURNS trigger AS $$
DECLARE
  v_task record;
BEGIN
  IF NEW.result = 'APPROVED' THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    IF FOUND AND v_task.current_assignee_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        v_task.current_assignee_id,
        'Deliverable Disetujui QC',
        'Deliverable untuk task ' || COALESCE(v_task.title, 'Untitled') || ' telah disetujui QC internal.',
        '/projects/' || NEW.project_id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_qc_reviews_notifier ON public.qc_reviews;
CREATE TRIGGER trg_qc_reviews_notifier
  AFTER INSERT ON public.qc_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_qc_review();

-- 5c. Task Status Trigger: Notify Creative Directors when a task is submitted to IN_REVIEW
CREATE OR REPLACE FUNCTION trg_notify_on_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
BEGIN
  IF NEW.status = 'IN_REVIEW' AND (OLD.status IS DISTINCT FROM 'IN_REVIEW') THEN
    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'Review QC Dibutuhkan',
        'Task ' || COALESCE(NEW.title, 'Untitled') || ' diajukan untuk review QC internal.',
        '/projects/' || NEW.project_id::text
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_status_notifier ON public.tasks;
CREATE TRIGGER trg_tasks_status_notifier
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_task_status_change();

-- 5d. Project Status Trigger: Notify on INTERNAL_QC, APPROVED, and PUBLISHED
CREATE OR REPLACE FUNCTION trg_notify_on_project_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
BEGIN
  IF NEW.status = 'INTERNAL_QC' AND OLD.status = 'PRODUCTION' THEN
    -- Notify CDs that project entered internal QC
    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'QC Internal Project Dimulai',
        'Project ' || NEW.name || ' telah memasuki fase QC internal.',
        '/projects/' || NEW.id::text
      );
    END LOOP;
  ELSIF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    -- Notify project SMS owner of full client approval
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Disetujui Klien',
        'Project ' || NEW.name || ' telah disetujui klien dan siap dipublikasikan.',
        '/projects/' || NEW.id::text
      );
    END IF;
  ELSIF NEW.status = 'PUBLISHED' AND OLD.status != 'PUBLISHED' THEN
    -- Notify project SMS owner of publication
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Telah Dipublikasikan',
        'Project ' || NEW.name || ' resmi dipublikasikan.',
        '/projects/' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_projects_status_notifier ON public.projects;
CREATE TRIGGER trg_projects_status_notifier
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_project_status_change();


-- ==========================================
-- FILE: 20260915000024_24_phase11_1_notification_dedupe_hardening.sql
-- ==========================================
-- Migration 24: Phase 11.1 Notification Dedupe Hardening
-- Fixes two defects identified in the Phase 11.1 audit:
--
-- 1. dispatch_domain_notification dedupe key was (user_id, title, link_url, created_at > now()-5min).
--    This falsely suppressed distinct domain events for the same user, same project, same event type
--    but different tasks (e.g. Task A and Task B both trigger "Review QC Dibutuhkan" with the same
--    /projects/<id> link_url within 5 minutes). Fix: include message in the dedupe key.
--    The message field contains the task title, which makes same-project different-task events distinct.
--
-- 2. trg_notify_on_task_assignment used English title "New Task Assigned".
--    All user-facing copy must be Bahasa Indonesia per project language rules.

-- Fix 1: Rebuild dispatch_domain_notification with (user_id, title, message, link_url) dedupe key
CREATE OR REPLACE FUNCTION dispatch_domain_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_link_url text
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  -- Inactive or missing profile: silently no-op
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id AND is_active = true) THEN
    RETURN NULL;
  END IF;

  -- Dedupe: suppress retry emission of the SAME logical domain event.
  -- Key: (user_id, title, message, link_url) within a 5-minute window.
  -- Including message ensures distinct domain events (e.g. different task titles in same project)
  -- are never suppressed even when they share the same title and link_url.
  SELECT id INTO v_existing
  FROM public.notifications
  WHERE user_id = p_recipient_id
    AND title = p_title
    AND message = p_message
    AND link_url = p_link_url
    AND created_at > (now() - interval '5 minutes')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url,
    is_read
  ) VALUES (
    p_recipient_id,
    p_title,
    p_message,
    p_link_url,
    false
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION dispatch_domain_notification(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Fix 2: Rebuild trg_notify_on_task_assignment with Bahasa Indonesia copy
CREATE OR REPLACE FUNCTION trg_notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title text;
  v_project_id uuid;
BEGIN
  SELECT title, project_id INTO v_task_title, v_project_id
  FROM public.tasks
  WHERE id = NEW.task_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    link_url
  ) VALUES (
    NEW.assignee_id,
    'Tugas Baru Ditetapkan',
    'Kamu ditugaskan pada task: ' || COALESCE(v_task_title, 'Tanpa Judul'),
    '/projects/' || v_project_id::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_task_assignments_notifier ON task_assignments;
CREATE TRIGGER trg_task_assignments_notifier
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_on_task_assignment();


-- ==========================================
-- FILE: 20260915000025_25_phase11_2_deterministic_notification_idempotency.sql
-- ==========================================
-- Migration 25: Phase 11.2 Deterministic Notification Idempotency Final Fix
-- Replaces time/content-based deduplication with authoritative domain-event identity.
-- Enforces UNIQUE(user_id, source_event_id) at database level.

-- 1. Add source_event_id column to notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_event_id uuid NULL;

-- 2. Database enforcement: partial unique index on (user_id, source_event_id)
-- Only notifications tied to a domain event (source_event_id IS NOT NULL) are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_source_event
  ON public.notifications (user_id, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- 3. Update notification immutability trigger to protect source_event_id
CREATE OR REPLACE FUNCTION trg_notifications_mutation_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'notifications user_id is immutable';
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'notifications title is immutable';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'notifications message is immutable';
  END IF;
  IF NEW.link_url IS DISTINCT FROM OLD.link_url THEN
    RAISE EXCEPTION 'notifications link_url is immutable';
  END IF;
  IF NEW.source_event_id IS DISTINCT FROM OLD.source_event_id THEN
    RAISE EXCEPTION 'notifications source_event_id is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Rebuild dispatch_domain_notification with deterministic source_event_id identity
-- Drops previous signature to allow clean parameter signature update
DROP FUNCTION IF EXISTS dispatch_domain_notification(uuid, text, text, text);

CREATE OR REPLACE FUNCTION dispatch_domain_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_link_url text,
  p_source_event_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  -- Validate active profile existence
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id AND is_active = true) THEN
    RETURN NULL;
  END IF;

  -- Deterministic Deduplication:
  -- If p_source_event_id is provided, check by authoritative domain event identity
  IF p_source_event_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE user_id = p_recipient_id
      AND source_event_id = p_source_event_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  ELSE
    -- Fallback for ad-hoc / legacy calls without source_event_id:
    -- Suppress exact retries within 5 minutes
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE user_id = p_recipient_id
      AND title = p_title
      AND message = p_message
      AND link_url = p_link_url
      AND created_at > (now() - interval '5 minutes')
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Database-safe idempotent insert:
  -- If p_source_event_id is present, handle potential concurrent races via ON CONFLICT
  IF p_source_event_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      link_url,
      source_event_id,
      is_read
    ) VALUES (
      p_recipient_id,
      p_title,
      p_message,
      p_link_url,
      p_source_event_id,
      false
    )
    ON CONFLICT (user_id, source_event_id) WHERE source_event_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_id;

    -- If concurrent insert won race, fetch the existing ID
    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.notifications
      WHERE user_id = p_recipient_id
        AND source_event_id = p_source_event_id
      LIMIT 1;
    END IF;
  ELSE
    -- Ad-hoc notifications without source event identity
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      link_url,
      source_event_id,
      is_read
    ) VALUES (
      p_recipient_id,
      p_title,
      p_message,
      p_link_url,
      NULL,
      false
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Strictly revoke dispatch_domain_notification from client access
REVOKE ALL ON FUNCTION dispatch_domain_notification(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 5. Rebuild Triggers to Pass Deterministic Source Event Identities

-- 5a. Task Assignment Notifier: uses task_assignments.id
CREATE OR REPLACE FUNCTION trg_notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title text;
  v_project_id uuid;
BEGIN
  SELECT title, project_id INTO v_task_title, v_project_id
  FROM public.tasks
  WHERE id = NEW.task_id;

  PERFORM dispatch_domain_notification(
    NEW.assignee_id,
    'Tugas Baru Ditetapkan',
    'Kamu ditugaskan pada task: ' || COALESCE(v_task_title, 'Tanpa Judul'),
    '/projects/' || v_project_id::text,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_task_assignments_notifier ON task_assignments;
CREATE TRIGGER trg_task_assignments_notifier
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_on_task_assignment();

-- 5b. Revision Request Notifier: uses revision_requests.id
CREATE OR REPLACE FUNCTION trg_notify_on_revision_request()
RETURNS trigger AS $$
DECLARE
  v_task record;
  v_title text;
  v_message text;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.source = 'CLIENT' THEN
    v_title := 'Revisi dari Client';
    v_message := 'Client meminta revisi untuk task: ' || COALESCE(v_task.title, 'Untitled');
  ELSE
    v_title := 'Revisi Internal Diminta';
    v_message := 'Creative Director meminta revisi internal untuk task: ' || COALESCE(v_task.title, 'Untitled');
  END IF;

  PERFORM dispatch_domain_notification(
    NEW.assigned_to,
    v_title,
    v_message,
    '/projects/' || NEW.project_id::text,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_revision_requests_notifier ON public.revision_requests;
CREATE TRIGGER trg_revision_requests_notifier
  AFTER INSERT ON public.revision_requests
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_revision_request();

-- 5c. QC Approved Review Notifier: uses qc_reviews.id
CREATE OR REPLACE FUNCTION trg_notify_on_qc_review()
RETURNS trigger AS $$
DECLARE
  v_task record;
BEGIN
  IF NEW.result = 'APPROVED' THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    IF FOUND AND v_task.current_assignee_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        v_task.current_assignee_id,
        'Deliverable Disetujui QC',
        'Deliverable untuk task ' || COALESCE(v_task.title, 'Untitled') || ' telah disetujui QC internal.',
        '/projects/' || NEW.project_id::text,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_qc_reviews_notifier ON public.qc_reviews;
CREATE TRIGGER trg_qc_reviews_notifier
  AFTER INSERT ON public.qc_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_qc_review();

-- 5d. Task Status Change to IN_REVIEW Notifier: uses latest deliverable file ID or deterministic hash
CREATE OR REPLACE FUNCTION trg_notify_on_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
  v_source_id uuid;
BEGIN
  IF NEW.status = 'IN_REVIEW' AND (OLD.status IS DISTINCT FROM 'IN_REVIEW') THEN
    -- Deterministic source: latest uploaded deliverable file for this task
    SELECT id INTO v_source_id
    FROM public.project_files
    WHERE task_id = NEW.id AND deleted_at IS NULL
    ORDER BY version DESC
    LIMIT 1;

    -- Deterministic fallback for synthetic status updates
    IF v_source_id IS NULL THEN
      v_source_id := md5(NEW.id::text || ':' || NEW.updated_at::text)::uuid;
    END IF;

    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'Review QC Dibutuhkan',
        'Task ' || COALESCE(NEW.title, 'Untitled') || ' diajukan untuk review QC internal.',
        '/projects/' || NEW.project_id::text,
        v_source_id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_status_notifier ON public.tasks;
CREATE TRIGGER trg_tasks_status_notifier
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_task_status_change();

-- 5e. Project Status Change Notifier: uses project_status_history.id
CREATE OR REPLACE FUNCTION trg_notify_on_project_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
  v_history_id uuid;
BEGIN
  -- Resolve the deterministic project_status_history record ID
  SELECT id INTO v_history_id
  FROM public.project_status_history
  WHERE project_id = NEW.id AND to_status = NEW.status
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    v_history_id := md5(NEW.id::text || ':' || NEW.status::text || ':' || NEW.updated_at::text)::uuid;
  END IF;

  IF NEW.status = 'INTERNAL_QC' AND OLD.status = 'PRODUCTION' THEN
    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'QC Internal Project Dimulai',
        'Project ' || NEW.name || ' telah memasuki fase QC internal.',
        '/projects/' || NEW.id::text,
        v_history_id
      );
    END LOOP;
  ELSIF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Disetujui Klien',
        'Project ' || NEW.name || ' telah disetujui klien dan siap dipublikasikan.',
        '/projects/' || NEW.id::text,
        v_history_id
      );
    END IF;
  ELSIF NEW.status = 'PUBLISHED' AND OLD.status != 'PUBLISHED' THEN
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Telah Dipublikasikan',
        'Project ' || NEW.name || ' resmi dipublikasikan.',
        '/projects/' || NEW.id::text,
        v_history_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_projects_status_notifier ON public.projects;
CREATE TRIGGER trg_projects_status_notifier
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_project_status_change();


-- ==========================================
-- FILE: 20260915000026_26_phase12_notification_namespace_and_readiness.sql
-- ==========================================
-- Migration 26: Phase 12 Notification Namespace & Production Readiness Hardening
-- Enforces deterministic namespace (user_id, source_event_type, source_event_id)
-- Guarantees cross-table domain event identities cannot collide or suppress across domain types.

-- 1. Add source_event_type column to notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_event_type text NULL;

-- 2. Drop legacy partial unique index and rebuild with source_event_type namespace
DROP INDEX IF EXISTS public.uq_notifications_user_source_event;

CREATE UNIQUE INDEX uq_notifications_user_source_event
  ON public.notifications (user_id, COALESCE(source_event_type, ''), source_event_id)
  WHERE source_event_id IS NOT NULL;

-- 3. Update notification immutability trigger to protect source_event_type
CREATE OR REPLACE FUNCTION trg_notifications_mutation_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'notifications user_id is immutable';
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'notifications title is immutable';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'notifications message is immutable';
  END IF;
  IF NEW.link_url IS DISTINCT FROM OLD.link_url THEN
    RAISE EXCEPTION 'notifications link_url is immutable';
  END IF;
  IF NEW.source_event_id IS DISTINCT FROM OLD.source_event_id THEN
    RAISE EXCEPTION 'notifications source_event_id is immutable';
  END IF;
  IF NEW.source_event_type IS DISTINCT FROM OLD.source_event_type THEN
    RAISE EXCEPTION 'notifications source_event_type is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Rebuild dispatch_domain_notification with source_event_type parameter
-- Drops previous signature to allow clean signature update
DROP FUNCTION IF EXISTS dispatch_domain_notification(uuid, text, text, text, uuid);

CREATE OR REPLACE FUNCTION dispatch_domain_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_link_url text,
  p_source_event_id uuid DEFAULT NULL,
  p_source_event_type text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  -- Validate active profile existence
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id AND is_active = true) THEN
    RETURN NULL;
  END IF;

  -- Deterministic Deduplication:
  -- If p_source_event_id is provided, check by authoritative domain event identity + event type namespace
  IF p_source_event_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE user_id = p_recipient_id
      AND COALESCE(source_event_type, '') = COALESCE(p_source_event_type, '')
      AND source_event_id = p_source_event_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  ELSE
    -- Legacy internal fallback for ad-hoc notices without source event identity:
    -- Suppress exact retries within 5 minutes.
    -- (In production, all domain notification triggers strictly pass source_event_id and source_event_type).
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE user_id = p_recipient_id
      AND title = p_title
      AND message = p_message
      AND link_url = p_link_url
      AND created_at > (now() - interval '5 minutes')
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Database-safe idempotent insert:
  IF p_source_event_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      link_url,
      source_event_id,
      source_event_type,
      is_read
    ) VALUES (
      p_recipient_id,
      p_title,
      p_message,
      p_link_url,
      p_source_event_id,
      p_source_event_type,
      false
    )
    ON CONFLICT (user_id, COALESCE(source_event_type, ''), source_event_id) WHERE source_event_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_id;

    -- If concurrent insert won race, fetch the existing ID
    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.notifications
      WHERE user_id = p_recipient_id
        AND COALESCE(source_event_type, '') = COALESCE(p_source_event_type, '')
        AND source_event_id = p_source_event_id
      LIMIT 1;
    END IF;
  ELSE
    -- Ad-hoc notifications without source event identity
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      link_url,
      source_event_id,
      source_event_type,
      is_read
    ) VALUES (
      p_recipient_id,
      p_title,
      p_message,
      p_link_url,
      NULL,
      NULL,
      false
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Strictly revoke dispatch_domain_notification from client access
REVOKE ALL ON FUNCTION dispatch_domain_notification(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- 5. Rebuild Triggers to Pass Deterministic Event Types and Source IDs

-- 5a. Task Assignment Notifier: uses task_assignments.id
CREATE OR REPLACE FUNCTION trg_notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title text;
  v_project_id uuid;
BEGIN
  SELECT title, project_id INTO v_task_title, v_project_id
  FROM public.tasks
  WHERE id = NEW.task_id;

  PERFORM dispatch_domain_notification(
    NEW.assignee_id,
    'Tugas Baru Ditetapkan',
    'Kamu ditugaskan pada task: ' || COALESCE(v_task_title, 'Tanpa Judul'),
    '/projects/' || v_project_id::text,
    NEW.id,
    'TASK_ASSIGNMENT'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_task_assignments_notifier ON task_assignments;
CREATE TRIGGER trg_task_assignments_notifier
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_on_task_assignment();

-- 5b. Revision Request Notifier: uses revision_requests.id
CREATE OR REPLACE FUNCTION trg_notify_on_revision_request()
RETURNS trigger AS $$
DECLARE
  v_task record;
  v_title text;
  v_message text;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.source = 'CLIENT' THEN
    v_title := 'Revisi dari Client';
    v_message := 'Client meminta revisi untuk task: ' || COALESCE(v_task.title, 'Untitled');
  ELSE
    v_title := 'Revisi Internal Diminta';
    v_message := 'Creative Director meminta revisi internal untuk task: ' || COALESCE(v_task.title, 'Untitled');
  END IF;

  PERFORM dispatch_domain_notification(
    NEW.assigned_to,
    v_title,
    v_message,
    '/projects/' || NEW.project_id::text,
    NEW.id,
    'REVISION_REQUEST'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_revision_requests_notifier ON public.revision_requests;
CREATE TRIGGER trg_revision_requests_notifier
  AFTER INSERT ON public.revision_requests
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_revision_request();

-- 5c. QC Approved Review Notifier: uses qc_reviews.id
CREATE OR REPLACE FUNCTION trg_notify_on_qc_review()
RETURNS trigger AS $$
DECLARE
  v_task record;
BEGIN
  IF NEW.result = 'APPROVED' THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    IF FOUND AND v_task.current_assignee_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        v_task.current_assignee_id,
        'Deliverable Disetujui QC',
        'Deliverable untuk task ' || COALESCE(v_task.title, 'Untitled') || ' telah disetujui QC internal.',
        '/projects/' || NEW.project_id::text,
        NEW.id,
        'QC_REVIEW'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_qc_reviews_notifier ON public.qc_reviews;
CREATE TRIGGER trg_qc_reviews_notifier
  AFTER INSERT ON public.qc_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_qc_review();

-- 5d. Task Status Change to IN_REVIEW Notifier
CREATE OR REPLACE FUNCTION trg_notify_on_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
  v_source_id uuid;
BEGIN
  IF NEW.status = 'IN_REVIEW' AND (OLD.status IS DISTINCT FROM 'IN_REVIEW') THEN
    -- Deterministic source: latest uploaded deliverable file for this task
    SELECT id INTO v_source_id
    FROM public.project_files
    WHERE task_id = NEW.id AND deleted_at IS NULL
    ORDER BY version DESC
    LIMIT 1;

    -- Deterministic fallback for synthetic status updates
    IF v_source_id IS NULL THEN
      v_source_id := md5(NEW.id::text || ':' || NEW.updated_at::text)::uuid;
    END IF;

    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'Review QC Dibutuhkan',
        'Task ' || COALESCE(NEW.title, 'Untitled') || ' diajukan untuk review QC internal.',
        '/projects/' || NEW.project_id::text,
        v_source_id,
        'TASK_IN_REVIEW'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_tasks_status_notifier ON public.tasks;
CREATE TRIGGER trg_tasks_status_notifier
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_task_status_change();

-- 5e. Project Status Change Notifier: uses project_status_history.id
CREATE OR REPLACE FUNCTION trg_notify_on_project_status_change()
RETURNS trigger AS $$
DECLARE
  v_cd record;
  v_history_id uuid;
BEGIN
  -- Resolve the deterministic project_status_history record ID
  SELECT id INTO v_history_id
  FROM public.project_status_history
  WHERE project_id = NEW.id AND to_status = NEW.status
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    v_history_id := md5(NEW.id::text || ':' || NEW.status::text || ':' || NEW.updated_at::text)::uuid;
  END IF;

  IF NEW.status = 'INTERNAL_QC' AND OLD.status = 'PRODUCTION' THEN
    FOR v_cd IN
      SELECT id FROM public.profiles WHERE role = 'CREATIVE_DIRECTOR' AND is_active = true
    LOOP
      PERFORM dispatch_domain_notification(
        v_cd.id,
        'QC Internal Project Dimulai',
        'Project ' || NEW.name || ' telah memasuki fase QC internal.',
        '/projects/' || NEW.id::text,
        v_history_id,
        'PROJECT_STATUS_CHANGE'
      );
    END LOOP;
  ELSIF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Disetujui Klien',
        'Project ' || NEW.name || ' telah disetujui klien dan siap dipublikasikan.',
        '/projects/' || NEW.id::text,
        v_history_id,
        'PROJECT_STATUS_CHANGE'
      );
    END IF;
  ELSIF NEW.status = 'PUBLISHED' AND OLD.status != 'PUBLISHED' THEN
    IF NEW.sms_owner_id IS NOT NULL THEN
      PERFORM dispatch_domain_notification(
        NEW.sms_owner_id,
        'Project Telah Dipublikasikan',
        'Project ' || NEW.name || ' resmi dipublikasikan.',
        '/projects/' || NEW.id::text,
        v_history_id,
        'PROJECT_STATUS_CHANGE'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_projects_status_notifier ON public.projects;
CREATE TRIGGER trg_projects_status_notifier
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION trg_notify_on_project_status_change();


-- ==========================================
-- FILE: 20260915000027_27_phase12_1_release_acceptance_hardening.sql
-- ==========================================
-- ==============================================================================
-- Migration 27: Phase 12.1 Release Acceptance Hardening
-- Resolves DB Linter notices, search_path completeness, and anonymous execute revokes.
-- ==============================================================================

-- 1. Fix DB Linter Notice: generate_project_code unreachable return warning
CREATE OR REPLACE FUNCTION generate_project_code(
  p_brand_id uuid
) RETURNS text AS $$
DECLARE
  v_brand_code text;
  v_year text;
  v_seq integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  SELECT code INTO v_brand_code FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  v_year := TO_CHAR(now(), 'YYYY');

  LOOP
    v_seq := nextval('project_code_seq');
    v_candidate := v_brand_code || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE project_code = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Failed to generate project code: loop exhausted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION generate_project_code(uuid) TO authenticated;


-- 2. Fix DB Linter Notice: start_client_re_presentation unused variable v_total_qc_tasks
CREATE OR REPLACE FUNCTION start_client_re_presentation(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
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
    RAISE EXCEPTION 'Cannot start new client presentation: project already has a pending client review round';
  END IF;

  -- Enforce Decision D-002: Mandatory CD re-QC gate
  -- Every active QC-required task must currently be internally APPROVED
  SELECT COUNT(*) INTO v_unapproved_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task(s) are not internally APPROVED (still undergoing revision or internal QC)', v_unapproved_count;
  END IF;

  -- Every task latest file must have an APPROVED qc_review
  SELECT COUNT(*) INTO v_missing_qc_count
  FROM public.tasks t
  CROSS JOIN LATERAL (
    SELECT id, version FROM public.project_files pf
    WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    ORDER BY pf.version DESC LIMIT 1
  ) latest_pf
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.qc_reviews qr
      WHERE qr.task_id = t.id
        AND qr.file_id = latest_pf.id
        AND qr.result = 'APPROVED'
    );

  IF v_missing_qc_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task(s) latest deliverable has not received internal CD approval', v_missing_qc_count;
  END IF;

  -- Verify no OPEN or IN_PROGRESS revision requests exist
  SELECT COUNT(*) INTO v_unresolved_revs
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_unresolved_revs > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % active revision request(s) remain unresolved', v_unresolved_revs;
  END IF;

  -- Determine next sequential round number
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next_round
  FROM public.client_reviews
  WHERE project_id = p_project_id;

  IF v_next_round < 2 THEN
    RAISE EXCEPTION 'Cannot use start_client_re_presentation for Round 1. Use start_client_review().';
  END IF;

  -- Insert client_reviews round header
  INSERT INTO public.client_reviews (
    project_id,
    round_number,
    overall_verdict,
    submitted_by,
    created_at
  ) VALUES (
    p_project_id,
    v_next_round,
    'PENDING',
    auth.uid(),
    now()
  ) RETURNING id INTO v_review_id;

  -- Log CLIENT_REVIEW_RESUBMITTED event
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    'CLIENT_REVIEW_RESUBMITTED',
    jsonb_build_object(
      'round_number', v_next_round,
      'client_review_id', v_review_id,
      'project_status', v_project.status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'round_number', v_next_round,
    'client_review_id', v_review_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_client_re_presentation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_client_re_presentation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION start_client_re_presentation(uuid) TO authenticated;


-- 3. Explicit search_path hardening on auxiliary triggers
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION trg_prevent_project_files_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Physical DELETE on project_files is strictly forbidden. Use soft_delete_project_file() RPC.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION trg_enforce_task_requires_qc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING') THEN
    NEW.requires_qc := true;
  ELSE
    NEW.requires_qc := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 4. Defense-in-Depth: Revoke execute from anon across public schema routines
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL PROCEDURES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;



-- ==========================================
-- FILE: 20260916000028_28_task_start_authority_hardening.sql
-- ==========================================
-- ==============================================================================
-- LOCO TRACK: Task Start Authority Hardening (Phase 12.2)
-- Enforces that transition to IN_PROGRESS can ONLY be performed by the
-- active assigned creative PIC (GRAPHIC_DESIGNER or VIDEO_EDITOR).
-- ==============================================================================

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

  -- 3. IN_PROGRESS -> IN_REVIEW
  ELSIF v_task.status = 'IN_PROGRESS' AND p_new_status = 'IN_REVIEW' THEN
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
    SELECT COALESCE(
      (
        SELECT target_version
        FROM public.revision_requests
        WHERE task_id = p_task_id
          AND revision_type = 'INTERNAL_QC'
          AND status IN ('OPEN', 'IN_PROGRESS')
        ORDER BY target_version DESC
        LIMIT 1
      ),
      (
        SELECT target_version
        FROM public.revision_requests
        WHERE task_id = p_task_id
          AND revision_type = 'CLIENT'
          AND status IN ('OPEN', 'IN_PROGRESS')
        ORDER BY target_version DESC
        LIMIT 1
      )
    ) INTO v_last_revised_version;

    IF v_last_revised_version IS NOT NULL AND v_latest_file.version <= v_last_revised_version THEN
      RAISE EXCEPTION 'New version required: latest file is version %, but revision was requested on version %',
        v_latest_file.version, v_last_revised_version;
    END IF;

    UPDATE public.tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = p_task_id;

    -- Close revision requests as RESOLVED
    UPDATE public.revision_requests
    SET status = 'RESOLVED', updated_at = now()
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


-- ==========================================
-- FILE: 20260916000029_29_deliverable_authority_hardening.sql
-- ==========================================
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


-- ==========================================
-- FILE: 20260916000030_30_task_level_client_review_and_publication.sql
-- ==========================================
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

