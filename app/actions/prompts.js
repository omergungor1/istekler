'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { dbFail, fail, validate, withActionSession } from '@/lib/actions'

const saveSchema = z
  .object({
    requestId: z.uuid().optional(),
    workItemId: z.uuid().optional(),
    content: z.string().trim().min(1, 'Prompt boş olamaz.').max(60000, 'Prompt en fazla 60.000 karakter olabilir.'),
  })
  .refine((v) => Boolean(v.requestId) !== Boolean(v.workItemId), { message: 'Geçersiz hedef.' })

/** Kullanıcının düzenlediği prompt "düzenlendi" olarak işaretlenir; AI yeniden üretiminde izinsiz ezilmez. */
export async function saveAgentPrompt(input) {
  const { data, error: validationError } = validate(saveSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase, user }) => {
    const column = data.requestId ? 'request_id' : 'work_item_id'
    const targetId = data.requestId ?? data.workItemId

    const { data: existing } = await supabase.from('agent_prompts').select('id').eq(column, targetId).maybeSingle()
    const { error } = existing
      ? await supabase.from('agent_prompts').update({ content: data.content, is_edited: true }).eq('id', existing.id)
      : await supabase
          .from('agent_prompts')
          .insert({ owner_id: user.id, [column]: targetId, content: data.content, is_edited: true, generated_by: 'manual' })
    if (error) return dbFail(error)

    if (data.requestId) {
      await supabase.from('request_events').insert({
        request_id: data.requestId,
        event_type: 'prompt_saved',
        details: { edited: true },
      })
    }
    refresh()
    return { ok: true }
  })
}
