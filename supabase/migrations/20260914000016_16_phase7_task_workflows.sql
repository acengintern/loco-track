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
