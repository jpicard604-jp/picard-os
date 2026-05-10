import { cn } from '@/lib/utils'

interface ProgressMetricProps {
  label: string
  value: string
  sub?: string
  pct?: number
  barColor?: string
  warn?: boolean
  good?: boolean
  className?: string
}

export function ProgressMetric({ label, value, sub, pct, barColor = '#22d3ee', warn, good, className }: ProgressMetricProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0', className)}>
      <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-zinc-600 w-[4.5rem] flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        {pct !== undefined && (
          <div className="h-px bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {sub && (
          <span className={`text-[9px] font-mono ${warn ? 'text-amber-400' : good ? 'text-green-400' : 'text-zinc-600'}`}>{sub}</span>
        )}
        <span className={`text-sm font-mono font-semibold tabular-nums ${warn ? 'text-amber-300' : good ? 'text-green-300' : 'text-white'}`}>{value}</span>
      </div>
    </div>
  )
}
