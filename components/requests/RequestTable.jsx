import Link from 'next/link'
import { ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { AiStatusBadge, DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

function requestHref(row) {
  return `/requests/${encodeURIComponent(row.external_no)}`
}

function WorkItemCell({ row }) {
  if (!row.work_item_count) return <span className="text-slate-400">—</span>
  return (
    <Link
      href={`/work-items/${row.first_work_item_id}`}
      className="inline-flex max-w-48 items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
      title={row.work_item_titles.join(', ')}
    >
      <Link2 className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{row.work_item_titles[0]}</span>
      {row.work_item_count > 1 ? <span className="text-xs text-slate-500">+{row.work_item_count - 1}</span> : null}
    </Link>
  )
}

export function RequestTable({ rows, variant = 'default' }) {
  const completed = variant === 'completed'
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-2.5">No</th>
              <th className="px-4 py-2.5">Konu</th>
              <th className="px-4 py-2.5">Kurum</th>
              <th className="px-4 py-2.5">Modül</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5">AI Zorluk</th>
              <th className="px-4 py-2.5">Tahmini Süre</th>
              {completed ? <th className="px-4 py-2.5">Kapatma Açıklaması</th> : <th className="px-4 py-2.5">İlişkili İş</th>}
              <th className="px-4 py-2.5">{completed ? 'Tamamlanma' : 'Son Güncelleme'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={requestHref(row)} className="font-mono text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    #{row.external_no}
                  </Link>
                </td>
                <td className="max-w-sm px-4 py-3">
                  <Link href={requestHref(row)} className="line-clamp-2 font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300">
                    {row.subject || 'Konu belirtilmemiş'}
                  </Link>
                  {row.ai_status !== 'done' ? (
                    <div className="mt-1">
                      <AiStatusBadge status={row.ai_status} />
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.institution_name ?? '—'}</td>
                <td className="max-w-40 px-4 py-3 text-slate-600 dark:text-slate-400">
                  <span className="line-clamp-2">{row.module_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3">{row.eff_difficulty ? <DifficultyBadge difficulty={row.eff_difficulty} /> : <span className="text-slate-400">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                  {formatHoursRange(row.eff_hours_min, row.eff_hours_max) ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600 dark:text-slate-400">
                  {completed ? <span className="line-clamp-2">{row.closing_message ?? '—'}</span> : <WorkItemCell row={row} />}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(completed ? row.completed_at : row.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={requestHref(row)} className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400">#{row.external_no}</span>
                <StatusBadge status={row.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{row.subject}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.institution_name} · {row.module_name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {row.eff_difficulty ? <DifficultyBadge difficulty={row.eff_difficulty} /> : <AiStatusBadge status={row.ai_status} />}
                {formatHoursRange(row.eff_hours_min, row.eff_hours_max) ? (
                  <span className="text-slate-600 dark:text-slate-400">{formatHoursRange(row.eff_hours_min, row.eff_hours_max)}</span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Pagination({ page, pageSize, total, hrefFor }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const linkClass = (disabled) =>
    cn(
      'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium ring-1 ring-inset ring-slate-300 dark:ring-slate-700',
      disabled ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
    )
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800" aria-label="Sayfalama">
      <p className="text-slate-500">
        {total} kayıttan {from}–{to} arası
      </p>
      <div className="flex items-center gap-2">
        <Link href={hrefFor(page - 1)} className={linkClass(page <= 1)} aria-disabled={page <= 1}>
          <ChevronLeft className="size-4" aria-hidden /> Önceki
        </Link>
        <span className="text-slate-500">
          {page}/{pages}
        </span>
        <Link href={hrefFor(page + 1)} className={linkClass(page >= pages)} aria-disabled={page >= pages}>
          Sonraki <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}
