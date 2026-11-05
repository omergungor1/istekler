// Tamamen kurgusal örnek veriler. Gerçek kurum, kişi veya hasta bilgisi içermez.
// Kolon sırası Tıpplus "İstekler" Excel çıktısıyla aynıdır.

export const HEADERS = ['İstek Tipi', 'Aciliyeti', 'Takip Eden', 'No', 'Kurum Adı', 'Konusu', 'Modül', 'Cevap Veren', 'Açıklama', 'Kullanıcı', 'Form Adı', 'Geçen Süre']

const BASE = [
  {
    no: '90001',
    kurum: 'Örnek Devlet Hastanesi',
    konu: 'Poliklinik hasta listesi raporunda tarih filtresi çalışmıyor',
    modul: 'Raporlar',
    aciklama:
      'Poliklinik hasta listesi raporunda başlangıç ve bitiş tarihi seçildiğinde, bitiş günündeki kayıtlar listeye gelmiyor. Rapor seçilen günün sonuna kadar olan kayıtları da göstermelidir.',
    form: 'frmPoliklinikRapor',
  },
  {
    no: '90002',
    kurum: 'Örnek Eğitim ve Araştırma Hastanesi',
    konu: 'Poliklinik raporunda bitiş tarihindeki kayıtlar eksik geliyor',
    modul: 'Raporlar',
    aciklama: 'Rapor alırken son günün kayıtları görünmüyor. Tarih aralığını bir gün fazla seçince geliyor.',
    form: 'frmPoliklinikRapor',
  },
  {
    no: '90003',
    kurum: 'Örnek Şehir Hastanesi',
    konu: 'Kalite göstergeleri ekranına yeni gösterge eklenmesi',
    modul: 'Kalite Yönetimi',
    aciklama:
      'Kalite göstergeleri ekranına "Düşme Riski Değerlendirme Oranı" göstergesinin eklenmesi istenmektedir. Hesaplama aylık yapılmalı ve servis bazlı kırılım olmalıdır.',
    form: 'frmKaliteGosterge',
  },
  {
    no: '90004',
    kurum: 'Örnek Devlet Hastanesi',
    konu: 'Demirbaş zimmet listesinde Excel aktarımı',
    modul: 'Demirbaş',
    aciklama: 'Demirbaş zimmet listesi ekranından Excel çıktısı alınabilmesi istenmektedir. Mevcut durumda sadece yazdırma seçeneği var.',
    form: 'frmZimmetListe',
  },
  {
    no: '90005',
    kurum: 'Örnek İlçe Hastanesi',
    konu: 'Hasta kayıt ekranında kişisel veri içeren örnek',
    modul: 'Hasta Kabul',
    aciklama:
      'Test amaçlı kurgusal veri: Hasta Deneme Örnekoğlu isimli hastanın 10000000146 TC kimlik numarası ile kaydı açılırken hata alınıyor. Hasta no: 123456789. İletişim: 0555 000 00 00, deneme@example.com. Dr. Kurgu Hekim bilgilendirildi.',
    form: 'frmHastaKabul',
  },
  {
    no: '90006',
    kurum: 'Örnek Şehir Hastanesi',
    konu: 'Laboratuvar sonuç ekranında &quot;onaylı&quot; filtresi',
    modul: 'Laboratuvar',
    aciklama: 'Sonuç ekranında &quot;Onaylı&quot; filtresi seçildiğinde onay bekleyen sonuçlar da listeleniyor. &lt;br&gt; Yalnızca onaylı sonuçlar gelmeli.',
    form: 'frmLabSonuc',
  },
  {
    no: '90007',
    kurum: 'Örnek Eğitim ve Araştırma Hastanesi',
    konu: 'Doktor ekranında reçete şablonu kaydedilemiyor',
    modul: 'Doktor Modülü',
    aciklama: 'Doktor ekranında yeni reçete şablonu oluşturulup kaydet denildiğinde "Nesne başvurusu bir nesnenin örneğine ayarlanmadı" hatası alınıyor.',
    form: 'frmReceteSablon',
  },
  {
    no: '90008',
    kurum: 'Örnek Devlet Hastanesi',
    konu: 'Entegrasyon servisinde zaman aşımı',
    modul: 'Entegrasyon',
    aciklama: 'Dış laboratuvar entegrasyon servisinde yoğun saatlerde zaman aşımı hatası oluşuyor ve sonuçlar sisteme düşmüyor.',
    form: '',
  },
]

function toRow(r, overrides = {}) {
  const v = { tip: 'Geliştirme', aciliyet: 'Normal', takip: 'Destek Ekibi', cevap: '', kullanici: 'Kurum Kullanıcısı', sure: '3 gün', ...r, ...overrides }
  return [v.tip, v.aciliyet, v.takip, v.no, v.kurum, v.konu, v.modul, v.cevap, v.aciklama, v.kullanici, v.form, v.sure]
}

/** İlk yükleme: 8 geçerli istek. */
export function sampleRowsV1() {
  return BASE.map((r) => toRow(r))
}

/**
 * İkinci yükleme senaryoları:
 * - 90001 açıklaması değişti (güncelleme)
 * - 90002 yalnızca "Geçen Süre" değişti (değişmemiş sayılır)
 * - 90003 kaldırıldı (dosyada olmayan istek silinmez)
 * - 90009 yeni istek
 * - 90004 iki kez geçiyor (tekrar eden numara)
 * - "No" alanı boş bir satır (hatalı satır)
 */
export function sampleRowsV2() {
  const rows = []
  for (const r of BASE) {
    if (r.no === '90003') continue
    if (r.no === '90001') rows.push(toRow(r, { aciklama: `${r.aciklama} Ayrıca rapor PDF çıktısında da aynı sorun var.` }))
    else if (r.no === '90002') rows.push(toRow(r, { sure: '12 gün' }))
    else rows.push(toRow(r))
  }
  rows.push(
    toRow({
      no: '90009',
      kurum: 'Örnek İlçe Hastanesi',
      konu: 'Raporlar modülünde tarih aralığı son günü dahil etmiyor',
      modul: 'Raporlar',
      aciklama: 'Ayaktan hasta raporunda bitiş tarihi seçilen günün kayıtları rapora yansımıyor.',
      form: 'frmAyaktanRapor',
    })
  )
  rows.push(toRow(BASE[3], { aciklama: 'Aynı numaranın ikinci kopyası.' }))
  rows.push(toRow({ no: '', kurum: 'Örnek Devlet Hastanesi', konu: 'Numarasız satır', modul: 'Raporlar', aciklama: 'No alanı boş.', form: '' }))
  return rows
}

export function buildSheet(rows, title = 'İstekler') {
  return [[title, ...Array(HEADERS.length - 1).fill(null)], HEADERS, ...rows, [`Kayıt Sayısı: ${rows.length}`, ...Array(HEADERS.length - 1).fill(null)]]
}
