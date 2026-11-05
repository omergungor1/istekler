'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { dbFail, fail, validate, withActionSession } from '@/lib/actions'

const idSchema = z.uuid()
const statusSchema = z.enum(['open', 'in_progress', 'completed'])
const difficultySchema = z.enum(['easy', 'medium', 'hard', 'very_hard']).nullable()
const hoursSchema = z.number().min(0, 'Süre negatif olamaz.').max(1000, 'Süre en fazla 1000 saat olabilir.').nullable()
const titleSchema = z.string().trim().min(1, 'İş başlığı zorunludur.').max(300, 'İş başlığı en fazla 300 karakter olabilir.')

async function addEvents(supabase, requestIds, workItemId, eventType, details) {
  if (!requestIds.length) return
  await supabase.from('request_events').insert(
    requestIds.map((request_id) => ({ request_id, work_item_id: workItemId, event_type: eventType, details }))
  )
}

const createSchema = z.object({
  title: titleSchema,
  summary: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(80).optional(),
  requestIds: z.array(idSchema).max(200).optional(),
})

export async function createWorkItem(input) {
  const { data, error: validationError } = validate(createSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase, user }) => {
    let category = data.category || null
    let estimate = {}
    const requestIds = [...new Set(data.requestIds ?? [])]

    if (requestIds.length === 1) {
      const { data: request } = await supabase
        .from('requests')
        .select('ai_category, ai_difficulty, ai_hours_min, ai_hours_max, ai_summary')
        .eq('id', requestIds[0])
        .maybeSingle()
      if (request) {
        category = category ?? request.ai_category
        estimate = {
          ai_difficulty: request.ai_difficulty,
          ai_estimated_hours_min: request.ai_hours_min,
          ai_estimated_hours_max: request.ai_hours_max,
          summary: data.summary || request.ai_summary,
        }
      }
    }

    const { data: workItem, error } = await supabase
      .from('work_items')
      .insert({ owner_id: user.id, title: data.title, summary: data.summary || null, category, ...estimate })
      .select('id')
      .single()
    if (error) return dbFail(error)

    if (requestIds.length) {
      const { error: linkError } = await supabase
        .from('work_item_requests')
        .insert(requestIds.map((request_id) => ({ owner_id: user.id, work_item_id: workItem.id, request_id })))
      if (linkError) {
        await supabase.from('work_items').delete().eq('id', workItem.id)
        return dbFail(linkError, 'İstekler işe bağlanamadı.')
      }
      await addEvents(supabase, requestIds, workItem.id, 'linked_work_item', { title: data.title, source: 'manual' })
    }
    refresh()
    return { ok: true, id: workItem.id }
  })
}

const updateSchema = z
  .object({
    id: idSchema,
    title: titleSchema,
    summary: z.string().max(4000).nullable(),
    description: z.string().max(20000).nullable(),
    category: z.string().trim().max(80).nullable(),
    technicalNotes: z.string().max(20000).nullable(),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(1000)).max(50),
  })

/** Notlar ve manuel tahmin kendi işlemleriyle güncellenir; burada ezilmez. */
export async function updateWorkItem(input) {
  const { data, error: validationError } = validate(updateSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const empty = (v) => (v === null || v.trim() === '' ? null : v.trim())
    const { error } = await supabase
      .from('work_items')
      .update({
        title: data.title,
        summary: empty(data.summary),
        description: empty(data.description),
        category: empty(data.category),
        technical_notes: empty(data.technicalNotes),
        acceptance_criteria: data.acceptanceCriteria,
      })
      .eq('id', data.id)
    if (error) return dbFail(error)
    refresh()
    return { ok: true }
  })
}

const notesSchema = z.object({
  id: idSchema,
  notes: z.string().max(20000, 'Notlar en fazla 20.000 karakter olabilir.'),
})

export async function updateWorkItemNotes(input) {
  const { data, error: validationError } = validate(notesSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('work_items')
      .update({ work_notes: data.notes.trim() || null })
      .eq('id', data.id)
    if (error) return dbFail(error)
    return { ok: true }
  })
}

const estimateSchema = z
  .object({
    id: idSchema,
    difficulty: difficultySchema,
    hoursMin: hoursSchema,
    hoursMax: hoursSchema,
  })
  .refine((v) => v.hoursMin === null || v.hoursMax === null || v.hoursMin <= v.hoursMax, {
    message: 'Minimum süre maksimum süreden büyük olamaz.',
  })

export async function updateWorkItemEstimate(input) {
  const { data, error: validationError } = validate(estimateSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('work_items')
      .update({
        manual_difficulty: data.difficulty,
        manual_estimated_hours_min: data.hoursMin,
        manual_estimated_hours_max: data.hoursMax,
      })
      .eq('id', data.id)
    if (error) return dbFail(error)
    refresh()
    return { ok: true }
  })
}

/** İşin durumu bağlı isteklerin durumunu otomatik değiştirmez. */
export async function setWorkItemStatus(id, status) {
  if (!idSchema.safeParse(id).success || !statusSchema.safeParse(status).success) return fail('Geçersiz işlem.')
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('work_items')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return dbFail(error)
    refresh()
    return { ok: true }
  })
}

export async function deleteWorkItem(id) {
  if (!idSchema.safeParse(id).success) return fail('Geçersiz iş.')
  return withActionSession(async ({ supabase }) => {
    const { data: workItem } = await supabase
      .from('work_items')
      .select('title, work_item_requests(request_id)')
      .eq('id', id)
      .maybeSingle()
    if (!workItem) return fail('İş bulunamadı.')

    const requestIds = (workItem.work_item_requests ?? []).map((l) => l.request_id)
    await addEvents(supabase, requestIds, null, 'unlinked_work_item', { title: workItem.title, reason: 'work_item_deleted' })
    const { error } = await supabase.from('work_items').delete().eq('id', id)
    if (error) return dbFail(error)
    return { ok: true }
  })
}

const linkSchema = z.object({
  workItemId: idSchema,
  requestIds: z.array(idSchema).min(1, 'En az bir istek seçmelisiniz.').max(200),
})

export async function addRequestsToWorkItem(input) {
  const { data, error: validationError } = validate(linkSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase, user }) => {
    const { data: workItem } = await supabase.from('work_items').select('title').eq('id', data.workItemId).maybeSingle()
    if (!workItem) return fail('İş bulunamadı.')

    const { data: existing } = await supabase
      .from('work_item_requests')
      .select('request_id')
      .eq('work_item_id', data.workItemId)
    const already = new Set((existing ?? []).map((l) => l.request_id))
    const ids = [...new Set(data.requestIds)].filter((id) => !already.has(id))
    if (!ids.length) return { ok: true, added: 0 }

    const { error } = await supabase
      .from('work_item_requests')
      .insert(ids.map((request_id) => ({ owner_id: user.id, work_item_id: data.workItemId, request_id })))
    if (error) return dbFail(error, 'İstekler işe bağlanamadı.')
    await addEvents(supabase, ids, data.workItemId, 'linked_work_item', { title: workItem.title, source: 'manual' })
    refresh()
    return { ok: true, added: ids.length }
  })
}

export async function removeRequestFromWorkItem(workItemId, requestId) {
  if (!idSchema.safeParse(workItemId).success || !idSchema.safeParse(requestId).success) return fail('Geçersiz işlem.')
  return withActionSession(async ({ supabase }) => {
    const { data: workItem } = await supabase.from('work_items').select('title').eq('id', workItemId).maybeSingle()
    if (!workItem) return fail('İş bulunamadı.')
    const { error } = await supabase
      .from('work_item_requests')
      .delete()
      .eq('work_item_id', workItemId)
      .eq('request_id', requestId)
    if (error) return dbFail(error)
    await addEvents(supabase, [requestId], workItemId, 'unlinked_work_item', { title: workItem.title, reason: 'manual' })
    refresh()
    return { ok: true }
  })
}

const splitSchema = z.object({
  workItemId: idSchema,
  title: titleSchema,
  requestIds: z.array(idSchema).min(1, 'Yeni işe taşınacak en az bir istek seçin.').max(200),
})

export async function splitWorkItem(input) {
  const { data, error: validationError } = validate(splitSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { data: newId, error } = await supabase.rpc('split_work_item', {
      p_work_item_id: data.workItemId,
      p_title: data.title,
      p_request_ids: data.requestIds,
    })
    if (error) return dbFail(error)
    refresh()
    return { ok: true, id: newId }
  })
}

const bulkCompleteSchema = z.object({
  workItemId: idSchema,
  requestIds: z.array(idSchema).min(1, 'Tamamlanacak en az bir istek seçin.').max(200),
  closingMessage: z.string().trim().max(2000),
})

/** Kullanıcı onayıyla işe bağlı seçili istekleri tek seferde tamamlar. */
export async function completeWorkItemRequests(input) {
  const { data, error: validationError } = validate(bulkCompleteSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { data: links } = await supabase
      .from('work_item_requests')
      .select('request_id, requests(status, deleted_at)')
      .eq('work_item_id', data.workItemId)
      .in('request_id', data.requestIds)

    const targets = (links ?? []).filter((l) => l.requests && !l.requests.deleted_at && l.requests.status !== 'completed')
    if (!targets.length) return fail('Tamamlanabilecek istek bulunamadı.')

    const ids = targets.map((t) => t.request_id)
    const { error } = await supabase
      .from('requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        closing_message: data.closingMessage || null,
      })
      .in('id', ids)
    if (error) return dbFail(error)

    await supabase.from('request_events').insert(
      targets.map((t) => ({
        request_id: t.request_id,
        work_item_id: data.workItemId,
        event_type: 'completed',
        details: { from: t.requests.status, closing_message: data.closingMessage || null, via: 'work_item' },
      }))
    )
    refresh()
    return { ok: true, completed: ids.length }
  })
}
