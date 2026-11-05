import { NextResponse } from 'next/server'
import { ApiError, withApiUser } from '@/lib/api'
import { getImportLimits } from '@/lib/import/limits'
import { ExcelFormatError, hashBuffer, parseRequestsWorkbook } from '@/lib/import/parse-excel'
import { classifyRows, savePreviewBatch, summarize, toPreviewRow } from '@/lib/import/preview'

export const POST = withApiUser(async ({ request, supabase, user }) => {
  const limits = getImportLimits()

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > limits.maxFileBytes + 64 * 1024) {
    throw new ApiError(413, `Dosya boyutu en fazla ${limits.maxFileMb} MB olabilir.`)
  }

  let formData
  try {
    formData = await request.formData()
  } catch {
    throw new ApiError(400, 'Dosya alınamadı.')
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') throw new ApiError(400, 'Lütfen bir Excel dosyası seçin.')
  if (!/\.xlsx$/i.test(file.name ?? '')) throw new ApiError(415, 'Yalnızca .xlsx formatındaki dosyalar desteklenir.')
  if (file.size === 0) throw new ApiError(400, 'Seçilen dosya boş.')
  if (file.size > limits.maxFileBytes) throw new ApiError(413, `Dosya boyutu en fazla ${limits.maxFileMb} MB olabilir.`)

  const buffer = Buffer.from(await file.arrayBuffer())
  // .xlsx dosyaları ZIP arşividir ve "PK" imzasıyla başlar.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new ApiError(415, 'Dosya geçerli bir .xlsx dosyası değil.')
  }

  let parsed
  try {
    parsed = await parseRequestsWorkbook(buffer, limits)
  } catch (err) {
    if (err instanceof ExcelFormatError) throw new ApiError(422, err.message)
    throw err
  }

  if (parsed.length === 0) throw new ApiError(422, 'Dosyada aktarılabilecek istek kaydı bulunamadı.')

  const rows = await classifyRows(supabase, parsed)
  const summary = summarize(rows)
  const fileHash = hashBuffer(buffer)

  const { data: previous } = await supabase
    .from('import_batches')
    .select('applied_at')
    .eq('file_hash', fileHash)
    .eq('status', 'completed')
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const batch = await savePreviewBatch(supabase, {
    userId: user.id,
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    rows,
    summary,
  })

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    expiresAt: batch.expires_at,
    fileName: file.name,
    fileSize: file.size,
    previouslyImportedAt: previous?.applied_at ?? null,
    summary,
    rows: rows.map(toPreviewRow),
  })
})
