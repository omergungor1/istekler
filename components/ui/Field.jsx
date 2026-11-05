import { cn } from './cn'

const control =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:focus:ring-indigo-500 dark:disabled:bg-slate-800'

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {children}
      {hint ? <span className="ml-1 font-normal text-slate-400">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn(control, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(control, 'min-h-24 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(control, 'h-9 pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function FieldError({ children }) {
  if (!children) return null
  return (
    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
      {children}
    </p>
  )
}
