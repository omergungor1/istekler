import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, parseWith, readJson, withApiUser } from '@/lib/api'
import { isAiConfigured } from '@/lib/ai/client'
import { generateRequestPrompt, generateWorkItemPrompt } from '@/lib/ai/agent-prompt'

const bodySchema = z
  .object({
    requestId: z.uuid().optional(),
    workItemId: z.uuid().optional(),
    regenerate: z.boolean().optional(),
    overwriteEdited: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.requestId) !== Boolean(b.workItemId))

export const POST = withApiUser(async ({ request, supabase }) => {
  const body = parseWith(bodySchema, await readJson(request))
  if (!isAiConfigured()) throw new ApiError(503, 'OpenAI yapılandırması eksik. OPENAI_API_KEY tanımlanmalı.')

  const options = { regenerate: body.regenerate ?? false, overwriteEdited: body.overwriteEdited ?? false }
  const result = body.requestId
    ? await generateRequestPrompt(supabase, body.requestId, options)
    : await generateWorkItemPrompt(supabase, body.workItemId, options)

  if (result.status === 'failed') throw new ApiError(404, result.error)
  return NextResponse.json({ ok: true, ...result })
})
