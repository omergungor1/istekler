'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Plus } from 'lucide-react'
import { addRequestsToWorkItem, createWorkItem } from '@/app/actions/work-items'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function LinkWorkItem({ request, workItems }) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState(null)
  const [title, setTitle] = useState('')
  const [workItemId, setWorkItemId] = useState('')
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const open = (next) => {
    setError(null)
    setTitle(request.subject ?? '')
    setWorkItemId(workItems[0]?.id ?? '')
    setMode(next)
  }

  const submit = () =>
    startTransition(async () => {
      const res =
        mode === 'new'
          ? await createWorkItem({ title, requestIds: [request.id] })
          : await addRequestsToWorkItem({ workItemId, requestIds: [request.id] })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(mode === 'new' ? 'Yeni iş oluşturuldu.' : 'İstek işe bağlandı.')
      setMode(null)
      if (mode === 'new' && res.id) router.push(`/work-items/${res.id}`)
    })

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => open('new')}>
          Bu İstekten İş Oluştur
        </Button>
        {workItems.length ? (
          <Button variant="secondary" size="sm" icon={Link2} onClick={() => open('existing')}>
            Mevcut İşe Bağla
          </Button>
        ) : null}
      </div>
      <Modal
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === 'new' ? 'Yeni iş oluştur' : 'Mevcut işe bağla'}
        size="sm"
        busy={pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={submit} loading={pending} disabled={mode === 'new' ? !title.trim() : !workItemId}>
              {mode === 'new' ? 'Oluştur' : 'Bağla'}
            </Button>
          </>
        }
      >
        {mode === 'new' ? (
          <div>
            <Label htmlFor="wi-title">İş başlığı</Label>
            <Input id="wi-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
            <p className="mt-1.5 text-xs text-slate-500">İsteğin AI tahmini ve kategorisi varsa işe aktarılır.</p>
          </div>
        ) : (
          <div>
            <Label htmlFor="wi-select">İş</Label>
            <Select id="wi-select" value={workItemId} onChange={(e) => setWorkItemId(e.target.value)}>
              {workItems.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <FieldError>{error}</FieldError>
      </Modal>
    </>
  )
}
