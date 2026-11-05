import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import writeExcelFile from 'write-excel-file/node'
import { buildSheet, sampleRowsV1, sampleRowsV2 } from './sample-data.mjs'

const outDir = fileURLToPath(new URL('../samples/', import.meta.url))
await mkdir(outDir, { recursive: true })

await writeExcelFile(buildSheet(sampleRowsV1())).toFile(`${outDir}ornek-istekler-1.xlsx`)
await writeExcelFile(buildSheet(sampleRowsV2())).toFile(`${outDir}ornek-istekler-2.xlsx`)

console.log('Örnek dosyalar oluşturuldu: samples/ornek-istekler-1.xlsx, samples/ornek-istekler-2.xlsx')
