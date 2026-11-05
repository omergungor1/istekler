import { Geist, Geist_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
})

export const metadata = {
  title: {
    default: 'Tıpplus İstek Yönetimi',
    template: '%s · Tıpplus İstek Yönetimi',
  },
  description: 'Tıpplus HBYS geliştirme isteklerini yapay zekâ desteğiyle yönetin.',
}

// Tema tercihi ilk boyamadan önce uygulanır; hidrasyon sonrası yanıp sönme olmaz.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
