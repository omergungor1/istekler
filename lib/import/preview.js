import { SOURCE_FIELDS } from './parse-excel'

const CHUNK = 500

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Ayrıştırılan satırları kullanıcının mevcut istekleriyle (owner_id + external_no) karşılaştırır.
 * Kullanıcı izolasyonu RLS ile sağlanır; sorgu yalnızca oturumdaki kullanıcının kayıtlarını görür.
 */
export async function classifyRows(supabase, parsedRows) {
  const numbers = [...new Set(parsedRows.filter((r) => r.kind === 'valid').map((r) => r.externalNo))]
  const existing = new Map()

  for (const part of chunk(numbers, CHUNK)) {
    const { data, error } = await supabase
      .from('requests')
      .select(`id, external_no, source_hash, status, deleted_at, ${SOURCE_FIELDS.join(', ')}`)
      .in('external_no', part)
    if (error) throw error
    data.forEach((r) => existing.set(r.external_no, r))
  }

  return parsedRows.map((row) => {
    if (row.kind !== 'valid') {
      return { ...row, action: row.kind, changedFields: [], existingId: null, isCompleted: false }
    }
    const current = existing.get(row.externalNo)
    if (!current) return { ...row, action: 'new', changedFields: [], existingId: null, isCompleted: false }

    const changedFields = SOURCE_FIELDS.filter((f) => (row.data[f] ?? null) !== (current[f] ?? null))
    const isDeleted = Boolean(current.deleted_at)
    const action = isDeleted ? 'restore' : current.source_hash === row.sourceHash ? 'unchanged' : 'update'

    return {
      ...row,
      action,
      changedFields: action === 'unchanged' ? [] : changedFields,
      existingId: current.id,
      isCompleted: current.status === 'completed' && !isDeleted,
    }
  })
}

export function summarize(rows) {
  const summary = { total: rows.length, new: 0, update: 0, unchanged: 0, restore: 0, invalid: 0, duplicate: 0, completedChanged: 0 }
  for (const row of rows) {
    summary[row.action] += 1
    if (row.action === 'update' && row.isCompleted) summary.completedChanged += 1
  }
  summary.valid = summary.new + summary.update + summary.unchanged + summary.restore
  return summary
}

export async function savePreviewBatch(supabase, { userId, fileName, fileHash, fileSize, rows, summary }) {
  await supabase.rpc('cleanup_expired_imports')

  const { data: batch, error } = await supabase
    .from('import_batches')
    .insert({
      owner_id: userId,
      file_name: fileName.slice(0, 255),
      file_hash: fileHash,
      file_size: fileSize,
      status: 'preview',
      total_rows: summary.total,
      valid_count: summary.valid,
      new_count: summary.new,
      updated_count: summary.update,
      unchanged_count: summary.unchanged,
      restored_count: summary.restore,
      error_count: summary.invalid,
      duplicate_count: summary.duplicate,
    })
    .select('id, expires_at')
    .single()
  if (error) throw error

  const records = rows.map((row) => ({
    owner_id: userId,
    batch_id: batch.id,
    row_number: row.rowNumber,
    external_no: row.externalNo,
    data: row.data,
    source_hash: row.sourceHash,
    content_hash: row.contentHash,
    action: row.action,
    changed_fields: row.changedFields,
    errors: row.errors,
    existing_request_id: row.existingId,
    is_completed: row.isCompleted,
  }))

  for (const part of chunk(records, CHUNK)) {
    const { error: rowsError } = await supabase.from('import_batch_rows').insert(part)
    if (rowsError) {
      await supabase.from('import_batches').update({ status: 'failed', error_message: 'Önizleme kaydedilemedi.' }).eq('id', batch.id)
      throw rowsError
    }
  }

  return batch
}

/** Önizleme ekranına yalnızca gerekli alanlar gönderilir (açıklama metni gönderilmez). */
export function toPreviewRow(row) {
  return {
    rowNumber: row.rowNumber,
    externalNo: row.externalNo,
    subject: row.data.subject ?? null,
    institution: row.data.institution_name ?? null,
    module: row.data.module_name ?? null,
    action: row.action,
    changedFields: row.changedFields,
    errors: row.errors,
    isCompleted: row.isCompleted,
  }
}
