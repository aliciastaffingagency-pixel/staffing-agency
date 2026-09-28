import 'server-only'
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import { notify, notifyClient } from '@/lib/notify'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateTime } from '@/lib/utils'

export * from './contracts-shared'
import { readTerms } from './contracts-shared'

// ---------------------------------------------------------------------------
// State machine. Call after any signature or payment change:
//   sent → client_signed → fully_signed (both signed) → active (both signed + paid)
// Booking follows: matched → contracted (both signed) → active (paid).
// ---------------------------------------------------------------------------
export async function advanceContract(contractId: string) {
  const admin = createAdminClient()
  const { data: c } = await admin
    .from('contracts')
    .select('id, agency_id, status, amount_due, client_signed_at, admin_signed_at, pdf_url, booking_request_id, booking_requests(id, client_id, staff_id, status, clients(name), staff_profiles(full_name))')
    .eq('id', contractId)
    .single()
  if (!c || c.status === 'cancelled' || c.status === 'ended' || !c.booking_requests) return null

  const { data: payments } = await admin.from('payments').select('amount').eq('contract_id', c.id).eq('status', 'paid')
  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const fullyPaid = paid >= Number(c.amount_due ?? 0)

  let next = c.status
  if (c.client_signed_at && c.admin_signed_at) next = fullyPaid ? 'active' : 'fully_signed'
  else if (c.client_signed_at) next = 'client_signed'

  if (next !== c.status) {
    await admin.from('contracts').update({ status: next }).eq('id', c.id)
  }

  const booking = c.booking_requests
  if ((next === 'fully_signed' || next === 'active') && !c.pdf_url) {
    try {
      const path = await generateContractPdf(c.id)
      await admin.from('contracts').update({ pdf_url: path }).eq('id', c.id)
    } catch (e) {
      console.error('contract pdf failed', e)
    }
  }

  // Once the client has signed, the booking can no longer be cancelled by them.
  if (['client_signed', 'fully_signed'].includes(next) && (booking.status === 'pending' || booking.status === 'matched')) {
    await admin.from('booking_requests').update({ status: 'contracted' }).eq('id', booking.id)
  }
  if (next === 'active' && c.status !== 'active') {
    await admin.from('booking_requests').update({ status: 'active' }).eq('id', booking.id)
    if (booking.staff_id) await admin.from('staff_profiles').update({ availability: 'placed' }).eq('id', booking.staff_id)
    await notifyClient(booking.client_id, {
      agencyId: c.agency_id,
      type: 'booking_update',
      subject: 'Your placement is confirmed',
      message: 'All signed and paid. Your placement is now active. Thank you for choosing Alicia Staffing Agency!',
      link: `/account/bookings/${booking.id}`,
      sms: true,
    })
    await notify({
      agencyId: c.agency_id,
      role: 'super_admin',
      type: 'booking_update',
      message: `${booking.staff_profiles?.full_name ?? 'A staff member'}'s placement with ${booking.clients?.name ?? 'a client'} is now active (signed by both sides and paid).`,
      link: `/admin/bookings/${booking.id}`,
    })
  }
  return next
}

// ---------------------------------------------------------------------------
// PDF (pdf-lib, pure JS: works on serverless). Stored privately at
// contracts/<agency_id>/<client_id>/<contract_id>.pdf
// ---------------------------------------------------------------------------
const ascii = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, '')

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line)
        line = word
      } else line = test
    }
    lines.push(line)
  }
  return lines
}

export async function generateContractPdf(contractId: string) {
  const admin = createAdminClient()
  const { data: c, error } = await admin
    .from('contracts')
    .select('*, agencies(name, phone, email), booking_requests(client_id)')
    .eq('id', contractId)
    .single()
  if (error || !c || !c.booking_requests) throw new Error(`contract ${contractId} not found`)
  const terms = readTerms(c.terms_json)
  if (!terms) throw new Error('contract has no rendered terms')

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Placement agreement ${c.id.slice(0, 8)}`)
  pdf.setAuthor(c.agencies?.name ?? 'Alicia Staffing Agency')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const magenta = rgb(0.84, 0.12, 0.48)
  const navy = rgb(0.11, 0.12, 0.29)

  const W = 595.28
  const H = 841.89
  const M = 56
  let page = pdf.addPage([W, H])
  let y = H - M

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: magenta })
    page.drawText(ascii(c.agencies?.name ?? 'Alicia Staffing Agency'), { x: M, y: H - 40, size: 14, font: bold, color: magenta })
    page.drawText(ascii([c.agencies?.phone, c.agencies?.email].filter(Boolean).join('  |  ')), { x: M, y: H - 54, size: 8, font, color: navy })
    y = H - 84
  }
  const ensure = (h: number) => {
    if (y - h < M + 20) {
      page = pdf.addPage([W, H])
      header()
    }
  }
  header()

  for (const [i, line] of wrap(ascii(terms.body), font, 10, W - 2 * M).entries()) {
    const isHeading = /^[0-9]+\.\s+[A-Z ]+$/.test(line) || (i === 0 && line === line.toUpperCase())
    ensure(16)
    page.drawText(line, { x: M, y, size: isHeading ? 11 : 10, font: isHeading ? bold : font, color: navy })
    y -= isHeading ? 17 : 14
  }

  const sigBlock = (title: string, name: string | null, at: string | null, extra: string) => {
    ensure(70)
    y -= 12
    page.drawText(title, { x: M, y, size: 9, font: bold, color: magenta })
    y -= 16
    page.drawText(ascii(name ? `Signed: ${name}` : 'Not yet signed'), { x: M, y, size: 12, font: bold, color: navy })
    y -= 14
    if (at) page.drawText(ascii(`${formatDateTime(at)} (EAT)  ${extra}`), { x: M, y, size: 8, font, color: navy })
    y -= 10
  }
  y -= 8
  sigBlock('CLIENT', c.client_signature, c.client_signed_at, c.client_ip ? `IP ${c.client_ip}` : '')
  sigBlock('FOR THE AGENCY', c.admin_signature, c.admin_signed_at, '')

  const pages = pdf.getPages()
  pages.forEach((p, i) =>
    p.drawText(`Contract ${c.id}  -  page ${i + 1} of ${pages.length}`, { x: M, y: 28, size: 7, font, color: rgb(0.5, 0.52, 0.7) }),
  )

  const bytes = await pdf.save()
  const path = `${c.agency_id}/${c.booking_requests.client_id}/${c.id}.pdf`
  const { error: upErr } = await admin.storage.from('contracts').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (upErr) throw upErr
  return path
}
