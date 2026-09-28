'use client'

import dynamic from 'next/dynamic'
import type { DemandPoint } from './demand-map-inner'

const Inner = dynamic(() => import('./demand-map-inner'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-brand-50" />,
})

export function DemandMap({ center, points }: { center: [number, number]; points: DemandPoint[] }) {
  return <Inner center={center} points={points} />
}
