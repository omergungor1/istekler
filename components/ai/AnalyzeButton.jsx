'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Sparkles } from 'lucide-react'
import { apiRequest } from '@/lib/client-api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export function AnalyzeButton({ requestId, aiStatus, analysisFresh, size, variant }) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const hasAnalysis = aiStatus === 'done' || aiStatus === 'stale'
  const label = aiStatus === 'stale' ? 'Analizi Güncelle' : hasAnalysis && analysisFresh ? 'Yeniden Analiz Et' : 'AI ile Analiz Et'

  const onClick = async () => {
    setLoading(true)
    try {
      const data = await apiRequest('/api/ai/analyze', {
        body: { requestId, force: hasAnalysis && analysisFresh },
      })
      if (data.status === 'needs_review') toast.warning('Metinde kişisel veri şüphesi var. AI Analizi sekmesinden maskelenmiş metni inceleyin.')
      else if (data.status === 'cached') toast.info('Analiz zaten güncel.')
      else toast.success('AI analizi tamamlandı.')
      router.refresh()
    } catch (err) {
      toast.error(err.message)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant ?? (hasAnalysis && analysisFresh ? 'secondary' : 'primary')}
      size={size}
      icon={hasAnalysis ? RefreshCw : Sparkles}
      loading={loading}
      disabled={aiStatus === 'processing'}
      onClick={onClick}
    >
      {loading ? 'Analiz ediliyor…' : label}
    </Button>
  )
}
