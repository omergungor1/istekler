'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { dbFail, fail, validate, withActionSession } from '@/lib/actions'

const approveSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, 'İş başlığı zorunludur.').max(300),
  requestIds: z.array(z.uuid()).min(1, 'En az bir istek seçmelisiniz.').max(200),
})

export async function approveSuggestion(input) {
  const { data, error: validationError } = validate(approveSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { data: workItemId, error } = await supabase.rpc('approve_group_suggestion', {
      p_suggestion_id: data.id,
      p_title: data.title,
      p_request_ids: data.requestIds,
    })
    if (error) return dbFail(error)
    refresh()
    return { ok: true, workItemId }
  })
}

export async function rejectSuggestion(id) {
  if (!z.uuid().safeParse(id).success) return fail('Geçersiz öneri.')
  return withActionSession(async ({ supabase }) => {
    const { data, error } = await supabase
      .from('ai_group_suggestions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
    if (error) return dbFail(error)
    if (!data.length) return fail('Bu öneri daha önce değerlendirilmiş.')
    refresh()
    return { ok: true }
  })
}
