'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label } from '@/components/ui/Field'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(signIn, null)

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={searchParams.get('next') ?? ''} />
      <div>
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Şifre</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" className="w-full" size="lg" loading={pending} icon={LogIn}>
        Giriş Yap
      </Button>
    </form>
  )
}
