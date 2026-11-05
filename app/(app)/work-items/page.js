import Link from 'next/link'
import { ListTodo, Plus, Sparkles } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { listWorkItems, parseWorkItemFilters } from '@/lib/data/work-items'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { buildQuery } from '@/lib/query-string'
import { CreateWorkItemButton } from '@/components/work-items/CreateWorkItemButton'
import { DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'

export const metadata = { title: 'Yapılacak İşler' }

const STATUS_TABS = [
  { value: 'active', label: 'Aktif' },
  { value: 'open', label: 'Açık' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'all', label: 'Tümü' },
]

export default async function WorkItemsPage({ searchParams }) {
  const { supabase } = await requireSession()
  const filters = parseWorkItemFilters(await searchParams)
  const items = await listWorkItems(supabase, filters)

  return (
    <PageContainer>
      <PageHeader
        title="Yapılacak İşler"
        description="Birden fazla isteği tek bir teknik geliştirme altında toplayan iş grupları. Toplam iş yükü bu gruplar üzerinden, istekler tekrar sayılmadan hesaplanır."
        actions={
          <>
            <ButtonLink href="/suggestions" variant="secondary" icon={Sparkles}>
              AI Önerileri
            </ButtonLink>
            <CreateWorkItemButton />
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <nav className="flex flex-wrap gap-1" aria-label="Durum filtresi">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/work-items${buildQuery({ status: tab.value === 'active' ? '' : tab.value, q: filters.q })}`}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  filters.status === tab.value
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <form action="/work-items" className="w-full sm:w-64">
            {filters.status !== 'active' ? <input type="hidden" name="status" value={filters.status} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="İş ara…"
              aria-label="İş ara"
              className="block h-9 w-full rounded-lg border-0 bg-white px-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 dark:bg-slate-900 dark:ring-slate-700"
            />
          </form>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="İş bulunamadı"
            description="Benzer istekleri AI önerileriyle gruplayabilir veya manuel iş oluşturabilirsiniz."
            action={
              <ButtonLink href="/suggestions" icon={Plus}>
                Önerilere Git
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => {
              const progress = item.requestCount ? Math.round((item.completedCount / item.requestCount) * 100) : 0
              return (
                <li key={item.id}>
                  <Link href={`/work-items/${item.id}`} className="flex flex-col gap-3 px-4 py-4 hover:bg-slate-50 sm:flex-row sm:items-center dark:hover:bg-slate-800/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.summary ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{item.summary}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {item.category ?? 'Kategorisiz'} · Güncelleme: {formatDateTime(item.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      <DifficultyBadge difficulty={item.estimate.difficulty} manual={Boolean(item.manual_difficulty)} />
                      <span className="w-24 tabular-nums text-slate-700 dark:text-slate-300">{formatHoursRange(item.estimate.min, item.estimate.max) ?? '—'}</span>
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{item.requestCount} istek</span>
                          <span>{item.completedCount} tamam</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </PageContainer>
  )
}
