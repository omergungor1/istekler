'use client'

import { useId, useState } from 'react'
import { cn } from './cn'

/** Paneller sunucuda oluşturulur; bu bileşen yalnızca görünür paneli seçer. */
export function Tabs({ tabs, defaultTab }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key)
  const baseId = useId()

  const onKeyDown = (e, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setActive(tabs[next].key)
    document.getElementById(`${baseId}-tab-${tabs[next].key}`)?.focus()
  }

  return (
    <div>
      <div className="flex flex-nowrap gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            id={`${baseId}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            aria-controls={`${baseId}-panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active === tab.key
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`${baseId}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          hidden={active !== tab.key}
          className="pt-5"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
