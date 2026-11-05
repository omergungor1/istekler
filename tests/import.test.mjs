import { test } from 'node:test'
import assert from 'node:assert/strict'
import writeExcelFile from 'write-excel-file/node'
import { ExcelFormatError, parseRequestsWorkbook } from '@/lib/import/parse-excel'
import { classifyRows, summarize } from '@/lib/import/preview'
import { buildSheet, HEADERS, sampleRowsV1, sampleRowsV2 } from '../scripts/sample-data.mjs'

const LIMITS = { maxRows: 5000, maxFieldLength: 100_000 }

async function workbook(rows) {
  return writeExcelFile(rows).toBuffer()
}

/** classifyRows için RLS'li Supabase sorgusunu taklit eden en küçük istemci. */
function fakeSupabase(existingRows) {
  return {
    from: () => ({
      select: () => ({
        in: async (_col, values) => ({ data: existingRows.filter((r) => values.includes(r.external_no)), error: null }),
      }),
    }),
  }
}

function asStored(parsedRow, extra = {}) {
  return { id: `id-${parsedRow.externalNo}`, external_no: parsedRow.externalNo, source_hash: parsedRow.sourceHash, status: 'open', deleted_at: null, ...parsedRow.data, ...extra }
}

test('başlık ve "Kayıt Sayısı" satırları atlanır, kolonlar isimle eşlenir', async () => {
  const rows = await parseRequestsWorkbook(await workbook(buildSheet(sampleRowsV1())), LIMITS)
  assert.equal(rows.length, 8)
  assert.ok(rows.every((r) => r.kind === 'valid'))
  assert.equal(rows[0].externalNo, '90001')
  assert.equal(rows[0].data.module_name, 'Raporlar')
})

test('kolon sırası değişse de okunur', async () => {
  const order = [...HEADERS].reverse()
  const data = sampleRowsV1().map((r) => order.map((h) => r[HEADERS.indexOf(h)]))
  const rows = await parseRequestsWorkbook(await workbook([order, ...data]), LIMITS)
  assert.equal(rows[0].externalNo, '90001')
  assert.equal(rows[0].data.institution_name, 'Örnek Devlet Hastanesi')
})

test('zorunlu kolon eksikse anlaşılır hata verilir', async () => {
  const headers = HEADERS.filter((h) => h !== 'Açıklama')
  await assert.rejects(parseRequestsWorkbook(await workbook([headers, headers.map(() => 'x')]), LIMITS), (err) => {
    assert.ok(err instanceof ExcelFormatError)
    assert.match(err.message, /Açıklama/)
    return true
  })
})

test('"Geçen Süre" değişikliği güncelleme sayılmaz', async () => {
  const v1 = await parseRequestsWorkbook(await workbook(buildSheet(sampleRowsV1())), LIMITS)
  const v2 = await parseRequestsWorkbook(await workbook(buildSheet(sampleRowsV2())), LIMITS)
  const original = v1.find((r) => r.externalNo === '90002')
  const b = v2.find((r) => r.externalNo === '90002')
  assert.equal(b.sourceHash, original.sourceHash)
  assert.equal(b.contentHash, original.contentHash)
  assert.notEqual(b.data.source_elapsed_time, original.data.source_elapsed_time)
})

test('senaryolar: yeni, güncelleme, değişmeyen, geri getirme, tamamlanmışta değişiklik, hatalı ve tekrar eden', async () => {
  const v1 = await parseRequestsWorkbook(await workbook(buildSheet(sampleRowsV1())), LIMITS)
  const v2 = await parseRequestsWorkbook(await workbook(buildSheet(sampleRowsV2())), LIMITS)
  const byNo = Object.fromEntries(v1.map((r) => [r.externalNo, r]))

  const existing = [
    asStored(byNo['90001'], { status: 'completed' }),
    asStored(byNo['90002']),
    asStored(byNo['90005']),
    asStored(byNo['90006'], { deleted_at: '2026-01-01T00:00:00Z' }),
    asStored(byNo['90007']),
    asStored(byNo['90008']),
  ]
  const classified = await classifyRows(fakeSupabase(existing), v2)
  const action = (no) => classified.filter((r) => r.externalNo === no).map((r) => r.action)

  assert.deepEqual(action('90009'), ['new'])
  assert.deepEqual(action('90001'), ['update'])
  assert.equal(classified.find((r) => r.externalNo === '90001').isCompleted, true)
  assert.deepEqual(classified.find((r) => r.externalNo === '90001').changedFields, ['description'])
  assert.deepEqual(action('90002'), ['unchanged'])
  assert.deepEqual(action('90006'), ['restore'])
  assert.deepEqual(action('90004'), ['duplicate', 'duplicate'])
  assert.equal(classified.filter((r) => r.action === 'invalid').length, 1)
  assert.equal(action('90003').length, 0, 'dosyada olmayan istek önizlemede yer almaz ve silinmez')

  const summary = summarize(classified)
  assert.equal(summary.completedChanged, 1)
  assert.equal(summary.new, 1)
  assert.equal(summary.total, classified.length)
})
