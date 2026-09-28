'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Uploads straight from the browser to Supabase Storage (storage RLS limits
// writes to the agency admin), then hands the stored path to the form through
// a hidden input. This keeps big files off the server action body limit.
export function FileUpload({
  label,
  name,
  bucket,
  folder,
  accept,
  maxMb,
  defaultValue,
  previewUrl,
  kind,
  hint,
}: {
  label: string
  name: string
  bucket: 'staff-photos' | 'staff-docs'
  folder: string // "<agency_id>/..." — must start with the agency id
  accept: string
  maxMb: number
  defaultValue?: string | null
  previewUrl?: string | null
  kind: 'image' | 'document'
  hint?: string
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [preview, setPreview] = useState(previewUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function onPick(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > maxMb * 1024 * 1024) return setError(`Keep files under ${maxMb} MB.`)
    setBusy(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      const path = `${folder}/${crypto.randomUUID()}.${ext}`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      if (bucket === 'staff-photos') {
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
        setValue(url)
        setPreview(url)
      } else {
        setValue(path)
        setPreview(kind === 'image' ? URL.createObjectURL(file) : null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1.5 flex items-center gap-4 rounded-2xl border border-dashed border-navy-100 bg-white p-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-400">
          {kind === 'image' && preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob / storage preview
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <FileText className="size-6" />
          )}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {value ? (
            <p className="truncate text-navy-600">{kind === 'image' ? 'Photo uploaded' : 'Document on file'}</p>
          ) : (
            <p className="text-navy-400">Nothing uploaded yet</p>
          )}
          {hint && <p className="text-xs text-navy-400">{hint}</p>}
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
        <div className="flex gap-1">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-navy-800 px-3.5 text-xs font-semibold text-white hover:bg-navy-700">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {value ? 'Replace' : 'Upload'}
            <input ref={input} type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => onPick(e.target.files?.[0])} />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setPreview(null)
              }}
              className="grid size-9 place-items-center rounded-full text-navy-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
