import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogRowProps {
  icon: LucideIcon
  iconColor: string
  title: string
  sub?: string
  time?: string
  className?: string
}

export function LogRow({ icon: Icon, iconColor, title, sub, time, className }: LogRowProps) {
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0', className)}>
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={12} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white truncate">{title}</p>
        {sub && <p className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">{sub}</p>}
      </div>
      {time && <span className="text-[9px] font-mono text-zinc-700 flex-shrink-0 mt-0.5">{time}</span>}
    </div>
  )
}
