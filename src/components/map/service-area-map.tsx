'use client'

import dynamic from 'next/dynamic'

// Leaflet touches `window`, so it only loads in the browser.
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-brand-50" />,
})

export function ServiceAreaMap({ center }: { center: [number, number] }) {
  return <LeafletMap center={center} />
}
