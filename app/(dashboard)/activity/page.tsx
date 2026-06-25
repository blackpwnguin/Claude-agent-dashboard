import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Session = {
  id: string
  agent: string | null
  model?: string | null
  topic?: string | null
  tokens?: number | null
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_tokens?: number | null
  cache_write_tokens?: number | null
  cost_usd?: number | null
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

function sessionTokens(s: Session): number {
  const granular = (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
  return granular > 0 ? granular : (s.tokens ?? 0)
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

function AgentBadge({ agent }: { agent: string | null }) {
  const label = agent ?? 'unknown'
  const isHermes = label === 'hermes'
  return (
    <span
      className="mono text-[10px] px-1.5 py-0.5 rounded"
      style={{
        background: isHermes ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-elevated)',
        color: isHermes ? 'var(--accent)' : 'var(--text-muted)',
        border: isHermes ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid transparent',
      }}
    >
      {label}
    </span>
  )
}

export default async function ActivityPage() {
  const { data } = await getSupabaseAdmin()
    .from('sessions')
    .select('id, agent, model, topic, summary, project_slug, created_at, tokens, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd')
    .order('created_at', { ascending: false })
    .limit(50)

  const sessions: Session[] = data ?? []
  const totalTokens = sessions.reduce((sum, s) => sum + sessionTokens(s), 0)
  const totalCost = sessions.reduce((sum, s) => sum + (s.cost_usd ?? 0), 0)
  const lastActive = sessions[0]?.created_at ?? null

  return (
    <div className="p-10 max-w-6xl">
      <h1 className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Agent activity
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Session history and token usage across Hermes and Claude Code sessions.
      </p>

      <div className="mt-8 flex gap-4">
        <Stat label="sessions (last 50)" value={String(sessions.length)} />
        <Stat label="tokens" value={fmtTokens(totalTokens)} />
        <Stat label="est. cost" value={totalCost > 0 ? `$${totalCost.toFixed(4)}` : '—'} />
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
          {sessions.map((s) => {
            const tok = sessionTokens(s)
            return (
              <div
                key={s.id}
                className="p-4 rounded flex items-center justify-between gap-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div className="min-w-0 flex items-start gap-2">
                  <AgentBadge agent={s.agent} />
                  <div>
                    <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {s.topic ?? s.summary ?? '—'}
                      {s.project_slug ? (
                        <span
                          className="mono text-[10px] ml-2 px-2 py-0.5 rounded"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                        >
                          {s.project_slug}
                        </span>
                      ) : null}
                      {s.model ? (
                        <span
                          className="mono text-[10px] ml-1 px-2 py-0.5 rounded"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        >
                          {s.model}
                        </span>
                      ) : null}
                    </div>
                    {s.summary && s.topic ? (
                      <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                        {s.summary}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="mono text-sm" style={{ color: 'var(--accent)' }}>
                    {tok > 0 ? fmtTokens(tok) : '—'}
                  </div>
                  {s.cost_usd ? (
                    <div className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ${s.cost_usd.toFixed(4)}
                    </div>
                  ) : null}
                  <div className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {fmtDateTime(s.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
