'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { clearAiInputOverride, saveAiInputOverride } from '@/app/actions/requests'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

/**
 * Otomatik maskelemenin yetersiz kalabileceği metinler için kullanıcı, AI'ye gidecek
 * maskelenmiş açıklamayı görür, düzenler ve onaylar. Onaylanan metin kaynak değişene kadar kullanılır.
 */
export function MaskReviewPanel({ requestId, maskedText, risks, hasOverride, needsReview }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(needsReview)
  const [text, setText] = useState(maskedText)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const res = await saveAiInputOverride({ id: requestId, text })
      if (!res.ok) return toast.error(res.error)
      toast.success('Onaylanan metin kaydedildi. Şimdi analizi başlatabilirsiniz.')
      router.refresh()
    })

  const clear = () =>
    startTransition(async () => {
      const res = await clearAiInputOverride(requestId)
      if (!res.ok) return toast.error(res.error)
      toast.success('Otomatik maskelemeye dönüldü.')
      router.refresh()
    })

  return (
    <div
      className={
        needsReview
          ? 'rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/5'
          : 'rounded-xl border border-slate-200 p-4 dark:border-slate-800'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {needsReview ? (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          ) : (
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          )}
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {needsReview ? 'Kişisel veri incelemesi gerekli' : 'AI\'ye gönderilecek metin'}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {needsReview
                ? 'Otomatik maskeleme bu metindeki tüm kişisel verileri güvenle ayıklayamadı. Metin AI\'ye gönderilmedi.'
                : hasOverride
                  ? 'Sizin onayladığınız maskelenmiş metin kullanılıyor.'
                  : 'Açıklama, kişisel veriler maskelenerek gönderilir. Kullanıcı, takip eden ve cevap veren bilgileri hiç gönderilmez.'}
            </p>
            {risks.length ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-300">
                {risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Gizle' : 'Metni Göster'}
        </Button>
      </div>
      {open ? (
        <div className="mt-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-48 font-mono text-xs"
            aria-label="AI'ye gönderilecek maskelenmiş açıklama"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Hasta adı, numara veya kimliği belirlenebilir bilgileri [HASTA], [HASTA_NO] gibi etiketlerle değiştirin. Teknik problemi anlatan kısımları koruyun.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {hasOverride ? (
              <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
                Otomatik Maskelemeye Dön
              </Button>
            ) : null}
            <Button size="sm" icon={ShieldCheck} onClick={save} loading={pending} disabled={!text.trim()}>
              Metni Onayla
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
