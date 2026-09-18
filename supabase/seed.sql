-- LOCO TRACK Local Development Seed Data
-- Deterministic test users, roles, sample project, and tasks

-- 1. Test Users in auth.users (Local development only)
-- Password for all test users: 'password123'
-- Hash generated via standard bcrypt cost 10: $2a$10$0G8iE5wI1Jj7N2xH.3jHie7B9fB7bU0cK7xS0F9n5N8aE3m0V4rGe
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'admin@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Super Administrator"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'cd@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Clara Director"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'ae@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Executive"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'sms@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Specialist"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'designer@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Diana Designer"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'editor@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Evan Editor"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'inactive@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Ian Inactive"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'sms2@locotrack.local', crypt('password123', gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"full_name":"Second Specialist"}', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at;

-- 1b. Test User Identities in auth.identities
INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id::text,
  id,
  json_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
FROM auth.users
ON CONFLICT (provider_id, provider) DO NOTHING;


-- 2. Test Profiles in public.profiles
INSERT INTO public.profiles (id, full_name, email, role, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Super Administrator', 'admin@locotrack.local', 'ADMIN', true),
  ('00000000-0000-0000-0000-000000000002', 'Clara Director', 'cd@locotrack.local', 'CREATIVE_DIRECTOR', true),
  ('00000000-0000-0000-0000-000000000003', 'Alex Executive', 'ae@locotrack.local', 'ACCOUNT_EXECUTIVE', true),
  ('00000000-0000-0000-0000-000000000004', 'Sam Specialist', 'sms@locotrack.local', 'SOCIAL_MEDIA_SPECIALIST', true),
  ('00000000-0000-0000-0000-000000000005', 'Diana Designer', 'designer@locotrack.local', 'GRAPHIC_DESIGNER', true),
  ('00000000-0000-0000-0000-000000000006', 'Evan Editor', 'editor@locotrack.local', 'VIDEO_EDITOR', true),
  ('00000000-0000-0000-0000-000000000007', 'Ian Inactive', 'inactive@locotrack.local', 'GRAPHIC_DESIGNER', false),
  ('00000000-0000-0000-0000-000000000008', 'Second Specialist', 'sms2@locotrack.local', 'SOCIAL_MEDIA_SPECIALIST', true)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 3. Sample Client and Brand
INSERT INTO public.clients (id, name, contact_name, contact_email, contact_phone, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Acme Global Corp',
  'John Client',
  'john@acme.com',
  '+1-555-0100',
  '00000000-0000-0000-0000-000000000004'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.brands (id, client_id, name, code, created_by)
VALUES 
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Acme Tech',
    'ACM',
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Unused Brand',
    'UNU',
    '00000000-0000-0000-0000-000000000004'
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Projects
INSERT INTO public.projects (
  id,
  project_code,
  brand_id,
  name,
  status,
  sms_owner_id,
  deadline,
  created_by
) VALUES 
  (
    '30000000-0000-0000-0000-000000000001',
    'ACM-2026-0001',
    '20000000-0000-0000-0000-000000000001',
    'Acme Q1 Product Launch Campaign',
    'PRODUCTION',
    '00000000-0000-0000-0000-000000000004',
    now() + interval '14 days',
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'ACM-2026-0002',
    '20000000-0000-0000-0000-000000000001',
    'Project Beta Isolated Campaign',
    'CONTENT_PLANNING',
    '00000000-0000-0000-0000-000000000008',
    now() + interval '20 days',
    '00000000-0000-0000-0000-000000000008'
  )
ON CONFLICT (id) DO NOTHING;

-- Synchronize sequence to prevent collision with sample projects
SELECT setval('project_code_seq', 10);

-- 5. Project Members
INSERT INTO public.project_members (project_id, user_id)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 6. Brief
INSERT INTO public.briefs (
  id,
  project_id,
  objective,
  target_audience,
  key_message,
  deliverables_summary,
  created_by
) VALUES  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Launch new AI Productivity Suite across social channels',
    'Knowledge workers, product managers, developers aged 22-45',
    'Double your output with calm, intuitive tools',
    '5-slide carousel, 30s reels video',
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Beta Campaign Launch Plan',
    'Enterprise Buyers',
    'Transform enterprise agility',
    '3 banners',
    '00000000-0000-0000-0000-000000000008'
  )
ON CONFLICT (project_id) DO NOTHING;

-- 7. Creative Tasks
INSERT INTO public.tasks (
  id,
  project_id,
  title,
  task_type,
  status,
  requires_qc,
  priority,
  current_assignee_id,
  deadline
) VALUES 
  (
    '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Design 5-Slide Instagram Launch Carousel',
    'GRAPHIC_DESIGN',
    'IN_PROGRESS',
    true,
    'HIGH',
    '00000000-0000-0000-0000-000000000005',
    now() + interval '5 days'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'Edit 30s TikTok/Reels Teaser Video',
    'VIDEO_EDITING',
    'TODO',
    true,
    'HIGH',
    '00000000-0000-0000-0000-000000000006',
    now() + interval '7 days'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    'Beta Campaign Banner',
    'GRAPHIC_DESIGN',
    'TODO',
    false,
    'MEDIUM',
    '00000000-0000-0000-0000-000000000008',
    now() + interval '10 days'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Task Assignments
INSERT INTO public.task_assignments (
  id,
  task_id,
  assignee_id,
  assigned_by,
  assigned_at
) VALUES 
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000004',
    now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000004',
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 9. Sample Project Files
INSERT INTO public.project_files (
  id,
  project_id,
  task_id,
  asset_group_id,
  version,
  storage_bucket,
  storage_path,
  file_name,
  file_type,
  mime_type,
  file_size_bytes,
  uploaded_by
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  1,
  'project-assets',
  '30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/carousel_draft_v1.fig',
  'carousel_draft_v1.fig',
  'DESIGN',
  'application/octet-stream',
  10485760,
  '00000000-0000-0000-0000-000000000005'
) ON CONFLICT (id) DO NOTHING;

-- 10. Sample QC Review
INSERT INTO public.qc_reviews (
  id,
  project_id,
  task_id,
  file_id,
  reviewer_id,
  result,
  notes,
  round_number
) VALUES (
  '80000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'REVISION_REQUESTED',
  'Adjust brand typography in slides 2 and 4 to use primary sans font.',
  1
) ON CONFLICT (id) DO NOTHING;
