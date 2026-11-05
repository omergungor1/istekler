import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, Tag } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getWorkItemDetail } from '@/lib/data/work-items'
import { formatDateTime, formatHoursRange } from '@/lib/format'
import { updateWorkItemEstimate, updateWorkItemNotes } from '@/app/actions/work-items'
import { AgentPromptPanel } from '@/components/ai/AgentPromptPanel'
import { EstimateEditor } from '@/components/requests/EstimateEditor'
import { NotesEditor } from '@/components/requests/NotesEditor'
import { LinkedRequests } from '@/components/work-items/LinkedRequests'
import { WorkItemActions } from '@/components/work-items/WorkItemActions'
import { DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/ui/PageHeader'
import { SafeText } from '@/components/ui/SafeText'
import { Tabs } from '@/components/ui/Tabs'

export const metadata = { title: 'İş Detayı' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">{children}</div>
    </section>
  )
}

export default async function WorkItemDetailPage({ params }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const { supabase } = await requireSession()
  const detail = await getWorkItemDetail(supabase, id)
  if (!detail) notFound()

  const { workItem, estimate, requests, prompt, candidates } = detail
  const completed = requests.filter((r) => r.status === 'completed').length
  const criteria = workItem.acceptance_criteria ?? []

  const tabs = [
    {
      key: 'requests',
      label: 'Bağlı İstekler',
      badge: requests.length || null,
      content: <LinkedRequests workItem={workItem} requests={requests} candidates={candidates} />,
    },
    {
      key: 'details',
      label: 'Teknik Detay',
      content: (
        <div className="space-y-6">
          <Section title="Açıklama">
            <SafeText text={workItem.description} empty="Açıklama eklenmemiş." />
          </Section>
          <Section title="Teknik notlar">
            <SafeText text={workItem.technical_notes} empty="Teknik not yok." />
          </Section>
          <Section title="Kabul kriterleri">
            {criteria.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-400">Kabul kriteri yok.</span>
            )}
          </Section>
        </div>
      ),
    },
    {
      key: 'prompt',
      label: 'Agent Promptu',
      content: (
        <AgentPromptPanel
          target={{ workItemId: workItem.id }}
          prompt={prompt}
          emptyHint="Bağlı isteklerin maskelenmiş içerikleri birleştirilerek tek bir geliştirme görevi promptu oluşturulur."
        />
      ),
    },
    {
      key: 'notes',
      label: 'Çalışma Notları',
      content: <NotesEditor id={workItem.id} initialNotes={workItem.work_notes} saveAction={updateWorkItemNotes} label="Çalışma notları" />,
    },
  ]

  return (
    <PageContainer>
      <Link href="/work-items" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="size-4" aria-hidden /> İşler
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={workItem.status} />
              <DifficultyBadge difficulty={estimate.difficulty} manual={Boolean(workItem.manual_difficulty)} />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{workItem.title}</h1>
            {workItem.summary ? <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{workItem.summary}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="size-4 text-slate-400" aria-hidden />
                {workItem.category ?? 'Kategorisiz'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-slate-400" aria-hidden />
                {formatHoursRange(estimate.min, estimate.max) ?? 'Süre tahmini yok'}
                {workItem.manual_estimated_hours_min !== null || workItem.manual_estimated_hours_max !== null ? ' (manuel)' : ''}
              </span>
              <span>
                {completed}/{requests.length} istek tamamlandı
              </span>
              <EstimateEditor
                action={updateWorkItemEstimate}
                targetId={workItem.id}
                title="İş tahminini düzenle"
                manual={{ difficulty: workItem.manual_difficulty, min: workItem.manual_estimated_hours_min, max: workItem.manual_estimated_hours_max }}
                ai={{ difficulty: workItem.ai_difficulty, min: workItem.ai_estimated_hours_min, max: workItem.ai_estimated_hours_max }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Oluşturulma: {formatDateTime(workItem.created_at)}
              {workItem.completed_at ? ` · Tamamlanma: ${formatDateTime(workItem.completed_at)}` : ''}
            </p>
          </div>
          <WorkItemActions key={workItem.updated_at} workItem={workItem} />
        </div>
      </Card>

      <Card className="mt-6 px-5 pb-6 pt-2 sm:px-6">
        <Tabs tabs={tabs} />
      </Card>
    </PageContainer>
  )
}
