'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAiJob } from './AiJobProvider'

export function BulkAnalyzeButton({ pendingCount, variant = 'secondary', size }) {
  const { startBulk, isRunning } = useAiJob()
  const toast = useToast()
  const [starting, setStarting] = useState(false)

  const onClick = async () => {
    setStarting(true)
    try {
      await startBulk()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Button variant={variant} size={size} icon={Sparkles} onClick={onClick} loading={starting} disabled={isRunning || pendingCount === 0}>
      {isRunning ? 'Toplu analiz sürüyor' : `Bekleyenleri Analiz Et${pendingCount ? ` (${pendingCount})` : ''}`}
    </Button>
  )
}
