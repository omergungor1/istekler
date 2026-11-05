'use client'

import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { SOURCE_FIELD_LABELS } from '@/lib/constants'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'

const ACTIONS = {
  new: { label: 'Yeni', tone: 'blue' },
  update: { label: 'Güncellenecek', tone: 'indigo' },
  unchanged: { label: 'Değişmeyen', tone: 'gray' },
  restore: { label: 'Geri getirilecek', tone: 'amber' },
  invalid: { label: 'Hatalı', tone: 'red' },
  duplicate: { label: 'Mükerrer', tone: 'red' },
}

const TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'new', label: 'Yeni' },
  { key: 'update', label: 'Güncellenecek' },
  { key: 'restore', label: 'Geri getirilecek' },
  { key: 'unchanged', label: 'Değişmeyen' },
  { key: 'errors', label: 'Hatalı / Mükerrer' },
]

export function ImportPreview({ preview, pending, onConfirm, onCancel }) {
  const { summary } = preview
  const [tab, setTab] = useState(() => (summary.invalid + summary.duplicate > 0 ? 'errors' : 'all'))

  const rows = useMemo(() => {
    if (tab === 'all') return preview.rows
    if (tab === 'errors') return preview.rows.filter((r) => r.action === 'invalid' || r.action === 'duplicate')
    return preview.rows.filter((r) => r.action === tab)
  }, [preview.rows, tab])

  const counts = {
    all: summary.total,
    new: summary.new,
    update: summary.update,
    restore: summary.restore,
    unchanged: summary.unchanged,
    errors: summary.invalid + summary.duplicate,
  }

  const stats = [
    { label: 'Yeni kayıt', value: summary.new, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Güncellenecek', value: summary.update, tone: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Değişmeyen', value: summary.unchanged, tone: 'text-slate-700 dark:text-slate-300' },
    { label: 'Geri getirilecek', value: summary.restore, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Hatalı', value: summary.invalid, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Mükerrer', value: summary.duplicate, tone: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Aktarım önizlemesi</h2>
            <p className="mt-1 text-sm text-slate-500">
              {preview.fileName} · {formatFileSize(preview.fileSize)} · {summary.total} satır
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={onConfirm} loading={pending} disabled={summary.valid === 0}>
              Aktarımı Onayla ({summary.valid})
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{s.label}</dt>
              <dd className={cn('mt-1 text-2xl font-semibold', s.tone)}>{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 space-y-2">
          {preview.previouslyImportedAt ? (
            <Notice>
              Bu dosya {formatDateTime(preview.previouslyImportedAt)} tarihinde zaten aktarılmış. Aktarım tekrar yapılırsa mükerrer kayıt oluşmaz; yalnızca değişen kayıtlar güncellenir.
            </Notice>
          ) : null}
          {summary.completedChanged ? (
            <Notice>
              Tamamlanmış {summary.completedChanged} isteğin kaynak bilgileri değişmiş. Kaynak alanları güncellenir; tamamlanma durumu ve kapatma açıklaması korunur.
            </Notice>
          ) : null}
          {summary.invalid + summary.duplicate > 0 ? (
            <Notice>Hatalı ve mükerrer satırlar aktarılmayacak. Diğer kayıtlar bu satırlardan etkilenmez.</Notice>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-800" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium',
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t.label} <span className="ml-1 text-xs text-slate-400">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2.5">Satır</th>
                <th className="px-4 py-2.5">No</th>
                <th className="px-4 py-2.5">Konu</th>
                <th className="px-4 py-2.5">Kurum</th>
                <th className="px-4 py-2.5">İşlem</th>
                <th className="px-4 py-2.5">Ayrıntı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Bu grupta kayıt yok.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="px-4 py-2.5 text-slate-400">{row.rowNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.externalNo ?? '—'}</td>
                    <td className="max-w-xs px-4 py-2.5">
                      <span className="line-clamp-2">{row.subject ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.institution ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={ACTIONS[row.action].tone}>{ACTIONS[row.action].label}</Badge>
                      {row.isCompleted ? <Badge className="ml-1">Tamamlanmış</Badge> : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {row.errors.length ? (
                        <span className="text-red-600 dark:text-red-400">{row.errors.join(' ')}</span>
                      ) : row.changedFields.length ? (
                        `Değişen: ${row.changedFields.map((f) => SOURCE_FIELD_LABELS[f] ?? f).join(', ')}`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Notice({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
