import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { requireSession } from '@/lib/auth'

export async function SidebarUser() {
  const { user } = await requireSession()
  const initial = (user.email?.[0] ?? '?').toLocaleUpperCase('tr-TR')

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={user.email}>
          {user.email}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Geliştirici</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Çıkış yap"
          title="Çıkış yap"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}

export function SidebarUserSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5" aria-hidden>
      <span className="size-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}
