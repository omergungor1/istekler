'use client'

import { useRef, useState, useTransition } from 'react'
import { FileSpreadsheet, Sparkles, UploadCloud, X } from 'lucide-react'
import { apiRequest } from '@/lib/client-api'
import { formatFileSize } from '@/lib/format'
import { cancelImport, confirmImport } from '@/app/actions/imports'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useAiJob } from '@/components/ai/AiJobProvider'
import { ImportPreview } from './ImportPreview'

export function ExcelImport({ maxFileMb }) {
  const toast = useToast()
  const { startBulk } = useAiJob()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const selectFile = (selected) => {
    setError(null)
    setPreview(null)
    setResult(null)
    if (!selected) return
    if (!/\.xlsx$/i.test(selected.name)) {
      setError('Yalnızca .xlsx formatındaki Excel dosyaları desteklenir.')
      return
    }
    if (selected.size > maxFileMb * 1024 * 1024) {
      setError(`Dosya boyutu en fazla ${maxFileMb} MB olabilir.`)
      return
    }
    setFile(selected)
  }

  const handlePreview = async () => {
    if (!file || uploading) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiRequest('/api/imports/preview', { formData })
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = () => {
    if (!preview || pending) return
    startTransition(async () => {
      const res = await confirmImport(preview.batchId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setResult(res.result)
      setPreview(null)
      toast.success('Excel aktarımı tamamlandı.')
    })
  }

  const handleCancel = () => {
    if (!preview || pending) return
    startTransition(async () => {
      await cancelImport(preview.batchId)
      reset()
    })
  }

  if (result) {
    return <ImportResult result={result} fileName={file?.name} onReset={reset} onAnalyze={() => startBulk().catch((e) => toast.error(e.message))} />
  }

  if (preview) {
    return <ImportPreview preview={preview} pending={pending} onConfirm={handleConfirm} onCancel={handleCancel} />
  }

  return (
    <Card className="p-5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          selectFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-500/5'
            : 'border-slate-300 dark:border-slate-700'
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <UploadCloud className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">Tıpplus İstekler Excel dosyasını buraya sürükleyin</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          veya{' '}
          <button
            type="button"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            onClick={() => inputRef.current?.click()}
          >
            bilgisayarınızdan seçin
          </button>
        </p>
        <p className="mt-3 text-xs text-slate-400">Yalnızca .xlsx · En fazla {maxFileMb} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0])}
        />
      </div>

      {file ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
          <FileSpreadsheet className="size-5 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} disabled={uploading} aria-label="Dosyayı kaldır">
            <X className="size-4" aria-hidden />
          </Button>
          <Button onClick={handlePreview} loading={uploading}>
            {uploading ? 'Dosya inceleniyor…' : 'Önizle'}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  )
}

function ImportResult({ result, fileName, onReset, onAnalyze }) {
  const items = [
    { label: 'Yeni istek', value: result.new },
    { label: 'Güncellenen', value: result.updated },
    { label: 'Değişmeyen', value: result.unchanged },
    { label: 'Geri getirilen', value: result.restored },
    { label: 'Hatalı (aktarılmadı)', value: result.errors },
    { label: 'Mükerrer (aktarılmadı)', value: result.duplicates },
  ]
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Aktarım tamamlandı</h2>
      {fileName ? <p className="mt-1 text-sm text-slate-500">{fileName}</p> : null}
      <dl className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{item.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{item.value ?? 0}</dd>
          </div>
        ))}
      </dl>
      {result.completed_changed ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Tamamlanmış {result.completed_changed} isteğin kaynak bilgileri değişti. Durumları korunarak güncellendi; gerekirse inceleyip yeniden açabilirsiniz.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/requests">İsteklere Git</ButtonLink>
        {result.new || result.updated || result.restored ? (
          <Button variant="secondary" icon={Sparkles} onClick={onAnalyze}>
            Bekleyenleri AI ile Analiz Et
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onReset}>
          Yeni Dosya Yükle
        </Button>
      </div>
    </Card>
  )
}
