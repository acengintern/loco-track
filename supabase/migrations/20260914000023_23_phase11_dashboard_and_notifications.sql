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
