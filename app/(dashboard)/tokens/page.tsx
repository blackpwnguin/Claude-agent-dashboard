import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type TokenRow = {
  project_slug: string | null
  model: string | null
  day: string | null
  session_count: number | null
  total_input_tokens: number | null
  total_output_tokens: number | null
  total_cache_read_tokens: number | null
  total_cache_write_tokens: number | null
  total_tokens_legacy: number | null
  total_cost_usd: number | null
}

type ProjectTotals = {
  slug: string
  sessions: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

function fmt(n: number | null | undefined): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtCost(n: number | null | undefined): string {
  if (!n) return '$0.00'
  return `$${n.toFixed(4)}`
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function TokensPage() {
  const supabase = getSupabaseAdmin()

  const [dailyRes, sessionsRes] = await Promise.all([
    supabase
      .from('token_usage_summary')
      .select('*')
      .order('day', { ascending: false })
      .limit(90),
    supabase
      .from('sessions')
      .select('project_slug, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, tokens, cost_usd, created_at, topic, summary')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const rows: TokenRow[] = dailyRes.data ?? []

  // Aggregate per-project totals
  const byProject = new Map<string, ProjectTotals>()
  for (const r of rows) {
    const slug = r.project_slug ?? 'unknown'
    const existing = byProject.get(slug) ?? {
      slug,
      sessions: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
    }
    byProject.set(slug, {
      slug,
      sessions: existing.sessions + (r.session_count ?? 0),
      input: existing.input + (r.total_input_tokens ?? 0),
      output: existing.output + (r.total_output_tokens ?? 0),
      cacheRead: existing.cacheRead + (r.total_cache_read_tokens ?? 0),
      cacheWrite: existing.cacheWrite + (r.total_cache_write_tokens ?? 0),
      cost: existing.cost + (r.total_cost_usd ?? 0),
    })
  }
  const projectTotals = [...byProject.values()].sort((a, b) => b.cost - a.cost)

  // Grand totals
  const grand = projectTotals.reduce(
    (acc, p) => ({
      sessions: acc.sessions + p.sessions,
      input: acc.input + p.input,
      output: acc.output + p.output,
      cacheRead: acc.cacheRead + p.cacheRead,
      cacheWrite: acc.cacheWrite + p.cacheWrite,
      cost: acc.cost + p.cost,
    }),
    { sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  )

  const recentSessions = sessionsRes.data ?? []

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Token Usage
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Granular breakdown by project, model, and session
      </p>

      {/* Grand total cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: 'Sessions', value: fmt(grand.sessions) },
          { label: 'Input', value: fmt(grand.input) },
          { label: 'Output', value: fmt(grand.output) },
          { label: 'Cache Read', value: fmt(grand.cacheRead) },
          { label: 'Cache Write', value: fmt(grand.cacheWrite) },
          { label: 'Est. Cost', value: fmtCost(grand.cost) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              {label}
            </div>
            <div className="text-xl font-semibold" style={{ color: 'var(--accent)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-project breakdown */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
        By Project
      </h2>
      <div
        className="rounded-lg overflow-hidden mb-10"
        style={{ border: '1px solid var(--border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Project', 'Sessions', 'Input', 'Output', 'Cache Read', 'Cache Write', 'Est. Cost'].map(h => (
                <th key={h} className="px-4 py-3 text-left mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projectTotals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No token data yet. Log sessions with granular token counts to see data here.
                </td>
              </tr>
            ) : (
              projectTotals.map((p, i) => (
                <tr
                  key={p.slug}
                  style={{
                    background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <td className="px-4 py-3 font-medium mono" style={{ color: 'var(--accent)' }}>{p.slug}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.sessions}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(p.input)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(p.output)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(p.cacheRead)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(p.cacheWrite)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--green)' }}>{fmtCost(p.cost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent sessions */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
        Recent Sessions
      </h2>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Project', 'Model', 'Topic', 'Input', 'Output', 'Cost'].map(h => (
                <th key={h} className="px-4 py-3 text-left mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No sessions yet.
                </td>
              </tr>
            ) : (
              recentSessions.map((s: any, i: number) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.created_at)}</td>
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--accent)' }}>{s.project_slug ?? '—'}</td>
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.model ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.topic ?? s.summary ?? '—'}
                  </td>
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{fmt(s.input_tokens)}</td>
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{fmt(s.output_tokens)}</td>
                  <td className="px-4 py-3 mono text-[11px]" style={{ color: 'var(--green)' }}>{fmtCost(s.cost_usd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
