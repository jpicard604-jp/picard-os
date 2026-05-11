'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  buildAllDailyPoints, buildMonthlyPoints, sliceDays,
} from '@/lib/trends'
import type { TrendWindow, DailyTrendPoint, MonthlyTrendPoint } from '@/lib/trends'

type AnyPoint = Record<string, unknown>

const WINDOWS: Array<{ id: TrendWindow; label: string }> = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]

const COLORS = {
  recovery:  '#22d3ee',
  hrv:       '#34d399',
  restingHR: '#f87171',
  strain:    '#f472b6',
  sleep:     '#a78bfa',
  weight:    '#f59e0b',
  steps:     '#4ade80',
  workouts:  '#fb923c',
} as const

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: unknown
  name: string
  color: string
  dataKey: string
}

function DarkTooltip({
  active,
  payload,
  label,
  fmt,
  sourceTag,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  fmt?: (v: number) => string
  sourceTag?: 'WHOOP' | 'Manual' | 'Mixed' | null
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value !== null && p.value !== undefined)
  if (!items.length) return null

  // Sort: daily series before rolling-avg series
  const ordered = [...items].sort((a, b) => {
    const aAvg = a.dataKey?.startsWith('avg') ? 1 : 0
    const bAvg = b.dataKey?.startsWith('avg') ? 1 : 0
    return aAvg - bAvg
  })

  function rowLabel(key: string): string {
    return key.startsWith('avg7') ? '7-day avg' : 'Day'
  }

  function format(v: unknown): string {
    if (typeof v !== 'number') return '—'
    if (fmt) return fmt(v)
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
  }

  return (
    <div className="bg-[#161616] border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-left min-w-[120px]">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
        {sourceTag && (
          <span
            className={`text-[8px] font-mono ${
              sourceTag === 'WHOOP' ? 'text-cyan-500'
              : sourceTag === 'Mixed' ? 'text-zinc-500'
              : 'text-zinc-600'
            }`}
          >
            {sourceTag}
          </span>
        )}
      </div>
      {ordered.map(p => (
        <div key={p.dataKey} className="flex items-baseline justify-between gap-3 leading-tight py-0.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">
            {rowLabel(p.dataKey)}
          </span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: p.color, opacity: p.dataKey.startsWith('avg') ? 0.7 : 1 }}>
            {format(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Source tag ───────────────────────────────────────────────────────────────
// Heuristic: if a day has recovery data it was WHOOP-synced (recovery only
// populates via WHOOP sync or deliberate manual entry).

function computeSource(
  chartData: AnyPoint[],
  metricKey: string,
): 'WHOOP' | 'Manual' | 'Mixed' | null {
  const nonNull = chartData.filter(p => p[metricKey] !== null && p[metricKey] !== undefined)
  if (nonNull.length === 0) return null
  const whoopDays = nonNull.filter(p => p.recovery !== null && p.recovery !== undefined).length
  if (whoopDays === 0) return 'Manual'
  if (whoopDays === nonNull.length) return 'WHOOP'
  return 'Mixed'
}

// ─── ChartCard ────────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string
  unit: string
  color: string
  data: AnyPoint[]
  dataKey: string
  avgKey?: string
  domain: [number | string, number | string]
  yTickFmt?: (v: number) => string
  tooltipFmt?: (v: number) => string
  isBar?: boolean
  xInterval: number
  sourceTag?: 'WHOOP' | 'Manual' | 'Mixed' | null
  loading?: boolean
}

function ChartCard({
  title, unit, color, data, dataKey, avgKey, domain,
  yTickFmt, tooltipFmt, isBar, xInterval, sourceTag, loading,
}: ChartCardProps) {
  const vals = data.map(p => p[dataKey] as number | null)
  const lastVal = [...vals].reverse().find(v => v !== null && v !== undefined) ?? null
  const hasData = vals.some(v =>
    v !== null && v !== undefined && (dataKey === 'workouts' ? (v as number) > 0 : true)
  )

  const fmt = tooltipFmt ?? (yTickFmt ? (v: number) => yTickFmt(v) : null)
  const displayVal = lastVal !== null
    ? fmt ? fmt(lastVal) : `${lastVal}${unit}`
    : '—'

  const sourceStyle =
    sourceTag === 'WHOOP'  ? 'text-cyan-700' :
    sourceTag === 'Mixed'  ? 'text-zinc-600' :
    sourceTag === 'Manual' ? 'text-zinc-700' : ''

  return (
    <div className="rounded-2xl bg-[#111] border border-white/[0.07] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">{title}</span>
          {sourceTag && (
            <span className={`text-[8px] font-mono ${sourceStyle}`}>{sourceTag}</span>
          )}
        </div>
        <span className="text-lg font-mono font-bold" style={{ color }}>
          {displayVal}
        </span>
      </div>

      {loading ? (
        <div className="h-[140px] flex items-center justify-center">
          <div className="w-32 h-px bg-zinc-800 rounded-full animate-pulse" />
        </div>
      ) : hasData ? (
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            {isBar ? (
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  domain={domain}
                  allowDecimals={false}
                />
                <Tooltip content={<DarkTooltip fmt={tooltipFmt} sourceTag={sourceTag} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  domain={domain}
                  tickFormatter={yTickFmt}
                />
                <Tooltip content={<DarkTooltip fmt={tooltipFmt} sourceTag={sourceTag} />} />
                {avgKey && (
                  <Line
                    type="monotone"
                    dataKey={avgKey}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                    strokeOpacity={0.4}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[140px] flex items-center justify-center">
          <p className="text-[10px] font-mono text-zinc-700">No data — log metrics or sync WHOOP</p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [viewWindow, setViewWindow] = useState<TrendWindow>('7d')
  const [allDaily, setAllDaily] = useState<DailyTrendPoint[]>([])
  const [monthly12, setMonthly12] = useState<MonthlyTrendPoint[]>([])
  const [monthly24, setMonthly24] = useState<MonthlyTrendPoint[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setAllDaily(buildAllDailyPoints())
    setMonthly12(buildMonthlyPoints(12))
    setMonthly24(buildMonthlyPoints(24))
    setIsLoaded(true)
  }, [])

  const isDaily = viewWindow === '7d' || viewWindow === '30d'

  const chartData = (isDaily
    ? sliceDays(allDaily, viewWindow === '7d' ? 7 : 30)
    : viewWindow === 'monthly' ? monthly12 : monthly24
  ) as unknown as AnyPoint[]

  const xInterval =
    viewWindow === '7d'       ? 0 :
    viewWindow === '30d'      ? 6 :
    viewWindow === 'monthly'  ? 1 : 3

  // Value formatters — used in both card header and tooltip
  const pctFmt    = (v: number) => `${Math.round(v)}%`
  const hrvFmt    = (v: number) => `${Math.round(v)}ms`
  const bpmFmt    = (v: number) => `${Math.round(v)} bpm`
  const strainFmt = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}/21`
  const hrFmt     = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}h`
  const lbFmt     = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} lb`
  const stepsFmt  = (v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`

  type MetricDef = Omit<ChartCardProps, 'data' | 'loading'>
  const metrics: MetricDef[] = [
    {
      title: 'Recovery', unit: '%', color: COLORS.recovery,
      dataKey: 'recovery',
      avgKey: isDaily ? 'avg7Recovery' : undefined,
      domain: [0, 100] as [number, number],
      xInterval, tooltipFmt: pctFmt,
      sourceTag: computeSource(chartData, 'recovery'),
    },
    {
      title: 'HRV', unit: 'ms', color: COLORS.hrv,
      dataKey: 'hrv',
      avgKey: isDaily ? 'avg7Hrv' : undefined,
      domain: ['auto', 'auto'] as [string, string],
      xInterval, tooltipFmt: hrvFmt,
      sourceTag: computeSource(chartData, 'hrv'),
    },
    {
      title: 'Resting HR', unit: ' bpm', color: COLORS.restingHR,
      dataKey: 'restingHR',
      avgKey: isDaily ? 'avg7RestingHR' : undefined,
      domain: ['auto', 'auto'] as [string, string],
      xInterval, tooltipFmt: bpmFmt,
      sourceTag: computeSource(chartData, 'restingHR'),
    },
    {
      title: 'Strain', unit: '/21', color: COLORS.strain,
      dataKey: 'strain',
      avgKey: isDaily ? 'avg7Strain' : undefined,
      domain: [0, 21] as [number, number],
      xInterval, tooltipFmt: strainFmt,
      sourceTag: computeSource(chartData, 'strain'),
    },
    {
      title: 'Sleep', unit: 'hr', color: COLORS.sleep,
      dataKey: 'sleep',
      avgKey: isDaily ? 'avg7Sleep' : undefined,
      domain: [0, 12] as [number, number],
      xInterval, tooltipFmt: hrFmt,
      sourceTag: computeSource(chartData, 'sleep'),
    },
    {
      title: 'Weight', unit: ' lb', color: COLORS.weight,
      dataKey: 'weight',
      domain: ['auto', 'auto'] as [string, string],
      xInterval, tooltipFmt: lbFmt,
      sourceTag: computeSource(chartData, 'weight'),
    },
    {
      title: 'Steps', unit: '', color: COLORS.steps,
      dataKey: 'steps',
      domain: [0, 'auto'] as [number, string],
      xInterval, yTickFmt: stepsFmt, tooltipFmt: stepsFmt,
    },
    {
      title: 'Workouts', unit: '', color: COLORS.workouts,
      dataKey: 'workouts',
      domain: [0, 'auto'] as [number, string],
      xInterval, isBar: true,
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-28">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronLeft size={15} strokeWidth={2} />
            <span className="text-[11px] font-mono uppercase tracking-wider">Dashboard</span>
          </Link>
          <div className="flex-1" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Trends</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {/* Window toggle */}
        <div className="flex gap-2">
          {WINDOWS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setViewWindow(id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
                viewWindow === id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-[#111] text-zinc-600 border border-white/[0.06] hover:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 px-1">
          {isDaily && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 rounded-full bg-zinc-400" />
                <span className="text-[9px] font-mono text-zinc-600">Actual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0" style={{ borderTop: '1.5px dashed #71717a' }} />
                <span className="text-[9px] font-mono text-zinc-600">7-day avg</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[8px] font-mono text-cyan-700">WHOOP</span>
            <span className="text-[8px] font-mono text-zinc-700">Manual</span>
            <span className="text-[8px] font-mono text-zinc-600">Mixed</span>
          </div>
        </div>

        {/* Charts */}
        {metrics.map(cfg => (
          <ChartCard key={cfg.dataKey} data={chartData} loading={!isLoaded} {...cfg} />
        ))}

        <p className="text-center text-[9px] font-mono text-zinc-800 pb-2">
          WHOOP → Recovery · HRV · RHR · Strain · Sleep · Weight · Apple Health (planned) → Steps · Manual fallback always available
        </p>
      </div>
    </div>
  )
}
