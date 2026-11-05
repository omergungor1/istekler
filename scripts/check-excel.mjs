// Bir Excel dosyasını uygulamanın ayrıştırıcısı ve maskeleme kurallarıyla kontrol eder.
// Yalnızca sayısal istatistik yazdırır; hiçbir hücre içeriği çıktıya yazılmaz.
// Kullanım: npm run check:excel -- <dosya.xlsx>
import { readFile } from 'node:fs/promises'
import { parseRequestsWorkbook } from '@/lib/import/parse-excel'
import { buildMaskedRequestInput } from '@/lib/privacy/mask'

const file = process.argv[2]
if (!file) {
  console.error('Kullanım: npm run check:excel -- <dosya.xlsx>')
  process.exit(1)
}

const rows = await parseRequestsWorkbook(await readFile(file), { maxRows: 5000, maxFieldLength: 100_000 })
const kinds = {}
const maskCounts = {}
let needsReview = 0

for (const row of rows) {
  kinds[row.kind] = (kinds[row.kind] ?? 0) + 1
  if (row.kind !== 'valid') continue
  const input = buildMaskedRequestInput({ external_no: row.externalNo, content_hash: row.contentHash, ...row.data })
  for (const [k, v] of Object.entries(input.maskCounts)) maskCounts[k] = (maskCounts[k] ?? 0) + v
  if (input.risks.length) needsReview += 1
}

console.log(JSON.stringify({ rows: rows.length, kinds, maskCounts, needsReview }, null, 2))
