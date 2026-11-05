import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, parseWith, readJson, withApiUser } from '@/lib/api'
import { cancelJob, getJobProgress, processJobBatch, retryFailedItems } from '@/lib/ai/jobs'

const bodySchema = z.object({
  action: z.enum(['process', 'cancel', 'retry']),
})

async function resolveJobId(context) {
  const { id } = await context.params
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'Geçersiz işlem numarası.')
  return parsed.data
}

export const GET = withApiUser(async ({ context, supabase }) => {
  const job = await getJobProgress(supabase, await resolveJobId(context))
  if (!job) throw new ApiError(404, 'İşlem bulunamadı.')
  return NextResponse.json({ ok: true, job })
})

export const POST = withApiUser(async ({ request, context, supabase }) => {
  const jobId = await resolveJobId(context)
  const { action } = parseWith(bodySchema, await readJson(request))

  let job
  if (action === 'process') job = await processJobBatch(supabase, jobId)
  else if (action === 'cancel') job = await cancelJob(supabase, jobId)
  else job = await retryFailedItems(supabase, jobId)

  if (!job) throw new ApiError(404, 'İşlem bulunamadı.')
  return NextResponse.json({ ok: true, job })
})
