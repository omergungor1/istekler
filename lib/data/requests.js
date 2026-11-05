import { REQUESTS_PAGE_SIZE } from '@/lib/constants'

const LIST_COLUMNS =
  'id, external_no, subject, institution_name, module_name, status, ai_status, eff_difficulty, eff_hours_min, eff_hours_max, work_item_count, work_item_titles, first_work_item_id, updated_at, completed_at, closing_message'

const SORTS = {
  no_desc: { column: 'external_no_sort', ascending: false },
  no_asc: { column: 'external_no_sort', ascending: true },
  updated_desc: { column: 'updated_at', ascending: false },
  difficulty_desc: { column: 'eff_difficulty_rank', ascending: false },
  difficulty_asc: { column: 'eff_difficulty_rank', ascending: true },
  hours_desc: { column: 'eff_hours_max', ascending: false },
  hours_asc: { column: 'eff_hours_max', ascending: true },
  completed_desc: { column: 'completed_at', ascending: false },
}

function one(value) {
  return Array.isArray(value) ? value[0] : value
}

/** URL arama parametrelerini doğrulanmış filtrelere dönüştürür. */
export function parseRequestFilters(searchParams, defaults = {}) {
  const get = (key) => (one(searchParams?.[key]) ?? '').toString().trim()
  const page = Math.max(1, Number.parseInt(get('page'), 10) || 1)
  const sort = SORTS[get('sort')] ? get('sort') : defaults.sort ?? 'no_desc'
  const status = ['open', 'in_progress', 'completed', 'active'].includes(get('status')) ? get('status') : defaults.status ?? ''
  const difficulty = ['easy', 'medium', 'hard', 'very_hard', 'unknown'].includes(get('difficulty')) ? get('difficulty') : ''
  const linked = ['yes', 'no'].includes(get('linked')) ? get('linked') : ''
  const ai = ['done', 'waiting', 'review'].includes(get('ai')) ? get('ai') : ''
  return {
    q: get('q').slice(0, 100),
    institution: get('institution').slice(0, 200),
    module: get('module').slice(0, 200),
    status,
    difficulty,
    linked,
    ai,
    sort,
    page,
  }
}

function sanitizeSearch(q) {
  // PostgREST "or" sözdizimini bozabilecek karakterler aramadan çıkarılır.
  return q.replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function listRequests(supabase, filters, { pageSize = REQUESTS_PAGE_SIZE } = {}) {
  let query = supabase.from('request_list').select(LIST_COLUMNS, { count: 'exact' }).is('deleted_at', null)

  const q = sanitizeSearch(filters.q)
  if (q) {
    const term = `%${q}%`
    query = query.or(
      ['external_no', 'subject', 'description', 'institution_name', 'module_name'].map((c) => `${c}.ilike.${term}`).join(',')
    )
  }
  if (filters.institution) query = query.eq('institution_name', filters.institution)
  if (filters.module) query = query.eq('module_name', filters.module)
  if (filters.status === 'active') query = query.neq('status', 'completed')
  else if (filters.status) query = query.eq('status', filters.status)
  if (filters.difficulty === 'unknown') query = query.is('eff_difficulty', null)
  else if (filters.difficulty) query = query.eq('eff_difficulty', filters.difficulty)
  if (filters.linked === 'yes') query = query.gt('work_item_count', 0)
  if (filters.linked === 'no') query = query.eq('work_item_count', 0)
  if (filters.ai === 'done') query = query.eq('ai_status', 'done')
  if (filters.ai === 'waiting') query = query.in('ai_status', ['pending', 'stale', 'failed', 'queued', 'processing'])
  if (filters.ai === 'review') query = query.eq('ai_status', 'needs_review')

  const sort = SORTS[filters.sort] ?? SORTS.no_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('external_no', { ascending: false })

  const from = (filters.page - 1) * pageSize
  const { data, count, error } = await query.range(from, from + pageSize - 1)
  if (error) throw error
  return { rows: data, total: count ?? 0, page: filters.page, pageSize }
}

export async function getFilterOptions(supabase) {
  const { data, error } = await supabase
    .from('requests')
    .select('institution_name, module_name')
    .is('deleted_at', null)
    .limit(10000)
  if (error) throw error
  const sortTr = (a, b) => a.localeCompare(b, 'tr')
  return {
    institutions: [...new Set(data.map((r) => r.institution_name).filter(Boolean))].sort(sortTr),
    modules: [...new Set(data.map((r) => r.module_name).filter(Boolean))].sort(sortTr),
  }
}

/** İstek numarası ve oturumdaki kullanıcı (RLS) birlikte çözümlenir. */
export async function getRequestDetail(supabase, externalNo) {
  const { data: request, error } = await supabase
    .from('requests')
    .select('*')
    .eq('external_no', externalNo)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!request) return null

  const [analysis, history, prompt, links, events] = await Promise.all([
    request.current_analysis_id
      ? supabase.from('ai_analyses').select('*').eq('id', request.current_analysis_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('ai_analyses')
      .select('id, analysis_status, model_name, error_message, created_at, source_hash')
      .eq('request_id', request.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('agent_prompts').select('*').eq('request_id', request.id).maybeSingle(),
    supabase
      .from('work_item_requests')
      .select('work_items(id, title, status, category, ai_difficulty, manual_difficulty, ai_estimated_hours_min, ai_estimated_hours_max, manual_estimated_hours_min, manual_estimated_hours_max)')
      .eq('request_id', request.id),
    supabase
      .from('request_events')
      .select('id, event_type, details, created_at')
      .eq('request_id', request.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return {
    request,
    analysis: analysis.data,
    analysisHistory: history.data ?? [],
    prompt: prompt.data,
    workItems: (links.data ?? []).map((l) => l.work_items).filter(Boolean),
    events: events.data ?? [],
  }
}
