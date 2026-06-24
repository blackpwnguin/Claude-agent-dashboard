-- 0002 — granular token tracking, ai_suggestions, dev_items
-- Run in Supabase SQL editor: Project -> SQL Editor -> New query -> paste -> Run
-- Idempotent: safe to re-run.

-- ── 1. Granular token columns on sessions ────────────────────────────────────
-- Add breakdown columns alongside the existing `tokens` total so old data
-- remains intact while new sessions log full detail.
alter table sessions add column if not exists tokens            integer;
alter table sessions add column if not exists input_tokens      integer;
alter table sessions add column if not exists output_tokens     integer;
alter table sessions add column if not exists cache_read_tokens integer;
alter table sessions add column if not exists cache_write_tokens integer;
alter table sessions add column if not exists model             text;
alter table sessions add column if not exists cost_usd          numeric(10,6);
alter table sessions add column if not exists tracked           boolean not null default true;
alter table sessions add column if not exists topic             text;
-- `tokens` becomes the fallback total; granular fields preferred when present.

create index if not exists sessions_project_slug_idx  on sessions (project_slug);
create index if not exists sessions_created_at_idx    on sessions (created_at);
create index if not exists sessions_model_idx         on sessions (model);

-- ── 2. AI suggestions ─────────────────────────────────────────────────────────
-- Improvements, ideas, and warnings surfaced by Claude during work sessions.
create table if not exists ai_suggestions (
  id           uuid primary key default gen_random_uuid(),
  project_slug text not null,
  title        text not null,
  body         text,
  category     text,            -- 'improvement' | 'bug-risk' | 'refactor' | 'idea'
  priority     text,            -- 'high' | 'medium' | 'low'
  status       text not null default 'open',  -- 'open' | 'accepted' | 'dismissed' | 'done'
  source       text not null default 'vault', -- 'vault' | 'portal'
  session_id   uuid references sessions(id) on delete set null,
  updated_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (project_slug, title)
);
create index if not exists ai_suggestions_project_slug_idx on ai_suggestions (project_slug);
create index if not exists ai_suggestions_status_idx       on ai_suggestions (status);
create index if not exists ai_suggestions_category_idx     on ai_suggestions (category);

alter table ai_suggestions enable row level security;

-- ── 3. Development items ──────────────────────────────────────────────────────
-- Bugs, features, refactors, chores — more granular than `tasks`.
create table if not exists dev_items (
  id           uuid primary key default gen_random_uuid(),
  project_slug text not null,
  title        text not null,
  description  text,
  item_type    text not null default 'feature', -- 'bug' | 'feature' | 'refactor' | 'chore'
  priority     text not null default 'medium',  -- 'critical' | 'high' | 'medium' | 'low'
  status       text not null default 'open',    -- 'open' | 'in-progress' | 'done' | 'cancelled'
  stage        text,
  source       text not null default 'vault',   -- 'vault' | 'portal'
  updated_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (project_slug, title)
);
create index if not exists dev_items_project_slug_idx on dev_items (project_slug);
create index if not exists dev_items_status_idx       on dev_items (status);
create index if not exists dev_items_item_type_idx    on dev_items (item_type);
create index if not exists dev_items_priority_idx     on dev_items (priority);

alter table dev_items enable row level security;

-- ── 4. Token usage summary view ──────────────────────────────────────────────
-- Materialised per-project / per-day / per-model aggregation for the UI.
create or replace view token_usage_summary as
select
  project_slug,
  model,
  date_trunc('day', created_at)::date          as day,
  count(*)                                      as session_count,
  sum(coalesce(input_tokens,  0))               as total_input_tokens,
  sum(coalesce(output_tokens, 0))               as total_output_tokens,
  sum(coalesce(cache_read_tokens,  0))          as total_cache_read_tokens,
  sum(coalesce(cache_write_tokens, 0))          as total_cache_write_tokens,
  sum(coalesce(tokens, 0))                      as total_tokens_legacy,
  sum(coalesce(cost_usd, 0))                    as total_cost_usd
from sessions
where tracked = true
group by project_slug, model, date_trunc('day', created_at)::date;

-- ── 5. Convenience: monthly rollup per project ────────────────────────────────
create or replace view token_usage_monthly as
select
  project_slug,
  model,
  date_trunc('month', created_at)::date         as month,
  count(*)                                      as session_count,
  sum(coalesce(input_tokens,  0))               as total_input_tokens,
  sum(coalesce(output_tokens, 0))               as total_output_tokens,
  sum(coalesce(cost_usd, 0))                    as total_cost_usd
from sessions
where tracked = true
group by project_slug, model, date_trunc('month', created_at)::date;
