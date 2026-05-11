'use client'

import dynamic from 'next/dynamic'

const BrainGraph = dynamic(() => import('./BrainGraph'), { ssr: false })

export default function BrainGraphLoader() {
  return <BrainGraph />
}
