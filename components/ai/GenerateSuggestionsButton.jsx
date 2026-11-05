'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { apiRequest } from '@/lib/client-api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export function GenerateSuggestionsButton({ analyzedCount }) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const data = await apiRequest('/api/ai/suggestions')
      if (data.created) toast.success(`${data.created} yeni gruplama önerisi oluşturuldu.`)
      else toast.info('Yeni bir gruplama önerisi bulunamadı.')
      router.refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">{analyzedCount} analiz edilmiş açık istek</span>
      <Button icon={Sparkles} loading={loading} onClick={run} disabled={analyzedCount < 2}>
        {loading ? 'Öneriler hazırlanıyor…' : 'Öneri Oluştur'}
      </Button>
    </div>
  )
}
