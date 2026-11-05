export const REQUEST_STATUSES = {
  open: { label: 'Açık', tone: 'blue' },
  in_progress: { label: 'Devam Ediyor', tone: 'amber' },
  completed: { label: 'Tamamlandı', tone: 'green' },
}

export const WORK_ITEM_STATUSES = REQUEST_STATUSES

export const DIFFICULTIES = {
  easy: { label: 'Kolay', tone: 'green', rank: 1 },
  medium: { label: 'Orta', tone: 'blue', rank: 2 },
  hard: { label: 'Zor', tone: 'amber', rank: 3 },
  very_hard: { label: 'Çok Zor', tone: 'red', rank: 4 },
  unknown: { label: 'Belirsiz', tone: 'gray', rank: 9 },
}

export const AI_STATUSES = {
  pending: { label: 'Analiz Bekliyor', tone: 'gray' },
  queued: { label: 'Kuyrukta', tone: 'blue' },
  processing: { label: 'Analiz Ediliyor', tone: 'blue' },
  done: { label: 'Analiz Edildi', tone: 'green' },
  stale: { label: 'Güncellenmeli', tone: 'amber' },
  needs_review: { label: 'İnceleme Gerekli', tone: 'red' },
  failed: { label: 'Analiz Başarısız', tone: 'red' },
}

export const ESTIMATE_CONFIDENCE = {
  low: 'Düşük güvenilirlik',
  medium: 'Orta güvenilirlik',
  high: 'Yüksek güvenilirlik',
}

export const DEFAULT_CATEGORIES = [
  'Raporlama',
  'SQL ve Veritabanı',
  'Kalite Göstergeleri',
  'Entegrasyon',
  'Doktor Modülü',
  'Demirbaş',
  'Veri Tutarsızlığı',
  'Kullanıcı Arayüzü',
  'Sistem Hataları',
]

export const TECHNICAL_AREAS = {
  database: 'Veritabanı',
  sql_query: 'SQL sorgusu',
  reporting: 'Raporlama',
  user_interface: 'Kullanıcı arayüzü',
  backend: 'Backend',
  api: 'API',
  integration: 'Entegrasyon',
  data_validation: 'Veri doğrulama',
  performance: 'Performans',
  authorization: 'Yetkilendirme',
  other: 'Diğer',
}

export const LIKELIHOOD = {
  certain: 'Kesin',
  likely: 'Olası',
  possible: 'Düşük olasılık',
}

export const EVENT_LABELS = {
  created: 'Excel aktarımıyla oluşturuldu',
  import_updated: 'Excel ile güncellendi',
  import_restored: 'Excel yüklemesiyle geri getirildi',
  ai_analyzed: 'AI analizi yapıldı',
  ai_failed: 'AI analizi başarısız oldu',
  ai_review_required: 'Kişisel veri incelemesi gerekli',
  linked_work_item: 'İş grubuna bağlandı',
  unlinked_work_item: 'İş grubundan çıkarıldı',
  status_changed: 'Durumu değişti',
  completed: 'Tamamlandı',
  reopened: 'Yeniden açıldı',
  deleted: 'Silindi',
  note_updated: 'Notlar güncellendi',
  estimate_updated: 'Tahmin manuel güncellendi',
  prompt_saved: 'Agent promptu kaydedildi',
}

export const SOURCE_FIELD_LABELS = {
  institution_name: 'Kurum Adı',
  subject: 'Konusu',
  module_name: 'Modül',
  description: 'Açıklama',
  tracked_by: 'Takip Eden',
  replied_by: 'Cevap Veren',
  requested_by: 'Kullanıcı',
  form_name: 'Form Adı',
  source_request_type: 'İstek Tipi',
  source_urgency: 'Aciliyeti',
  source_elapsed_time: 'Geçen Süre',
}

export const REQUESTS_PAGE_SIZE = 25
