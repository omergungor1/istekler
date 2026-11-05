import { NextResponse } from 'next/server'
import { AiError } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function jsonError(status, message, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

/**
 * Route Handler sarmalayıcısı: oturumu doğrular, hataları güvenli biçimde döndürür.
 * Hata ayrıntıları (kişisel veri içerebilecek metinler) loglanmaz.
 */
export function withApiUser(handler) {
  return async (request, context) => {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getClaims()
      if (error || !data?.claims?.sub) {
        return jsonError(401, 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.')
      }
      const user = { id: data.claims.sub, email: data.claims.email ?? '' }
      return await handler({ request, context, supabase, user })
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.status, err.message, err.code ? { code: err.code } : {})
      }
      if (err instanceof AiError) {
        return jsonError(err.code === 'not_configured' ? 503 : 502, err.message, { code: err.code })
      }
      console.error('[api] beklenmeyen hata:', err?.name ?? 'Error', err?.code ?? '')
      return jsonError(500, 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    }
  }
}

export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError(400, 'Geçersiz istek gövdesi.')
  }
}

export function parseWith(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new ApiError(400, 'Geçersiz istek parametreleri.')
  }
  return result.data
}
