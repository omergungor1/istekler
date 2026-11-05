import { getSession } from '@/lib/auth'

const DB_ERROR_MESSAGES = {
  batch_not_found: 'Aktarım önizlemesi bulunamadı.',
  batch_not_pending: 'Bu aktarım daha önce uygulanmış veya iptal edilmiş.',
  batch_expired: 'Önizlemenin süresi doldu. Lütfen dosyayı tekrar yükleyin.',
  suggestion_not_found: 'Öneri bulunamadı.',
  suggestion_not_pending: 'Bu öneri daha önce değerlendirilmiş.',
  no_requests: 'En az bir istek seçmelisiniz.',
  invalid_request: 'Seçilen isteklerden biri bulunamadı veya silinmiş.',
  title_required: 'İş başlığı zorunludur.',
  work_item_not_found: 'İş bulunamadı.',
  request_not_linked: 'Seçilen istekler bu işe bağlı değil.',
}

export function fail(error) {
  return { ok: false, error }
}

export function dbFail(error, fallback = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.') {
  const key = Object.keys(DB_ERROR_MESSAGES).find((k) => error?.message?.includes(k))
  if (key) return fail(DB_ERROR_MESSAGES[key])
  if (error?.code === '23505') return fail('Bu kayıt zaten mevcut.')
  console.error('[action] veritabanı hatası:', error?.code ?? 'unknown')
  return fail(fallback)
}

/** Server Action içinde oturumu yeniden doğrular; istemciden gelen kimliğe güvenilmez. */
export async function withActionSession(fn) {
  const { supabase, user } = await getSession()
  if (!user) return fail('Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.')
  return fn({ supabase, user })
}

export function validate(schema, input) {
  const result = schema.safeParse(input)
  return result.success ? { data: result.data } : { error: result.error.issues[0]?.message || 'Geçersiz bilgi.' }
}
