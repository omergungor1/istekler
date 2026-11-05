export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return { url, key, configured: Boolean(url && key) }
}

export function assertSupabaseConfig() {
  const config = getSupabaseConfig()
  if (!config.configured) {
    throw new Error(
      'Supabase yapılandırması eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY değişkenlerini .env.local dosyasına ekleyin.'
    )
  }
  return config
}
