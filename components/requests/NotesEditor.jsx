'use client'

import { useState, useTransition } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

/** `saveAction` bir Server Action'dır ve `{ id, notes }` alır. */
export function NotesEditor({ id, initialNotes, saveAction, label = 'Notlar', placeholder }) {
  const toast = useToast()
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const res = await saveAction({ id, notes })
      if (!res.ok) return toast.error(res.error)
      setSaved(notes)
      toast.success('Notlar kaydedildi.')
    })

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="notes">
        {label}
      </label>
      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} className="min-h-32" placeholder={placeholder} />
      <div className="mt-2 flex justify-end">
        <Button size="sm" icon={Save} onClick={save} loading={pending} disabled={notes === saved}>
          Notları Kaydet
        </Button>
      </div>
    </div>
  )
}
