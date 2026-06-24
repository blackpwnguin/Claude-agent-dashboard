import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type DevItem = {
  id: string
  project_slug: string
  title: string
  description: string | null
  item_type: string
  priority: string
  status: string
  stage: string | null
  created_at: string | null
  updated_at: string | null
}

const TYPE_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  bug:      { bg: 'rgb(248 113 113 / 0.13)', color: 'var(--red)',    icon: '🐛' },
  feature:  { bg: 'rgb(124 106 247 / 0.15)', color: 'var(--accent)', icon: '✦' },
  refactor: { bg: 'rgb(250 204 21 / 0.13)',  color: 'var(--yellow)', icon: '⟳' },
  chore:    { bg: 'rgb(136 136 170 / 0.1)',  color: 'var(--text-muted)', icon: '·' },
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--red)',
  high:     'var(--red)',
  medium:   'var(--yellow)',
  low:      'var(--text-muted)',
}

function TypePill({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.feature
  return (
    <span className="pill" style={{ background: c.bg, color: c.color }}>
      {c.icon} {type}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    open:         { bg: 'rgb(250 204 21 / 0.13)',  color: 'var(--yellow)' },
    'in-progress':{ bg: 'rgb(124 106 247 / 0.15)', color: 'var(--accent)' },
    done:         { bg: 'rgb(74 222 128 / 0.13)',  color: 'var(--green)'  },
    cancelled:    { bg: 'rgb(136 136 170 / 0.08)', color: 'var(--text-muted)' },
  }
  const c = map[status] ?? map.open
  return <span className="pill" style={{ background: c.bg, color: c.color }}>{status}</span>
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DevItemsPage() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('dev_items')
    .select('*')
    .order('created_at', { ascending: false })

  const items: DevItem[] = (data ?? []).sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
  )

  const byStatus = {
    open: items.filter(i => i.status === 'open'),
    'in-progress': items.filter(i => i.status === 'in-progress'),
    done: items.filter(i => i.status === 'done'),
    cancelled: items.filter(i => i.status === 'cancelled'),
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Dev Items
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Bugs, features, refactors, and chores across all projects
          </p>
        </div>
        <div className="flex gap-4">
          {[
            { label: 'Open', count: byStatus.open.length, color: 'var(--yellow)' },
            { label: 'In Progress', count: byStatus['in-progress'].length, color: 'var(--accent)' },
            { label: 'Done', count: byStatus.done.length, color: 'var(--green)' },
          ].map(({ label, count, color }) => (
            <div key={label} className="text-right">
              <div className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
              <div className="text-xl font-semibold" style={{ color }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'rgb(248 113 113 / 0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          Failed to load dev items: {error.message}
        </div>
      )}

      {items.length === 0 && !error ? (
        <div className="rounded-lg p-10 text-center" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div className="text-4xl mb-3">🛠</div>
          <div className="text-sm">No dev items yet.</div>
          <div className="text-xs mt-1">
            Create a note with <span className="mono">type: dev-item</span> in any workspace to see it here.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['open', 'in-progress', 'done'] as const).map(col => (
            <div key={col}>
              <div className="mono text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                {col} · {byStatus[col].length}
              </div>
              <div className="flex flex-col gap-3">
                {byStatus[col].length === 0 ? (
                  <div
                    className="rounded-lg p-4 text-center text-xs"
                    style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                  >
                    empty
                  </div>
                ) : (
                  byStatus[col].map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg p-4"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <TypePill type={item.item_type} />
                      </div>
                      <div className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {item.description.slice(0, 120)}{item.description.length > 120 ? '…' : ''}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="mono text-[10px]" style={{ color: 'var(--accent)' }}>
                          {item.project_slug}
                        </span>
                        <span
                          className="mono text-[10px] font-medium"
                          style={{ color: PRIORITY_COLORS[item.priority] ?? 'var(--text-muted)' }}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <div className="mono text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(item.updated_at ?? item.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
