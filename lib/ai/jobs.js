import { analyzeRequest } from './analyze-request'

export const JOB_CONCURRENCY = 3
const MAX_JOB_ITEMS = 500
const MAX_ATTEMPTS = 3

export async function getJobProgress(supabase, jobId) {
  const { data: job, error } = await supabase
    .from('ai_jobs')
    .select('id, status, total_count, created_at, finished_at')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  if (!job) return null

  const { data: items, error: itemsError } = await supabase.from('ai_job_items').select('status').eq('job_id', jobId)
  if (itemsError) throw itemsError

  const counts = { queued: 0, processing: 0, done: 0, failed: 0, skipped: 0, needs_review: 0 }
  for (const item of items) counts[item.status] += 1
  return { ...job, counts }
}

export async function getActiveJob(supabase) {
  const { data } = await supabase
    .from('ai_jobs')
    .select('id')
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? getJobProgress(supabase, data.id) : null
}

/** Analiz bekleyen, güncelliğini yitirmiş veya başarısız olmuş açık istekler için iş kuyruğu oluşturur. */
export async function createBulkJob(supabase, userId, requestIds) {
  const active = await getActiveJob(supabase)
  if (active) return { job: active, reused: true }

  let query = supabase
    .from('requests')
    .select('id')
    .is('deleted_at', null)
    .neq('status', 'completed')
    .in('ai_status', ['pending', 'stale', 'failed'])
    .order('external_no_sort', { ascending: false, nullsFirst: false })
    .limit(MAX_JOB_ITEMS)
  if (requestIds?.length) query = query.in('id', requestIds)

  const { data: requests, error } = await query
  if (error) throw error
  if (!requests.length) return { job: null, reused: false }

  const { data: job, error: jobError } = await supabase
    .from('ai_jobs')
    .insert({ owner_id: userId, kind: 'bulk_analysis', status: 'running', total_count: requests.length })
    .select('id')
    .single()
  if (jobError) throw jobError

  const { error: itemsError } = await supabase
    .from('ai_job_items')
    .insert(requests.map((r) => ({ owner_id: userId, job_id: job.id, request_id: r.id })))
  if (itemsError) throw itemsError

  return { job: await getJobProgress(supabase, job.id), reused: false }
}

async function finishIfDone(supabase, jobId) {
  const progress = await getJobProgress(supabase, jobId)
  if (progress && progress.status === 'running' && progress.counts.queued === 0 && progress.counts.processing === 0) {
    await supabase.from('ai_jobs').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', jobId)
    return { ...progress, status: 'completed' }
  }
  return progress
}

/**
 * Kuyruktan kontrollü sayıda kayıt alıp işler. Her çağrı kısa sürer; uzun işlem tek bir
 * HTTP isteğine bağlı kalmaz ve sayfa yenilense bile kaldığı yerden devam eder.
 */
export async function processJobBatch(supabase, jobId) {
  const progress = await getJobProgress(supabase, jobId)
  if (!progress) return null
  if (progress.status !== 'running') return progress

  const { data: claimed, error } = await supabase.rpc('claim_ai_job_items', {
    p_job_id: jobId,
    p_limit: JOB_CONCURRENCY,
  })
  if (error) throw error

  await Promise.all(
    (claimed ?? []).map(async (item) => {
      let update
      try {
        const result = await analyzeRequest(supabase, item.request_id)
        if (result.status === 'done') update = { status: 'done', error_message: null }
        else if (result.status === 'cached') update = { status: 'skipped', error_message: null }
        else if (result.status === 'needs_review') update = { status: 'needs_review', error_message: null }
        else if (result.retriable && item.attempts < MAX_ATTEMPTS) update = { status: 'queued', error_message: result.error }
        else update = { status: 'failed', error_message: result.error }
      } catch {
        update =
          item.attempts < MAX_ATTEMPTS
            ? { status: 'queued', error_message: 'Geçici hata, tekrar denenecek.' }
            : { status: 'failed', error_message: 'İşlem başarısız oldu.' }
      }
      await supabase
        .from('ai_job_items')
        .update({ ...update, locked_at: null })
        .eq('id', item.id)
    })
  )

  return finishIfDone(supabase, jobId)
}

export async function cancelJob(supabase, jobId) {
  await supabase.from('ai_job_items').update({ status: 'skipped' }).eq('job_id', jobId).eq('status', 'queued')
  await supabase
    .from('ai_jobs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'running')
  return getJobProgress(supabase, jobId)
}

export async function retryFailedItems(supabase, jobId) {
  const { data: failed } = await supabase
    .from('ai_job_items')
    .select('id')
    .eq('job_id', jobId)
    .eq('status', 'failed')
  if (!failed?.length) return getJobProgress(supabase, jobId)

  const active = await getActiveJob(supabase)
  if (active && active.id !== jobId) return active

  await supabase
    .from('ai_job_items')
    .update({ status: 'queued', attempts: 0, error_message: null, locked_at: null })
    .eq('job_id', jobId)
    .eq('status', 'failed')
  await supabase.from('ai_jobs').update({ status: 'running', finished_at: null }).eq('id', jobId)
  return getJobProgress(supabase, jobId)
}
