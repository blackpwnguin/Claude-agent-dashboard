import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Suggestion = {
  id: string
  project_slug: string
  title: string
  body: string | null
  category: string | null
  priority: string | null
  status: string
  created_at: string | null
  updated_at: string | null
}

function CategoryPill({ category }: { category: string | null }) {
  const map: Record<string, { bg: string; color: string }> = {
    improvement:  { bg: 'rgb(124 106 247 / 0.15)', color: 'var(--accent)' },
    'bug-risk':   { bg: 'rgb(248 113 113 / 0.15)', color: 'var(--red)' },
    refactor:     { bg: 'rgb(250 204 21 / 0.13)',  color: 'var(--yellow)' },
    idea:         { bg: 'rgb(74 222 128 / 0.13)',  color: 'var(--green)' },
  }
  const c = map[category ?? ''] ?? { bg: 'rgb(136 136 170 / 0.1)', color: 'var(--text-muted)' }
  return (
    <span
      className="pill"
      style={{ background: c.bg, color: c.color }}
    >
      {category ?? 'misc'}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string | null }) {
  const colors: Record<string, string> = {
    high:   'var(--red)',
    medium: 'var(--yellow)',
    low:    'var(--text-muted)',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[priority ?? 'low'] ?? 'var(--text-muted)',
        marginRight: 6,
      }}
    />
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    open:      { bg: 'rgb(250 204 21 / 0.13)', color: 'var(--yellow)' },
    accepted:  { bg: 'rgb(124 106 247 / 0.15)', color: 'var(--accent)' },
    done:      { bg: 'rgb(74 222 128 / 0.13)', color: 'var(--green)' },
    dismissed: { bg: 'rgb(136 136 170 / 0.08)', color: 'var(--text-muted)' },
  }
  const c = map[status] ?? map.open
  return <span className="pill" style={{ background: c.bg, color: c.color }}>{status}</span>
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function SuggestionsPage() {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  const suggestions: Suggestion[] = data ?? []

  // Group by project
  const byProject = new Map<string, Suggestion[]>()
  for (const s of suggestions) {
    const list = byProject.get(s.project_slug) ?? []
    list.push(s)
    byProject.set(s.project_slug, list)
  }

  const openCount = suggestions.filter(s => s.status === 'open').length

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            AI Suggestions
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Improvements and ideas surfaced by Claude during work sessions
          </p>
        </div>
        <div className="text-right">
          <div className="mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Open</div>
          <div className="text-2xl font-semibold" style={{ color: openCount > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
            {openCount}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'rgb(248 113 113 / 0.1)', color: 'var(--red)', border: '1px solid var(--red)' }}>
          Failed to load suggestions: {error.message}
        </div>
      )}

      {suggestions.length === 0 && !error ? (
        <div
          className="rounded-lg p-10 text-center"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <div className="text-4xl mb-3">💡</div>
          <div className="text-sm">No AI suggestions yet.</div>
          <div className="text-xs mt-1">
            Create a note with <span className="mono">type: suggestion</span> in any workspace to see it here.
          </div>
        </div>
      ) : (
        [...byProject.entries()].map(([slug, items]) => (
          <div key={slug} className="mb-8">
            <h2 className="mono text-[11px] uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent)' }}>{slug}</span>
              <span>· {items.length} suggestion{items.length !== 1 ? 's' : ''}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {items.map(s => (
                <div
                  key={s.id}
                  className="rounded-lg p-4"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <PriorityDot priority={s.priority} />
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {s.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <CategoryPill category={s.category} />
                      <StatusPill status={s.status} />
                    </div>
                  </div>
                  {s.body && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {s.body}
                    </p>
                  )}
                  <div className="mono text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(s.updated_at ?? s.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
