import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, parseWith, readJson, withApiUser } from '@/lib/api'
import { isAiConfigured } from '@/lib/ai/client'
import { generateRequestClosingMessage, generateWorkItemClosingMessage } from '@/lib/ai/closing'

const bodySchema = z
  .object({
    requestId: z.uuid().optional(),
    workItemId: z.uuid().optional(),
    workDone: z.string().max(4000).optional(),
  })
  .refine((b) => Boolean(b.requestId) !== Boolean(b.workItemId))

export const POST = withApiUser(async ({ request, supabase }) => {
  const body = parseWith(bodySchema, await readJson(request))
  if (!isAiConfigured()) throw new ApiError(503, 'OpenAI yapılandırması eksik. OPENAI_API_KEY tanımlanmalı.')

  const result = body.requestId
    ? await generateRequestClosingMessage(supabase, body.requestId, body.workDone)
    : await generateWorkItemClosingMessage(supabase, body.workItemId, body.workDone)

  if (result.status === 'failed') throw new ApiError(404, result.error)
  return NextResponse.json({ ok: true, message: result.message })
})
