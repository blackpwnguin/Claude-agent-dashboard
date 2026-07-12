-- 0004 — per-repo tracking + ICM command-center source
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query -> Run).
-- Idempotent: safe to re-run. Additive only — no data is dropped.
--
-- Purpose: let the dashboard track updates per GitHub repo, fed by the ICM
-- command-center (workspaces/command-center in the icm-enhanced repo) via
-- `npm run sync-icm`. ICM rows use source = 'icm' and never collide with
-- 'vault' or 'portal' rows.

-- Link a project to its GitHub repo so the dashboard can show per-repo tracking.
alter table projects add column if not exists repo        text;  -- owner/name
alter table projects add column if not exists github_url  text;
alter table projects add column if not exists visibility  text;  -- public | private
create index if not exists projects_repo_idx on projects (repo);

-- Tag build-log entries with the ICM domain they belong to (seo, analytics, …),
-- so per-repo updates can be grouped by domain in the UI.
alter table build_logs add column if not exists domain text;
create index if not exists build_logs_domain_idx on build_logs (domain);

-- Optional convenience view: latest update per project (vault + icm + portal).
create or replace view project_latest_update as
select
  p.slug,
  p.display_name,
  p.repo,
  p.status,
  p.stage,
  greatest(
    coalesce(p.updated_at, 'epoch'::timestamptz),
    coalesce((select max(b.updated_at) from build_logs b where b.project_slug = p.slug), 'epoch'::timestamptz)
  ) as last_update,
  (select count(*) from build_logs b where b.project_slug = p.slug) as update_count
from projects p;
