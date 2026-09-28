'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { AREA_NAMES, matchArea } from '@/lib/areas'

const LocationPickerMap = dynamic(() => import('./location-picker-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-brand-50" />,
})

// Area name + optional exact point. Typing a known area drops a pin there;
// clicking the map refines it. Public pages only ever show ~1 km precision.
export function LocationPicker({
  center,
  defaultText,
  defaultLat,
  defaultLng,
  textName = 'location_text',
  label = 'Area / neighbourhood',
}: {
  center: [number, number]
  defaultText?: string | null
  defaultLat?: number | null
  defaultLng?: number | null
  textName?: string
  label?: string
}) {
  const [text, setText] = useState(defaultText ?? '')
  const [point, setPoint] = useState<[number, number] | null>(defaultLat != null && defaultLng != null ? [defaultLat, defaultLng] : null)

  return (
    <div className="grid gap-2">
      <label className="block">
        <span className="text-sm font-semibold text-navy-700">{label}</span>
        <input
          name={textName}
          list="known-areas"
          value={text}
          maxLength={120}
          placeholder="e.g. Kilimani, Nairobi"
          onChange={(e) => {
            setText(e.target.value)
            const hit = matchArea(e.target.value)
            if (hit && !point) setPoint(hit.coords)
          }}
          className="mt-1.5 block h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-navy-800 outline-none transition placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        <datalist id="known-areas">
          {AREA_NAMES.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <input type="hidden" name="lat" value={point ? point[0].toFixed(6) : ''} />
      <input type="hidden" name="lng" value={point ? point[1].toFixed(6) : ''} />
      <div className="h-56 overflow-hidden rounded-2xl border border-navy-100">
        <LocationPickerMap center={center} point={point} onPick={(lat, lng) => setPoint([lat, lng])} />
      </div>
      <p className="flex items-center justify-between gap-2 text-xs text-navy-400">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          {point ? `Pinned at ${point[0].toFixed(4)}, ${point[1].toFixed(4)}` : 'Click the map to pin the exact spot (optional)'}
        </span>
        {point && (
          <button type="button" onClick={() => setPoint(null)} className="font-semibold text-brand-600 hover:underline">
            Clear pin
          </button>
        )}
      </p>
    </div>
  )
}
