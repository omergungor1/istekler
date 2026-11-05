'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createWorkItem } from '@/app/actions/work-items'
import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function CreateWorkItemButton() {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const res = await createWorkItem({ title, summary, category })
      if (!res.ok) return setError(res.error)
      toast.success('İş oluşturuldu.')
      setOpen(false)
      router.push(`/work-items/${res.id}`)
    })

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Yeni İş
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Yeni iş oluştur"
        busy={pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={submit} loading={pending} disabled={!title.trim()}>
              Oluştur
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-title">Başlık</Label>
            <Input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
          </div>
          <div>
            <Label htmlFor="new-category" hint="(isteğe bağlı)">
              Kategori
            </Label>
            <Input id="new-category" list="category-options" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} />
            <datalist id="category-options">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="new-summary" hint="(isteğe bağlı)">
              Özet
            </Label>
            <Textarea id="new-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Modal>
    </>
  )
}
