import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Oturumdaki kullanıcıyı Supabase Auth üzerinden doğrular.
 * Kullanıcı kimliği hiçbir zaman istemciden gelen bir alandan alınmaz.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return { supabase, user: null }
  return { supabase, user: { id: claims.sub, email: claims.email ?? '' } }
})

export async function requireSession() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  return session
}
