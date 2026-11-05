'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  ListTodo,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/work-items', label: 'Yapılacak İşler', icon: ListTodo },
  { href: '/requests', label: 'İstekler', icon: ClipboardList },
  { href: '/suggestions', label: 'AI Önerileri', icon: Sparkles },
  { href: '/imports', label: 'Excel Yükle', icon: FileSpreadsheet },
  { href: '/completed', label: 'Tamamlananlar', icon: CheckCircle2 },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
]

function NavLinkView({ item, active, onNavigate }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0',
          active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
        )}
        aria-hidden
      />
      {item.label}
    </Link>
  )
}

function ActiveNavLink({ item, onNavigate }) {
  const pathname = usePathname()
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  return <NavLinkView item={item} active={active} onNavigate={onNavigate} />
}

function SidebarContent({ userSlot, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <ClipboardList className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Tıpplus</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">İstek Yönetimi</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Ana menü">
        {NAV_ITEMS.map((item) => (
          <Suspense key={item.href} fallback={<NavLinkView item={item} active={false} />}>
            <ActiveNavLink item={item} onNavigate={onNavigate} />
          </Suspense>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">{userSlot}</div>
    </div>
  )
}

export function AppSidebar({ userSlot }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent userSlot={userSlot} />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Menüyü aç"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="text-sm font-semibold">Tıpplus İstek Yönetimi</span>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Ana menü">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Menüyü kapat"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarContent userSlot={userSlot} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}
