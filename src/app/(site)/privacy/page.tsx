import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { getLegalDetails, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Alicia Staffing Agency collects, uses, shares and protects personal data, and your rights under the Kenya Data Protection Act, 2019.',
}
export const revalidate = 3600

export default async function PrivacyPage() {
  const a = await getLegalDetails()
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro={
        <>
          This policy explains how {a.name} (“we”, “us”) handles personal data when you use our website, mobile app
          (“Alicia Staffing”), phone or WhatsApp services, as a client, a job applicant, a member of our staff or a
          visitor. We follow the Kenya Data Protection Act, 2019 and its regulations.
        </>
      }
    >
      <h2 id="who">1. Who we are</h2>
      <p>
        {a.name} is the data controller for the personal data described here. Address: {a.address}. Email:{' '}
        <a href={`mailto:${a.email}`}>{a.email}</a>. Phone and WhatsApp: {a.phone}.
        {a.odpc && <> We are registered with the Office of the Data Protection Commissioner (registration no. {a.odpc}).</>}
      </p>

      <h2 id="collect">2. What we collect</h2>
      <h3>Clients (households and businesses)</h3>
      <ul>
        <li>Name, phone number, email address, whether you hire for a home or a business, and your area.</li>
        <li>Details of the help you need: role, start date, live-in or live-out, budget, and notes you choose to share about your household or work (for example, children’s ages when you need a nanny).</li>
        <li>Contracts you sign: the terms, your typed signature, the date, time and IP address of signing.</li>
        <li>Payments: amount, method, your M-Pesa number and receipt number. Card payments are handled by Paystack; we never see or store your card number.</li>
        <li>Messages you send us, reviews you write, requests (replacement, issue, extension, ending a contract) and details you give about staff who already work for you.</li>
      </ul>
      <h3>Job applicants and staff</h3>
      <ul>
        <li>Name, phone, email, area, optional date of birth, experience, skills, languages, the terms and pay you would prefer, and what you tell us about yourself.</li>
        <li>Documents you upload, such as your national ID, CV, certificate of good conduct, references, training or medical certificates and driving licence.</li>
        <li>Vetting results we record: ID verification, reference and background checks, and training completed.</li>
        <li>For staff we place: your profile photo, profile details, availability, rates, placements and client reviews.</li>
      </ul>
      <p>
        A certificate of good conduct and background checks involve information about criminal records, and ID documents
        carry identity numbers. We treat these as sensitive, use them only to vet you with your consent, keep them in
        private storage that only authorised agency staff can open, and never publish them.
      </p>
      <h3>Everyone who uses our website or app</h3>
      <ul>
        <li>What you type into Smart match or our website chat assistant, and callback details you choose to leave (name, phone, what you need).</li>
        <li>Technical data needed to run the service securely: IP address, browser and device type, and sign-in session cookies (see our <Link href="/cookies">Cookie Policy</Link>). The mobile app also stores a push-notification token for your device.</li>
      </ul>

      <h2 id="use">3. How we use it, and our legal bases</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Creating your account, matching you with staff or work, preparing and signing contracts, taking payments, sending you updates</td>
            <td>Performing a contract with you, or steps you ask us to take before one</td>
          </tr>
          <tr>
            <td>Vetting applicants and staff (ID, references, background checks, training)</td>
            <td>Your consent, given when you apply, and our legitimate interest in placing trustworthy staff in clients’ homes</td>
          </tr>
          <tr>
            <td>Publishing a staff profile (name, photo, area, skills, rates, badges, reviews)</td>
            <td>The staff member’s consent, recorded before the profile goes live</td>
          </tr>
          <tr>
            <td>Keeping contracts, invoices and payment records</td>
            <td>Legal obligations, including Kenyan tax law</td>
          </tr>
          <tr>
            <td>Security, fraud prevention, rate-limiting and keeping an activity log of changes</td>
            <td>Our legitimate interests in protecting you, our staff and the service</td>
          </tr>
          <tr>
            <td>Answering questions, callbacks and improving our service (for example, learning which roles are in demand)</td>
            <td>Our legitimate interests; we use search logs in aggregate</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not sell personal data and we do not use it for advertising. Smart match and the chat assistant suggest
        staff or answer questions automatically, but people at the agency make every decision about placements,
        contracts and applications. You may ask for any automated suggestion to be reviewed by a person.
      </p>

      <h2 id="share">4. Who we share it with</h2>
      <ul>
        <li><strong>Clients</strong> see a staff member’s public profile only: name, photo, approximate area (about 1 km), skills, languages, experience, rates, badges and reviews. Never ID documents or contact details.</li>
        <li><strong>Staff</strong> placed with you see your name and area for their placements.</li>
        <li>
          <strong>Service providers</strong> who process data for us under contract and only on our instructions:
          Supabase (database, sign-in and file storage, hosted in the EU), Vercel (website hosting), Safaricom M-Pesa and
          Paystack (payments), Resend (email), Africa’s Talking (SMS), Expo (mobile push notifications, delivered through
          Google Firebase Cloud Messaging on Android and Apple Push Notification service on iPhone) and, when our AI
          features are switched on, Anthropic (Smart match and the chat assistant). Map tiles are loaded from
          OpenStreetMap.
        </li>
        <li><strong>Authorities</strong> when the law requires it, or to protect someone’s safety.</li>
      </ul>

      <h2 id="transfers">5. Storage outside Kenya</h2>
      <p>
        Some of our providers store or process data outside Kenya, mainly in the European Union and the United States.
        We only use providers that protect data with contractual safeguards, encryption in transit and at rest, and
        access controls, as the Act requires for transfers outside Kenya.
      </p>

      <h2 id="retention">6. How long we keep it</h2>
      <ul>
        <li>Client accounts: until you delete your account or ask us to.</li>
        <li>Signed contracts, invoices and payment records: for at least five years after the end of the placement, as Kenyan tax law requires. If you delete your account we anonymise the client record attached to them.</li>
        <li>Job applications and their documents: up to 12 months after your last contact with us, unless you join our staff. You can ask us to delete them sooner.</li>
        <li>Staff records: while you work through us, and up to 12 months after, then deleted unless the law requires us to keep something longer.</li>
        <li>Chat transcripts, callback requests and search logs: up to 12 months.</li>
        <li>Activity logs: kept for security, but personal details in them are removed when the person is deleted.</li>
      </ul>

      <h2 id="rights">7. Your rights</h2>
      <p>Under the Kenya Data Protection Act you have the right to:</p>
      <ul>
        <li>be told how your data is used (this policy);</li>
        <li>access your data: clients can download a copy any time from <Link href="/account/settings">Account settings</Link>;</li>
        <li>have inaccurate data corrected;</li>
        <li>have your data deleted: see <Link href="/delete-account">Delete your account</Link>;</li>
        <li>object to processing, including processing based on our legitimate interests;</li>
        <li>data portability: your data export is in a common machine-readable format (JSON);</li>
        <li>withdraw consent at any time (for example, to having your staff profile published), without affecting what was done before;</li>
        <li>not be subject to a decision based solely on automated processing.</li>
      </ul>
      <p>
        To use any right, email <a href={`mailto:${a.email}`}>{a.email}</a> or message us on WhatsApp. We may need to
        confirm your identity and will respond within the time limits set by the Act and its regulations. If you are not
        happy with our answer, you can complain to the Office of the Data Protection Commissioner (
        <a href="https://www.odpc.go.ke" target="_blank" rel="noopener">odpc.go.ke</a>).
      </p>

      <h2 id="security">8. How we protect it</h2>
      <ul>
        <li>All connections use encryption (HTTPS/TLS).</li>
        <li>Database rules make sure each person can only reach their own records; clients can never see other clients’ contracts or payments, and staff can never see each other’s pay.</li>
        <li>ID and vetting documents, applications and contracts are kept in private storage, opened only through short-lived secure links.</li>
        <li>Every change to important records is logged, and only the agency owner can see that log.</li>
      </ul>

      <h2 id="children">9. Children</h2>
      <p>
        Our services are for adults aged 18 and over. We do not knowingly collect data directly from children. Where a
        client tells us about their children to find the right nanny or caregiver, we use it only for that purpose.
      </p>

      <h2 id="changes">10. Changes to this policy</h2>
      <p>
        We will update this page when our practices change and show the new date at the top. If a change affects you in
        an important way, we will tell you by email, SMS or in your account.
      </p>

      <h2 id="contact">11. Contact</h2>
      <p>
        {a.name}, {a.address}. Email <a href={`mailto:${a.email}`}>{a.email}</a>, phone or WhatsApp {a.phone}.
      </p>
    </LegalPage>
  )
}
