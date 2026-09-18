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
