const TIME_ZONE = 'Europe/Istanbul'

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d)
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d)
}

function formatNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  return Number.isInteger(num) ? String(num) : num.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

/** Tahmini süreleri kesin değer gibi göstermemek için aralık olarak biçimlendirir. */
export function formatHoursRange(min, max) {
  const hasMin = min !== null && min !== undefined && min !== ''
  const hasMax = max !== null && max !== undefined && max !== ''
  if (!hasMin && !hasMax) return null
  if (hasMin && hasMax && Number(min) !== Number(max)) {
    return `${formatNumber(min)}–${formatNumber(max)} saat`
  }
  return `${formatNumber(hasMax ? max : min)} saat`
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

/** HTML entity'lerini düz metne çevirir; sonuç her zaman metin olarak gösterilir. */
export function decodeEntities(text) {
  if (!text) return ''
  return String(text).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(num) && num > 0 && num < 0x110000 ? String.fromCodePoint(num) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}