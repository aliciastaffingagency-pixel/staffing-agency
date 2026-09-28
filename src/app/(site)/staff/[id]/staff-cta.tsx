import { CalendarCheck } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'

export function StaffCta({ staffId, firstName, available }: { staffId: string; firstName: string; available: boolean }) {
  return (
    <ButtonLink href={`/book?staff=${staffId}`} size="lg" className="w-full">
      <CalendarCheck className="size-5" /> {available ? `Request ${firstName}` : `Join ${firstName}'s waiting list`}
    </ButtonLink>
  )
}
