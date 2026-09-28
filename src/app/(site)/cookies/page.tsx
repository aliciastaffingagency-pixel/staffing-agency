import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { getLegalDetails, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'The cookies and similar technologies used on the Alicia Staffing Agency website and app.',
}
export const revalidate = 3600

export default async function CookiesPage() {
  const a = await getLegalDetails()
  return (
    <LegalPage
      title="Cookie Policy"
      updated={LEGAL_UPDATED}
      intro={
        <>
          We only use cookies that are needed to run the site: mainly to keep you signed in. We do not use advertising or
          tracking cookies. If we ever add analytics, we will ask for your permission first.
        </>
      }
    >
      <h2>What cookies are</h2>
      <p>
        Cookies are small text files a website stores in your browser. Similar technologies, like your browser’s local
        storage or the storage of our mobile app, work in a similar way.
      </p>

      <h2>What we use</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Type and duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>sb-…-auth-token</code></td>
            <td>Keeps you signed in and protects your account. Only set when you log in.</td>
            <td>Essential, first-party. Refreshed while you use the site; removed when you log out.</td>
          </tr>
          <tr>
            <td><code>alicia-cookie-notice</code></td>
            <td>Remembers that you have seen our cookie notice.</td>
            <td>Essential, stored in your browser (local storage) until you clear it.</td>
          </tr>
          <tr>
            <td>App storage</td>
            <td>The mobile app keeps your sign-in session on your device so you stay logged in.</td>
            <td>Essential; removed when you log out or uninstall the app.</td>
          </tr>
        </tbody>
      </table>

      <h2>Third-party content</h2>
      <ul>
        <li>Maps are loaded from OpenStreetMap; your browser connects to their servers to fetch map images.</li>
        <li>Staff introduction videos from YouTube are embedded in privacy-enhanced mode (youtube-nocookie.com).</li>
        <li>When you pay by card you are taken to Paystack, which sets its own cookies under its own policy.</li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser settings. If you block the essential sign-in cookie you will not
        be able to log in. See our <Link href="/privacy">Privacy Policy</Link> for more about how we use data, or email{' '}
        <a href={`mailto:${a.email}`}>{a.email}</a> with any questions.
      </p>
    </LegalPage>
  )
}
