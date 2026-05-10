import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  sub?: string
  className?: string
  accentColor?: 'blue' | 'cyan' | 'pink' | 'green' | 'amber'
}

const GLOW_MAP = {
  blue:  'rgba(59,130,246,0.06)',
  cyan:  'rgba(34,211,238,0.06)',
  pink:  'rgba(244,114,182,0.06)',
  green: 'rgba(74,222,128,0.06)',
  amber: 'rgba(251,191,36,0.06)',
}

export function PageHeader({ eyebrow, title, sub, className, accentColor = 'blue' }: PageHeaderProps) {
  return (
    <div className={cn('relative px-5 pt-10 pb-6 lg:px-8 border-b border-white/[0.05] overflow-hidden', className)}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 15% 0%, ${GLOW_MAP[accentColor]} 0%, transparent 60%)` }}
      />
      <div className="relative">
        {eyebrow && <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">{eyebrow}</p>}
        <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">{title}</h1>
        {sub && <p className="text-[13px] text-zinc-500 font-mono mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}
