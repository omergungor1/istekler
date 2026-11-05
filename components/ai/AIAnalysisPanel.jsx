import { AlertTriangle, Clock, Sparkles } from 'lucide-react'
import { ESTIMATE_CONFIDENCE, LIKELIHOOD, TECHNICAL_AREAS } from '@/lib/constants'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { Badge, DifficultyBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  )
}

function List({ items, ordered = false, empty = 'Belirtilmedi.' }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (!list.length) return <p className="text-slate-400">{empty}</p>
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
      {list.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  )
}

export function AIAnalysisPanel({ analysis, fresh, statusMessage }) {
  if (!analysis) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Henüz AI analizi yok"
        description={statusMessage ?? '"AI ile Analiz Et" butonuyla isteği analiz edebilirsiniz. Kişisel veriler gönderilmeden önce maskelenir.'}
      />
    )
  }

  const hours = formatHoursRange(analysis.estimated_hours_min, analysis.estimated_hours_max)

  return (
    <div className="space-y-6">
      {!fresh ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bu analiz isteğin önceki kaynak metnine aittir. Excel ile gelen değişiklikleri yansıtmak için analizi güncelleyin.
        </p>
      ) : null}
      {statusMessage ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">Son deneme: {statusMessage}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500">Zorluk</p>
          <div className="mt-1.5">
            <DifficultyBadge difficulty={analysis.difficulty} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500">Tahmini geliştirme süresi</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
            <Clock className="size-4 text-slate-400" aria-hidden />
            {hours ?? 'Tahmin yapılamadı'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{ESTIMATE_CONFIDENCE[analysis.estimate_confidence] ?? ''}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500">Kategori</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{analysis.category ?? '—'}</p>
          {analysis.tags?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {analysis.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Section title="Özet">{analysis.short_summary}</Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Problem">{analysis.problem_description}</Section>
        <Section title="Mevcut davranış">{analysis.current_behavior}</Section>
      </div>
      <Section title="Beklenen sonuç">{analysis.expected_behavior}</Section>

      <Section title="Teknik değerlendirme">
        {analysis.technical_analysis?.length ? (
          <ul className="space-y-2">
            {analysis.technical_analysis.map((h, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2">
                <Badge tone={h.likelihood === 'certain' ? 'indigo' : h.likelihood === 'likely' ? 'blue' : 'gray'}>
                  {TECHNICAL_AREAS[h.area] ?? h.area} · {LIKELIHOOD[h.likelihood] ?? h.likelihood}
                </Badge>
                <span className="min-w-0 flex-1">{h.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">Belirtilmedi.</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Yapılacak işlemler">
          <List items={analysis.suggested_solution} ordered />
        </Section>
        <Section title="Kabul kriterleri">
          <List items={analysis.acceptance_criteria} />
        </Section>
      </div>

      <Section title="Eksik bilgiler / netleştirme soruları">
        <List items={analysis.missing_information} empty="Eksik bilgi belirtilmedi." />
      </Section>

      <Section title="Süre tahmininin dayanağı">{analysis.estimated_time_reason || '—'}</Section>

      <p className="border-t border-slate-200 pt-3 text-xs text-slate-400 dark:border-slate-800">
        {analysis.model_name} · {formatDateTime(analysis.analyzed_at)} · AI tahminleri kesin teknik bilgi değildir; kaynak açıklamayla birlikte değerlendirin.
      </p>
    </div>
  )
}
