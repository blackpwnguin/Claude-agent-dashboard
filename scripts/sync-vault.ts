/**
 * sync-vault.ts
 *
 * Crawls an Obsidian knowledge vault, parses YAML frontmatter from markdown
 * notes, and upserts the results into Supabase.
 *
 *   - `type: project-overview` -> upsert into `projects`    (conflict on `slug`)
 *   - `type: spec`             -> upsert into `tasks`       (matched on project_slug + title)
 *   - `type: decision`         -> upsert into `decisions`   (matched on project_slug + title)
 *   - `type: build-log`        -> upsert into `build_logs`  (matched on project_slug + title)
 *   - `STATUS.md` per workspace -> updates the matching `projects` row
 *
 * `source: portal` rows are never overwritten. Run with: npm run sync-vault
 * (needs VAULT_PATH + Supabase env vars; see .env.local).
 */

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getSupabaseAdmin } from '@/lib/supabase'

// Workspaces we crawl. Everything else (_reference, _templates) is skipped.
const WORKSPACES = ['nihilo', 'oikos', 'stowed', 'homelab'] as const

const VALID_STATUSES = ['spec', 'building', 'shipped', 'archived'] as const
type Status = (typeof VALID_STATUSES)[number]

type Summary = {
  filesScanned: number
  projectsUpserted: number
  tasksUpserted: number
  decisionsUpserted: number
  buildLogsUpserted: number
  skipped: number
  errors: number
  portalProtected: number
}

/**
 * Load .env.local into process.env when the variables are not already set, so
 * `tsx scripts/sync-vault.ts` works without a separate dotenv dependency.
 */
function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

/** Recursively collect every `.md` file beneath `dir`. */
function collectMarkdown(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectMarkdown(full))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

/** Map any incoming status string onto the controlled vocabulary. */
function normalizeStatus(raw: unknown): Status {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'p0-shipped') return 'shipped'
  if (value === 'in-progress') return 'building'
  return (VALID_STATUSES as readonly string[]).includes(value) ? (value as Status) : 'spec'
}

/** Frontmatter `stage`; treat "-" / empty as no stage. */
function normalizeStage(raw: unknown): string | null {
  const value = String(raw ?? '').trim()
  return value && value !== '-' ? value : null
}

/**
 * Coerce a frontmatter `updated` value into ISO 8601 for Postgres.
 * YAML parses unquoted dates (e.g. `updated: 2026-06-10`) into a JS Date, whose
 * default string form ("...GMT-0400...") Postgres can't parse.
 */
function toISODate(raw: unknown): string {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString()
  if (raw) {
    const d = new Date(String(raw))
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

/** First Markdown H1 ("# Title") in the body, or null. */
function firstH1(content: string): string | null {
  const m = content.match(/^#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : null
}

/** First real paragraph (skips leading headings), capped, for a summary blurb. */
function firstParagraph(content: string): string | null {
  const buf: string[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) {
      if (buf.length) break
      continue
    }
    buf.push(t)
  }
  const p = buf.join(' ').trim()
  return p ? p.slice(0, 500) : null
}

async function upsertProject(
  data: Record<string, any>,
  content: string,
  summary: Summary,
): Promise<void> {
  const slug = String(data.slug ?? data.project ?? '').trim()
  if (!slug) {
    console.warn('  ! project-overview note has no slug/project — skipping')
    summary.skipped++
    return
  }
  const row = {
    slug,
    display_name: data.display_name ?? data.title ?? firstH1(content) ?? slug,
    status: normalizeStatus(data.status),
    stage: normalizeStage(data.stage),
    summary: firstParagraph(content),
    updated_at: toISODate(data.updated),
  }
  const { error } = await getSupabaseAdmin()
    .from('projects')
    .upsert(row, { onConflict: 'slug' })
  if (error) {
    console.error(`  x projects upsert failed (${slug}): ${error.message}`)
    summary.errors++
    return
  }
  summary.projectsUpserted++
  console.log(`  ✓ project: ${slug}`)
}

/**
 * Upsert a note keyed on (project_slug, title) into a child table. Shared by
 * specs->tasks, decisions->decisions, build-logs->build_logs. Portal-safe.
 */
async function upsertNote(
  table: 'tasks' | 'decisions' | 'build_logs',
  label: string,
  counter: 'tasksUpserted' | 'decisionsUpserted' | 'buildLogsUpserted',
  withSummary: boolean,
  data: Record<string, any>,
  content: string,
  summary: Summary,
): Promise<void> {
  const projectSlug = String(data.project ?? '').trim()
  const title = firstH1(content)
  if (!projectSlug || !title) {
    console.warn(`  ! ${label} note missing project or H1 title — skipping`)
    summary.skipped++
    return
  }

  const admin = getSupabaseAdmin()

  const { data: existing, error: lookupError } = await admin
    .from(table)
    .select('id, source')
    .eq('project_slug', projectSlug)
    .eq('title', title)
    .maybeSingle()
  if (lookupError) {
    console.error(`  x ${label} lookup failed (${projectSlug} / ${title}): ${lookupError.message}`)
    summary.errors++
    return
  }

  if (existing && existing.source === 'portal') {
    console.log(`  · skip portal-owned ${label}: ${projectSlug} / ${title}`)
    summary.portalProtected++
    summary.skipped++
    return
  }

  const fields: Record<string, any> = {
    project_slug: projectSlug,
    title,
    status: normalizeStatus(data.status),
    stage: normalizeStage(data.stage),
    source: 'vault',
    updated_at: toISODate(data.updated),
  }
  if (withSummary) fields.summary = firstParagraph(content)

  const result = existing
    ? await admin.from(table).update(fields).eq('id', existing.id)
    : await admin.from(table).insert(fields)
  if (result.error) {
    console.error(`  x ${label} upsert failed (${projectSlug} / ${title}): ${result.error.message}`)
    summary.errors++
    return
  }
  summary[counter]++
  console.log(`  ✓ ${label}: ${projectSlug} / ${title}`)
}

/** Read `<workspace>/STATUS.md` and patch the matching projects row. */
async function applyStatusFile(
  workspace: string,
  vaultPath: string,
  summary: Summary,
): Promise<void> {
  const statusPath = path.join(vaultPath, workspace, 'STATUS.md')
  if (!fs.existsSync(statusPath)) return
  let parsed
  try {
    parsed = matter(fs.readFileSync(statusPath, 'utf8'))
  } catch (err) {
    console.error(`  x failed to parse ${workspace}/STATUS.md: ${(err as Error).message}`)
    summary.errors++
    return
  }
  if (Object.keys(parsed.data).length === 0) return
  const slug = String(parsed.data.project ?? workspace).trim()
  const { error } = await getSupabaseAdmin()
    .from('projects')
    .update({
      status: normalizeStatus(parsed.data.status),
      stage: normalizeStage(parsed.data.stage),
    })
    .eq('slug', slug)
  if (error) {
    console.error(`  x STATUS.md update failed (${slug}): ${error.message}`)
    summary.errors++
    return
  }
  console.log(`  ✓ STATUS.md applied: ${slug}`)
}

async function main(): Promise<void> {
  loadEnvLocal()

  const vaultPath = process.env.VAULT_PATH
  if (!vaultPath) {
    console.error('VAULT_PATH is not set. Point it at the root of your Obsidian vault.')
    process.exit(1)
  }
  if (!fs.existsSync(vaultPath)) {
    console.error(`VAULT_PATH does not exist: ${vaultPath}`)
    process.exit(1)
  }

  const summary: Summary = {
    filesScanned: 0,
    projectsUpserted: 0,
    tasksUpserted: 0,
    decisionsUpserted: 0,
    buildLogsUpserted: 0,
    skipped: 0,
    errors: 0,
    portalProtected: 0,
  }

  for (const workspace of WORKSPACES) {
    const wsDir = path.join(vaultPath, workspace)
    const files = collectMarkdown(wsDir)
    for (const file of files) {
      summary.filesScanned++
      const rel = path.relative(vaultPath, file)
      let parsed
      try {
        parsed = matter(fs.readFileSync(file, 'utf8'))
      } catch (err) {
        console.error(`  x parse error (${rel}): ${(err as Error).message}`)
        summary.errors++
        continue
      }

      // Skip files without frontmatter.
      if (Object.keys(parsed.data).length === 0) {
        summary.skipped++
        continue
      }

      switch (parsed.data.type) {
        case 'project-overview':
          await upsertProject(parsed.data, parsed.content, summary)
          break
        case 'spec':
          await upsertNote('tasks', 'task', 'tasksUpserted', false, parsed.data, parsed.content, summary)
          break
        case 'decision':
          await upsertNote('decisions', 'decision', 'decisionsUpserted', true, parsed.data, parsed.content, summary)
          break
        case 'build-log':
          await upsertNote('build_logs', 'build-log', 'buildLogsUpserted', true, parsed.data, parsed.content, summary)
          break
        default:
          // Has frontmatter but not a synced type (reference, index, audit…).
          summary.skipped++
      }
    }

    // STATUS.md overrides project status/stage after the crawl.
    await applyStatusFile(workspace, vaultPath, summary)
  }

  console.log('\n── vault sync summary ──────────────────')
  console.log(`  files scanned      : ${summary.filesScanned}`)
  console.log(`  projects upserted  : ${summary.projectsUpserted}`)
  console.log(`  tasks upserted     : ${summary.tasksUpserted}`)
  console.log(`  decisions upserted : ${summary.decisionsUpserted}`)
  console.log(`  build-logs upserted: ${summary.buildLogsUpserted}`)
  console.log(`  skipped            : ${summary.skipped} (incl. ${summary.portalProtected} portal-owned)`)
  console.log(`  errors             : ${summary.errors}`)
  console.log('────────────────────────────────────────')

  if (summary.errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
