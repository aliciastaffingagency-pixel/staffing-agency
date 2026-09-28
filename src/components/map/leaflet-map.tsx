'use client'

import 'leaflet/dist/leaflet.css'
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'

export default function LeafletMap({ center }: { center: [number, number] }) {
  return (
    <MapContainer
      center={center}
      zoom={10}
      scrollWheelZoom={false}
      className="size-full"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle center={center} radius={28000} pathOptions={{ color: '#D61F7A', weight: 1.5, fillColor: '#D61F7A', fillOpacity: 0.1 }} />
      <CircleMarker center={center} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#D61F7A', fillOpacity: 1 }}>
        <Tooltip direction="top" offset={[0, -8]} permanent>
          Alicia Staffing Agency
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}
