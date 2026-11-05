import { generateStructured } from './client'
import { CLOSING_INSTRUCTIONS, formatRequestBlock } from './prompts'
import { closingMessageSchema } from './schemas'
import { buildMaskedRequestInput, maskText } from '@/lib/privacy/mask'

const FIELDS =
  'id, external_no, institution_name, subject, module_name, form_name, description, content_hash, ai_input_override, ai_input_override_hash, deleted_at'

function workDoneBlock(workDone) {
  const masked = maskText(workDone ?? '').text.trim()
  return masked
    ? `Geliştiricinin yaptığını belirttiği işlemler:\n<istek_verisi>\n${masked}\n</istek_verisi>`
    : 'Geliştirici yaptığı işlemleri belirtmedi. Güvenli ve genel bir ifade kullan.'
}

function cleanMessage(text) {
  return text.replace(/\s+/g, ' ').replace(/^["“]|["”]$/g, '').trim().slice(0, 600)
}

export async function generateRequestClosingMessage(supabase, requestId, workDone) {
  const { data: request, error } = await supabase.from('requests').select(FIELDS).eq('id', requestId).maybeSingle()
  if (error) throw error
  if (!request || request.deleted_at) return { status: 'failed', error: 'İstek bulunamadı.' }

  const input = buildMaskedRequestInput(request)
  // Kişisel veri riski varsa açıklama gönderilmez; yalnızca konu ve modül bilgisiyle çalışılır.
  const block =
    input.risks.length > 0
      ? `<istek_verisi>\nModül: ${input.module || '-'}\nKonu: ${input.subject || '-'}\n</istek_verisi>`
      : formatRequestBlock(input)

  const result = await generateStructured({
    instructions: CLOSING_INSTRUCTIONS,
    input: `${block}\n\n${workDoneBlock(workDone)}`,
    schema: closingMessageSchema,
    name: 'closing_message',
    maxOutputTokens: 1500,
  })
  return { status: 'done', message: cleanMessage(result.data.message) }
}

export async function generateWorkItemClosingMessage(supabase, workItemId, workDone) {
  const { data: workItem, error } = await supabase
    .from('work_items')
    .select('title, summary, category')
    .eq('id', workItemId)
    .maybeSingle()
  if (error) throw error
  if (!workItem) return { status: 'failed', error: 'İş bulunamadı.' }

  const result = await generateStructured({
    instructions: CLOSING_INSTRUCTIONS,
    input: `<istek_verisi>\nTeknik iş: ${maskText(workItem.title).text}\n${workItem.summary ? `Özet: ${maskText(workItem.summary).text}\n` : ''}</istek_verisi>\n\nBu metin işe bağlı birden fazla kurumun isteğini kapatmak için ortak kullanılacak; kuruma özgü ifade kullanma.\n\n${workDoneBlock(workDone)}`,
    schema: closingMessageSchema,
    name: 'closing_message',
    maxOutputTokens: 1500,
  })
  return { status: 'done', message: cleanMessage(result.data.message) }
}
