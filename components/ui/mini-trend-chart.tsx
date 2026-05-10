'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface MiniTrendChartProps {
  data: number[]
  color?: string
  height?: number
}

export function MiniTrendChart({ data, color = '#22d3ee', height = 36 }: MiniTrendChartProps) {
  if (data.length < 2) return null
  const chartData = data.map((v, i) => ({ i, v }))
  const safeId = color.replace(/[^a-z0-9]/gi, '')

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`mtc-${safeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#mtc-${safeId})`}
          dot={false}
          isAnimationActive
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
