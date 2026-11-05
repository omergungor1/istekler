import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, parseWith, readJson, withApiUser } from '@/lib/api'
import { isAiConfigured } from '@/lib/ai/client'
import { createBulkJob, getActiveJob } from '@/lib/ai/jobs'

const bodySchema = z.object({
  requestIds: z.array(z.uuid()).max(500).optional(),
})

export const GET = withApiUser(async ({ supabase }) => {
  return NextResponse.json({ ok: true, job: await getActiveJob(supabase) })
})

export const POST = withApiUser(async ({ request, supabase, user }) => {
  const body = parseWith(bodySchema, await readJson(request))
  if (!isAiConfigured()) throw new ApiError(503, 'OpenAI yapılandırması eksik. OPENAI_API_KEY tanımlanmalı.')

  const { job, reused } = await createBulkJob(supabase, user.id, body.requestIds)
  if (!job) {
    return NextResponse.json({ ok: true, job: null, message: 'Analiz bekleyen istek bulunmuyor.' })
  }
  return NextResponse.json({ ok: true, job, reused })
})
