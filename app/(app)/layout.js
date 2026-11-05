import { Suspense } from 'react'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarUser, SidebarUserSkeleton } from '@/components/layout/SidebarUser'
import { AiJobProvider } from '@/components/ai/AiJobProvider'

export default function AppLayout({ children }) {
  return (
    <AiJobProvider>
      <div className="lg:flex">
        <AppSidebar
          userSlot={
            <Suspense fallback={<SidebarUserSkeleton />}>
              <SidebarUser />
            </Suspense>
          }
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AiJobProvider>
  )
}
