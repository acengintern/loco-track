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
