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
