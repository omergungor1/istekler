'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import { deleteWorkItem, setWorkItemStatus, updateWorkItem } from '@/app/actions/work-items'
import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Field'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

function toForm(item) {
  return {
    title: item.title ?? '',
    summary: item.summary ?? '',
    description: item.description ?? '',
    category: item.category ?? '',
    technicalNotes: item.technical_notes ?? '',
    acceptanceCriteria: (item.acceptance_criteria ?? []).join('\n'),
  }
}

export function WorkItemActions({ workItem }) {
  const router = useRouter()
  const toast = useToast()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(() => toForm(workItem))
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const changeStatus = (status, message) =>
    startTransition(async () => {
      const res = await setWorkItemStatus(workItem.id, status)
      if (!res.ok) return toast.error(res.error)
      toast.success(message)
    })

  const openEdit = () => {
    setForm(toForm(workItem))
    setError(null)
    setModal('edit')
  }

  const save = () =>
    startTransition(async () => {
      const res = await updateWorkItem({
        id: workItem.id,
        title: form.title,
        summary: form.summary,
        description: form.description,
        category: form.category,
        technicalNotes: form.technicalNotes,
        acceptanceCriteria: form.acceptanceCriteria
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      if (!res.ok) return setError(res.error)
      toast.success('İş güncellendi.')
      setModal(null)
    })

  const remove = () =>
    startTransition(async () => {
      const res = await deleteWorkItem(workItem.id)
      if (!res.ok) return toast.error(res.error)
      toast.success('İş silindi. Bağlı istekler korunur.')
      router.push('/work-items')
      router.refresh()
    })

  const field = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) })

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workItem.status === 'open' ? (
        <Button variant="secondary" icon={Play} loading={pending && !modal} onClick={() => changeStatus('in_progress', 'İş "Devam Ediyor" durumuna alındı.')}>
          İşi Başlat
        </Button>
      ) : null}
      {workItem.status !== 'completed' ? (
        <Button variant="success" icon={CheckCircle2} onClick={() => setModal('complete')}>
          İşi Tamamla
        </Button>
      ) : (
        <Button variant="secondary" icon={RotateCcw} loading={pending && !modal} onClick={() => changeStatus('open', 'İş yeniden açıldı.')}>
          Yeniden Aç
        </Button>
      )}
      <Button variant="secondary" icon={Pencil} onClick={openEdit}>
        Düzenle
      </Button>
      <Button variant="ghost" icon={Trash2} onClick={() => setModal('delete')} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
        Sil
      </Button>

      <ConfirmModal
        open={modal === 'complete'}
        onClose={() => setModal(null)}
        busy={pending}
        title="İşi tamamla"
        description="İş tamamlandı olarak işaretlenir. Bağlı isteklerin durumu otomatik değişmez; istekleri aşağıdaki listeden seçerek ayrıca tamamlayabilirsiniz."
        confirmLabel="Tamamla"
        variant="success"
        onConfirm={() => {
          setModal(null)
          changeStatus('completed', 'İş tamamlandı.')
        }}
      />

      <ConfirmModal
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        busy={pending}
        variant="danger"
        title="İşi sil"
        description="Yalnızca iş grubu silinir; bağlı istekler silinmez ve işlem geçmişlerine kayıt düşülür."
        confirmLabel="Sil"
        onConfirm={remove}
      />

      <Modal
        open={modal === 'edit'}
        onClose={() => setModal(null)}
        title="İşi düzenle"
        size="lg"
        busy={pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={save} loading={pending} disabled={!form.title.trim()}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="wi-edit-title">Başlık</Label>
            <Input id="wi-edit-title" maxLength={300} {...field('title')} />
          </div>
          <div>
            <Label htmlFor="wi-edit-category">Kategori</Label>
            <Input id="wi-edit-category" list="wi-category-options" maxLength={80} {...field('category')} />
            <datalist id="wi-category-options">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="wi-edit-summary">Özet</Label>
            <Textarea id="wi-edit-summary" maxLength={4000} {...field('summary')} />
          </div>
          <div>
            <Label htmlFor="wi-edit-description">Açıklama</Label>
            <Textarea id="wi-edit-description" maxLength={20000} className="min-h-32" {...field('description')} />
          </div>
          <div>
            <Label htmlFor="wi-edit-tech">Teknik notlar</Label>
            <Textarea id="wi-edit-tech" maxLength={20000} {...field('technicalNotes')} />
          </div>
          <div>
            <Label htmlFor="wi-edit-ac" hint="(her satıra bir kriter)">
              Kabul kriterleri
            </Label>
            <Textarea id="wi-edit-ac" className="min-h-28" {...field('acceptanceCriteria')} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Modal>
    </div>
  )
}
