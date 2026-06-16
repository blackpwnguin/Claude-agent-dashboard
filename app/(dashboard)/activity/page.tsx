import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Session = {
  id: string
  agent: string
  tokens?: number | null
  summary?: string | null
  project_slug?: string | null
  created_at?: string | null
}

function fmtDateTime(d?: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-5 rounded flex-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="mono text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  )
}

export default async function ActivityPage() {
  const { data } = await getSupabaseAdmin()
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const sessions: Session[] = data ?? []
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokens ?? 0), 0)
  const lastActive = sessions[0]?.created_at ?? null

  return (
    <div className="p-10 max-w-6xl">
      <h1 className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Claude activity
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Session history and token usage across Claude Code and Cowork runs.
      </p>

      <div className="mt-8 flex gap-4">
        <Stat label="sessions (last 50)" value={String(sessions.length)} />
        <Stat label="tokens" value={fmtTokens(totalTokens)} />
        <Stat label="last active" value={lastActive ? fmtDateTime(lastActive) : '—'} />
      </div>

      <h2 className="text-sm uppercase mono tracking-wider mt-10 mb-4" style={{ color: 'var(--text-muted)' }}>
        Recent sessions
      </h2>

      {sessions.length === 0 ? (
        <div
          className="p-8 mono text-xs text-center rounded"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
        >
          no sessions logged yet — use scripts/log-session.ts to record one
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded flex items-center justify-between gap-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {s.agent}
                  {s.project_slug ? (
                    <span
                      className="mono text-[10px] ml-2 px-2 py-0.5 rounded"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                    >
                      {s.project_slug}
                    </span>
                  ) : null}
                </div>
                {s.summary ? (
                  <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {s.summary}
                  </div>
                ) : null}
              </div>
              <div className="text-right shrink-0">
                <div className="mono text-sm" style={{ color: 'var(--accent)' }}>
                  {s.tokens != null ? fmtTokens(s.tokens) : '—'}
                </div>
                <div className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {fmtDateTime(s.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
