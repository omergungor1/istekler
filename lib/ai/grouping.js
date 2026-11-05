import { generateStructured } from './client'
import { GROUPING_INSTRUCTIONS, GROUPING_PROMPT_VERSION } from './prompts'
import { groupSuggestionsSchema } from './schemas'
import { normalizeEstimate } from './analyze-request'
import { maskText } from '@/lib/privacy/mask'

const MAX_CANDIDATES = 150

export function requestSetKey(ids) {
  return [...new Set(ids)].sort().join(',')
}

/**
 * Kullanıcının açık ve analiz edilmiş istekleri arasında ortak teknik iş önerileri üretir.
 * Öneriler yalnızca kaydedilir; hiçbir istek kullanıcı onayı olmadan gruba bağlanmaz.
 */
export async function generateGroupSuggestions(supabase, userId) {
  const { data: candidates, error } = await supabase
    .from('requests')
    .select('id, external_no, institution_name, module_name, subject, ai_summary, ai_category')
    .is('deleted_at', null)
    .neq('status', 'completed')
    .in('ai_status', ['done', 'stale'])
    .order('updated_at', { ascending: false })
    .limit(MAX_CANDIDATES)
  if (error) throw error

  if (!candidates || candidates.length < 2) {
    return { status: 'not_enough', created: 0 }
  }

  const [{ data: workItems }, { data: previous }] = await Promise.all([
    supabase
      .from('work_items')
      .select('title, work_item_requests(request_id)')
      .neq('status', 'completed')
      .limit(200),
    supabase
      .from('ai_group_suggestions')
      .select('status, request_set_key, suggested_title')
      .in('status', ['pending', 'rejected', 'approved'])
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const byNo = new Map(candidates.map((r) => [r.external_no, r]))
  const noById = new Map(candidates.map((r) => [r.id, r.external_no]))
  const toNos = (ids) => ids.map((id) => noById.get(id)).filter(Boolean)

  const requestLines = candidates
    .map((r) => {
      const subject = maskText(r.subject).text.replace(/\s+/g, ' ').slice(0, 300)
      return `- No: ${r.external_no} | Kurum: ${r.institution_name ?? '-'} | Modül: ${r.module_name ?? '-'} | Kategori: ${r.ai_category ?? '-'} | Konu: ${subject} | AI özeti: ${(r.ai_summary ?? '').replace(/\s+/g, ' ').slice(0, 600)}`
    })
    .join('\n')

  const workItemLines = (workItems ?? [])
    .map((w) => {
      const nos = toNos((w.work_item_requests ?? []).map((l) => l.request_id))
      return nos.length ? `- ${w.title}: ${nos.join(', ')}` : null
    })
    .filter(Boolean)
    .join('\n')

  const previousLines = (previous ?? [])
    .filter((s) => s.status !== 'approved')
    .map((s) => {
      const nos = toNos(s.request_set_key.split(','))
      return nos.length >= 2 ? `- (${s.status === 'rejected' ? 'reddedildi' : 'bekliyor'}) ${s.suggested_title}: ${nos.join(', ')}` : null
    })
    .filter(Boolean)
    .join('\n')

  const result = await generateStructured({
    instructions: GROUPING_INSTRUCTIONS,
    input: `<istek_verisi>
Açık istekler:
${requestLines}
</istek_verisi>

Mevcut işler (tekrar önerme):
${workItemLines || '- Yok'}

Daha önce önerilmiş/reddedilmiş gruplar (tekrar önerme):
${previousLines || '- Yok'}`,
    schema: groupSuggestionsSchema,
    name: 'group_suggestions',
    maxOutputTokens: 8000,
  })

  const knownKeys = new Set((previous ?? []).map((s) => s.request_set_key))
  const workItemKeys = (workItems ?? []).map((w) => new Set((w.work_item_requests ?? []).map((l) => l.request_id)))

  let created = 0
  for (const group of result.data.groups) {
    const ids = [...new Set(group.request_numbers.map((no) => byNo.get(String(no).trim())?.id).filter(Boolean))]
    if (ids.length < 2) continue
    const key = requestSetKey(ids)
    if (knownKeys.has(key)) continue
    if (workItemKeys.some((set) => ids.every((id) => set.has(id)))) continue
    knownKeys.add(key)

    const estimate = normalizeEstimate(group.estimated_hours_min, group.estimated_hours_max)
    const { data: suggestion, error: insertError } = await supabase
      .from('ai_group_suggestions')
      .insert({
        owner_id: userId,
        suggested_title: group.title.slice(0, 300),
        explanation: group.explanation,
        summary: group.summary,
        category: group.category.slice(0, 80) || null,
        difficulty: group.difficulty,
        estimated_hours_min: estimate.min,
        estimated_hours_max: estimate.max,
        confidence: Math.min(Math.max(Number(group.confidence) || 0, 0), 1).toFixed(2),
        request_set_key: key,
        model_name: result.model,
        prompt_version: GROUPING_PROMPT_VERSION,
      })
      .select('id')
      .single()
    if (insertError) throw insertError

    const { error: linkError } = await supabase
      .from('ai_group_suggestion_requests')
      .insert(ids.map((request_id) => ({ owner_id: userId, suggestion_id: suggestion.id, request_id })))
    if (linkError) throw linkError
    created += 1
  }

  return { status: 'done', created, considered: candidates.length }
}
