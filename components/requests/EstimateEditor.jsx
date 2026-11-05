'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { DIFFICULTIES } from '@/lib/constants'
import { formatHoursRange } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** Manuel zorluk ve süre değerleri AI analizinden bağımsız saklanır; yeni analiz bunları ezmez. */
export function EstimateEditor({ action, targetId, manual, ai, title = 'Tahmini düzenle' }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [difficulty, setDifficulty] = useState(manual.difficulty ?? '')
  const [min, setMin] = useState(manual.min ?? '')
  const [max, setMax] = useState(manual.max ?? '')
  const [error, setError] = useState(null)
  const [pending, startTransition] = useTransition()

  const save = (clear = false) => {
    const hoursMin = clear ? null : toNumber(min)
    const hoursMax = clear ? null : toNumber(max)
    if (Number.isNaN(hoursMin) || Number.isNaN(hoursMax)) {
      setError('Süre değerleri sayı olmalıdır.')
      return
    }
    startTransition(async () => {
      const res = await action({ id: targetId, difficulty: clear ? null : difficulty || null, hoursMin, hoursMax })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(clear ? 'Manuel tahmin kaldırıldı; AI tahmini kullanılacak.' : 'Tahmin güncellendi.')
      setOpen(false)
    })
  }

  const hasManual = manual.difficulty || manual.min !== null || manual.max !== null

  return (
    <>
      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setOpen(true)}>
        {hasManual ? 'Manuel tahmini düzenle' : 'Tahmini düzenle'}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description="Manuel değerler AI tahmininin yerine kullanılır ve yeni AI analizlerinde korunur."
        size="sm"
        busy={pending}
        footer={
          <>
            {hasManual ? (
              <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
                AI Tahminine Dön
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={() => save(false)} loading={pending}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            AI tahmini: {DIFFICULTIES[ai.difficulty]?.label ?? 'Yok'} · {formatHoursRange(ai.min, ai.max) ?? 'süre yok'}
          </p>
          <div>
            <Label htmlFor="est-difficulty">Zorluk</Label>
            <Select id="est-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">AI tahminini kullan</option>
              {['easy', 'medium', 'hard', 'very_hard'].map((key) => (
                <option key={key} value={key}>
                  {DIFFICULTIES[key].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="est-min">Min. saat</Label>
              <Input id="est-min" inputMode="decimal" value={min ?? ''} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="est-max">Maks. saat</Label>
              <Input id="est-max" inputMode="decimal" value={max ?? ''} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Modal>
    </>
  )
}
