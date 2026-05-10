import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecommendationCardProps {
  icon: LucideIcon
  title: string
  description: string
  href: string
  accent?: 'cyan' | 'pink' | 'green' | 'amber'
  className?: string
}

const ACCENT = {
  cyan:  { icon: 'text-cyan-400',  bg: 'bg-cyan-400/[0.08] border-cyan-400/[0.15]',  ring: 'bg-cyan-500/[0.08]' },
  pink:  { icon: 'text-pink-400',  bg: 'bg-pink-400/[0.08] border-pink-400/[0.15]',  ring: 'bg-pink-500/[0.08]'  },
  green: { icon: 'text-green-400', bg: 'bg-green-400/[0.08] border-green-400/[0.15]', ring: 'bg-green-500/[0.08]' },
  amber: { icon: 'text-amber-400', bg: 'bg-amber-400/[0.08] border-amber-400/[0.15]', ring: 'bg-amber-500/[0.08]' },
}

export function RecommendationCard({ icon: Icon, title, description, href, accent = 'cyan', className }: RecommendationCardProps) {
  const c = ACCENT[accent]
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150 hover:brightness-110 active:scale-[0.98]',
        c.bg,
        className
      )}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.ring}`}>
        <Icon size={14} className={c.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-semibold leading-none mb-0.5 ${c.icon}`}>{title}</p>
        <p className="text-[10px] text-zinc-600 font-mono truncate">{description}</p>
      </div>
      <span className="text-zinc-700 text-[11px] flex-shrink-0">→</span>
    </Link>
  )
}
