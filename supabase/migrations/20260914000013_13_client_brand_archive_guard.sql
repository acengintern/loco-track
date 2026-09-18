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
