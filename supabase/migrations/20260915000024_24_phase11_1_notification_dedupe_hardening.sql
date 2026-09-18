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
