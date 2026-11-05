import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'

export class AiError extends Error {
  constructor(message, { retriable = false, code = 'ai_error' } = {}) {
    super(message)
    this.retriable = retriable
    this.code = code
  }
}

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function getModelName() {
  return process.env.OPENAI_MODEL || 'gpt-5.4-mini'
}

let cachedClient = null

function getClient() {
  if (!isAiConfigured()) {
    throw new AiError('OpenAI yapılandırması eksik. Sunucuda OPENAI_API_KEY ortam değişkenini tanımlayın.', {
      code: 'not_configured',
    })
  }
  if (!cachedClient) {
    const timeout = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? '', 10)
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 90_000,
      maxRetries: 2,
    })
  }
  return cachedClient
}

function supportsReasoning(model) {
  return /^(gpt-5|o\d)/i.test(model)
}

function toAiError(err) {
  if (err instanceof AiError) return err
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiError('AI servisi zaman aşımına uğradı. Lütfen tekrar deneyin.', { retriable: true, code: 'timeout' })
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiError('AI servisine bağlanılamadı. Ağ bağlantısını kontrol edin.', { retriable: true, code: 'connection' })
  }
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
    return new AiError('OpenAI API anahtarı geçersiz veya yetkisiz.', { code: 'auth' })
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new AiError('AI servisi istek sınırına ulaşıldı veya kota doldu. Bir süre sonra tekrar deneyin.', {
      retriable: true,
      code: 'rate_limit',
    })
  }
  if (err instanceof OpenAI.NotFoundError) {
    return new AiError(`Tanımlı model (${getModelName()}) bulunamadı. OPENAI_MODEL değerini kontrol edin.`, { code: 'model' })
  }
  if (err instanceof OpenAI.BadRequestError) {
    return new AiError('AI servisi isteği kabul etmedi. Model ayarlarını kontrol edin.', { code: 'bad_request' })
  }
  if (err instanceof OpenAI.InternalServerError) {
    return new AiError('AI servisinde geçici bir hata oluştu. Lütfen tekrar deneyin.', { retriable: true, code: 'server' })
  }
  if (err?.name === 'ZodError') {
    return new AiError('AI yanıtı beklenen formatta değil. Lütfen tekrar deneyin.', { retriable: true, code: 'invalid_output' })
  }
  return new AiError('AI işlemi sırasında beklenmeyen bir hata oluştu.', { retriable: true })
}

/**
 * Responses API + Structured Outputs ile şemaya uygun yanıt üretir ve sonucu tekrar doğrular.
 * Kaynak metinler loglanmaz.
 */
export async function generateStructured({ instructions, input, schema, name, maxOutputTokens = 6000 }) {
  const model = getModelName()
  try {
    const response = await getClient().responses.parse({
      model,
      instructions,
      input,
      store: false,
      max_output_tokens: maxOutputTokens,
      ...(supportsReasoning(model) ? { reasoning: { effort: 'low' } } : {}),
      text: { format: zodTextFormat(schema, name) },
    })

    if (response.status === 'incomplete') {
      throw new AiError('AI yanıtı tamamlanamadı (çıktı sınırı aşıldı). Lütfen tekrar deneyin.', {
        retriable: true,
        code: 'incomplete',
      })
    }
    const refusal = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === 'refusal')
    if (refusal) throw new AiError('AI bu isteği işlemeyi reddetti.', { code: 'refusal' })
    if (!response.output_parsed) {
      throw new AiError('AI yanıtı boş döndü. Lütfen tekrar deneyin.', { retriable: true, code: 'empty' })
    }

    return { data: schema.parse(response.output_parsed), model }
  } catch (err) {
    const aiError = toAiError(err)
    console.error('[ai] çağrı başarısız:', aiError.code)
    throw aiError
  }
}
