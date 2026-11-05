import { decodeEntities } from '@/lib/format'

const UPPER = 'A-ZÇĞİÖŞÜ'
const LOWER = 'a-zçğıöşü'
const NAME_WORD = `(?:[${UPPER}][${LOWER}]+|[${UPPER}]{2,})`
const NAME_SEQUENCE = `${NAME_WORD}(?:\\s+${NAME_WORD}){1,3}`

// "Hasta Kabul", "Hasta Listesi" gibi ifadelerin isim sanılmaması için.
const NON_NAME_WORDS = [
  'kabul', 'kayıt', 'kayit', 'modül', 'modul', 'liste', 'bilgi', 'takip', 'yatış', 'yatis', 'çıkış', 'cikis',
  'dosya', 'rapor', 'sevk', 'randevu', 'kart', 'ekran', 'form', 'sayı', 'sayi', 'veri', 'ücret', 'ucret',
  'hizmet', 'tahlil', 'tetkik', 'sonuç', 'sonuc', 'işlem', 'islem', 'süre', 'sure', 'bazlı', 'bazli', 'grubu',
  'arama', 'geçmiş', 'gecmis', 'portal', 'memnuniyet', 'güvenliği', 'guvenligi', 'hakları', 'haklari',
  'izlem', 'yönetim', 'yonetim', 'protokol', 'numara', 'barkod', 'etiket', 'fatura', 'epikriz', 'reçete',
  'recete', 'order', 'istem', 'onam', 'tanı', 'tani', 'muayene', 'poliklinik', 'servis', 'klinik', 'laboratuvar',
  'radyoloji', 'patoloji', 'acil', 'ameliyat', 'yoğun', 'yogun', 'bakım', 'bakim', 'kimlik', 'adı', 'adi',
]

function isLikelyName(sequence) {
  const words = sequence.toLocaleLowerCase('tr-TR').split(/\s+/)
  return !words.some((w) => NON_NAME_WORDS.some((n) => w.startsWith(n)))
}

function isValidTckn(value) {
  if (!/^[1-9]\d{10}$/.test(value)) return false
  const d = value.split('').map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]
  const even = d[1] + d[3] + d[5] + d[7]
  const d10 = (((odd * 7 - even) % 10) + 10) % 10
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10
  return d[9] === d10 && d[10] === d11
}

const RULES = [
  {
    label: 'E-POSTA',
    regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    replace: () => '[E-POSTA]',
  },
  {
    label: 'IBAN',
    regex: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi,
    replace: () => '[IBAN]',
  },
  {
    label: 'TC_KIMLIK',
    regex: /\b\d{11}\b/g,
    replace: (m) => (isValidTckn(m) ? '[TC_KIMLIK]' : '[NUMARA]'),
  },
  {
    label: 'TELEFON',
    regex: /(?:\+90[\s-]?|\b0[\s-]?)?\(?[2-5]\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g,
    replace: () => '[TELEFON]',
  },
  {
    label: 'DOGUM_TARIHI',
    regex: /(doğum\s+tarihi|d\.\s?tarihi)\s*[:\-]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/gi,
    replace: (_m, p1) => `${p1}: [TARİH]`,
  },
  {
    label: 'HASTA_NO',
    regex: /\b(hasta|protokol|dosya|başvuru|basvuru|barkod|numune|kimlik|tc|t\.c\.)(\s*(?:no|numarası|numarasi|numaralı|numarali|nolu|no'lu|#)?\s*[:=.]?\s*)(\d{4,})\b/gi,
    replace: (_m, p1, p2) => `${p1}${p2}[${/protokol/i.test(p1) ? 'PROTOKOL_NO' : 'HASTA_NO'}]`,
  },
  {
    label: 'HASTA_NO',
    regex: /\b(\d{4,})(\s*(?:numaralı|numarali|nolu|no'lu|no\.lu)\s+)(hasta|protokol|dosya)/gi,
    replace: (_m, _p1, p2, p3) => `[${/protokol/i.test(p3) ? 'PROTOKOL_NO' : 'HASTA_NO'}]${p2}${p3}`,
  },
  {
    label: 'PERSONEL',
    regex: new RegExp(
      `\\b(Dr\\.|Doç\\.|Doc\\.|Prof\\.|Uzm\\.|Op\\.|Hem\\.|Hemşire|Ebe|Sayın)(\\s*(?:Dr\\.|Uzm\\.|Op\\.)?\\s*)(${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})`,
      'g'
    ),
    replace: (_m, p1, p2) => `${p1}${p2}[PERSONEL]`,
  },
  {
    label: 'HASTA',
    regex: new RegExp(`(hasta\\s+ad[ıi](?:\\s+soyad[ıi])?|ad[ıi]\\s+soyad[ıi])\\s*[:\\-]\\s*([^\\n,;]+)`, 'gi'),
    replace: (_m, p1) => `${p1}: [HASTA]`,
  },
  {
    label: 'HASTA',
    regex: new RegExp(`(${NAME_SEQUENCE})(\\s+)(isimli|adlı|adli|adında|adinda|isminde|adındaki|adlı hasta)`, 'g'),
    replace: (m, p1, p2, p3) => (isLikelyName(p1) ? `[HASTA]${p2}${p3}` : m),
  },
  {
    label: 'HASTA',
    regex: new RegExp(`\\b(hasta(?:mız|miz|sı|si)?\\s*[:\\-]\\s*)(${NAME_SEQUENCE})`, 'gi'),
    replace: (m, p1, p2) => (isLikelyName(p2) ? `${p1}[HASTA]` : m),
  },
  {
    label: 'NUMARA',
    regex: /\b\d{7,}\b/g,
    replace: () => '[NUMARA]',
  },
]

const RISK_CHECKS = [
  {
    reason: 'Hasta ifadesinin yanında maskelenmemiş olası bir isim bulunuyor.',
    test: (text) => {
      const re = new RegExp(`\\b[Hh]asta(?:nın|nin|mız|miz|mızın|sı|si|ya|yı|yi)?\\s+(${NAME_SEQUENCE})`, 'g')
      for (const m of text.matchAll(re)) {
        if (isLikelyName(m[1])) return true
      }
      return false
    },
  },
  {
    reason: 'Metinde kimlik, doğum tarihi, anne/baba adı veya adres bilgisi geçiyor olabilir.',
    test: (text) => /\b(t\.?c\.?\s*kimlik|kimlik\s*no|doğum\s*tarihi|anne\s*adı|baba\s*adı|ev\s*adresi|adresi\s*:)/i.test(text),
  },
  {
    reason: 'Metinde maskelenmemiş uzun sayısal değerler bulunuyor.',
    test: (text) => /\b\d{6}\b/.test(text),
  },
]

/**
 * Metindeki kişisel verileri uygulama sunucusunda, AI'ye gönderilmeden önce maskeler.
 * Otomatik maskeleme her durumda yeterli değildir; şüpheli kalan içerik `risks` ile işaretlenir.
 */
export function maskText(raw) {
  let text = decodeEntities(raw ?? '')
  const counts = {}
  for (const rule of RULES) {
    text = text.replace(rule.regex, (...args) => {
      const replaced = rule.replace(...args)
      if (replaced !== args[0]) counts[rule.label] = (counts[rule.label] ?? 0) + 1
      return replaced
    })
  }
  const risks = RISK_CHECKS.filter((check) => check.test(text)).map((check) => check.reason)
  return { text, counts, risks }
}

/** AI'ye gönderilecek istek içeriğini hazırlar. Kişi alanları (kullanıcı, takip eden, cevap veren) hiç gönderilmez. */
export function buildMaskedRequestInput(request) {
  const override =
    request.ai_input_override && request.ai_input_override_hash === request.content_hash
      ? request.ai_input_override
      : null

  const subject = maskText(request.subject)
  const description = override !== null ? { text: override, counts: {}, risks: [] } : maskText(request.description)
  const risks = [...new Set([...subject.risks, ...description.risks])]

  return {
    externalNo: request.external_no,
    institution: request.institution_name ?? '',
    module: request.module_name ?? '',
    form: request.form_name ?? '',
    subject: subject.text,
    description: description.text,
    usesOverride: override !== null,
    maskCounts: mergeCounts(subject.counts, description.counts),
    risks: override !== null ? subject.risks : risks,
  }
}

function mergeCounts(a, b) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}
