-- 01: Enums, Extensions, and Core Sequences
-- LOCO TRACK Database Infrastructure

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Invariant agency operational roles
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'CREATIVE_DIRECTOR',
  'ACCOUNT_EXECUTIVE',
  'SOCIAL_MEDIA_SPECIALIST',
  'GRAPHIC_DESIGNER',
  'VIDEO_EDITOR'
);

-- Macro project lifecycle phase
CREATE TYPE project_phase AS ENUM (
  'BRIEF_RECEIVED',
  'CONTENT_PLANNING',
  'SCRIPT_READY',
  'PRODUCTION',
  'INTERNAL_QC',
  'CLIENT_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'DONE',
  'CANCELLED'
);

-- Operational task discipline classification
CREATE TYPE task_type AS ENUM (
  'CONTENT_PLAN',
  'SCRIPT',
  'GRAPHIC_DESIGN',
  'VIDEO_EDITING',
  'PUBLISHING',
  'OTHER'
);

-- Task state machine statuses
CREATE TYPE task_status AS ENUM (
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'REVISION_REQUESTED',
  'APPROVED',
  'COMPLETED'
);

-- Urgency and scheduling priority
CREATE TYPE priority_level AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- File category taxonomy
CREATE TYPE file_category AS ENUM (
  'BRIEF',
  'REFERENCE',
  'RAW_FOOTAGE',
  'AUDIO',
  'DESIGN',
  'VIDEO',
  'DOCUMENT'
);

-- QC review and deliverable verdict
CREATE TYPE qc_verdict AS ENUM (
  'APPROVED',
  'REVISION_REQUESTED'
);

-- Revision origin classification
CREATE TYPE revision_source AS ENUM (
  'INTERNAL_QC',
  'CLIENT'
);

-- Revision iteration status
CREATE TYPE revision_status AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED'
);

-- Client review session outcome
CREATE TYPE client_review_verdict AS ENUM (
  'PENDING',
  'APPROVED',
  'REVISION_REQUESTED'
);

-- Concurrency-safe project code counter
CREATE SEQUENCE IF NOT EXISTS project_code_seq START WITH 1 INCREMENT BY 1;
