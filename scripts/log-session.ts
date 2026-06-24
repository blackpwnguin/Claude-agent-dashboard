/**
 * log-session.ts
 *
 * Records a Claude Code / Cowork session (agent + token usage) to the dashboard
 * through its portal API (/api/mcp -> log_session). Use it at the end of a run
 * so the Activity page reflects real token usage.
 *
 * Usage:
 *   npm run log-session -- --agent "claude-code" --model "claude-sonnet-4-6" \
 *     --input_tokens 12500 --output_tokens 4800 \
 *     --cache_read_tokens 30000 --cache_write_tokens 2000 \
 *     --cost_usd 0.0342 \
 *     --summary "stowed auth wiring" --project stowed --topic "auth-wiring-2026-06-23"
 *
 * Legacy: --tokens <total> still works as a fallback total.
 *
 * Env (from .env.local): PORTAL_API_KEY (required), DASHBOARD_URL (optional,
 * defaults to the deployed dashboard).
 */

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_URL = 'https://claudedashboard-theta.vercel.app'

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

/** Minimal --flag value parser. */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = 'true'
      }
    }
  }
  return out
}

async function main(): Promise<void> {
  loadEnvLocal()

  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.PORTAL_API_KEY
  const baseUrl = (process.env.DASHBOARD_URL || DEFAULT_URL).replace(/\/$/, '')

  if (!apiKey) {
    console.error('PORTAL_API_KEY is not set (add it to .env.local).')
    process.exit(1)
  }
  if (!args.agent) {
    console.error('Missing --agent. Example: npm run log-session -- --agent claude-code --tokens 1234')
    process.exit(1)
  }

  const params: Record<string, unknown> = { agent: args.agent }
  if (args.tokens)             params.tokens             = Number(args.tokens)
  if (args.input_tokens)       params.input_tokens       = Number(args.input_tokens)
  if (args.output_tokens)      params.output_tokens      = Number(args.output_tokens)
  if (args.cache_read_tokens)  params.cache_read_tokens  = Number(args.cache_read_tokens)
  if (args.cache_write_tokens) params.cache_write_tokens = Number(args.cache_write_tokens)
  if (args.cost_usd)           params.cost_usd           = Number(args.cost_usd)
  if (args.model)              params.model              = args.model
  if (args.summary)            params.summary            = args.summary
  if (args.project)            params.project_slug       = args.project
  if (args.topic)              params.topic              = args.topic

  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ tool: 'log_session', params }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || (json as { ok?: boolean }).ok === false) {
    console.error(`Failed (${res.status}):`, (json as { error?: string }).error ?? json)
    process.exit(1)
  }
  console.log('✓ session logged:', JSON.stringify((json as { data?: unknown }).data ?? json))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
