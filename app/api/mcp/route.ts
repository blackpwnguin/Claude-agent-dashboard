import { NextRequest, NextResponse } from 'next/server'
import { handleMCPTool, MCPRequest } from '@/lib/mcp-tools'

export async function POST(req: NextRequest) {
  // Auth: check API key
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.PORTAL_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: MCPRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.tool) {
    return NextResponse.json({ ok: false, error: 'tool is required' }, { status: 400 })
  }

  const result = await handleMCPTool(body)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

// MCP discovery endpoint
export async function GET() {
  return NextResponse.json({
    name: 'claude-agent-dashboard',
    version: '2.0.0',
    tools: [
      { name: 'get_projects',    description: 'List all projects with current status' },
      { name: 'get_tasks',       description: 'List tasks, filterable by project_slug and status' },
      { name: 'get_decisions',   description: 'List decisions, filterable by project_slug and status' },
      { name: 'get_build_logs',  description: 'List build-logs, filterable by project_slug and status' },
      { name: 'get_sessions',    description: 'List tracked sessions, filterable by project_slug' },
      { name: 'get_suggestions', description: 'List AI suggestions, filterable by project_slug, status, category' },
      { name: 'get_dev_items',   description: 'List dev items (bugs/features/refactors), filterable by project_slug, status, item_type' },
      { name: 'get_token_usage', description: 'Granular token usage aggregated by project/model/day. Pass view="monthly" for monthly rollup.' },
      { name: 'update_task',       description: 'Update a task by id' },
      { name: 'create_task',       description: 'Create a new task record (source: portal)' },
      { name: 'create_suggestion', description: 'Create an AI suggestion from the portal' },
      { name: 'create_dev_item',   description: 'Create a dev item from the portal' },
      { name: 'update_suggestion', description: 'Update an AI suggestion status/priority' },
      { name: 'update_dev_item',   description: 'Update a dev item status/priority' },
      { name: 'log_session', description: 'Log a session with granular token breakdown (input, output, cache_read, cache_write, cost_usd, model, topic)' },
      { name: 'trigger_sync', description: 'Dispatch the vault → Supabase sync GitHub Actions workflow immediately. Requires GITHUB_SYNC_TOKEN env var (fine-grained PAT, actions:write on knowledge-vault repo).' },
    ]
  })
}
