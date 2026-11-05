'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { dbFail, fail, withActionSession } from '@/lib/actions'

const batchIdSchema = z.uuid()

export async function confirmImport(batchId) {
  if (!batchIdSchema.safeParse(batchId).success) return fail('Geçersiz aktarım.')
  return withActionSession(async ({ supabase }) => {
    const { data, error } = await supabase.rpc('apply_import_batch', { p_batch_id: batchId })
    if (error) return dbFail(error, 'Aktarım tamamlanamadı. Hiçbir kayıt değiştirilmedi.')
    refresh()
    return { ok: true, result: data }
  })
}

export async function cancelImport(batchId) {
  if (!batchIdSchema.safeParse(batchId).success) return fail('Geçersiz aktarım.')
  return withActionSession(async ({ supabase }) => {
    const { error } = await supabase
      .from('import_batches')
      .update({ status: 'cancelled' })
      .eq('id', batchId)
      .eq('status', 'preview')
    if (error) return dbFail(error)
    await supabase.from('import_batch_rows').delete().eq('batch_id', batchId)
    refresh()
    return { ok: true }
  })
}
