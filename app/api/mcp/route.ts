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
    version: '1.0.0',
    tools: [
      { name: 'get_projects', description: 'List all projects with current status' },
      { name: 'get_tasks', description: 'List tasks, filterable by project_slug and status' },
      { name: 'get_decisions', description: 'List decisions, filterable by project_slug and status' },
      { name: 'get_build_logs', description: 'List build-logs, filterable by project_slug and status' },
      { name: 'update_task', description: 'Update a task by id' },
      { name: 'create_task', description: 'Create a new task record' },
      { name: 'log_session', description: 'Log a Claude Code or Cowork session with token count' },
    ]
  })
}
