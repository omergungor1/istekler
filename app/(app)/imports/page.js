import { History } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getImportLimits } from '@/lib/import/limits'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { ExcelImport } from '@/components/imports/ExcelImport'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'Excel Yükle' }

const STATUS = {
  preview: { label: 'Önizleme', tone: 'blue' },
  completed: { label: 'Tamamlandı', tone: 'green' },
  failed: { label: 'Başarısız', tone: 'red' },
  cancelled: { label: 'İptal edildi', tone: 'gray' },
  expired: { label: 'Süresi doldu', tone: 'gray' },
}

export default async function ImportsPage() {
  const { supabase } = await requireSession()
  const { data: batches, error } = await supabase
    .from('import_batches')
    .select('id, file_name, file_size, status, total_rows, new_count, updated_count, unchanged_count, restored_count, error_count, duplicate_count, created_at, applied_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  const { maxFileMb } = getImportLimits()

  return (
    <PageContainer>
      <PageHeader
        title="Excel Yükle"
        description="Tıpplus İstekler modülünden aldığınız Excel çıktısını yükleyin. İstekler değişmeyen istek numarasına göre eşleştirilir; Excel'de bulunmayan kayıtlar silinmez."
      />
      <ExcelImport maxFileMb={maxFileMb} />

      <Card className="mt-6">
        <CardHeader icon={History} title="Aktarım geçmişi" description="Son 20 yükleme" />
        {batches.length === 0 ? (
          <EmptyState title="Henüz aktarım yapılmadı" description="İlk Excel dosyanızı yüklediğinizde burada görünecek." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className="px-5 py-2.5">Dosya</th>
                  <th className="px-5 py-2.5">Tarih</th>
                  <th className="px-5 py-2.5">Durum</th>
                  <th className="px-5 py-2.5 text-right">Yeni</th>
                  <th className="px-5 py-2.5 text-right">Güncellenen</th>
                  <th className="px-5 py-2.5 text-right">Değişmeyen</th>
                  <th className="px-5 py-2.5 text-right">Geri getirilen</th>
                  <th className="px-5 py-2.5 text-right">Hatalı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <p className="max-w-xs truncate font-medium text-slate-900 dark:text-white">{b.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(b.file_size)} · {b.total_rows} satır
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-400">
                      {formatDateTime(b.applied_at ?? b.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS[b.status]?.tone}>{STATUS[b.status]?.label ?? b.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.new_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.updated_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.unchanged_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.restored_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{b.error_count + b.duplicate_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  )
}
