'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { dbFail, fail, validate, withActionSession } from '@/lib/actions'

const idSchema = z.uuid()
const difficultySchema = z.enum(['easy', 'medium', 'hard', 'very_hard']).nullable()
const hoursSchema = z.number().min(0, 'Süre negatif olamaz.').max(1000, 'Süre en fazla 1000 saat olabilir.').nullable()

async function loadRequest(supabase, id, fields = 'id, status, deleted_at, closing_message, completed_at') {
  const { data, error } = await supabase.from('requests').select(fields).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

async function addEvent(supabase, requestId, eventType, details = {}, workItemId = null) {
  await supabase.from('request_events').insert({
    request_id: requestId,
    work_item_id: workItemId,
    event_type: eventType,
    details,
  })
}

export async function startRequest(id) {
  if (!idSchema.safeParse(id).success) return fail('Geçersiz istek.')
  return withActionSession(async ({ supabase }) => {
    const request = await loadRequest(supabase, id)
    if (!request || request.deleted_at) return fail('İstek bulunamadı.')
    if (request.status !== 'open') return fail('Yalnızca açık istekler başlatılabilir.')

    const { error } = await supabase
      .from('requests')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return dbFail(error)
    await addEvent(supabase, id, 'status_changed', { from: 'open', to: 'in_progress' })
    refresh()
    return { ok: true }
  })
}

const completeSchema = z.object({
  id: idSchema,
  closingMessage: z.string().trim().max(2000, 'Kapatma açıklaması en fazla 2000 karakter olabilir.'),
  workDone: z.string().trim().max(4000).optional(),
})

export async function completeRequest(input) {
  const { data, error: validationError } = validate(completeSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const request = await loadRequest(supabase, data.id)
    if (!request || request.deleted_at) return fail('İstek bulunamadı.')
    if (request.status === 'completed') return fail('İstek zaten tamamlanmış.')

    const { error } = await supabase
      .from('requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        closing_message: data.closingMessage || null,
      })
      .eq('id', data.id)
    if (error) return dbFail(error)
    await addEvent(supabase, data.id, 'completed', {
      from: request.status,
      closing_message: data.closingMessage || null,
    })
    refresh()
    return { ok: true }
  })
}

export async function reopenRequest(id) {
  if (!idSchema.safeParse(id).success) return fail('Geçersiz istek.')
  return withActionSession(async ({ supabase }) => {
    const request = await loadRequest(supabase, id)
    if (!request || request.deleted_at) return fail('İstek bulunamadı.')
    if (request.status !== 'completed') return fail('Yalnızca tamamlanan istekler yeniden açılabilir.')

    const { error } = await supabase
      .from('requests')
      .update({ status: 'open', completed_at: null, closing_message: null })
      .eq('id', id)
    if (error) return dbFail(error)
    await addEvent(supabase, id, 'reopened', {
      previous_closing_message: request.closing_message,
      previous_completed_at: request.completed_at,
    })
    refresh()
    return { ok: true }
  })
}

export async function deleteRequest(id) {
  if (!idSchema.safeParse(id).success) return fail('Geçersiz istek.')
  return withActionSession(async ({ supabase }) => {
    const request = await loadRequest(supabase, id)
    if (!request || request.deleted_at) return fail('İstek bulunamadı.')

    const { error } = await supabase.from('requests').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return dbFail(error)
    await addEvent(supabase, id, 'deleted', { status: request.status })
    return { ok: true }
  })
}

const notesSchema = z.object({
  id: idSchema,
  notes: z.string().max(20000, 'Notlar en fazla 20.000 karakter olabilir.'),
})

export async function updateRequestNotes(input) {
  const { data, error: validationError } = validate(notesSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('requests')
      .update({ user_notes: data.notes.trim() || null })
      .eq('id', data.id)
      .is('deleted_at', null)
    if (error) return dbFail(error)
    await addEvent(supabase, data.id, 'note_updated')
    refresh()
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

export async function updateRequestEstimate(input) {
  const { data, error: validationError } = validate(estimateSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('requests')
      .update({
        manual_difficulty: data.difficulty,
        manual_hours_min: data.hoursMin,
        manual_hours_max: data.hoursMax,
      })
      .eq('id', data.id)
    if (error) return dbFail(error)
    await addEvent(supabase, data.id, 'estimate_updated', {
      difficulty: data.difficulty,
      hours_min: data.hoursMin,
      hours_max: data.hoursMax,
    })
    refresh()
    return { ok: true }
  })
}

const overrideSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1, 'Metin boş olamaz.').max(50000),
})

/** Kullanıcının incelediği ve onayladığı maskelenmiş metni AI girdisi olarak kaydeder. */
export async function saveAiInputOverride(input) {
  const { data, error: validationError } = validate(overrideSchema, input)
  if (validationError) return fail(validationError)
  return withActionSession(async ({ supabase }) => {
    const request = await loadRequest(supabase, data.id, 'id, content_hash, ai_status, current_analysis_id, deleted_at')
    if (!request || request.deleted_at) return fail('İstek bulunamadı.')

    const { error } = await supabase
      .from('requests')
      .update({
        ai_input_override: data.text,
        ai_input_override_hash: request.content_hash,
        ai_status: request.current_analysis_id ? 'stale' : 'pending',
        ai_status_message: null,
      })
      .eq('id', data.id)
    if (error) return dbFail(error)
    refresh()
    return { ok: true }
  })
}

export async function clearAiInputOverride(id) {
  if (!idSchema.safeParse(id).success) return fail('Geçersiz istek.')
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('requests')
      .update({ ai_input_override: null, ai_input_override_hash: null })
      .eq('id', id)
    if (error) return dbFail(error)
    refresh()
    return { ok: true }
  })
}
