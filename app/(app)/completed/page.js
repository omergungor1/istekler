import { CheckCircle2 } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getFilterOptions, listRequests, parseRequestFilters } from '@/lib/data/requests'
import { buildQuery } from '@/lib/query-string'
import { RequestFilters } from '@/components/requests/RequestFilters'
import { Pagination, RequestTable } from '@/components/requests/RequestTable'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'Tamamlananlar' }

const SORT_OPTIONS = [
  { value: 'completed_desc', label: 'Tamamlanma tarihi' },
  { value: 'no_desc', label: 'İstek no (yeni → eski)' },
  { value: 'no_asc', label: 'İstek no (eski → yeni)' },
]

export default async function CompletedPage({ searchParams }) {
  const { supabase } = await requireSession()
  const filters = { ...parseRequestFilters(await searchParams, { sort: 'completed_desc' }), status: 'completed' }

  const [list, options] = await Promise.all([listRequests(supabase, filters), getFilterOptions(supabase)])
  const urlFilters = { ...filters, status: '' }

  return (
    <PageContainer>
      <PageHeader title="Tamamlananlar" description="Tamamlanan istekler ve kapatma açıklamaları. Bir isteği detay sayfasından yeniden açabilirsiniz." />
      <Card>
        <RequestFilters filters={urlFilters} options={options} sortOptions={SORT_OPTIONS} showStatus={false} />
        {list.rows.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Tamamlanan istek yok" description="Tamamladığınız istekler burada listelenir." />
        ) : (
          <RequestTable rows={list.rows} variant="completed" />
        )}
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(p) => `/completed${buildQuery({ ...urlFilters, page: p })}`}
        />
      </Card>
    </PageContainer>
  )
}
