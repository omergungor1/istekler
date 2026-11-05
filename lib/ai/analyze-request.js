import { AiError, generateStructured } from './client'
import { ANALYSIS_INSTRUCTIONS, ANALYSIS_PROMPT_VERSION, composeAgentPrompt, formatRequestBlock } from './prompts'
import { requestAnalysisSchema } from './schemas'
import { buildMaskedRequestInput } from '@/lib/privacy/mask'

const REQUEST_FIELDS =
  'id, owner_id, external_no, institution_name, subject, module_name, form_name, description, content_hash, ai_status, current_analysis_id, ai_input_override, ai_input_override_hash, deleted_at'

export function normalizeEstimate(min, max, possible = true) {
  if (!possible) return { min: null, max: null }
  const clamp = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.min(Math.max(Number(v), 0), 1000))
  let lo = clamp(min)
  let hi = clamp(max)
  if (lo === null && hi === null) return { min: null, max: null }
  if (lo === null) lo = hi
  if (hi === null) hi = lo
  if (lo > hi) [lo, hi] = [hi, lo]
  return { min: Math.round(lo * 10) / 10, max: Math.round(hi * 10) / 10 }
}

export async function loadRequestForAi(supabase, requestId) {
  const { data, error } = await supabase.from('requests').select(REQUEST_FIELDS).eq('id', requestId).maybeSingle()
  if (error) throw error
  return data
}

async function addEvent(supabase, request, eventType, details = {}) {
  await supabase.from('request_events').insert({
    owner_id: request.owner_id,
    request_id: request.id,
    event_type: eventType,
    details,
  })
}

/**
 * Tek bir isteği analiz eder. Kaynak metni değişmemiş ve analizi mevcut kayıtlar için
 * API çağrısı yapılmaz. Kişisel veri riski taşıyan metinler API'ye gönderilmez.
 *
 * Dönüş: { status: 'cached' | 'done' | 'needs_review' | 'failed', error?, retriable?, risks? }
 */
export async function analyzeRequest(supabase, requestId, { force = false } = {}) {
  const request = await loadRequestForAi(supabase, requestId)
  if (!request) return { status: 'failed', error: 'İstek bulunamadı.', retriable: false }
  if (request.deleted_at) return { status: 'failed', error: 'Silinmiş istekler analiz edilemez.', retriable: false }

  if (!force && request.current_analysis_id && request.ai_status === 'done') {
    const { data: current } = await supabase
      .from('ai_analyses')
      .select('source_hash')
      .eq('id', request.current_analysis_id)
      .maybeSingle()
    if (current?.source_hash === request.content_hash) return { status: 'cached' }
  }

  const input = buildMaskedRequestInput(request)
  if (input.risks.length > 0) {
    if (request.ai_status !== 'needs_review') {
      await supabase
        .from('requests')
        .update({ ai_status: 'needs_review', ai_status_message: input.risks.join(' ') })
        .eq('id', request.id)
      await addEvent(supabase, request, 'ai_review_required', { risks: input.risks })
    }
    return { status: 'needs_review', risks: input.risks }
  }

  const previousStatus = request.ai_status
  await supabase.from('requests').update({ ai_status: 'processing', ai_status_message: null }).eq('id', request.id)

  let result
  try {
    result = await generateStructured({
      instructions: ANALYSIS_INSTRUCTIONS,
      input: `Aşağıdaki isteği analiz et.\n\n${formatRequestBlock(input)}`,
      schema: requestAnalysisSchema,
      name: 'request_analysis',
    })
  } catch (err) {
    const message = err instanceof AiError ? err.message : 'AI analizi başarısız oldu.'
    await supabase.from('ai_analyses').insert({
      owner_id: request.owner_id,
      request_id: request.id,
      source_hash: request.content_hash,
      prompt_version: ANALYSIS_PROMPT_VERSION,
      model_name: process.env.OPENAI_MODEL || 'unknown',
      analysis_status: 'failed',
      error_message: message,
    })
    // Önceki geçerli analiz varsa korunur; yalnızca durum mesajı güncellenir.
    await supabase
      .from('requests')
      .update({
        ai_status: request.current_analysis_id ? (previousStatus === 'done' ? 'done' : 'stale') : 'failed',
        ai_status_message: message,
      })
      .eq('id', request.id)
    await addEvent(supabase, request, 'ai_failed', { error: message })
    return { status: 'failed', error: message, retriable: err?.retriable ?? false }
  }

  const a = result.data
  const estimate = normalizeEstimate(a.estimated_hours_min, a.estimated_hours_max, a.estimate_possible)
  const agentPrompt = composeAgentPrompt(a.agent_prompt, [input])
  const category = a.category.trim().slice(0, 80) || null

  const { data: analysis, error: insertError } = await supabase
    .from('ai_analyses')
    .insert({
      owner_id: request.owner_id,
      request_id: request.id,
      source_hash: request.content_hash,
      prompt_version: ANALYSIS_PROMPT_VERSION,
      model_name: result.model,
      analysis_status: 'completed',
      short_summary: a.summary,
      problem_description: a.problem,
      current_behavior: a.current_behavior,
      expected_behavior: a.expected_behavior,
      technical_analysis: a.technical_hypotheses,
      suggested_solution: a.steps,
      acceptance_criteria: a.acceptance_criteria,
      missing_information: a.missing_information,
      difficulty: a.difficulty,
      estimated_hours_min: estimate.min,
      estimated_hours_max: estimate.max,
      estimate_confidence: estimate.max === null ? 'low' : a.estimate_confidence,
      estimated_time_reason: a.estimate_reason,
      generated_agent_prompt: agentPrompt,
      category,
      tags: a.tags.slice(0, 8).map((t) => t.slice(0, 40)),
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  // Manuel tahmin alanlarına (manual_*) dokunulmaz.
  await supabase
    .from('requests')
    .update({
      current_analysis_id: analysis.id,
      ai_status: 'done',
      ai_status_message: null,
      ai_summary: a.summary,
      ai_category: category,
      ai_difficulty: a.difficulty,
      ai_hours_min: estimate.min,
      ai_hours_max: estimate.max,
      ai_analyzed_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  await addEvent(supabase, request, 'ai_analyzed', { analysis_id: analysis.id, model: result.model })
  return { status: 'done', analysisId: analysis.id }
}
