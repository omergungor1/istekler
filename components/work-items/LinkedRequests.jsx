'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Plus, Scissors, Unlink } from 'lucide-react'
import { addRequestsToWorkItem, completeWorkItemRequests, removeRequestFromWorkItem, splitWorkItem } from '@/app/actions/work-items'
import { formatHoursRange } from '@/lib/format'
import { CompleteRequestModal } from '@/components/requests/CompleteRequestModal'
import { DifficultyBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldError, Input, Label } from '@/components/ui/Field'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

function Checkbox(props) {
  return <input type="checkbox" className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-600 dark:bg-slate-900" {...props} />
}

function AddRequestsModal({ open, onClose, workItemId, candidates }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    const list = term
      ? candidates.filter((c) =>
          [c.external_no, c.subject, c.institution_name, c.module_name].some((v) => v?.toLocaleLowerCase('tr').includes(term))
        )
      : candidates
    return list.slice(0, 200)
  }, [q, candidates])

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = () =>
    startTransition(async () => {
      const res = await addRequestsToWorkItem({ workItemId, requestIds: [...selected] })
      if (!res.ok) return setError(res.error)
      toast.success(`${res.added} istek işe eklendi.`)
      setSelected(new Set())
      onClose()
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="İşe istek ekle"
      description="Tamamlanmamış ve bu işe bağlı olmayan istekler listelenir."
      size="lg"
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={pending} disabled={selected.size === 0}>
            {selected.size} İsteği Ekle
          </Button>
        </>
      }
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="No, konu, kurum veya modül ara…" aria-label="İstek ara" />
      <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
        {filtered.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">Eşleşen istek yok.</li> : null}
        {filtered.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="mt-0.5 size-4" />
              <span className="min-w-0 text-sm">
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">#{c.external_no}</span>{' '}
                <span className="text-slate-900 dark:text-slate-100">{c.subject}</span>
                <span className="block text-xs text-slate-500">
                  {c.institution_name} · {c.module_name}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <FieldError>{error}</FieldError>
    </Modal>
  )
}

export function LinkedRequests({ workItem, requests, candidates }) {
  const router = useRouter()
  const toast = useToast()
  const [selected, setSelected] = useState(() => new Set())
  const [modal, setModal] = useState(null)
  const [splitTitle, setSplitTitle] = useState('')
  const [error, setError] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [pending, startTransition] = useTransition()

  const visibleIds = new Set(requests.map((r) => r.id))
  const selectedIds = [...selected].filter((id) => visibleIds.has(id))
  const selectedOpen = requests.filter((r) => selected.has(r.id) && r.status !== 'completed')
  const allSelected = requests.length > 0 && selectedIds.length === requests.length

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const split = () =>
    startTransition(async () => {
      const res = await splitWorkItem({ workItemId: workItem.id, title: splitTitle, requestIds: selectedIds })
      if (!res.ok) return setError(res.error)
      toast.success('Seçili istekler yeni işe taşındı.')
      setModal(null)
      setSelected(new Set())
      router.push(`/work-items/${res.id}`)
    })

  const remove = () =>
    startTransition(async () => {
      const res = await removeRequestFromWorkItem(workItem.id, removeTarget.id)
      if (!res.ok) return toast.error(res.error)
      toast.success('İstek işten çıkarıldı.')
      setRemoveTarget(null)
    })

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{selectedIds.length ? `${selectedIds.length} istek seçildi` : `${requests.length} bağlı istek`}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setModal('add')}>
            İstek Ekle
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Scissors}
            disabled={selectedIds.length === 0 || selectedIds.length === requests.length}
            onClick={() => {
              setSplitTitle('')
              setError(null)
              setModal('split')
            }}
            title="Seçili istekleri yeni bir işe taşır"
          >
            Ayrı İşe Böl
          </Button>
          <Button variant="success" size="sm" icon={CheckCircle2} disabled={selectedOpen.length === 0} onClick={() => setModal('complete')}>
            Seçilenleri Tamamla
          </Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="Bağlı istek yok" description="Bu işe istek ekleyerek başlayın." />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    aria-label="Tümünü seç"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(requests.map((r) => r.id)))}
                  />
                </th>
                <th className="px-3 py-2.5">İstek</th>
                <th className="px-3 py-2.5">Kurum</th>
                <th className="px-3 py-2.5">Durum</th>
                <th className="px-3 py-2.5">Tahmin</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-3">
                    <Checkbox aria-label={`#${r.external_no} seç`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="max-w-md px-3 py-3">
                    <Link href={`/requests/${encodeURIComponent(r.external_no)}`} className="hover:text-indigo-600">
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">#{r.external_no}</span>{' '}
                      <span className="text-slate-900 dark:text-slate-100">{r.subject}</span>
                    </Link>
                    <p className="text-xs text-slate-500">{r.module_name}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{r.institution_name}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-2">
                      <DifficultyBadge difficulty={r.manual_difficulty ?? r.ai_difficulty} manual={Boolean(r.manual_difficulty)} />
                      <span className="text-xs text-slate-500">
                        {formatHoursRange(r.manual_hours_min ?? r.ai_hours_min, r.manual_hours_max ?? r.ai_hours_max) ?? ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button variant="ghost" size="sm" icon={Unlink} onClick={() => setRemoveTarget(r)} aria-label={`#${r.external_no} işten çıkar`}>
                      Çıkar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        İş grubunun toplam süresi bağlı isteklerin süreleri toplanarak değil, iş seviyesindeki tahmin üzerinden hesaplanır.
      </p>

      <AddRequestsModal open={modal === 'add'} onClose={() => setModal(null)} workItemId={workItem.id} candidates={candidates} />

      <Modal
        open={modal === 'split'}
        onClose={() => setModal(null)}
        title="Seçili istekleri ayrı işe böl"
        description={`${selectedIds.length} istek bu işten çıkarılıp yeni bir işe bağlanacak.`}
        size="sm"
        busy={pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={split} loading={pending} disabled={!splitTitle.trim()}>
              Yeni İş Oluştur
            </Button>
          </>
        }
      >
        <Label htmlFor="split-title">Yeni iş başlığı</Label>
        <Input id="split-title" value={splitTitle} onChange={(e) => setSplitTitle(e.target.value)} maxLength={300} />
        <FieldError>{error}</FieldError>
      </Modal>

      <ConfirmModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        busy={pending}
        title="İsteği işten çıkar"
        description={removeTarget ? `#${removeTarget.external_no} bu işten çıkarılacak. İstek silinmez.` : ''}
        confirmLabel="Çıkar"
        onConfirm={remove}
      />

      <CompleteRequestModal
        open={modal === 'complete'}
        onClose={() => setModal(null)}
        title="Seçili istekleri tamamla"
        subtitle={`${selectedOpen.length} istek aynı kapatma açıklamasıyla tamamlanacak.`}
        target={{ workItemId: workItem.id }}
        confirmLabel={`${selectedOpen.length} İsteği Tamamla`}
        onSubmit={async ({ closingMessage }) => {
          const res = await completeWorkItemRequests({
            workItemId: workItem.id,
            requestIds: selectedOpen.map((r) => r.id),
            closingMessage,
          })
          if (res.ok) {
            toast.success(`${res.completed} istek tamamlandı.`)
            setSelected(new Set())
            setModal(null)
          }
          return res
        }}
      >
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          {selectedOpen.map((r) => (
            <li key={r.id}>
              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">#{r.external_no}</span> {r.subject}
            </li>
          ))}
        </ul>
      </CompleteRequestModal>
    </div>
  )
}
