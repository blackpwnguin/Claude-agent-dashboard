import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Task = {
  id: string
  title: string
  project_slug: string
  status: 'spec' | 'building' | 'shipped' | 'archived'
  stage?: string | null
}

const COLUMNS = ['spec', 'building', 'shipped'] as const
type Column = (typeof COLUMNS)[number]

function StatusPill({ status, count }: { status: Column; count: number }) {
  return (
    <span className={`pill pill-${status}`}>
      {status} · {count}
    </span>
  )
}

export default async function TasksPage() {
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  const tasks: Task[] = data ?? []
  const grouped: Record<Column, Task[]> = { spec: [], building: [], shipped: [] }
  for (const t of tasks) {
    if (t.status in grouped) grouped[t.status as Column].push(t)
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-semibold mb-8" style={{ color: 'var(--text-primary)' }}>
        Tasks
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map((col) => (
          <div key={col}>
            <div className="mb-3">
              <StatusPill status={col} count={grouped[col].length} />
            </div>
            <div className="space-y-3">
              {grouped[col].length === 0 ? (
                <div
                  className="p-8 mono text-xs text-center rounded"
                  style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                >
                  empty
                </div>
              ) : (
                grouped[col].map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {t.title}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className="mono text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                      >
                        {t.project_slug}
                      </span>
                      <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t.stage ?? ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
