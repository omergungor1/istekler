'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Pencil, X } from 'lucide-react'
import { approveSuggestion, rejectSuggestion } from '@/app/actions/suggestions'
import { formatHoursRange } from '@/lib/format'
import { Badge, DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FieldError, Input, Label } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

export function GroupSuggestionCard({ suggestion }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(suggestion.suggested_title)
  const [selected, setSelected] = useState(() => new Set(suggestion.requests.map((r) => r.id)))
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const approve = () =>
    startTransition(async () => {
      setError(null)
      const res = await approveSuggestion({ id: suggestion.id, title, requestIds: [...selected] })
      if (!res.ok) return setError(res.error)
      toast.success('Öneri onaylandı ve iş oluşturuldu.')
      router.push(`/work-items/${res.workItemId}`)
    })

  const reject = () =>
    startTransition(async () => {
      const res = await rejectSuggestion(suggestion.id)
      if (!res.ok) return toast.error(res.error)
      toast.success('Öneri reddedildi.')
    })

  const confidence = Math.round(Number(suggestion.confidence ?? 0) * 100)

  return (
    <Card className="flex flex-col">
      <div className="flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {suggestion.category ? <Badge tone="indigo">{suggestion.category}</Badge> : null}
          <DifficultyBadge difficulty={suggestion.difficulty} />
          {formatHoursRange(suggestion.estimated_hours_min, suggestion.estimated_hours_max) ? (
            <Badge>{formatHoursRange(suggestion.estimated_hours_min, suggestion.estimated_hours_max)}</Badge>
          ) : null}
          <span className="text-xs text-slate-500">Güven: %{confidence}</span>
        </div>

        {editing ? (
          <div className="mt-3">
            <Label htmlFor={`title-${suggestion.id}`}>İş başlığı</Label>
            <Input id={`title-${suggestion.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
          </div>
        ) : (
          <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        )}
        {suggestion.explanation ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{suggestion.explanation}</p> : null}
        {suggestion.summary ? <p className="mt-2 text-sm text-slate-500">{suggestion.summary}</p> : null}

        <ul className="mt-4 space-y-1.5">
          {suggestion.requests.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              {editing ? (
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`#${r.external_no} gruba dahil et`}
                />
              ) : null}
              <div className={editing && !selected.has(r.id) ? 'min-w-0 opacity-50' : 'min-w-0'}>
                <Link href={`/requests/${encodeURIComponent(r.external_no)}`} className="hover:text-indigo-600">
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">#{r.external_no}</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200">{r.subject}</span>
                </Link>
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
                  {r.institution_name} {r.status !== 'open' ? <StatusBadge status={r.status} /> : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <FieldError>{error}</FieldError>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <Button variant="ghost" size="sm" icon={X} onClick={reject} disabled={pending}>
          Reddet
        </Button>
        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing((v) => !v)} disabled={pending}>
          {editing ? 'Düzenlemeyi Kapat' : 'Düzenle'}
        </Button>
        <Button variant="success" size="sm" icon={Check} onClick={approve} loading={pending} disabled={!title.trim() || selected.size < 1}>
          Onayla ve İş Oluştur
        </Button>
      </div>
    </Card>
  )
}
