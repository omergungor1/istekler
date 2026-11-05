import { decodeEntities } from '@/lib/format'
import { cn } from './cn'

/** Kaynak metni yalnızca düz metin olarak gösterir; HTML/JavaScript çalıştırılmaz. */
export function SafeText({ text, className, empty = '—' }) {
  const value = decodeEntities(text)
  if (!value.trim()) return <span className="text-slate-400">{empty}</span>
  return <div className={cn('whitespace-pre-wrap break-words leading-relaxed', className)}>{value}</div>
}
