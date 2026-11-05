import { NextResponse } from 'next/server'
import { ApiError, withApiUser } from '@/lib/api'
import { isAiConfigured } from '@/lib/ai/client'
import { generateGroupSuggestions } from '@/lib/ai/grouping'

export const POST = withApiUser(async ({ supabase, user }) => {
  if (!isAiConfigured()) throw new ApiError(503, 'OpenAI yapılandırması eksik. OPENAI_API_KEY tanımlanmalı.')

  const result = await generateGroupSuggestions(supabase, user.id)
  if (result.status === 'not_enough') {
    throw new ApiError(422, 'Öneri üretmek için en az 2 analiz edilmiş açık istek gerekir.')
  }
  return NextResponse.json({ ok: true, ...result })
})
