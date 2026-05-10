'use client'

import React from 'react'
import { motion } from 'framer-motion'

type RingColor = 'cyan' | 'green' | 'pink' | 'amber'

const PALETTE: Record<RingColor, { from: string; to: string; glow: string }> = {
  cyan:  { from: '#22d3ee', to: '#f472b6', glow: 'rgba(34,211,238,0.35)'  },
  green: { from: '#4ade80', to: '#22d3ee', glow: 'rgba(74,222,128,0.35)'  },
  pink:  { from: '#ec4899', to: '#22d3ee', glow: 'rgba(236,72,153,0.40)'  },
  amber: { from: '#fbbf24', to: '#f472b6', glow: 'rgba(251,191,36,0.35)'  },
}

interface ScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: RingColor
  label?: string
  sublabel?: string
  className?: string
}

export function ScoreRing({
  value,
  size = 120,
  strokeWidth = 9,
  color = 'cyan',
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const uid = React.useId().replace(/[^a-z0-9]/gi, '')
  const gradId = `sg-${uid}`
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100)
  const c = PALETTE[color]

  return (
    <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c.from} />
            <stop offset="100%" stopColor={c.to} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        {/* Progress */}
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ filter: `drop-shadow(0 0 7px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {label && (
          <span
            className="font-display font-light text-white leading-none tabular-nums"
            style={{ fontSize: size * 0.215 }}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span
            className="text-zinc-600 font-mono leading-none mt-0.5"
            style={{ fontSize: size * 0.085 }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
