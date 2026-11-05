'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import { apiRequest } from '@/lib/client-api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const AiJobContext = createContext(null)

function summarize(job) {
  const c = job?.counts ?? {}
  const finished = (c.done ?? 0) + (c.failed ?? 0) + (c.skipped ?? 0) + (c.needs_review ?? 0)
  return { finished, total: job?.total_count ?? 0, ...c }
}

/**
 * Toplu AI analizini sayfalar arasında sürdürür. İşlem durumu veritabanında tutulur;
 * sayfa yenilenirse aktif işlem bulunur ve kaldığı yerden devam eder.
 */
export function AiJobProvider({ children }) {
  const router = useRouter()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const runningRef = useRef(false)
  const lastRefreshRef = useRef(0)

  const runLoop = useCallback(
    async (initialJob) => {
      if (runningRef.current) return
      runningRef.current = true
      let current = initialJob
      let failures = 0
      try {
        while (current?.status === 'running') {
          try {
            const data = await apiRequest(`/api/ai/jobs/${current.id}`, { body: { action: 'process' } })
            current = data.job
            failures = 0
            setJob(current)
            if (Date.now() - lastRefreshRef.current > 8000) {
              lastRefreshRef.current = Date.now()
              router.refresh()
            }
          } catch (err) {
            failures += 1
            if (err.status === 401 || err.status === 404 || failures >= 3) {
              toast.error(err.message || 'Toplu analiz durduruldu.')
              break
            }
            await new Promise((r) => setTimeout(r, 3000 * failures))
          }
        }
        if (current && current.status !== 'running') {
          const s = summarize(current)
          if (current.status === 'completed') {
            toast.success(
              `Toplu analiz tamamlandı: ${s.done ?? 0} analiz edildi${s.failed ? `, ${s.failed} hatalı` : ''}${s.needs_review ? `, ${s.needs_review} inceleme bekliyor` : ''}.`
            )
          }
          router.refresh()
        }
      } finally {
        runningRef.current = false
      }
    },
    [router, toast]
  )

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/ai/jobs', { method: 'GET' })
      .then((data) => {
        if (!cancelled && data.job) {
          setJob(data.job)
          runLoop(data.job)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [runLoop])

  const startBulk = useCallback(
    async (requestIds) => {
      const data = await apiRequest('/api/ai/jobs', { body: requestIds ? { requestIds } : {} })
      if (!data.job) {
        toast.info(data.message || 'Analiz bekleyen istek bulunmuyor.')
        return
      }
      setDismissed(false)
      setJob(data.job)
      if (data.reused) toast.info('Devam eden bir toplu analiz var; o işlem sürdürülüyor.')
      runLoop(data.job)
    },
    [runLoop, toast]
  )

  const cancel = useCallback(async () => {
    if (!job) return
    try {
      const data = await apiRequest(`/api/ai/jobs/${job.id}`, { body: { action: 'cancel' } })
      setJob(data.job)
      toast.info('Toplu analiz durduruldu. Tamamlanan analizler korunur.')
    } catch (err) {
      toast.error(err.message)
    }
  }, [job, toast])

  const retry = useCallback(async () => {
    if (!job) return
    try {
      const data = await apiRequest(`/api/ai/jobs/${job.id}`, { body: { action: 'retry' } })
      setJob(data.job)
      setDismissed(false)
      runLoop(data.job)
    } catch (err) {
      toast.error(err.message)
    }
  }, [job, runLoop, toast])

  const isRunning = job?.status === 'running'

  return (
    <AiJobContext value={{ job, isRunning, startBulk }}>
      {children}
      {job && !dismissed ? <AiJobPanel job={job} onCancel={cancel} onRetry={retry} onDismiss={() => setDismissed(true)} /> : null}
    </AiJobContext>
  )
}

function AiJobPanel({ job, onCancel, onRetry, onDismiss }) {
  const s = summarize(job)
  const percent = s.total ? Math.round((s.finished / s.total) * 100) : 0
  const running = job.status === 'running'

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[calc(100%-2rem)] max-w-xs rounded-xl bg-white p-4 shadow-lg ring-1 ring-slate-200 lg:left-auto lg:right-6 lg:bottom-6 dark:bg-slate-900 dark:ring-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          {running ? (
            <Loader2 className="size-4 animate-spin text-indigo-500" aria-hidden />
          ) : (
            <Sparkles className="size-4 text-indigo-500" aria-hidden />
          )}
          {running ? 'Toplu AI analizi sürüyor' : job.status === 'cancelled' ? 'Toplu analiz durduruldu' : 'Toplu analiz tamamlandı'}
        </div>
        {!running ? (
          <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600" aria-label="Paneli kapat">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <dt>İlerleme</dt>
        <dd className="text-right font-medium text-slate-900 dark:text-white">
          {s.finished}/{s.total}
        </dd>
        <dt>Başarılı</dt>
        <dd className="text-right">{s.done ?? 0}</dd>
        {s.skipped ? (
          <>
            <dt>Zaten güncel</dt>
            <dd className="text-right">{s.skipped}</dd>
          </>
        ) : null}
        <dt>Hatalı</dt>
        <dd className="text-right">{s.failed ?? 0}</dd>
        {s.needs_review ? (
          <>
            <dt>İnceleme gerekli</dt>
            <dd className="text-right">{s.needs_review}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-3 flex justify-end gap-2">
        {running ? (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Durdur
          </Button>
        ) : s.failed ? (
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={onRetry}>
            Hatalıları Tekrar Dene
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function useAiJob() {
  const ctx = useContext(AiJobContext)
  if (!ctx) throw new Error('useAiJob, AiJobProvider içinde kullanılmalı.')
  return ctx
}
