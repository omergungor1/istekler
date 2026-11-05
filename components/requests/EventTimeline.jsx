import { EVENT_LABELS, REQUEST_STATUSES, SOURCE_FIELD_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'

function describe(event) {
  const d = event.details ?? {}
  switch (event.event_type) {
    case 'import_updated':
    case 'import_restored': {
      const fields = (d.changed_fields ?? []).map((f) => SOURCE_FIELD_LABELS[f] ?? f)
      const parts = []
      if (d.file_name) parts.push(d.file_name)
      if (fields.length) parts.push(`Değişen alanlar: ${fields.join(', ')}`)
      if (d.completed_source_changed) parts.push('Tamamlanmış istek; durum korundu.')
      return parts.join(' · ')
    }
    case 'created':
      return d.file_name ?? ''
    case 'status_changed':
      return `${REQUEST_STATUSES[d.from]?.label ?? d.from} → ${REQUEST_STATUSES[d.to]?.label ?? d.to}`
    case 'completed':
      return d.closing_message ? `Kapatma açıklaması: ${d.closing_message}` : ''
    case 'reopened':
      return d.previous_closing_message ? `Önceki kapatma açıklaması: ${d.previous_closing_message}` : ''
    case 'linked_work_item':
    case 'unlinked_work_item':
      return d.title ?? ''
    case 'ai_failed':
      return d.error ?? ''
    case 'ai_review_required':
      return (d.risks ?? []).join(' ')
    case 'ai_analyzed':
      return d.model ?? ''
    default:
      return ''
  }
}

export function EventTimeline({ events }) {
  if (!events.length) return <p className="text-sm text-slate-500">Henüz işlem geçmişi yok.</p>
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
      {events.map((event) => {
        const detail = describe(event)
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" aria-hidden />
            <p className="text-sm font-medium text-slate-900 dark:text-white">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
            {detail ? <p className="mt-0.5 break-words text-sm text-slate-600 dark:text-slate-400">{detail}</p> : null}
            <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(event.created_at)}</p>
          </li>
        )
      })}
    </ol>
  )
}
