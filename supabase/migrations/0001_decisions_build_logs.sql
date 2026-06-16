-- 0001 — decisions + build_logs tables, project summary, sessions link
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query -> paste -> Run).
-- Idempotent: safe to re-run.

-- Decision notes (type: decision) surfaced as their own rows.
create table if not exists decisions (
  id           uuid primary key default gen_random_uuid(),
  project_slug text not null,
  title        text not null,
  status       text,
  stage        text,
  summary      text,
  source       text not null default 'vault',
  updated_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (project_slug, title)
);
create index if not exists decisions_project_slug_idx on decisions (project_slug);
create index if not exists decisions_status_idx       on decisions (status);

-- Build-log notes (type: build-log) surfaced as their own rows.
create table if not exists build_logs (
  id           uuid primary key default gen_random_uuid(),
  project_slug text not null,
  title        text not null,
  status       text,
  stage        text,
  summary      text,
  source       text not null default 'vault',
  updated_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (project_slug, title)
);
create index if not exists build_logs_project_slug_idx on build_logs (project_slug);
create index if not exists build_logs_status_idx       on build_logs (status);

-- Short summary on projects for the detail view (first paragraph of the overview note).
alter table projects add column if not exists summary text;

-- Ensure a sessions table exists (powers Claude status / token usage) and can link to a project.
create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  agent      text not null,
  tokens     integer,
  summary    text,
  project_slug text,
  created_at timestamptz not null default now()
);
alter table sessions add column if not exists project_slug text;

-- Lock down the new tables: only the service-role key (used by the dashboard
-- and sync) can touch them; the public anon key cannot. Service role bypasses RLS.
alter table decisions  enable row level security;
alter table build_logs enable row level security;
