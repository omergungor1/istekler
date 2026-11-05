'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseConfig } from '@/lib/supabase/config'

const loginSchema = z.object({
  email: z.email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifre zorunludur.').max(200),
  next: z.string().optional(),
})

function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard'
}

export async function signIn(_prevState, formData) {
  if (!getSupabaseConfig().configured) {
    return { error: 'Supabase yapılandırması eksik. Kurulum adımları için README dosyasına bakın.' }
  }

  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    next: String(formData.get('next') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz bilgi.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    return { error: error.status === 429 ? 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.' : 'E-posta veya şifre hatalı.' }
  }

  redirect(safeNext(parsed.data.next))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
