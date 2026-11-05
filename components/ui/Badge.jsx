import { AI_STATUSES, DIFFICULTIES, REQUEST_STATUSES } from '@/lib/constants'
import { cn } from './cn'

const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
}

export function Badge({ tone = 'gray', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone] ?? TONES.gray,
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = REQUEST_STATUSES[status]
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null
}

export function DifficultyBadge({ difficulty, manual = false }) {
  const d = DIFFICULTIES[difficulty ?? 'unknown'] ?? DIFFICULTIES.unknown
  return (
    <Badge tone={d.tone}>
      {d.label}
      {manual ? <span className="opacity-70" title="Manuel olarak belirlendi">·M</span> : null}
    </Badge>
  )
}

export function AiStatusBadge({ status }) {
  const s = AI_STATUSES[status]
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null
}
