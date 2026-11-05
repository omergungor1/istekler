import { ClipboardList, FileSpreadsheet } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getFilterOptions, listRequests, parseRequestFilters } from '@/lib/data/requests'
import { buildQuery } from '@/lib/query-string'
import { BulkAnalyzeButton } from '@/components/ai/BulkAnalyzeButton'
import { RequestFilters } from '@/components/requests/RequestFilters'
import { Pagination, RequestTable } from '@/components/requests/RequestTable'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'İstekler' }

const SORT_OPTIONS = [
  { value: 'no_desc', label: 'İstek no (yeni → eski)' },
  { value: 'no_asc', label: 'İstek no (eski → yeni)' },
  { value: 'updated_desc', label: 'Son güncelleme' },
  { value: 'difficulty_desc', label: 'Zorluk (zor → kolay)' },
  { value: 'difficulty_asc', label: 'Zorluk (kolay → zor)' },
  { value: 'hours_desc', label: 'Tahmini süre (uzun → kısa)' },
  { value: 'hours_asc', label: 'Tahmini süre (kısa → uzun)' },
]

export default async function RequestsPage({ searchParams }) {
  const { supabase } = await requireSession()
  const filters = parseRequestFilters(await searchParams, { status: '' })

  const [list, options, pending] = await Promise.all([
    listRequests(supabase, filters),
    getFilterOptions(supabase),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .neq('status', 'completed')
      .in('ai_status', ['pending', 'stale', 'failed']),
  ])

  const isEmpty = list.total === 0 && !filters.q && !filters.institution && !filters.module && !filters.status && !filters.difficulty && !filters.linked && !filters.ai

  return (
    <PageContainer>
      <PageHeader
        title="İstekler"
        description="Kurumlardan gelen tüm istekler. Silinen istekler listede gösterilmez."
        actions={<BulkAnalyzeButton pendingCount={pending.count ?? 0} />}
      />
      <Card>
        {isEmpty ? (
          <EmptyState
            icon={ClipboardList}
            title="Henüz istek yok"
            description="Tıpplus İstekler Excel çıktısını yükleyerek başlayın."
            action={
              <ButtonLink href="/imports" icon={FileSpreadsheet}>
                Excel Yükle
              </ButtonLink>
            }
          />
        ) : (
          <>
            <RequestFilters filters={filters} options={options} sortOptions={SORT_OPTIONS} />
            {list.rows.length === 0 ? (
              <EmptyState title="Sonuç bulunamadı" description="Filtreleri değiştirerek tekrar deneyin." />
            ) : (
              <RequestTable rows={list.rows} />
            )}
            <Pagination
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              hrefFor={(p) => `/requests${buildQuery({ ...filters, page: p })}`}
            />
          </>
        )}
      </Card>
    </PageContainer>
  )
}
