BEGIN;

-- 1. Client: PT Kopi Kenangan Nusantara
INSERT INTO clients (
  id,
  name,
  contact_name,
  contact_email,
  contact_phone,
  description,
  is_active,
  created_by
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'PT Kopi Kenangan Nusantara',
  'Rian Pratama',
  'rian.pratama@kopikenangan.id',
  '+6281234567890',
  'Perusahaan ritel makanan dan minuman terkemuka di Indonesia.',
  true,
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  description = EXCLUDED.description;

-- 2. Brand: Kopi Kenangan (KPKN)
INSERT INTO brands (
  id,
  client_id,
  name,
  code,
  description,
  created_by
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Kopi Kenangan',
  'KPKN',
  'Brand kopi grab-and-go premium kebanggaan Indonesia.',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description;

-- 3. Project: KPKN-2026-0001
INSERT INTO projects (
  id,
  project_code,
  brand_id,
  name,
  description,
  priority,
  status,
  sms_owner_id,
  start_date,
  deadline,
  created_by
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'KPKN-2026-0001',
  '22222222-2222-4222-8222-222222222222',
  'Campaign Menu Musim Panas 2026',
  'Peluncuran varian seasonal series kelapa segar dan espresso untuk kanal Instagram & TikTok.',
  'HIGH',
  'PRODUCTION',
  '00000000-0000-0000-0000-000000000004',
  '2026-09-16',
  '2026-10-15 23:59:59+07',
  '00000000-0000-0000-0000-000000000004'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  deadline = EXCLUDED.deadline;

-- 4. Project Members
INSERT INTO project_members (project_id, user_id)
VALUES 
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000002'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000004'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000005'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000006')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 5. Brief
INSERT INTO briefs (
  id,
  project_id,
  objective,
  target_audience,
  key_message,
  deliverables_summary,
  reference_links,
  created_by
) VALUES (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Meningkatkan awareness dan transaksi menu seasonal series hingga 25% di seluruh gerai Jabodetabek.',
  'Generasi Z dan milenial perkotaan usia 18-35 tahun pencinta minuman kopi segar.',
  'Sensasi dingin kelapa asli berpadu mantap dengan espresso premium Kenangan.',
  '3 Konten Carousel Feed Instagram (1080x1350) dan 2 Konten Video Reels/TikTok (9:16) 15-30s.',
  'https://instagram.com/p/summer-ref1',
  '00000000-0000-0000-0000-000000000004'
) ON CONFLICT (project_id) DO UPDATE SET
  objective = EXCLUDED.objective,
  target_audience = EXCLUDED.target_audience,
  key_message = EXCLUDED.key_message,
  deliverables_summary = EXCLUDED.deliverables_summary;

-- 6. Content Plan
INSERT INTO content_plans (
  id,
  project_id,
  title,
  channel,
  planned_post_date,
  pillar,
  copy_draft,
  status,
  created_by
) VALUES (
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  'Feed Carousel: Peluncuran Resmi Coconut Espresso Series',
  'INSTAGRAM',
  '2026-09-22',
  'PROMOTION',
  'Yang dingin dan segar akhirnya datang! Rasakan paduan air kelapa asli dan espresso khas Kopi Kenangan.',
  'APPROVED',
  '00000000-0000-0000-0000-000000000004'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  channel = EXCLUDED.channel,
  status = EXCLUDED.status;

-- 7. Script
INSERT INTO scripts (
  id,
  project_id,
  content_plan_id,
  title,
  hook,
  body,
  visual_cues,
  call_to_action,
  status,
  created_by
) VALUES (
  '66666666-6666-4666-8666-666666666666',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  'Reels Teaser: Sensasi Segar Kopi Kelapa',
  'Udah pernah coba kopi dicampur air kelapa murni belum?',
  'Bukan cuma manis biasa, tapi segarnya kelapa muda dingin langsung seimbangin rasa pekat legit espresso Kenangan.',
  'Shot pembuka embun pada gelas dingin, tuangan espresso ke batok kelapa segar dengan es batu kristal (slow-motion 60fps).',
  'Coba sekarang di gerai Kopi Kenangan terdekat atau order lewat aplikasi Kenangan!',
  'READY',
  '00000000-0000-0000-0000-000000000004'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  hook = EXCLUDED.hook,
  status = EXCLUDED.status;

-- 8. Tasks
INSERT INTO tasks (
  id,
  project_id,
  content_plan_id,
  title,
  task_type,
  status,
  priority,
  requires_qc,
  current_assignee_id,
  deadline,
  notes
) VALUES (
  '77777777-7777-4777-8777-777777777777',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  'Desain Carousel Feed 3 Slide: Reveal Menu',
  'GRAPHIC_DESIGN',
  'IN_PROGRESS',
  'HIGH',
  true,
  '00000000-0000-0000-0000-000000000005',
  '2026-09-24 17:00:00+07',
  'Buat 3 slide format 1080x1350px dengan warna brand tropis yang cerah dan modern.'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  current_assignee_id = EXCLUDED.current_assignee_id;

INSERT INTO tasks (
  id,
  project_id,
  content_plan_id,
  script_id,
  title,
  task_type,
  status,
  priority,
  requires_qc,
  current_assignee_id,
  deadline,
  notes
) VALUES (
  '88888888-8888-4888-8888-888888888888',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  'Editing Video Reels 15s: Teaser Segar Kopi Kelapa',
  'VIDEO_EDITING',
  'TODO',
  'MEDIUM',
  true,
  '00000000-0000-0000-0000-000000000006',
  '2026-09-28 17:00:00+07',
  'Edit vertikal 9:16 dengan musik up-beat berlisensi dan sound design es batu yang jernih.'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  current_assignee_id = EXCLUDED.current_assignee_id;

-- 9. Task Assignments
INSERT INTO task_assignments (task_id, assignee_id, assigned_by)
VALUES 
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004'),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

COMMIT;
