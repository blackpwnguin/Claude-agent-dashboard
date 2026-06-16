import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Project = {
  id: string
  slug: string
  display_name?: string | null
  status?: string | null
  stage?: string | null
  summary?: string | null
  updated_at?: string | null
}

type ChildRow = { project_slug: string; status?: string | null }

function StatusPill({ status }: { status?: string | null }) {
  const safe = ['spec', 'building', 'shipped', 'archived'].includes(status ?? '')
    ? (status as string)
    : 'spec'
  return <span className={`pill pill-${safe}`}>{status ?? 'spec'}</span>
}

function fmtDate(d?: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function countBy(rows: ChildRow[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows ?? []) out[r.project_slug] = (out[r.project_slug] ?? 0) + 1
  return out
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
      <span className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  )
}

export default async function ProjectsPage() {
  const supabase = getSupabaseAdmin()
  const [projectsRes, tasksRes, decisionsRes, buildLogsRes] = await Promise.all([
    supabase.from('projects').select('*').order('slug', { ascending: true }),
    supabase.from('tasks').select('project_slug,status'),
    supabase.from('decisions').select('project_slug,status'),
    supabase.from('build_logs').select('project_slug,status'),
  ])

  const projects: Project[] = projectsRes.data ?? []
  const taskCount = countBy(tasksRes.data as ChildRow[] | null)
  const decisionCount = countBy(decisionsRes.data as ChildRow[] | null)
  const buildLogCount = countBy(buildLogsRes.data as ChildRow[] | null)

  return (
    <div className="p-10 max-w-6xl">
      <h1 className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Projects
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {projects.length} {projects.length === 1 ? 'project' : 'projects'}, live from the vault.
      </p>

      {projects.length === 0 ? (
        <div
          className="mt-8 p-8 mono text-xs text-center rounded"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
        >
          no projects yet — run the vault sync
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-6 rounded"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.display_name ?? p.slug}
                  </div>
                  <div className="mono text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {p.slug}
                    {p.stage ? ` · ${p.stage}` : ''}
                    {p.updated_at ? ` · updated ${fmtDate(p.updated_at)}` : ''}
                  </div>
                </div>
                <StatusPill status={p.status} />
              </div>

              {p.summary ? (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {p.summary}
                </p>
              ) : null}

              <div className="mt-5 flex gap-8">
                <Metric label="tasks" value={taskCount[p.slug] ?? 0} />
                <Metric label="decisions" value={decisionCount[p.slug] ?? 0} />
                <Metric label="build-logs" value={buildLogCount[p.slug] ?? 0} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
