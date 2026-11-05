'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiRequest } from '@/lib/client-api'
import { Button } from '@/components/ui/Button'
import { FieldError, Label, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'

/**
 * Tamamlama modalı: kullanıcı yaptığı işlemi yazar, AI kısa kapatma açıklaması önerir,
 * kullanıcı metni düzenleyip onaylar. `onSubmit` sunucu işlemini gerçekleştirir.
 */
export function CompleteRequestModal({ open, onClose, title, subtitle, target, onSubmit, confirmLabel = 'Onayla ve Tamamla', children }) {
  const [workDone, setWorkDone] = useState('')
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    if (submitting) return
    setError(null)
    onClose()
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const data = await apiRequest('/api/ai/closing', { body: { ...target, workDone } })
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const res = await onSubmit({ closingMessage: message.trim(), workDone: workDone.trim() })
    setSubmitting(false)
    if (!res?.ok) {
      setError(res?.error ?? 'İşlem tamamlanamadı.')
      return
    }
    setWorkDone('')
    setMessage('')
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={subtitle}
      size="lg"
      busy={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Vazgeç
          </Button>
          <Button variant="success" onClick={submit} loading={submitting} disabled={generating}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        <div>
          <Label htmlFor="work-done" hint="(isteğe bağlı)">
            Bu istek için hangi işlemleri yaptınız?
          </Label>
          <Textarea
            id="work-done"
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            maxLength={4000}
            placeholder="Örn: SQL sorgusundaki tarih filtresini düzelttim."
          />
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" icon={Sparkles} onClick={generate} loading={generating} disabled={submitting}>
            Kapatma Açıklaması Oluştur
          </Button>
        </div>
        <div>
          <Label htmlFor="closing-message">Kapatma açıklaması</Label>
          <Textarea
            id="closing-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder="Kuruma iletilecek kısa açıklama. AI ile oluşturabilir veya kendiniz yazabilirsiniz."
          />
          <p className="mt-1.5 text-xs text-slate-500">
            AI yalnızca belirttiğiniz işlemleri ifade eder. Metni göndermeden önce kontrol edip düzenleyebilirsiniz.
          </p>
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Modal>
  )
}
