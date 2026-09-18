-- 31: Add username support to public.profiles
-- Enables login via unique lowercase usernames alongside existing emails

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Backfill usernames for existing profiles from email prefix
UPDATE public.profiles
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_.-]', '_', 'g'))
WHERE username IS NULL;

-- Enforce format constraint: 3-30 characters, alphanumeric, dots, underscores, hyphens
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_.-]{3,30}$');

-- Case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;
