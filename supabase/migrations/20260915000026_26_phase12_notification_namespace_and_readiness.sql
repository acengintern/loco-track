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
