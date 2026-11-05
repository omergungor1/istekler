import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleDot, Clock, FileSpreadsheet, Hourglass, ListTodo, Sparkles } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { DIFFICULTIES, REQUEST_STATUSES } from '@/lib/constants'
import { listWorkItems } from '@/lib/data/work-items'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'Dashboard' }

const BAR_TONES = {
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-slate-400',
  indigo: 'bg-indigo-500',
}

function StatCard({ icon: Icon, label, value, hint, href, tone = 'indigo' }) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-indigo-600'}`}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  )
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-600">
      {body}
    </Link>
  ) : (
    body
  )
}

function BarList({ items, format = (v) => v, toneFor }) {
  if (!items.length) return <p className="py-4 text-sm text-slate-500">Veri yok.</p>
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1)
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-slate-700 dark:text-slate-300" title={item.label}>
              {item.display ?? item.label}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">{format(item.value, item)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-full rounded-full ${BAR_TONES[toneFor?.(item) ?? 'indigo']}`} style={{ width: `${Math.max(2, (Number(item.value) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default async function DashboardPage() {
  const { supabase } = await requireSession()
  const [{ data: stats, error }, workItems] = await Promise.all([supabase.rpc('dashboard_stats'), listWorkItems(supabase, { status: 'active', q: '' })])
  if (error) throw error

  if (!stats.total) {
    return (
      <PageContainer>
        <PageHeader title="Dashboard" />
        <Card>
          <EmptyState
            icon={FileSpreadsheet}
            title="Henüz veri yok"
            description="Tıpplus İstekler Excel çıktısını yükleyince istatistikler burada görünür."
            action={
              <ButtonLink href="/imports" icon={FileSpreadsheet}>
                Excel Yükle
              </ButtonLink>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  const w = stats.workload
  const totalMin = Number(w.work_items_min) + Number(w.requests_min)
  const totalMax = Number(w.work_items_max) + Number(w.requests_max)
  const unestimated = Number(w.work_items_unestimated) + Number(w.requests_unestimated)
  const activeCount = stats.open + stats.in_progress

  const topWorkItems = [...workItems]
    .sort((a, b) => (Number(b.estimate.max) || 0) - (Number(a.estimate.max) || 0) || b.requestCount - a.requestCount)
    .slice(0, 6)

  const byStatus = ['open', 'in_progress', 'completed'].map((key) => ({
    label: key,
    display: REQUEST_STATUSES[key].label,
    value: stats.by_status.find((s) => s.label === key)?.value ?? 0,
  }))

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={stats.last_import_at ? `Son Excel aktarımı: ${formatDateTime(stats.last_import_at)}` : 'Henüz tamamlanmış Excel aktarımı yok.'}
        actions={
          <ButtonLink href="/imports" variant="secondary" icon={FileSpreadsheet}>
            Excel Yükle
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CircleDot} label="Açık istek" value={activeCount} hint={`${stats.in_progress} devam ediyor`} href="/requests?status=active" />
        <StatCard icon={CheckCircle2} label="Tamamlanan" value={stats.completed} hint={`Toplam ${stats.total} istek`} href="/completed" tone="green" />
        <StatCard icon={ListTodo} label="Aktif iş grubu" value={stats.work_items_open} href="/work-items" />
        <StatCard
          icon={stats.ai_needs_review ? AlertTriangle : Sparkles}
          label="Analiz bekleyen"
          value={stats.ai_pending}
          hint={stats.ai_needs_review ? `${stats.ai_needs_review} istek kişisel veri incelemesi bekliyor` : 'Açık istekler arasında'}
          href="/requests?ai=waiting"
          tone={stats.ai_needs_review ? 'red' : 'amber'}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={Hourglass}
          title="Tahmini toplam iş yükü"
          description="Gruplanmış istekler iş seviyesinde bir kez sayılır; grupsuz açık istekler ayrıca eklenir. Bir istek birden fazla kez toplanmaz."
        />
        <CardBody className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Toplam</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatHoursRange(totalMin, totalMax) ?? '0 saat'}</p>
            {unestimated ? <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{unestimated} kalem için tahmin yok; toplama dahil edilmedi.</p> : null}
          </div>
          <div>
            <p className="text-sm text-slate-500">İş grupları ({stats.work_items_open})</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatHoursRange(w.work_items_min, w.work_items_max) ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Gruplanmamış istekler ({w.requests_count})</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatHoursRange(w.requests_min, w.requests_max) ?? '—'}</p>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kategoriye göre iş yükü" description="Maksimum tahmini süre (saat)" />
          <CardBody>
            <BarList
              items={stats.workload_by_category.map((c) => ({ label: c.label, value: Number(c.max), min: Number(c.min) }))}
              format={(v, item) => formatHoursRange(item.min, v)}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Zorluk dağılımı" description="Açık istekler" />
          <CardBody>
            <BarList
              items={stats.by_difficulty.map((d) => ({ label: d.label, display: DIFFICULTIES[d.label]?.label ?? d.label, value: d.value }))}
              toneFor={(item) => DIFFICULTIES[item.label]?.tone ?? 'gray'}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Modüllere göre istekler" />
          <CardBody>
            <BarList items={stats.by_module} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Kurumlara göre istekler" />
          <CardBody>
            <BarList items={stats.by_institution} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Durum dağılımı" />
          <CardBody>
            <BarList items={byStatus} toneFor={(item) => REQUEST_STATUSES[item.label].tone} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={Clock}
            title="En büyük aktif işler"
            actions={
              <Link href="/work-items" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                Tümü
              </Link>
            }
          />
          {topWorkItems.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {topWorkItems.map((item) => (
                <li key={item.id}>
                  <Link href={`/work-items/${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.requestCount} istek · {formatHoursRange(item.estimate.min, item.estimate.max) ?? 'süre yok'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <DifficultyBadge difficulty={item.estimate.difficulty} />
                      <StatusBadge status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aktif iş yok" description="AI önerilerini onaylayarak veya manuel olarak iş oluşturabilirsiniz." />
          )}
        </Card>
      </div>
    </PageContainer>
  )
}
