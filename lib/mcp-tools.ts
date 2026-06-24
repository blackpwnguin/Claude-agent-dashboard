import { getSupabaseAdmin } from './supabase'

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
    case 'get_decisions':
      return getChildRows('decisions', params)
    case 'get_build_logs':
      return getChildRows('build_logs', params)
    case 'get_sessions':
      return getSessions(params)
    case 'get_suggestions':
      return getChildRows('ai_suggestions', params)
    case 'get_dev_items':
      return getChildRows('dev_items', params)
    case 'get_token_usage':
      return getTokenUsage(params)
    case 'update_task':
      return updateTask(params)
    case 'create_task':
      return createTask(params)
    case 'create_suggestion':
      return createPortalRow('ai_suggestions', ['project_slug', 'title'], params)
    case 'create_dev_item':
      return createPortalRow('dev_items', ['project_slug', 'title'], params)
    case 'update_suggestion':
      return updateRow('ai_suggestions', params)
    case 'update_dev_item':
      return updateRow('dev_items', params)
    case 'log_session':
      return logSession(params)
    default:
      return { ok: false, error: `Unknown tool: ${tool}` }
  }
}

async function getProjects(): Promise<MCPResponse> {
  const { data, error } = await getSupabaseAdmin()
    .from('projects')
    .select('*')
    .order('slug', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function getTasks(params: { project_slug?: string; status?: string }): Promise<MCPResponse> {
  let query = getSupabaseAdmin().from('tasks').select('*')
  if (params.project_slug) query = query.eq('project_slug', params.project_slug)
  if (params.status) query = query.eq('status', params.status)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function getSessions(params: {
  project_slug?: string
  limit?: number
}): Promise<MCPResponse> {
  let query = getSupabaseAdmin().from('sessions').select('*')
  if (params.project_slug) query = query.eq('project_slug', params.project_slug)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function getChildRows(
  table: 'decisions' | 'build_logs' | 'ai_suggestions' | 'dev_items',
  params: { project_slug?: string; status?: string; item_type?: string; category?: string },
): Promise<MCPResponse> {
  let query = getSupabaseAdmin().from(table).select('*')
  if (params.project_slug) query = query.eq('project_slug', params.project_slug)
  if (params.status) query = query.eq('status', params.status)
  if (params.item_type && table === 'dev_items') query = query.eq('item_type', params.item_type)
  if (params.category && table === 'ai_suggestions') query = query.eq('category', params.category)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function getTokenUsage(params: {
  project_slug?: string
  view?: 'daily' | 'monthly'
}): Promise<MCPResponse> {
  const view = params.view === 'monthly' ? 'token_usage_monthly' : 'token_usage_summary'
  let query = getSupabaseAdmin().from(view).select('*')
  if (params.project_slug) query = query.eq('project_slug', params.project_slug)
  const { data, error } = await query.order('day' in (({} as any)) ? 'day' : 'month', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function updateTask(params: { id?: string; [k: string]: any }): Promise<MCPResponse> {
  if (!params.id) return { ok: false, error: 'id is required' }
  const { id, ...updates } = params
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function updateRow(
  table: 'ai_suggestions' | 'dev_items',
  params: { id?: string; [k: string]: any },
): Promise<MCPResponse> {
  if (!params.id) return { ok: false, error: 'id is required' }
  const { id, ...updates } = params
  const { data, error } = await getSupabaseAdmin()
    .from(table)
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
  const insert = { status: 'spec', source: 'portal', ...params }
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .insert(insert)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function createPortalRow(
  table: 'ai_suggestions' | 'dev_items',
  required: string[],
  params: Record<string, any>,
): Promise<MCPResponse> {
  for (const key of required) {
    if (!params[key]) return { ok: false, error: `${key} is required` }
  }
  const insert = { source: 'portal', ...params }
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .insert(insert)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

async function logSession(params: { agent?: string; [k: string]: any }): Promise<MCPResponse> {
  if (!params.agent) return { ok: false, error: 'agent is required' }
  // Compute legacy total from granular fields if not already provided
  if (!params.tokens && (params.input_tokens || params.output_tokens)) {
    params.tokens =
      (params.input_tokens ?? 0) +
      (params.output_tokens ?? 0) +
      (params.cache_read_tokens ?? 0) +
      (params.cache_write_tokens ?? 0)
  }
  const { data, error } = await getSupabaseAdmin()
    .from('sessions')
    .insert({ source: 'portal', tracked: true, ...params })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}
