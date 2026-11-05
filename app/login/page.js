import { Suspense } from 'react'
import { ClipboardList } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { getSupabaseConfig } from '@/lib/supabase/config'

export const metadata = { title: 'Giriş' }

export default function LoginPage() {
  const configured = getSupabaseConfig().configured

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Tıpplus İstek Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hesabınızla giriş yapın</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {configured ? (
            <Suspense>
              <LoginForm />
            </Suspense>
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-white">Supabase yapılandırması eksik</p>
              <p className="mt-2">
                <code className="font-mono text-xs">.env.local</code> dosyasına <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> ve{' '}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> değerlerini ekleyip uygulamayı yeniden başlatın.
              </p>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Hesaplar yönetici tarafından oluşturulur.</p>
      </div>
    </main>
  )
}
