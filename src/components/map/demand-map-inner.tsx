'use client'

import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'

export type DemandPoint = { name: string; coords: [number, number]; requests: number; unmet: number }

// Circle area ∝ requests. Hover for the breakdown.
export default function DemandMapInner({ center, points }: { center: [number, number]; points: DemandPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.requests + p.unmet))
  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="size-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => {
        const total = p.requests + p.unmet
        return (
          <CircleMarker
            key={p.name}
            center={p.coords}
            radius={8 + Math.sqrt(total / max) * 22}
            pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#D61F7A', fillOpacity: 0.55 }}
          >
            <Tooltip direction="top">
              <strong>{p.name}</strong>
              <br />
              {p.requests} booking request{p.requests === 1 ? '' : 's'}
              {p.unmet > 0 && (
                <>
                  <br />
                  {p.unmet} search{p.unmet === 1 ? '' : 'es'} with no match
                </>
              )}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
