# Tıpplus İstek Yönetimi

Tıpplus HBYS kurumlarından gelen geliştirme isteklerini Excel'den içe aktaran, yapay zekâ ile analiz eden, benzer istekleri ortak teknik işler altında gruplayan ve kod geliştirme agentları için görev promptu üreten bir iç araç.

**Teknolojiler:** Next.js 16 (App Router, Cache Components), JavaScript (TypeScript kullanılmaz), Tailwind CSS v4, Supabase (Auth + Postgres + RLS), OpenAI Responses API (Structured Outputs).

## Özellikler

- **Excel içe aktarma:** Tıpplus "İstekler" çıktısı (.xlsx) yüklenir, kolonlar başlık adıyla eşlenir. Rapor başlığı ve "Kayıt Sayısı" satırı atlanır. Kayıt yapılmadan önce önizleme gösterilir: yeni, güncellenen, değişmeyen, geri getirilen, hatalı ve tekrar eden satırlar. Onaylanınca tüm satırlar tek bir veritabanı işleminde uygulanır.
  - Dosyada olmayan istekler silinmez.
  - Tamamlanmış bir istek Excel'de değişirse durumu korunur, kullanıcıya bildirilir.
  - Silinmiş bir istek Excel'de tekrar gelirse geri getirilir.
  - "Geçen Süre" geliştirme süresi değildir; değişmesi güncelleme sayılmaz.
  - Kullanıcı notları, manuel tahminler ve düzenlenmiş promptlar içe aktarmada asla ezilmez.
- **AI analizi:** Her istek için özet, beklenen/mevcut davranış, teknik analiz, çözüm önerisi, kabul kriterleri, eksik bilgiler, zorluk ve süre aralığı. Tekli veya toplu analiz (arka planda kuyruk, ilerleme paneli). İstek içeriği değişince analiz "Güncellenmeli" olarak işaretlenir.
- **Kişisel veri koruması:** Metinler AI'ye gönderilmeden önce sunucuda maskelenir (TC kimlik, telefon, e-posta, IBAN, hasta/protokol numarası, kişi adı kalıpları, unvanlı personel adları). Kullanıcı, Takip Eden ve Cevap Veren alanları AI'ye hiç gönderilmez. Şüpheli içerik kalırsa analiz durur ve istek "İnceleme Gerekli" olur. Kullanıcı maskelenmiş metni düzeltip onaylayabilir. OpenAI çağrıları `store: false` ile yapılır.
- **AI gruplama önerileri:** Aynı teknik geliştirmeyle çözülebilecek istekler önerilir. Öneriler kullanıcı onaylamadan uygulanmaz; başlık ve istek listesi onaydan önce düzenlenebilir.
- **Yapılacak işler:** İstekleri iş gruplarında toplama, işe istek ekleme/çıkarma, ayrı işe bölme, iş seviyesinde tahmin, toplu tamamlama.
- **Agent promptu:** İstek veya iş için Markdown görev promptu. Kopyalanabilir ve düzenlenebilir; düzenlenmiş prompt onay olmadan yeniden oluşturulmaz.
- **Tamamlama:** Kullanıcı yaptığı işlemi yazar, AI kısa bir kapatma açıklaması önerir, kullanıcı düzenleyip onaylar.
- **Dashboard:** Durum, modül, kurum ve zorluk dağılımları. Toplam iş yükü, gruplanmış istekler iş seviyesinde bir kez sayılarak, tekrar olmadan hesaplanır.
- **Çok kullanıcılı izolasyon:** Her kullanıcı yalnızca kendi verisini görür (Postgres RLS + bileşik yabancı anahtarlar).

## Kurulum

Gereksinimler: Node.js 20.9+ (önerilen 22 veya 24), bir Supabase projesi ve bir OpenAI API anahtarı.

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
```

`.env.local` dosyasını doldurun:

| Değişken | Açıklama |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'si (Dashboard → Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable anahtarı (`sb_publishable_...`) |
| `OPENAI_API_KEY` | OpenAI API anahtarı. **Yalnızca sunucuda** kullanılır, tarayıcıya gönderilmez |
| `OPENAI_MODEL` | Kullanılacak model (varsayılan `gpt-5.4-mini`) |
| `OPENAI_TIMEOUT_MS` | Tek bir AI çağrısı için zaman aşımı (varsayılan 90000) |
| `IMPORT_MAX_FILE_MB` / `IMPORT_MAX_ROWS` | Excel aktarım sınırları (varsayılan 10 MB / 5000 satır) |

> Supabase service role anahtarı bu uygulamada kullanılmaz ve gerekmez. Tüm işlemler oturum açmış kullanıcının yetkisiyle, RLS altında çalışır.

### Veritabanı

`supabase/migrations/` klasöründeki dosyaları sırasıyla uygulayın:

1. `20261104100000_init_schema.sql`: tablolar, indeksler, tetikleyiciler, RLS politikaları
2. `20261104100100_functions.sql`: `request_list` görünümü ve işlemsel fonksiyonlar (içe aktarma, öneri onayı, iş bölme, AI kuyruğu, dashboard)
3. `20261104100200_dashboard_workload_fix.sql`: dashboard iş yükü hesabı düzeltmesi

Supabase CLI ile: `supabase link --project-ref <ref>` ve ardından `supabase db push`. Alternatif olarak dosyaları Dashboard → SQL Editor'de sırayla çalıştırabilirsiniz.

### Kullanıcı oluşturma

Uygulamada kayıt ekranı yoktur. Kullanıcıları Supabase Dashboard → **Authentication → Users → Add user** ile e-posta ve şifre vererek oluşturun ("Auto Confirm User" seçili olsun). Ayrıca **Authentication → Sign In / Providers** altında herkese açık kaydı kapatmanız ve **leaked password protection** seçeneğini açmanız önerilir.

### Çalıştırma

```bash
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Kullanım

1. **Excel Yükle** sayfasından Tıpplus "İstekler" çıktısını seçin, önizlemeyi kontrol edip **Aktarımı Onayla** deyin.
2. **İstekler** sayfasında **Bekleyenleri Analiz Et** ile bekleyen istekleri analiz edin. İlerleme sağ altta görünür, sayfadan ayrılabilirsiniz.
3. "İnceleme Gerekli" olan isteklerde **AI Analizi** sekmesinden maskelenmiş metni kontrol edip onaylayın.
4. **AI Önerileri** sayfasından gruplama önerileri oluşturun; uygun olanları onaylayın veya düzenleyin.
5. İş ya da istek detayında **Agent Promptu** sekmesinden promptu kopyalayıp geliştirme agentına verin.
6. İş bitince **Tamamla** ile kapatma açıklamasını oluşturup onaylayın.

## Excel formatı

Beklenen kolonlar (sıra önemsiz, başlıklar isimle eşlenir): `İstek Tipi`, `Aciliyeti`, `Takip Eden`, `No`, `Kurum Adı`, `Konusu`, `Modül`, `Cevap Veren`, `Açıklama`, `Kullanıcı`, `Form Adı`, `Geçen Süre`.

Zorunlu kolonlar: `No`, `Kurum Adı`, `Konusu`, `Modül`, `Açıklama`. "İstek Tipi" ve "Aciliyeti" kaynak veri olarak saklanır ancak değerlendirmede kullanılmaz.

Kişisel veri içermeyen örnek dosyalar `samples/` klasöründedir. `npm run sample:excel` ile yeniden üretilebilir:

- `ornek-istekler-1.xlsx`: ilk yükleme (8 istek)
- `ornek-istekler-2.xlsx`: ikinci yükleme. Güncelleme, yalnızca "Geçen Süre" değişikliği, yeni istek, tekrar eden numara ve numarasız satır içerir.

## Testler

```bash
npm test                                   # maskeleme, Excel ayrıştırma ve içe aktarma sınıflandırması
npm run check:excel -- <dosya.xlsx>        # bir Excel dosyasını içerik yazdırmadan istatistikle kontrol eder
```

`supabase/tests/import_scenarios.sql`, içe aktarma senaryolarını ve kullanıcı izolasyonunu veritabanında test eder. SQL Editor'de çalıştırın; tüm değişiklikler sonunda geri alınır.

## Güvenlik notları

- OpenAI anahtarı yalnızca sunucu tarafındaki route handler'larda kullanılır.
- Excel açıklamaları HTML olarak değil, düz metin olarak gösterilir.
- Önizleme için geçici olarak saklanan satır kopyaları, içe aktarma onaylanınca silinir. Onaylanmayan önizlemeler 24 saat sonra geçersiz olur; satırları bir sonraki yüklemede temizlenir.
- Gerçek kişisel veri içeren Excel dosyalarını depoya eklemeyin.
