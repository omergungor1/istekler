import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { GenerateSuggestionsButton } from '@/components/ai/GenerateSuggestionsButton'
import { GroupSuggestionCard } from '@/components/ai/GroupSuggestionCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'

export const metadata = { title: 'AI Önerileri' }

const VIEWS = {
  pending: 'Bekleyen',
  approved: 'Onaylanan',
  rejected: 'Reddedilen',
}

export default async function SuggestionsPage({ searchParams }) {
  const { supabase } = await requireSession()
  const sp = await searchParams
  const view = VIEWS[sp?.view] ? sp.view : 'pending'

  const [{ data: suggestions, error }, { count: analyzedCount }] = await Promise.all([
    supabase
      .from('ai_group_suggestions')
      .select(
        'id, suggested_title, explanation, summary, category, difficulty, estimated_hours_min, estimated_hours_max, confidence, status, work_item_id, created_at, reviewed_at, ai_group_suggestion_requests(requests(id, external_no, subject, institution_name, module_name, status, deleted_at))'
      )
      .eq('status', view)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .neq('status', 'completed')
      .in('ai_status', ['done', 'stale']),
  ])
  if (error) throw error

  const items = suggestions.map(({ ai_group_suggestion_requests: links, ...s }) => ({
    ...s,
    requests: (links ?? []).map((l) => l.requests).filter((r) => r && !r.deleted_at),
  }))

  return (
    <PageContainer>
      <PageHeader
        title="AI Önerileri"
        description="AI, analiz edilmiş açık istekler arasında aynı teknik geliştirmeyle çözülebilecek grupları önerir. Öneriler siz onaylamadan hiçbir isteği gruplamaz."
        actions={<GenerateSuggestionsButton analyzedCount={analyzedCount ?? 0} />}
      />

      <nav className="mb-4 flex gap-1" aria-label="Öneri durumu">
        {Object.entries(VIEWS).map(([key, label]) => (
          <Link
            key={key}
            href={key === 'pending' ? '/suggestions' : `/suggestions?view=${key}`}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              view === key
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title={view === 'pending' ? 'Bekleyen öneri yok' : 'Kayıt yok'}
            description={
              view === 'pending'
                ? 'İstekleri analiz ettikten sonra "Öneri Oluştur" ile benzer istekleri gruplatın.'
                : 'Bu durumda öneri bulunmuyor.'
            }
          />
        </Card>
      ) : view === 'pending' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((s) => (
            <GroupSuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{s.suggested_title}</p>
                  <p className="text-xs text-slate-500">
                    {s.requests.map((r) => `#${r.external_no}`).join(', ')} · {formatDateTime(s.reviewed_at ?? s.created_at)}
                  </p>
                </div>
                {s.work_item_id ? (
                  <Link href={`/work-items/${s.work_item_id}`} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    İşe git
                  </Link>
                ) : (
                  <Badge>{VIEWS[s.status]}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  )
}
