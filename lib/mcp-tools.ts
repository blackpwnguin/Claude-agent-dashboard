import { supabaseAdmin } from './supabase'

export type MCPResponse = {
  ok: boolean
  data?: any
  error?: string
}

export type MCPRequest = {
  tool: string
  params?: Record<string, any>
}

export async function handleMCPTool(req: MCPRequest): Promise<MCPResponse> {
  const { tool, params = {} } = req

  switch (tool) {
    case 'get_projects':
      return getProjects()
    case 'get_tasks':
      return getTasks(params)
    case 'update_task':
      return updateTask(params)
    case 'create_task':
      return createTask(params)
    case 'log_session':
      return logSession(params)
    default:
      return { ok: false, error: `Unknown tool: ${tool}` }
  }
}

async function getProjects(): Promise<MCPResponse> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .order('slug', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function getTasks(params: { project_slug?: string; status?: string }): Promise<MCPResponse> {
  let query = supabaseAdmin.from('tasks').select('*')
  if (params.project_slug) query = query.eq('project_slug', params.project_slug)
  if (params.status) query = query.eq('status', params.status)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function updateTask(params: { id?: string; [k: string]: any }): Promise<MCPResponse> {
  if (!params.id) return { ok: false, error: 'id is required' }
  const { id, ...updates } = params
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function createTask(params: {
  project_slug?: string
  title?: string
  status?: string
  source?: string
  [k: string]: any
}): Promise<MCPResponse> {
  if (!params.project_slug) return { ok: false, error: 'project_slug is required' }
  if (!params.title) return { ok: false, error: 'title is required' }
  const insert = {
    status: 'spec',
    source: 'portal',
    ...params,
  }
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(insert)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function logSession(params: { agent?: string; [k: string]: any }): Promise<MCPResponse> {
  if (!params.agent) return { ok: false, error: 'agent is required' }
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert(params)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}
