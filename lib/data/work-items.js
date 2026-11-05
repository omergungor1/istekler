const REQUEST_COLUMNS = 'id, external_no, subject, institution_name, module_name, status, ai_status, ai_difficulty, manual_difficulty, ai_hours_min, ai_hours_max, manual_hours_min, manual_hours_max, deleted_at'

export function effectiveEstimate(item) {
  return {
    difficulty: item.manual_difficulty ?? item.ai_difficulty ?? null,
    min: item.manual_estimated_hours_min ?? item.ai_estimated_hours_min ?? null,
    max: item.manual_estimated_hours_max ?? item.ai_estimated_hours_max ?? null,
  }
}

function sanitizeSearch(q) {
  return q.replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseWorkItemFilters(searchParams) {
  const get = (key) => {
    const v = searchParams?.[key]
    return (Array.isArray(v) ? v[0] : v ?? '').toString().trim()
  }
  const status = ['open', 'in_progress', 'completed', 'all'].includes(get('status')) ? get('status') : 'active'
  return { status, q: get('q').slice(0, 100) }
}

export async function listWorkItems(supabase, filters) {
  let query = supabase
    .from('work_items')
    .select(
      'id, title, summary, category, status, ai_difficulty, manual_difficulty, ai_estimated_hours_min, ai_estimated_hours_max, manual_estimated_hours_min, manual_estimated_hours_max, updated_at, completed_at, work_item_requests(requests(id, status, deleted_at))'
    )
    .order('updated_at', { ascending: false })
    .limit(500)

  if (filters.status === 'active') query = query.neq('status', 'completed')
  else if (filters.status !== 'all') query = query.eq('status', filters.status)
  const q = sanitizeSearch(filters.q)
  if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,category.ilike.%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data.map(({ work_item_requests: links, ...item }) => {
    const requests = (links ?? []).map((l) => l.requests).filter((r) => r && !r.deleted_at)
    return {
      ...item,
      requestCount: requests.length,
      completedCount: requests.filter((r) => r.status === 'completed').length,
      estimate: effectiveEstimate(item),
    }
  })
}

export async function getWorkItemDetail(supabase, id) {
  const { data: workItem, error } = await supabase.from('work_items').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!workItem) return null

  const [links, prompt, candidates] = await Promise.all([
    supabase.from('work_item_requests').select(`created_at, requests(${REQUEST_COLUMNS})`).eq('work_item_id', id),
    supabase.from('agent_prompts').select('*').eq('work_item_id', id).maybeSingle(),
    supabase
      .from('requests')
      .select('id, external_no, subject, institution_name, module_name')
      .is('deleted_at', null)
      .neq('status', 'completed')
      .order('external_no_sort', { ascending: false })
      .limit(1000),
  ])

  const requests = (links.data ?? [])
    .map((l) => l.requests)
    .filter((r) => r && !r.deleted_at)
    .sort((a, b) => a.external_no.localeCompare(b.external_no, 'tr', { numeric: true }))
  const linkedIds = new Set(requests.map((r) => r.id))

  return {
    workItem,
    estimate: effectiveEstimate(workItem),
    requests,
    prompt: prompt.data,
    candidates: (candidates.data ?? []).filter((r) => !linkedIds.has(r.id)),
  }
}
