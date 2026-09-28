import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { WhatsAppFab } from '@/components/site/whatsapp-fab'
import { getAgency, whatsappLink } from '@/lib/agency'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const agency = await getAgency()
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppFab href={whatsappLink(agency)} />
    </>
  )
}
