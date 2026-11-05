import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { assertSupabaseConfig } from './config'

export async function createClient() {
  const { url, key } = assertSupabaseConfig()
  // Supabase her çağrıda token süresini Date.now() ile kontrol eder; bu yüzden
  // istemci önceden render (prefetch) aşamasında değil, yalnızca istek anında oluşturulmalıdır.
  await connection()
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component içinden çağrıldığında cookie yazılamaz; oturum proxy'de yenilenir.
        }
      },
    },
  })
}
