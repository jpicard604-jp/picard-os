import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'cyan' | 'green' | 'pink' | 'amber' | 'default'
  className?: string
}

const ACCENT_MAP = {
  cyan:    'text-cyan-400',
  green:   'text-green-400',
  pink:    'text-pink-400',
  amber:   'text-amber-400',
  default: 'text-white',
}

export function MetricCard({ label, value, sub, accent = 'default', className }: MetricCardProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className={`text-sm font-mono font-semibold tabular-nums leading-none ${ACCENT_MAP[accent]}`}>{value}</p>
      {sub && <p className="text-[9px] font-mono text-zinc-700 leading-none">{sub}</p>}
    </div>
  )
}
