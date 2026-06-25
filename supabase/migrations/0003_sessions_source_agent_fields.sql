-- 0003 — add missing fields to sessions table
-- Adds: source (vault vs portal), agent (hermes vs claude-code)
-- Idempotent: safe to re-run.

-- source: which system wrote this row ('vault' = synced from Obsidian, 'portal' = created via dashboard UI)
alter table sessions add column if not exists source text not null default 'vault';
create index if not exists sessions_source_idx on sessions (source);

-- agent: which AI harness ran this session ('hermes' = Hermes, 'claude-code' = Claude Code CLI)
-- already exists from 0002 check but guard it
alter table sessions add column if not exists agent text;
create index if not exists sessions_agent_idx on sessions (agent);
