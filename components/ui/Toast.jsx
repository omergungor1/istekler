'use client'

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { cn } from './cn'

const ToastContext = createContext(null)

const ICONS = {
  success: { icon: CheckCircle2, className: 'text-emerald-500' },
  error: { icon: XCircle, className: 'text-red-500' },
  warning: { icon: TriangleAlert, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-indigo-500' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message, type = 'success', duration = 4000) => {
      counter.current += 1
      const id = counter.current
      setToasts((list) => [...list.slice(-3), { id, message, type }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  const api = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error', 6000),
      warning: (m) => show(m, 'warning', 6000),
      info: (m) => show(m, 'info'),
    }),
    [show]
  )

  return (
    <ToastContext value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => {
          const { icon: Icon, className } = ICONS[t.type] ?? ICONS.info
          return (
            <div
              key={t.id}
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3.5 text-sm shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
              <p className="flex-1 text-slate-700 dark:text-slate-200">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Bildirimi kapat"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı.')
  return ctx
}
