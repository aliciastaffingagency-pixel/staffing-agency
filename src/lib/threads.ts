import type { Enums } from '@/lib/supabase/database.types'

export const THREAD_KIND: Record<Enums<'thread_kind'>, { label: string; client: string; hint: string }> = {
  general: { label: 'Message', client: 'Ask a question', hint: 'Anything you’d like to ask the agency.' },
  replacement: { label: 'Replacement request', client: 'Request a replacement', hint: 'Tell us why, and when you need the new person to start.' },
  dispute: { label: 'Issue / dispute', client: 'Report an issue', hint: 'Describe what happened. We’ll mediate privately.' },
  extension: { label: 'Extend contract', client: 'Extend the contract', hint: 'How long would you like to extend for?' },
  end_request: { label: 'End contract', client: 'End the contract', hint: 'When should it end, and why? Notice terms from your contract apply.' },
}

export const THREAD_KINDS = Object.keys(THREAD_KIND) as Enums<'thread_kind'>[]

// Which admin notification a new thread of this kind raises.
export const KIND_NOTIFICATION: Record<Enums<'thread_kind'>, Enums<'notification_type'>> = {
  general: 'new_message',
  replacement: 'replacement_requested',
  dispute: 'dispute_raised',
  extension: 'new_message',
  end_request: 'new_message',
}
