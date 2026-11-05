import { Bot, Database, FileSpreadsheet, Palette, ShieldCheck, User } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { getModelName, isAiConfigured } from '@/lib/ai/client'
import { getImportLimits } from '@/lib/import/limits'
import { formatDateTime } from '@/lib/format'
import { signOut } from '@/app/actions/auth'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageContainer, PageHeader } from '@/components/ui/PageHeader'

export const metadata = { title: 'Ayarlar' }

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  )
}

export default async function SettingsPage() {
  const { supabase, user } = await requireSession()
  const aiReady = isAiConfigured()
  const limits = getImportLimits()

  const [{ data: lastImport }, { count: requestCount }, { count: analysisCount }] = await Promise.all([
    supabase
      .from('import_batches')
      .select('file_name, applied_at')
      .eq('status', 'completed')
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('requests').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('ai_analyses').select('id', { count: 'exact', head: true }),
  ])

  return (
    <PageContainer>
      <PageHeader title="Ayarlar" description="Hesap, görünüm ve sistem yapılandırması." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={User} title="Hesap" />
          <CardBody>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <Row label="E-posta">{user.email}</Row>
              <Row label="Oturum">
                <form action={signOut}>
                  <Button type="submit" variant="secondary" size="sm">
                    Çıkış Yap
                  </Button>
                </form>
              </Row>
            </dl>
            <p className="mt-4 text-xs text-slate-500">Yeni kullanıcılar yalnızca Supabase Dashboard üzerinden yönetici tarafından oluşturulur.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Palette} title="Görünüm" />
          <CardBody>
            <dl>
              <Row label="Tema">
                <ThemeToggle />
              </Row>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Bot} title="Yapay zekâ" />
          <CardBody>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <Row label="OpenAI bağlantısı">{aiReady ? <Badge tone="green">Yapılandırıldı</Badge> : <Badge tone="red">OPENAI_API_KEY eksik</Badge>}</Row>
              <Row label="Model">{getModelName()}</Row>
              <Row label="Yanıt saklama">Kapalı (store: false)</Row>
              <Row label="Kayıtlı analiz">{analysisCount ?? 0}</Row>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              API anahtarı yalnızca sunucuda kullanılır ve tarayıcıya gönderilmez. Model, sunucu ortam değişkeni <code>OPENAI_MODEL</code> ile değiştirilebilir.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={ShieldCheck} title="Kişisel veri koruması" />
          <CardBody>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-400">
              <li>İstek metinleri AI&apos;ye gönderilmeden önce sunucuda maskelenir (TC kimlik, telefon, e-posta, IBAN, hasta/protokol numarası, kişi adı kalıpları).</li>
              <li>Kullanıcı, Takip Eden ve Cevap Veren alanları AI&apos;ye hiç gönderilmez.</li>
              <li>Maskelemeden sonra şüpheli içerik kalırsa analiz durdurulur ve “İnceleme Gerekli” olarak işaretlenir.</li>
              <li>Süre tahminleri kesin değer değil, aralık olarak gösterilir.</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={FileSpreadsheet} title="Excel aktarımı" />
          <CardBody>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <Row label="Son aktarım">{lastImport ? `${formatDateTime(lastImport.applied_at)}` : '—'}</Row>
              <Row label="Son dosya">{lastImport?.file_name ?? '—'}</Row>
              <Row label="Azami dosya boyutu">{limits.maxFileMb} MB</Row>
              <Row label="Azami satır">{limits.maxRows.toLocaleString('tr-TR')}</Row>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={Database} title="Veri" />
          <CardBody>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <Row label="Aktif istek sayısı">{requestCount ?? 0}</Row>
              <Row label="Veri izolasyonu">Satır düzeyi güvenlik (RLS) — her kullanıcı yalnızca kendi kayıtlarını görür</Row>
            </dl>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  )
}
