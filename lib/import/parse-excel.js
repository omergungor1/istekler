import { createHash } from 'node:crypto'
import { readSheet } from 'read-excel-file/node'

/** Excel kolon başlığı → veritabanı alanı. Sıra önemsizdir; başlıklar isimle eşleştirilir. */
const COLUMN_MAP = {
  'istek tipi': 'source_request_type',
  aciliyeti: 'source_urgency',
  'takip eden': 'tracked_by',
  no: 'external_no',
  'kurum adı': 'institution_name',
  konusu: 'subject',
  modül: 'module_name',
  'cevap veren': 'replied_by',
  açıklama: 'description',
  kullanıcı: 'requested_by',
  'form adı': 'form_name',
  'geçen süre': 'source_elapsed_time',
}

const REQUIRED_FIELDS = ['external_no', 'institution_name', 'subject', 'module_name', 'description']

export const SOURCE_FIELDS = [
  'institution_name',
  'subject',
  'module_name',
  'description',
  'tracked_by',
  'replied_by',
  'requested_by',
  'form_name',
  'source_request_type',
  'source_urgency',
]

// AI analizinin bağlı olduğu alanlar; bunlar değişince analiz güncelliğini yitirir.
const CONTENT_FIELDS = ['subject', 'module_name', 'form_name', 'description']

export class ExcelFormatError extends Error {}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function cellToText(value) {
  if (value === null || value === undefined) return null
  let text
  if (value instanceof Date) text = Number.isNaN(value.getTime()) ? '' : value.toISOString()
  else text = String(value)
  text = text.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  return text === '' ? null : text
}

function normalizeExternalNo(value) {
  const text = cellToText(value)
  if (!text) return null
  // Sayısal hücreler "56053.0" biçiminde gelebilir; baştaki sıfırlar korunur.
  const numeric = text.match(/^(\d+)\.0+$/)
  return numeric ? numeric[1] : text
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function hashFields(data, fields) {
  return sha256(JSON.stringify(fields.map((f) => data[f] ?? null)))
}

export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function findHeaderRow(rows) {
  const limit = Math.min(rows.length, 15)
  for (let i = 0; i < limit; i++) {
    const mapping = {}
    rows[i].forEach((cell, index) => {
      const field = COLUMN_MAP[normalizeHeader(cell)]
      if (field && mapping[field] === undefined) mapping[field] = index
    })
    if (mapping.external_no !== undefined && Object.keys(mapping).length >= 4) {
      return { index: i, mapping }
    }
  }
  return null
}

function isSummaryRow(cells) {
  const filled = cells.map(cellToText).filter(Boolean)
  if (filled.length === 0) return true
  return filled.length === 1 && /^(kayıt sayısı|toplam)(?=$|[\s:])/u.test(filled[0].toLocaleLowerCase('tr-TR'))
}

/**
 * Excel dosyasını okur, başlık satırını kolon isimlerine göre bulur ve
 * satırları doğrular. Rapor başlığı ve özet satırları atlanır.
 */
export async function parseRequestsWorkbook(buffer, limits) {
  let rows
  try {
    rows = await readSheet(buffer, { parseNumber: (s) => s, trim: false })
  } catch {
    throw new ExcelFormatError('Dosya okunamadı. Geçerli bir .xlsx dosyası olduğundan emin olun.')
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ExcelFormatError('Excel dosyasında okunabilir satır bulunamadı.')
  }

  const header = findHeaderRow(rows)
  if (!header) {
    throw new ExcelFormatError(
      'Kolon başlıkları bulunamadı. Dosyada en az "No" ve diğer Tıpplus İstekler kolonları bulunmalıdır.'
    )
  }

  const missing = REQUIRED_FIELDS.filter((f) => header.mapping[f] === undefined)
  if (missing.length > 0) {
    const labels = Object.entries(COLUMN_MAP)
      .filter(([, field]) => missing.includes(field))
      .map(([label]) => `"${label.replace(/(^|\s)\S/g, (s) => s.toLocaleUpperCase('tr-TR'))}"`)
    throw new ExcelFormatError(`Zorunlu kolonlar eksik: ${labels.join(', ')}.`)
  }

  const dataRows = rows.slice(header.index + 1)
  const parsed = []

  dataRows.forEach((cells, offset) => {
    if (isSummaryRow(cells)) return
    const rowNumber = header.index + offset + 2
    const data = {}
    for (const [field, index] of Object.entries(header.mapping)) {
      data[field] = field === 'external_no' ? normalizeExternalNo(cells[index]) : cellToText(cells[index])
    }

    const errors = []
    if (!data.external_no) errors.push('"No" alanı boş.')
    else if (data.external_no.length > 64) errors.push('"No" alanı 64 karakterden uzun.')
    for (const field of SOURCE_FIELDS) {
      if (data[field] && data[field].length > limits.maxFieldLength) {
        errors.push(`"${field}" alanı izin verilen uzunluğu aşıyor; kesilmeden kaydedilemez.`)
      }
    }

    const { external_no: externalNo, ...sourceData } = data
    parsed.push({ rowNumber, externalNo, data: sourceData, errors })
  })

  if (parsed.length > limits.maxRows) {
    throw new ExcelFormatError(`Dosyada ${parsed.length} satır var. En fazla ${limits.maxRows} satır aktarılabilir.`)
  }

  // Aynı dosyada tekrar eden "No" değerleri hatalı kabul edilir.
  const counts = new Map()
  for (const row of parsed) {
    if (row.externalNo && row.errors.length === 0) counts.set(row.externalNo, (counts.get(row.externalNo) ?? 0) + 1)
  }

  return parsed.map((row) => {
    const isDuplicate = row.externalNo && (counts.get(row.externalNo) ?? 0) > 1
    const kind = row.errors.length > 0 ? 'invalid' : isDuplicate ? 'duplicate' : 'valid'
    return {
      ...row,
      kind,
      errors: isDuplicate ? [...row.errors, `"${row.externalNo}" numarası dosyada birden fazla kez geçiyor.`] : row.errors,
      sourceHash: kind === 'valid' ? hashFields(row.data, SOURCE_FIELDS) : null,
      contentHash: kind === 'valid' ? hashFields(row.data, CONTENT_FIELDS) : null,
    }
  })
}
