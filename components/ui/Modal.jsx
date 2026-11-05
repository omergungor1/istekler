'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'
import { cn } from './cn'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/** Yerel <dialog> tabanlı erişilebilir modal: odak hapsi, Esc ile kapanma ve arka plan kilidi tarayıcıdan gelir. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', busy = false }) {
  const ref = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const requestClose = () => {
    if (!busy) onClose?.()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) requestClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 text-slate-900 shadow-2xl ring-1 ring-slate-200 backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px] dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800',
        SIZES[size]
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={requestClose} disabled={busy} aria-label="Kapat" className="-mr-1.5 px-1.5">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  variant = 'primary',
  busy = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      {children}
    </Modal>
  )
}
