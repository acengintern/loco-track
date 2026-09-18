-- 03: Workflow and Production Tables
-- content_plans, scripts, tasks, task_assignments, briefs, project_files,
-- qc_reviews, revision_requests, client_reviews, client_review_items,
-- project_status_history, activity_logs, notifications

CREATE TABLE content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  channel text NOT NULL,
  planned_post_date date NOT NULL,
  pillar text NULL,
  copy_draft text NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_plan_id uuid NULL REFERENCES content_plans(id) ON DELETE SET NULL,
  title text NOT NULL,
  hook text NOT NULL,
  body text NOT NULL,
  visual_cues text NOT NULL,
  call_to_action text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_plan_id uuid NULL REFERENCES content_plans(id) ON DELETE SET NULL,
  script_id uuid NULL REFERENCES scripts(id) ON DELETE SET NULL,
  title text NOT NULL,
  task_type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'TODO',
  requires_qc boolean NOT NULL DEFAULT false,
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  current_assignee_id uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  deadline timestamptz NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL
);

CREATE TABLE briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  objective text NOT NULL,
  target_audience text NOT NULL,
  key_message text NOT NULL,
  deliverables_summary text NOT NULL,
  reference_links text NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NULL REFERENCES tasks(id) ON DELETE SET NULL,
  asset_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_type file_category NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT uq_project_files_asset_version UNIQUE (asset_group_id, version)
);

CREATE TABLE qc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES project_files(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  result qc_verdict NOT NULL,
  notes text NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qc_reviews_task_round UNIQUE (task_id, round_number)
);

CREATE TABLE revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  qc_review_id uuid NULL REFERENCES qc_reviews(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source revision_source NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  notes text NOT NULL,
  status revision_status NOT NULL DEFAULT 'OPEN',
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  round_number integer NOT NULL DEFAULT 1,
  overall_verdict client_review_verdict NOT NULL DEFAULT 'PENDING',
  general_feedback text NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_reviews_project_round UNIQUE (project_id, round_number)
);

CREATE TABLE client_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_review_id uuid NOT NULL REFERENCES client_reviews(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES project_files(id) ON DELETE RESTRICT,
  verdict qc_verdict NOT NULL,
  feedback_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_review_items_review_task UNIQUE (client_review_id, task_id)
);

CREATE TABLE project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status project_phase NOT NULL,
  to_status project_phase NOT NULL,
  changed_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link_url text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
