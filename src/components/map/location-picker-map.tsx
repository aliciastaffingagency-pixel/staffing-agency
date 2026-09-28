'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ point }: { point: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 })
  }, [map, point])
  return null
}

export default function LocationPickerMap({
  center,
  point,
  onPick,
}: {
  center: [number, number]
  point: [number, number] | null
  onPick: (lat: number, lng: number) => void
}) {
  return (
    <MapContainer center={point ?? center} zoom={point ? 13 : 11} scrollWheelZoom className="size-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FlyTo point={point} />
      {point && <CircleMarker center={point} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#D61F7A', fillOpacity: 1 }} />}
    </MapContainer>
  )
}
