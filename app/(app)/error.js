'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function AppError({ error, retry }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Sayfa yüklenemedi</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {error?.message?.includes('Supabase yapılandırması')
          ? error.message
          : 'Veriler alınırken bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyin.'}
      </p>
      <Button className="mt-6" variant="secondary" onClick={() => retry()}>
        Tekrar Dene
      </Button>
    </div>
  )
}
