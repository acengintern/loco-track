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
