import { FileSignature } from 'lucide-react'
import { readTerms } from '@/lib/contracts-shared'
import type { Json } from '@/lib/supabase/database.types'
import { formatDateTime } from '@/lib/utils'

type Props = {
  terms: Json
  clientSignature: string | null
  clientSignedAt: string | null
  adminSignature: string | null
  adminSignedAt: string | null
  showIp?: string | null
}

// The rendered contract text plus both signature blocks.
export function ContractDocument({ terms, clientSignature, clientSignedAt, adminSignature, adminSignedAt, showIp }: Props) {
  const t = readTerms(terms)
  if (!t) return <p className="text-sm text-navy-500">Contract text unavailable.</p>
  const lines = t.body.split('\n')

  return (
    <article className="rounded-3xl border border-navy-100 bg-white p-6 sm:p-10">
      <div className="max-h-[32rem] overflow-y-auto pr-2 text-[0.95rem] leading-relaxed text-navy-700">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-3" />
          if (i === 0) return <h2 key={i} className="mb-4 text-center text-lg font-extrabold tracking-wide text-navy-800">{line}</h2>
          if (/^\d+\.\s+[A-Z ]+$/.test(line)) return <h3 key={i} className="mt-2 font-bold text-navy-800">{line}</h3>
          return <p key={i}>{line}</p>
        })}
      </div>
      <div className="mt-8 grid gap-4 border-t border-dashed border-navy-100 pt-6 sm:grid-cols-2">
        <Signature title="Client" name={clientSignature} at={clientSignedAt} extra={showIp ? `IP ${showIp}` : null} />
        <Signature title="For the agency" name={adminSignature} at={adminSignedAt} />
      </div>
    </article>
  )
}

function Signature({ title, name, at, extra }: { title: string; name: string | null; at: string | null; extra?: string | null }) {
  return (
    <div className="rounded-2xl bg-blush p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{title}</p>
      {name ? (
        <>
          <p className="mt-1 font-script text-3xl text-navy-800">{name}</p>
          <p className="text-xs text-navy-400">
            {formatDateTime(at)}
            {extra && ` · ${extra}`}
          </p>
        </>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-400">
          <FileSignature className="size-4" /> Not signed yet
        </p>
      )}
    </div>
  )
}
