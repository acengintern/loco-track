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
