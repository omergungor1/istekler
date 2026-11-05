import { generateStructured } from './client'
import { AGENT_PROMPT_INSTRUCTIONS, composeAgentPrompt, formatRequestBlock } from './prompts'
import { agentPromptSectionsSchema } from './schemas'
import { loadRequestForAi } from './analyze-request'
import { buildMaskedRequestInput } from '@/lib/privacy/mask'

const MASK_FIELDS =
  'id, external_no, institution_name, subject, module_name, form_name, description, content_hash, ai_input_override, ai_input_override_hash, ai_summary, deleted_at'

async function savePrompt(supabase, target, { content, generatedBy, model, sourceHash, overwriteEdited }) {
  const column = target.requestId ? 'request_id' : 'work_item_id'
  const id = target.requestId ?? target.workItemId

  const { data: existing } = await supabase.from('agent_prompts').select('id, is_edited').eq(column, id).maybeSingle()
  if (existing?.is_edited && !overwriteEdited) return { status: 'edited_conflict' }

  const payload = {
    content,
    is_edited: false,
    generated_by: generatedBy,
    model_name: model,
    source_hash: sourceHash,
  }
  const query = existing
    ? supabase.from('agent_prompts').update(payload).eq('id', existing.id)
    : supabase.from('agent_prompts').insert({ ...payload, [column]: id })
  const { error } = await query
  if (error) throw error

  if (target.requestId) {
    await supabase.from('request_events').insert({
      request_id: target.requestId,
      event_type: 'prompt_saved',
      details: { generated_by: generatedBy },
    })
  }
  return { status: 'done', content }
}

/** İstek için agent promptu: güncel analiz varsa ondan oluşturulur (ek API çağrısı yapılmaz). */
export async function generateRequestPrompt(supabase, requestId, { regenerate = false, overwriteEdited = false } = {}) {
  const request = await loadRequestForAi(supabase, requestId)
  if (!request || request.deleted_at) return { status: 'failed', error: 'İstek bulunamadı.' }

  if (!regenerate && request.current_analysis_id) {
    const { data: analysis } = await supabase
      .from('ai_analyses')
      .select('source_hash, generated_agent_prompt, model_name')
      .eq('id', request.current_analysis_id)
      .maybeSingle()
    if (analysis?.generated_agent_prompt && analysis.source_hash === request.content_hash) {
      return savePrompt(supabase, { requestId }, {
        content: analysis.generated_agent_prompt,
        generatedBy: 'analysis',
        model: analysis.model_name,
        sourceHash: request.content_hash,
        overwriteEdited,
      })
    }
  }

  const input = buildMaskedRequestInput(request)
  if (input.risks.length > 0) return { status: 'needs_review', risks: input.risks }

  const result = await generateStructured({
    instructions: AGENT_PROMPT_INSTRUCTIONS,
    input: `Aşağıdaki istek için kod agentı görev bölümlerini hazırla.\n\n${formatRequestBlock(input)}`,
    schema: agentPromptSectionsSchema,
    name: 'agent_prompt',
  })

  return savePrompt(supabase, { requestId }, {
    content: composeAgentPrompt(result.data, [input]),
    generatedBy: 'ai',
    model: result.model,
    sourceHash: request.content_hash,
    overwriteEdited,
  })
}

/** Birden fazla isteği kapsayan iş grubu için ortak agent promptu üretir. */
export async function generateWorkItemPrompt(supabase, workItemId, { overwriteEdited = false } = {}) {
  const { data: workItem, error } = await supabase
    .from('work_items')
    .select('id, title, summary, description, technical_notes, work_item_requests(requests(' + MASK_FIELDS + '))')
    .eq('id', workItemId)
    .maybeSingle()
  if (error) throw error
  if (!workItem) return { status: 'failed', error: 'İş bulunamadı.' }

  const requests = (workItem.work_item_requests ?? []).map((l) => l.requests).filter((r) => r && !r.deleted_at)
  if (requests.length === 0) return { status: 'failed', error: 'Prompt oluşturmak için işe en az bir istek bağlanmalı.' }

  const inputs = requests.map((r) => ({ request: r, input: buildMaskedRequestInput(r) }))
  const risky = inputs.filter((i) => i.input.risks.length > 0)
  if (risky.length > 0) {
    return {
      status: 'needs_review',
      risks: [`Şu isteklerde kişisel veri incelemesi gerekiyor: ${risky.map((i) => `#${i.request.external_no}`).join(', ')}`],
    }
  }

  const blocks = inputs
    .map(({ request, input }) => `${formatRequestBlock(input)}${request.ai_summary ? `\nAI özeti: ${request.ai_summary}` : ''}`)
    .join('\n\n')

  const result = await generateStructured({
    instructions: AGENT_PROMPT_INSTRUCTIONS,
    input: `Teknik iş: ${workItem.title}
${workItem.summary ? `İş özeti: ${workItem.summary}\n` : ''}${workItem.description ? `İş açıklaması: ${workItem.description}\n` : ''}
Bu işe bağlı istekler:

${blocks}`,
    schema: agentPromptSectionsSchema,
    name: 'work_item_agent_prompt',
  })

  return savePrompt(supabase, { workItemId }, {
    content: composeAgentPrompt(result.data, inputs.map((i) => i.input)),
    generatedBy: 'ai',
    model: result.model,
    sourceHash: null,
    overwriteEdited,
  })
}
