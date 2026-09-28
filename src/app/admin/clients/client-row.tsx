'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { StatusPill } from '@/components/portal/portal-shell'
import { deleteClient } from './actions'

export function ClientRow({ client }: { client: { id: string; name: string; detail: string; meta: string; deleted: boolean } }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-3xl border border-brand-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy-800">{client.name}</p>
          <p className="truncate text-sm text-navy-500">{client.detail || '—'}</p>
          <p className="text-xs capitalize text-navy-400">{client.meta}</p>
        </div>
        {client.deleted ? (
          <StatusPill status="ended" />
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Delete account <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && !client.deleted && (
        <div className="mt-4">
          <ConfirmDelete
            action={deleteClient}
            id={client.id}
            phrase="DELETE"
            title={`Delete ${client.name}'s account`}
            button="Delete account"
            deletes={[
              'Their login, profile and contact details',
              'Open requests and unsigned contracts',
              'Messages, reviews, staff claims, job applications and callback requests',
              'Personal details stored in the activity log',
            ]}
            keeps={['Signed contracts and payment records (anonymised) for tax and legal retention']}
          />
        </div>
      )}
    </li>
  )
}
