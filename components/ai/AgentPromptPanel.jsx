'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Pencil, RefreshCw, Save, Sparkles, Terminal } from 'lucide-react'
import { saveAgentPrompt } from '@/app/actions/prompts'
import { apiRequest } from '@/lib/client-api'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Field'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/**
 * Agent promptu görüntüleme, kopyalama, düzenleme ve yeniden oluşturma.
 * Düzenlenmiş prompt, kullanıcı açıkça onaylamadıkça AI tarafından ezilmez.
 */
export function AgentPromptPanel({ target, prompt, newerAnalysisAvailable = false, emptyHint }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(prompt?.content ?? '')
  const [generating, setGenerating] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [saving, startSaving] = useTransition()

  const generate = async ({ regenerate, overwriteEdited = false }) => {
    setGenerating(true)
    try {
      const data = await apiRequest('/api/ai/prompt', { body: { ...target, regenerate, overwriteEdited } })
      if (data.status === 'edited_conflict') {
        setConfirmOverwrite(true)
        return
      }
      if (data.status === 'needs_review') {
        toast.warning(data.risks?.[0] ?? 'Kişisel veri incelemesi gerekiyor.')
        return
      }
      setDraft(data.content)
      setEditing(false)
      setConfirmOverwrite(false)
      toast.success('Agent promptu oluşturuldu.')
      router.refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editing ? draft : prompt?.content ?? '')
      toast.success('Prompt panoya kopyalandı.')
    } catch {
      toast.error('Panoya kopyalanamadı. Tarayıcı izinlerini kontrol edin.')
    }
  }

  const save = () =>
    startSaving(async () => {
      const res = await saveAgentPrompt({ ...target, content: draft })
      if (!res.ok) return toast.error(res.error)
      toast.success('Prompt kaydedildi.')
      setEditing(false)
    })

  if (!prompt && !editing) {
    return (
      <EmptyState
        icon={Terminal}
        title="Henüz agent promptu yok"
        description={emptyHint ?? 'Kod geliştirme agentına verebileceğiniz ayrıntılı bir görev promptu oluşturun.'}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={Sparkles} loading={generating} onClick={() => generate({ regenerate: false })}>
              Agent İçin Prompt Oluştur
            </Button>
            <Button
              variant="secondary"
              icon={Pencil}
              onClick={() => {
                setDraft('')
                setEditing(true)
              }}
            >
              Kendim Yazacağım
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {prompt?.is_edited ? <Badge tone="amber">Düzenlendi</Badge> : prompt ? <Badge tone="indigo">AI tarafından oluşturuldu</Badge> : null}
          {prompt ? <span>Son güncelleme: {formatDateTime(prompt.updated_at)}</span> : null}
          {newerAnalysisAvailable ? <Badge tone="blue">Daha yeni bir analiz mevcut</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={copy}>
            Kopyala
          </Button>
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(prompt?.content ?? '')
                  setEditing(false)
                }}
                disabled={saving}
              >
                Vazgeç
              </Button>
              <Button size="sm" icon={Save} onClick={save} loading={saving} disabled={!draft.trim()}>
                Kaydet
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                Düzenle
              </Button>
              <Button variant="secondary" size="sm" icon={RefreshCw} loading={generating} onClick={() => generate({ regenerate: true })}>
                Yeniden Oluştur
              </Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[480px] font-mono text-xs"
          aria-label="Agent promptu"
        />
      ) : (
        <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-5 font-mono text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
          {prompt?.content}
        </pre>
      )}

      <ConfirmModal
        open={confirmOverwrite}
        onClose={() => setConfirmOverwrite(false)}
        busy={generating}
        variant="danger"
        title="Düzenlenmiş prompt değiştirilsin mi?"
        description="Bu promptu manuel olarak düzenlediniz. Yeniden oluşturursanız yaptığınız düzenlemeler kaybolur."
        confirmLabel="Yine de Yeniden Oluştur"
        onConfirm={() => generate({ regenerate: true, overwriteEdited: true })}
      />
    </div>
  )
}
