import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Project = {
  id: string
  slug: string
  display_name?: string | null
  status?: string | null
  stage?: string | null
  updated_at?: string | null
}

type Task = {
  id: string
  title: string
  project_slug: string
  status: string
  stage?: string | null
}

type Session = {
  id: string
  agent: string
  tokens?: number | null
  summary?: string | null
  created_at?: string | null
}

function StatusPill({ status }: { status: string }) {
  const safe = ['spec', 'building', 'shipped', 'archived'].includes(status) ? status : 'spec'
  return <span className={`pill pill-${safe}`}>{status}</span>
}

function fmtDate(d?: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const [projectsRes, tasksRes, sessionsRes] = await Promise.all([
    supabaseAdmin.from('projects').select('*').order('slug', { ascending: true }),
    supabaseAdmin.from('tasks').select('*').eq('status', 'building'),
    supabaseAdmin
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const projects: Project[] = projectsRes.data ?? []
  const tasks: Task[] = tasksRes.data ?? []
  const sessions: Session[] = sessionsRes.data ?? []

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokens ?? 0), 0)

  return (
    <div className="p-10 max-w-6xl">
      <div className="mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {today}
      </div>
      <h1 className="text-4xl font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>
        Good to go.
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {projects.length} active {projects.length === 1 ? 'project' : 'projects'},{' '}
        {tasks.length} active {tasks.length === 1 ? 'task' : 'tasks'}
      </p>

      <section className="mt-10">
        <h2 className="text-sm uppercase mono tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Projects
        </h2>
        {projects.length === 0 ? (
          <div
            className="p-8 mono text-xs text-center rounded"
            style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          >
            no projects yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.display_name ?? p.slug}
                  </div>
                  <StatusPill status={p.status ?? 'spec'} />
                </div>
                <div className="mt-3 mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {p.stage ?? ''}
                </div>
                <div className="mt-1 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  updated {fmtDate(p.updated_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm uppercase mono tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Active tasks
        </h2>
        {tasks.length === 0 ? (
          <div
            className="p-8 mono text-xs text-center rounded"
            style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          >
            nothing in flight
          </div>
        ) : (
          <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {tasks.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-4 px-5 py-3"
                style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--accent)' }}
                />
                <div className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t.title}
                </div>
                <div className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.project_slug}
                </div>
                <div className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.stage ?? ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 mb-10">
        <h2 className="text-sm uppercase mono tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Recent sessions{' '}
          <span style={{ color: 'var(--text-secondary)' }}>· {totalTokens.toLocaleString()} tokens</span>
        </h2>
        {sessions.length === 0 ? (
          <div
            className="p-8 mono text-xs text-center rounded"
            style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          >
            no sessions logged
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="mono text-sm" style={{ color: 'var(--accent)' }}>
                    {s.agent}
                  </div>
                  <div className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(s.tokens ?? 0).toLocaleString()} tokens · {fmtDate(s.created_at)}
                  </div>
                </div>
                {s.summary && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
