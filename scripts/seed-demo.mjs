// Demo data for presentations: vetted staff across roles, open vacancies, and a
// demo client with a pending request, an active placement and published reviews.
//
//   node scripts/seed-demo.mjs            # create (safe to re-run: replaces the previous demo set)
//   node scripts/seed-demo.mjs --remove   # delete everything this script created
//
// Everything is owned by the account demo-seed@aliciastaffing.test (staff/vacancies via
// created_by, bookings/reviews via the demo client), so removal never touches real data.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SEED_EMAIL = 'demo-seed@aliciastaffing.test'
const CLIENT_EMAIL = 'demo.client@aliciastaffing.test'
// New on every run and printed once: this repository is public, so no fixed password.
const CLIENT_PASSWORD = `Demo-${crypto.randomUUID().slice(0, 13)}`
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function findUser(email) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  return data.users.find((u) => u.email === email) ?? null
}

async function remove() {
  const seed = await findUser(SEED_EMAIL)
  const client = await findUser(CLIENT_EMAIL)
  if (client) {
    const clients = must(await db.from('clients').select('id').eq('user_id', client.id), 'clients')
    for (const c of clients) {
      const bookings = must(await db.from('booking_requests').select('id').eq('client_id', c.id), 'bookings')
      const ids = bookings.map((b) => b.id)
      if (ids.length) {
        const contracts = must(await db.from('contracts').select('id').in('booking_request_id', ids), 'contracts').map((x) => x.id)
        if (contracts.length) {
          must(await db.from('payments').delete().in('contract_id', contracts), 'payments')
          must(await db.from('ratings').delete().in('contract_id', contracts), 'ratings')
          must(await db.from('contracts').delete().in('id', contracts), 'contracts')
        }
      }
    }
    // Deleting a login keeps its client record (for signed contracts), so remove it explicitly.
    must(await db.from('clients').delete().eq('user_id', client.id), 'client rows') // cascades bookings, threads, reviews
    await db.auth.admin.deleteUser(client.id)
  }
  if (seed) {
    must(await db.from('vacancies').delete().eq('created_by', seed.id), 'vacancies')
    must(await db.from('staff_profiles').delete().eq('created_by', seed.id), 'staff')
    await db.auth.admin.deleteUser(seed.id)
  }
  console.log('Demo data removed.')
}

const STAFF = [
  ['Grace Wanjiru', 'nanny', 'Kilimani', 'live_in', 15000, 6, ['Childcare', 'Cooking', 'First aid'], ['English', 'Kiswahili', 'Kikuyu'], 'Warm, patient nanny who has cared for toddlers and twins for six years. Loves reading and outdoor play.'],
  ['Faith Akinyi', 'nanny', 'South B', 'live_out', 13000, 4, ['Childcare', 'Homework help'], ['English', 'Kiswahili', 'Luo'], 'Calm and organised; helps school-age children with homework and routines.'],
  ['Mercy Chebet', 'house-help', 'Kileleshwa', 'live_in', 12000, 5, ['Cleaning', 'Laundry', 'Cooking'], ['Kiswahili', 'English'], 'Thorough house help who keeps a spotless home and cooks simple family meals.'],
  ['Esther Mwende', 'house-help', 'Ruaka', 'either', 11000, 3, ['Cleaning', 'Ironing'], ['Kiswahili', 'Kamba'], 'Reliable and honest; previous employer kept her for three years.'],
  ['Joseph Kamau', 'cook-chef', 'Karen', 'live_out', 22000, 8, ['Continental cuisine', 'Baking', 'Meal prep'], ['English', 'Kiswahili'], 'Trained cook with hotel experience; plans weekly menus and cooks for special diets.'],
  ['Peter Otieno', 'driver', 'Westlands', 'live_out', 25000, 10, ['School runs', 'Defensive driving', 'Airport transfers'], ['English', 'Kiswahili'], 'Clean licence and ten years of family and corporate driving.'],
  ['Samuel Kiprono', 'security-guard', 'Kasarani', 'live_out', 18000, 7, ['Night patrol', 'Access control'], ['Kiswahili', 'Kalenjin'], 'Disciplined guard experienced with homes and small businesses.'],
  ['Mary Nyambura', 'caregiver', 'Lavington', 'live_in', 20000, 9, ['Elderly care', 'Medication reminders', 'Mobility support'], ['English', 'Kiswahili', 'Kikuyu'], 'Gentle caregiver trained in home-based care for elderly clients.'],
  ['John Mutua', 'gardener', 'Runda', 'live_out', 12000, 6, ['Lawn care', 'Planting', 'Compound cleaning'], ['Kiswahili', 'Kamba'], 'Keeps lawns and gardens neat; knows local plants and seasons.'],
  ['Lucy Wambui', 'laundry-ironing', 'Parklands', 'live_out', 900, 4, ['Ironing', 'Delicate fabrics'], ['Kiswahili', 'English'], 'Careful with delicate fabrics and school uniforms. Available by the day.'],
  ['Agnes Moraa', 'house-manager', 'Muthaiga', 'live_in', 35000, 12, ['Staff supervision', 'Budgeting', 'Event hosting'], ['English', 'Kiswahili'], 'Runs large households: supervises staff, manages supplies and budgets.'],
  ['Brian Omondi', 'shop-attendant', 'Nairobi CBD', 'live_out', 14000, 3, ['Sales', 'Cash handling', 'Stock taking'], ['English', 'Kiswahili'], 'Friendly and numerate; experienced in retail and M-Pesa till handling.'],
]

async function create() {
  await remove()
  const { data: agency } = await db.from('agencies').select('id').eq('slug', process.env.NEXT_PUBLIC_AGENCY_SLUG ?? 'alicia').single()
  const cats = must(await db.from('staff_categories').select('id, slug').eq('agency_id', agency.id), 'categories')
  const catId = (slug) => cats.find((c) => c.slug === slug)?.id

  const seed = must(await db.auth.admin.createUser({ email: SEED_EMAIL, password: crypto.randomUUID(), email_confirm: true, user_metadata: { full_name: 'Demo data', agency_slug: 'alicia' } }), 'seed user').user
  await db.from('clients').delete().eq('user_id', seed.id)

  // Staff + vetting checks (badges follow from the checks).
  const staff = must(
    await db
      .from('staff_profiles')
      .insert(
        STAFF.filter((s) => catId(s[1])).map(([full_name, slug, location_text, live_arrangement, rate, years_experience, skills, languages, bio]) => ({
          agency_id: agency.id,
          category_id: catId(slug),
          full_name,
          location_text,
          live_arrangement,
          month_rate: rate > 5000 ? rate : null,
          day_rate: rate <= 5000 ? rate : null,
          years_experience,
          skills,
          languages,
          bio,
          created_by: seed.id,
          publish_consent_at: new Date().toISOString(), // real staff: recorded when they agree to be listed
        })),
        { defaultToNull: false },
      )
      .select('id, full_name'),
    'staff',
  )
  const checks = staff.flatMap((s, i) =>
    ['id_verification', 'reference_check', 'background_check', ...(i % 3 === 0 ? [] : ['training'])].map((check_type) => ({
      agency_id: agency.id,
      staff_id: s.id,
      check_type,
      notes: 'Demo record',
      confirmed_by: seed.id,
    })),
  )
  must(await db.from('staff_vetting_checks').insert(checks), 'vetting checks')

  // Vacancies
  must(
    await db.from('vacancies').insert([
      { agency_id: agency.id, category_id: catId('nanny'), title: 'Live-in Nanny for two toddlers', description: 'Loving nanny for a family in Kilimani with two children aged 2 and 4. Sundays off.', requirements: 'At least 3 years of childcare experience. First aid a plus.', location_text: 'Kilimani, Nairobi', live_arrangement: 'live_in', pay_min: 14000, pay_max: 18000, required_documents: ['National ID', 'CV / Résumé', 'Certificate of good conduct'], status: 'open', published_at: new Date().toISOString(), created_by: seed.id },
      { agency_id: agency.id, category_id: catId('driver'), title: 'Family driver (school runs)', description: 'Punctual driver for school runs and errands in Karen, Monday to Friday.', location_text: 'Karen, Nairobi', employment_type: 'full_time', live_arrangement: 'live_out', pay_min: 22000, pay_max: 28000, required_documents: ['National ID', 'Driving licence', 'Certificate of good conduct'], status: 'open', published_at: new Date().toISOString(), created_by: seed.id },
    ], { defaultToNull: false }),
    'vacancies',
  )

  // Demo client with a pending request, an active placement and reviews.
  const clientUser = must(
    await db.auth.admin.createUser({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Wanjiku Demo', phone: '+254700111222', agency_slug: 'alicia', client_kind: 'household' } }),
    'demo client',
  ).user
  const client = must(await db.from('clients').update({ location_text: 'Kilimani, Nairobi' }).eq('user_id', clientUser.id).select('id').single(), 'client row')

  must(
    await db.from('booking_requests').insert({ agency_id: agency.id, client_id: client.id, category_id: catId('cook-chef'), status: 'pending', location_text: 'Kilimani', live_arrangement: 'live_out', budget: 22000, notes: 'Cook for a family of four, weekdays.' }),
    'pending booking',
  )

  // Six past placements spread over recent months: one still active, one that ended
  // inside its trial period, the rest completed after a few months.
  const DAY = 86400000
  const ago = (d) => new Date(Date.now() - d * DAY).toISOString()
  const TIMELINE = [
    { signed: 40, days: null }, // active
    { signed: 170, days: 95 },
    { signed: 130, days: 60 },
    { signed: 100, days: 10 }, // ended during the trial
    { signed: 80, days: 45 },
    { signed: 60, days: 30 },
  ]
  const comments = [
    'Grace is wonderful with our kids. Patient, kind and always on time.',
    'Very reliable and great with homework. Highly recommend.',
    'Spotless house every day and lovely food. Thank you Alicia!',
    'Honest and hardworking.',
    'Amazing meals, our guests always ask for his recipes.',
    'Safe, punctual driver. The school runs are stress-free now.',
  ]
  const reviewed = staff.slice(0, 6)
  for (const [i, s] of reviewed.entries()) {
    const t = TIMELINE[i]
    const start = t.signed - 3
    const endedAgo = t.days == null ? null : start - t.days
    const { data: sp } = await db.from('staff_profiles').select('category_id').eq('id', s.id).single()
    const booking = must(
      await db
        .from('booking_requests')
        .insert({ agency_id: agency.id, client_id: client.id, staff_id: s.id, category_id: sp.category_id, status: t.days == null ? 'active' : 'completed', location_text: 'Kilimani', created_at: ago(t.signed + 5) })
        .select('id')
        .single(),
      'placement',
    )
    const contract = must(
      await db
        .from('contracts')
        .insert({
          agency_id: agency.id,
          booking_request_id: booking.id,
          status: t.days == null ? 'active' : 'ended',
          amount_due: 5000,
          rate: 15000,
          rate_period: 'month',
          starts_on: ago(start).slice(0, 10),
          terms_json: { body: 'STAFF PLACEMENT AGREEMENT\n\nDemo contract.', values: {}, defaults: {} },
          client_signature: 'Wanjiku Demo',
          client_signed_at: ago(t.signed),
          admin_signature: 'Alicia',
          admin_signed_at: ago(t.signed - 1),
          ended_at: endedAgo == null ? null : ago(endedAgo),
          end_reason: endedAgo == null ? null : t.days <= 14 ? 'Did not suit the household (trial)' : 'Contract finished',
          created_at: ago(t.signed + 1),
        })
        .select('id')
        .single(),
      'contract',
    )
    must(await db.from('payments').insert({ agency_id: agency.id, contract_id: contract.id, amount: 5000, method: 'mpesa', mpesa_receipt: `DEMO${i}${Date.now().toString(36).toUpperCase()}`.slice(0, 20), status: 'paid', paid_at: ago(t.signed - 1), created_at: ago(t.signed - 1) }), 'payment')
    must(await db.from('ratings').insert({ agency_id: agency.id, contract_id: contract.id, client_id: client.id, staff_id: s.id, stars: i === 3 ? 4 : 5, comment: comments[i], is_published: true, moderated_at: new Date().toISOString(), created_at: ago(endedAgo ?? 7) }), 'rating')
  }
  await db.from('staff_profiles').update({ availability: 'placed' }).eq('id', reviewed[0].id)

  console.log(`Demo data created: ${staff.length} staff, 2 vacancies, 1 demo client.`)
  console.log(`Demo client login: ${CLIENT_EMAIL} / ${CLIENT_PASSWORD}`)
}

if (process.argv.includes('--remove')) await remove()
else await create()
