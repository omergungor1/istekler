'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { DIFFICULTIES } from '@/lib/constants'
import { buildQuery } from '@/lib/query-string'
import { Input, Select } from '@/components/ui/Field'

export function RequestFilters({ filters, options, showStatus = true, sortOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q)
  const timer = useRef(null)

  const apply = (patch) => {
    const next = { ...filters, ...patch, page: 1 }
    startTransition(() => router.replace(`${pathname}${buildQuery(next)}`, { scroll: false }))
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const onSearch = (value) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => apply({ q: value.trim() }), 350)
  }

  const hasFilters = filters.q || filters.institution || filters.module || filters.status || filters.difficulty || filters.linked || filters.ai

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="No, konu, açıklama, kurum veya modül ara…"
            className="pl-9"
            aria-label="İsteklerde ara"
          />
        </div>
        <Select value={filters.sort} onChange={(e) => apply({ sort: e.target.value })} className="w-auto" aria-label="Sıralama">
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {pending ? <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Yükleniyor" /> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Select value={filters.institution} onChange={(e) => apply({ institution: e.target.value })} aria-label="Kurum">
          <option value="">Tüm kurumlar</option>
          {options.institutions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={filters.module} onChange={(e) => apply({ module: e.target.value })} aria-label="Modül">
          <option value="">Tüm modüller</option>
          {options.modules.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        {showStatus ? (
          <Select value={filters.status} onChange={(e) => apply({ status: e.target.value })} aria-label="Durum">
            <option value="">Tüm durumlar</option>
            <option value="active">Aktif (açık + devam eden)</option>
            <option value="open">Açık</option>
            <option value="in_progress">Devam Ediyor</option>
            <option value="completed">Tamamlandı</option>
          </Select>
        ) : null}
        <Select value={filters.difficulty} onChange={(e) => apply({ difficulty: e.target.value })} aria-label="Zorluk">
          <option value="">Tüm zorluklar</option>
          {Object.entries(DIFFICULTIES).map(([key, d]) => (
            <option key={key} value={key}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select value={filters.linked} onChange={(e) => apply({ linked: e.target.value })} aria-label="İş grubu">
          <option value="">İş grubu: tümü</option>
          <option value="yes">İşe bağlı</option>
          <option value="no">İşe bağlanmamış</option>
        </Select>
        <Select value={filters.ai} onChange={(e) => apply({ ai: e.target.value })} aria-label="AI analizi">
          <option value="">AI analizi: tümü</option>
          <option value="done">Analiz edilmiş</option>
          <option value="waiting">Analiz bekleyen</option>
          <option value="review">İnceleme gerekli</option>
        </Select>
      </div>
      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQ('')
            apply({ q: '', institution: '', module: '', status: '', difficulty: '', linked: '', ai: '' })
          }}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <X className="size-3.5" aria-hidden /> Filtreleri temizle
        </button>
      ) : null}
    </div>
  )
}