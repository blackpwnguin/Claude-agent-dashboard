/**
 * sync-icm.ts
 *
 * Bridges the ICM command-center (workspaces/command-center in the icm-enhanced
 * repo — the "second Obsidian vault that lives in GitHub") into the dashboard's
 * Supabase, so the Projects/Activity views track updates per GitHub repo.
 *
 * What it reads (from ICM_PATH = the command-center directory):
 *   _config/registry.md              -> repo -> slug + visibility mapping
 *   projects/<slug>/overview.md      -> upsert into `projects` (repo, github_url, summary)
 *   projects/<slug>/change-log.md    -> each dated line -> `build_logs` (source: 'icm')
 *   projects/<slug>/domains/<d>/10-change-log.md -> `build_logs` tagged domain = <d>
 *
 * Nothing is hardcoded: repo names (incl. private ones) are read at runtime from
 * the ICM checkout, never committed here. `source: 'portal'` rows are never touched.
 *
 * Run:  ICM_PATH=/path/to/icm-enhanced/workspaces/command-center npm run sync-icm
 * Needs Supabase env vars (see .env.local). Requires migration 0004.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/supabase'

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

type RepoInfo = { repo: string; slug: string; visibility: string; tracked: boolean }

/** Parse the registry markdown table into repo rows. */
function parseRegistry(file: string): RepoInfo[] {
  const out: RepoInfo[] = []
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(public|private)\s*\|/i)
    if (!m) continue
    const repo = m[1].trim()
    if (!repo.includes('/')) continue // skip header/separator rows
    const cells = line.split('|').map((c) => c.trim())
    // columns: | repo | visibility | last push | status | tracked |
    const tracked = (cells[5] ?? 'yes').toLowerCase() !== 'no'
    out.push({
      repo,
      slug: repo.split('/').pop()!.toLowerCase(),
      visibility: m[2].toLowerCase(),
      tracked,
    })
  }
  return out
}

/** First H1 or first bold "What it is" line as a summary. */
function summaryFromOverview(content: string): string | null {
  const what = content.match(/\*\*What it is:\*\*\s*(.+)/i)
  if (what) return what[1].replace(/[_<>]/g, '').trim().slice(0, 400)
  const h1 = content.match(/^#\s+(.+)$/m)
  return h1 ? h1[1].trim().slice(0, 400) : null
}

/** Extract dated change-log entries: lines beginning "## YYYY-MM-DD — text" or "### YYYY-MM-DD — text". */
function parseChangeLog(content: string): { date: string; title: string }[] {
  const out: { date: string; title: string }[] = []
  const re = /^#{2,3}\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(.+?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    out.push({ date: m[1], title: `${m[1]} — ${m[2].replace(/\s*\[[^\]]*\]\s*/g, ' ').trim()}`.slice(0, 200) })
  }
  return out
}

async function upsertProject(info: RepoInfo, icmPath: string): Promise<boolean> {
  const dir = path.join(icmPath, 'projects', info.slug)
  const overviewPath = path.join(dir, 'overview.md')
  if (!fs.existsSync(overviewPath)) return false
  const content = fs.readFileSync(overviewPath, 'utf8')
  const admin = getSupabaseAdmin()

  // Don't clobber a portal-owned project row; only patch repo linkage + summary.
  const { data: existing } = await admin
    .from('projects')
    .select('slug, status')
    .eq('slug', info.slug)
    .maybeSingle()

  const row: Record<string, unknown> = {
    slug: info.slug,
    repo: info.repo,
    github_url: `https://github.com/${info.repo}`,
    visibility: info.visibility,
    summary: summaryFromOverview(content),
    updated_at: new Date().toISOString(),
  }
  if (!existing) {
    row.display_name = info.slug
    row.status = 'building'
  }
  const { error } = await admin.from('projects').upsert(row, { onConflict: 'slug' })
  if (error) {
    console.error(`  x project upsert failed (${info.slug}): ${error.message}`)
    return false
  }
  console.log(`  ✓ project: ${info.slug} -> ${info.repo}`)
  return true
}

async function upsertChangeLog(
  slug: string,
  file: string,
  domain: string | null,
): Promise<number> {
  if (!fs.existsSync(file)) return 0
  const entries = parseChangeLog(fs.readFileSync(file, 'utf8'))
  if (!entries.length) return 0
  const admin = getSupabaseAdmin()
  let n = 0
  for (const e of entries) {
    const row = {
      project_slug: slug,
      title: domain ? `[${domain}] ${e.title}` : e.title,
      status: 'shipped',
      stage: domain,
      domain,
      summary: null as string | null,
      source: 'icm',
      updated_at: new Date(`${e.date}T00:00:00Z`).toISOString(),
    }
    const { error } = await admin.from('build_logs').upsert(row, { onConflict: 'project_slug,title' })
    if (error) {
      console.error(`  x build_log upsert failed (${slug}): ${error.message}`)
      continue
    }
    n++
  }
  return n
}

async function main(): Promise<void> {
  loadEnvLocal()
  const icmPath = process.env.ICM_PATH
  if (!icmPath || !fs.existsSync(icmPath)) {
    console.error('ICM_PATH is not set or does not exist. Point it at the command-center dir')
    console.error('(e.g. /path/to/icm-enhanced/workspaces/command-center).')
    process.exit(1)
  }

  const repos = parseRegistry(path.join(icmPath, '_config', 'registry.md')).filter((r) => r.tracked)
  console.log(`ICM sync: ${repos.length} tracked repos from registry`)

  let projects = 0
  let updates = 0
  for (const info of repos) {
    const scaffolded = await upsertProject(info, icmPath)
    if (!scaffolded) continue
    projects++
    const projDir = path.join(icmPath, 'projects', info.slug)
    updates += await upsertChangeLog(info.slug, path.join(projDir, 'change-log.md'), null)
    const domainsDir = path.join(projDir, 'domains')
    if (fs.existsSync(domainsDir)) {
      for (const d of fs.readdirSync(domainsDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        updates += await upsertChangeLog(
          info.slug,
          path.join(domainsDir, d.name, '10-change-log.md'),
          d.name,
        )
      }
    }
  }

  console.log('\n── ICM sync summary ────────────────────')
  console.log(`  projects linked : ${projects}`)
  console.log(`  updates upserted: ${updates}`)
  console.log('────────────────────────────────────────')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
