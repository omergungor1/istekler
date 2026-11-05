'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Play, RotateCcw, Trash2 } from 'lucide-react'
import { completeRequest, deleteRequest, reopenRequest, startRequest } from '@/app/actions/requests'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { AnalyzeButton } from '@/components/ai/AnalyzeButton'
import { CompleteRequestModal } from './CompleteRequestModal'

export function RequestActions({ request, analysisFresh }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [modal, setModal] = useState(null)

  const run = (action, successMessage, after) =>
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(successMessage)
      setModal(null)
      after?.()
    })

  const isCompleted = request.status === 'completed'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isCompleted ? <AnalyzeButton requestId={request.id} aiStatus={request.ai_status} analysisFresh={analysisFresh} /> : null}
      {request.status === 'open' ? (
        <Button variant="secondary" icon={Play} loading={pending && modal === null} onClick={() => run(() => startRequest(request.id), 'İstek "Devam Ediyor" durumuna alındı.')}>
          İşi Başlat
        </Button>
      ) : null}
      {!isCompleted ? (
        <Button variant="success" icon={CheckCircle2} onClick={() => setModal('complete')}>
          Tamamla
        </Button>
      ) : (
        <Button variant="secondary" icon={RotateCcw} onClick={() => setModal('reopen')}>
          Yeniden Aç
        </Button>
      )}
      <Button variant="ghost" icon={Trash2} onClick={() => setModal('delete')} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
        Sil
      </Button>

      <CompleteRequestModal
        open={modal === 'complete'}
        onClose={() => setModal(null)}
        title="İsteği Tamamla"
        subtitle={`#${request.external_no} — ${request.subject ?? ''}`}
        target={{ requestId: request.id }}
        onSubmit={async (values) => {
          const res = await completeRequest({ id: request.id, ...values })
          if (res.ok) {
            toast.success('İstek tamamlandı.')
            setModal(null)
          }
          return res
        }}
      />

      <ConfirmModal
        open={modal === 'reopen'}
        onClose={() => setModal(null)}
        busy={pending}
        title="İsteği yeniden aç"
        description="İstek tekrar açık duruma alınır. Önceki kapatma açıklaması işlem geçmişinde saklanır."
        confirmLabel="Yeniden Aç"
        onConfirm={() => run(() => reopenRequest(request.id), 'İstek yeniden açıldı.')}
      />

      <ConfirmModal
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        busy={pending}
        variant="danger"
        title="İsteği sil"
        description="İstek aktif listelerden ve istatistiklerden kaldırılır. Notları ve geçmişi korunur; aynı numara ileride Excel'de tekrar gelirse kayıt geri getirilir."
        confirmLabel="Sil"
        onConfirm={() =>
          run(() => deleteRequest(request.id), 'İstek silindi.', () => {
            router.push('/requests')
            router.refresh()
          })
        }
      />
    </div>
  )
}
