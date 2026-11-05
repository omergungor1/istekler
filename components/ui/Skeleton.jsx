import { cn } from './cn'

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800', className)} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8" role="status" aria-label="Yükleniyor">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80" />
    </div>
  )
}
