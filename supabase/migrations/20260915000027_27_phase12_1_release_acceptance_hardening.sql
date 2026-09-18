-- ==============================================================================
-- Migration 27: Phase 12.1 Release Acceptance Hardening
-- Resolves DB Linter notices, search_path completeness, and anonymous execute revokes.
-- ==============================================================================

-- 1. Fix DB Linter Notice: generate_project_code unreachable return warning
CREATE OR REPLACE FUNCTION generate_project_code(
  p_brand_id uuid
) RETURNS text AS $$
DECLARE
  v_brand_code text;
  v_year text;
  v_seq integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  SELECT code INTO v_brand_code FROM public.brands WHERE id = p_brand_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  v_year := TO_CHAR(now(), 'YYYY');

  LOOP
    v_seq := nextval('project_code_seq');
    v_candidate := v_brand_code || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE project_code = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Failed to generate project code: loop exhausted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_project_code(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION generate_project_code(uuid) TO authenticated;


-- 2. Fix DB Linter Notice: start_client_re_presentation unused variable v_total_qc_tasks
CREATE OR REPLACE FUNCTION start_client_re_presentation(
  p_project_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_project record;
  v_unapproved_count integer;
  v_unresolved_revs integer;
  v_active_pending_rounds integer;
  v_next_round integer;
  v_review_id uuid;
  v_missing_qc_count integer;
BEGIN
  IF NOT is_active_user() THEN
    RAISE EXCEPTION 'Unauthorized: caller is inactive or unauthenticated';
  END IF;

  v_caller_role := auth_user_role();

  -- Row-lock project
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or archived';
  END IF;

  -- Authority: Assigned project SMS owner only (Section 24)
  IF NOT (
    v_caller_role = 'SOCIAL_MEDIA_SPECIALIST' AND v_project.sms_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned project SMS owner can re-present to client';
  END IF;

  IF v_project.status != 'CLIENT_REVIEW' THEN
    RAISE EXCEPTION 'Project must be in CLIENT_REVIEW phase to re-present (current: %)', v_project.status;
  END IF;

  -- Enforce at most one active (PENDING) round per project
  SELECT COUNT(*) INTO v_active_pending_rounds
  FROM public.client_reviews
  WHERE project_id = p_project_id AND overall_verdict = 'PENDING';

  IF v_active_pending_rounds > 0 THEN
    RAISE EXCEPTION 'Cannot start new client presentation: project already has a pending client review round';
  END IF;

  -- Enforce Decision D-002: Mandatory CD re-QC gate
  -- Every active QC-required task must currently be internally APPROVED
  SELECT COUNT(*) INTO v_unapproved_count
  FROM public.tasks
  WHERE project_id = p_project_id
    AND requires_qc = true
    AND deleted_at IS NULL
    AND status != 'APPROVED';

  IF v_unapproved_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task(s) are not internally APPROVED (still undergoing revision or internal QC)', v_unapproved_count;
  END IF;

  -- Every task latest file must have an APPROVED qc_review
  SELECT COUNT(*) INTO v_missing_qc_count
  FROM public.tasks t
  CROSS JOIN LATERAL (
    SELECT id, version FROM public.project_files pf
    WHERE pf.task_id = t.id AND pf.deleted_at IS NULL
    ORDER BY pf.version DESC LIMIT 1
  ) latest_pf
  WHERE t.project_id = p_project_id
    AND t.requires_qc = true
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.qc_reviews qr
      WHERE qr.task_id = t.id
        AND qr.file_id = latest_pf.id
        AND qr.result = 'APPROVED'
    );

  IF v_missing_qc_count > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % task(s) latest deliverable has not received internal CD approval', v_missing_qc_count;
  END IF;

  -- Verify no OPEN or IN_PROGRESS revision requests exist
  SELECT COUNT(*) INTO v_unresolved_revs
  FROM public.revision_requests
  WHERE project_id = p_project_id
    AND status IN ('OPEN', 'IN_PROGRESS');

  IF v_unresolved_revs > 0 THEN
    RAISE EXCEPTION 'Cannot re-present to client: % active revision request(s) remain unresolved', v_unresolved_revs;
  END IF;

  -- Determine next sequential round number
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next_round
  FROM public.client_reviews
  WHERE project_id = p_project_id;

  IF v_next_round < 2 THEN
    RAISE EXCEPTION 'Cannot use start_client_re_presentation for Round 1. Use start_client_review().';
  END IF;

  -- Insert client_reviews round header
  INSERT INTO public.client_reviews (
    project_id,
    round_number,
    overall_verdict,
    submitted_by,
    created_at
  ) VALUES (
    p_project_id,
    v_next_round,
    'PENDING',
    auth.uid(),
    now()
  ) RETURNING id INTO v_review_id;

  -- Log CLIENT_REVIEW_RESUBMITTED event
  INSERT INTO public.activity_logs (
    project_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    'CLIENT_REVIEW_RESUBMITTED',
    jsonb_build_object(
      'round_number', v_next_round,
      'client_review_id', v_review_id,
      'project_status', v_project.status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'round_number', v_next_round,
    'client_review_id', v_review_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_client_re_presentation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_client_re_presentation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION start_client_re_presentation(uuid) TO authenticated;


-- 3. Explicit search_path hardening on auxiliary triggers
CREATE OR REPLACE FUNCTION trg_prevent_project_files_metadata_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != OLD.id
     OR NEW.project_id != OLD.project_id
     OR NEW.task_id != OLD.task_id
     OR NEW.asset_group_id != OLD.asset_group_id
     OR NEW.version != OLD.version
     OR NEW.storage_bucket != OLD.storage_bucket
     OR NEW.storage_path != OLD.storage_path
     OR NEW.uploaded_by != OLD.uploaded_by
     OR NEW.created_at != OLD.created_at
     OR (NEW.file_name IS DISTINCT FROM OLD.file_name)
     OR (NEW.file_type IS DISTINCT FROM OLD.file_type)
     OR (NEW.mime_type IS DISTINCT FROM OLD.mime_type)
     OR (NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes)
  THEN
    RAISE EXCEPTION 'project_files metadata is immutable. Only deleted_at lifecycle mutation is permitted via soft_delete_project_file() RPC.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION trg_prevent_project_files_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Physical DELETE on project_files is strictly forbidden. Use soft_delete_project_file() RPC.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION trg_enforce_task_requires_qc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_type IN ('GRAPHIC_DESIGN', 'VIDEO_EDITING') THEN
    NEW.requires_qc := true;
  ELSE
    NEW.requires_qc := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 4. Defense-in-Depth: Revoke execute from anon across public schema routines
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL PROCEDURES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

