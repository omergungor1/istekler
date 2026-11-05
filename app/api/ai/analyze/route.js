import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, parseWith, readJson, withApiUser } from '@/lib/api'
import { isAiConfigured } from '@/lib/ai/client'
import { analyzeRequest } from '@/lib/ai/analyze-request'

const bodySchema = z.object({
  requestId: z.uuid(),
  force: z.boolean().optional(),
})

export const POST = withApiUser(async ({ request, supabase }) => {
  const body = parseWith(bodySchema, await readJson(request))
  if (!isAiConfigured()) throw new ApiError(503, 'OpenAI yapılandırması eksik. OPENAI_API_KEY tanımlanmalı.')

  const result = await analyzeRequest(supabase, body.requestId, { force: body.force ?? false })
  if (result.status === 'failed') {
    return NextResponse.json({ ok: false, ...result }, { status: 502 })
  }
  return NextResponse.json({ ok: true, ...result })
})
