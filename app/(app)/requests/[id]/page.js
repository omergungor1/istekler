import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Clock, Layers, ListTodo } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getRequestDetail } from '@/lib/data/requests'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { buildMaskedRequestInput } from '@/lib/privacy/mask'
import { updateRequestEstimate, updateRequestNotes } from '@/app/actions/requests'
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel'
import { AgentPromptPanel } from '@/components/ai/AgentPromptPanel'
import { MaskReviewPanel } from '@/components/ai/MaskReviewPanel'
import { EstimateEditor } from '@/components/requests/EstimateEditor'
import { EventTimeline } from '@/components/requests/EventTimeline'
import { LinkWorkItem } from '@/components/requests/LinkWorkItem'
import { NotesEditor } from '@/components/requests/NotesEditor'
import { RequestActions } from '@/components/requests/RequestActions'
import { AiStatusBadge, Badge, DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer } from '@/components/ui/PageHeader'
import { SafeText } from '@/components/ui/SafeText'
import { Tabs } from '@/components/ui/Tabs'

export async function generateMetadata({ params }) {
  const { id } = await params
  return { title: `İstek #${decodeURIComponent(id)}` }
}

function SourceField({ label, value, note, multiline }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
        {note ? <span className="mt-0.5 block text-xs font-normal text-slate-400">{note}</span> : null}
      </dt>
      <dd className="mt-1 text-sm text-slate-900 sm:col-span-2 sm:mt-0 dark:text-slate-200">
        {multiline ? <SafeText text={value} /> : value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  )
}

export default async function RequestDetailPage({ params }) {
  const { id } = await params
  const externalNo = decodeURIComponent(id)
  const { supabase } = await requireSession()

  const detail = await getRequestDetail(supabase, externalNo)
  if (!detail) notFound()

  const { request, analysis, prompt, workItems, events } = detail
  const analysisFresh = Boolean(analysis && analysis.source_hash === request.content_hash)
  const masked = buildMaskedRequestInput(request)
  const effDifficulty = request.manual_difficulty ?? request.ai_difficulty
  const effHours = formatHoursRange(request.manual_hours_min ?? request.ai_hours_min, request.manual_hours_max ?? request.ai_hours_max)
  const linkedIds = new Set(workItems.map((w) => w.id))

  const { data: openWorkItems } = await supabase
    .from('work_items')
    .select('id, title')
    .neq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(100)

  const tabs = [
    {
      key: 'source',
      label: 'Orijinal İstek',
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Açıklama</h3>
            <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
              <SafeText text={request.description} empty="Açıklama yok." />
            </div>
          </div>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <SourceField label="Kurum" value={request.institution_name} />
            <SourceField label="Modül" value={request.module_name} />
            <SourceField label="Form Adı" value={request.form_name} />
            <SourceField label="Kullanıcı" value={request.requested_by} />
            <SourceField label="Takip Eden" value={request.tracked_by} />
            <SourceField label="Cevap Veren" value={request.replied_by} multiline />
            <SourceField label="İstek Tipi" value={request.source_request_type} note="Kaynak veri; değerlendirmede kullanılmaz" />
            <SourceField label="Aciliyeti" value={request.source_urgency} note="Kaynak veri; değerlendirmede kullanılmaz" />
            <SourceField label="Geçen Süre" value={request.source_elapsed_time} note="Kaynak sistemdeki değer; geliştirme süresi değildir" />
            <SourceField label="İlk görülme" value={formatDateTime(request.first_seen_at)} />
            <SourceField label="Son Excel'de görülme" value={formatDateTime(request.last_seen_at)} />
          </dl>
        </div>
      ),
    },
    {
      key: 'analysis',
      label: 'AI Analizi',
      content: (
        <div className="space-y-6">
          {request.status !== 'completed' || request.ai_status === 'needs_review' ? (
            <MaskReviewPanel
              requestId={request.id}
              maskedText={masked.description}
              risks={masked.risks}
              hasOverride={masked.usesOverride}
              needsReview={request.ai_status === 'needs_review' || masked.risks.length > 0}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Etkin tahmin: {effDifficulty ? <DifficultyBadge difficulty={effDifficulty} manual={Boolean(request.manual_difficulty)} /> : '—'}{' '}
              · {effHours ?? 'süre yok'}
              {request.manual_hours_min !== null || request.manual_hours_max !== null ? ' (manuel süre)' : ''}
            </p>
            <EstimateEditor
              action={updateRequestEstimate}
              targetId={request.id}
              manual={{ difficulty: request.manual_difficulty, min: request.manual_hours_min, max: request.manual_hours_max }}
              ai={{ difficulty: request.ai_difficulty, min: request.ai_hours_min, max: request.ai_hours_max }}
            />
          </div>
          <AIAnalysisPanel
            analysis={analysis}
            fresh={analysisFresh}
            statusMessage={request.ai_status === 'failed' || request.ai_status_message ? request.ai_status_message : null}
          />
        </div>
      ),
    },
    {
      key: 'prompt',
      label: 'Agent Promptu',
      content: (
        <AgentPromptPanel
          target={{ requestId: request.id }}
          prompt={prompt}
          newerAnalysisAvailable={Boolean(prompt && !prompt.is_edited && analysis && new Date(analysis.created_at) > new Date(prompt.updated_at))}
          emptyHint={
            analysisFresh
              ? 'Güncel AI analizinden ek API çağrısı yapmadan bir agent promptu oluşturulur.'
              : 'Güncel analiz olmadığından prompt için ayrı bir AI çağrısı yapılır.'
          }
        />
      ),
    },
    {
      key: 'work',
      label: 'İlişkili İşler',
      badge: workItems.length || null,
      content: (
        <div className="space-y-4">
          <LinkWorkItem request={request} workItems={(openWorkItems ?? []).filter((w) => !linkedIds.has(w.id))} />
          {workItems.length === 0 ? (
            <EmptyState icon={ListTodo} title="Bağlı iş yok" description="Bu istek henüz bir teknik işe bağlanmadı. AI Önerileri sayfasından benzer isteklerle gruplayabilirsiniz." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
              {workItems.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/work-items/${w.id}`} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-white">
                      {w.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {w.category ?? 'Kategorisiz'} ·{' '}
                      {formatHoursRange(w.manual_estimated_hours_min ?? w.ai_estimated_hours_min, w.manual_estimated_hours_max ?? w.ai_estimated_hours_max) ?? 'süre yok'}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: 'Notlar ve Geçmiş',
      content: (
        <div className="grid gap-8 lg:grid-cols-2">
          <NotesEditor id={request.id} initialNotes={request.user_notes} saveAction={updateRequestNotes} placeholder="Bu istekle ilgili kişisel notlarınız…" />
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">İşlem geçmişi</h3>
            <EventTimeline events={events} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" aria-hidden /> İstekler
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">#{request.external_no}</span>
              <StatusBadge status={request.status} />
              <AiStatusBadge status={request.ai_status} />
              {request.user_notes ? <Badge>Not var</Badge> : null}
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{request.subject || 'Konu belirtilmemiş'}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-slate-400" aria-hidden />
                {request.institution_name ?? '—'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-4 text-slate-400" aria-hidden />
                {request.module_name ?? '—'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-slate-400" aria-hidden />
                {effHours ?? 'Süre tahmini yok'}
              </span>
              {effDifficulty ? <DifficultyBadge difficulty={effDifficulty} manual={Boolean(request.manual_difficulty)} /> : null}
            </div>
          </div>
          <RequestActions request={request} analysisFresh={analysisFresh} />
        </div>

        {request.status === 'completed' ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <p className="font-medium">Tamamlandı · {formatDateTime(request.completed_at)}</p>
            {request.closing_message ? <p className="mt-1">{request.closing_message}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="mt-6 px-5 pb-6 pt-2 sm:px-6">
        <Tabs tabs={tabs} defaultTab={request.ai_status === 'needs_review' ? 'analysis' : 'source'} />
      </Card>
    </PageContainer>
  )
}
