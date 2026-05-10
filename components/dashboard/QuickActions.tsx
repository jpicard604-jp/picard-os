import Link from 'next/link'
import { CalendarDays, MessageSquare, Dumbbell, Upload, Mic, FolderKanban } from 'lucide-react'

const ACTIONS = [
  { href: '/daily',    icon: CalendarDays,  label: 'Log Daily', sub: 'Track today', color: 'text-pink-400',   hover: 'hover:border-pink-500/25 hover:bg-pink-500/[0.04]'   },
  { href: '/xodus',    icon: MessageSquare, label: 'XODUS',     sub: 'AI brief',    color: 'text-cyan-400',   hover: 'hover:border-cyan-500/25 hover:bg-cyan-500/[0.04]'   },
  { href: '/fitness',  icon: Dumbbell,      label: 'Fitness',   sub: 'Training',    color: 'text-cyan-400',   hover: 'hover:border-cyan-500/25 hover:bg-cyan-500/[0.04]'   },
  { href: '/projects', icon: FolderKanban,  label: 'Projects',  sub: 'Manage',      color: 'text-pink-400',   hover: 'hover:border-pink-500/25 hover:bg-pink-500/[0.04]'   },
  { href: '/voice',    icon: Mic,           label: 'Voice Log', sub: 'Record',      color: 'text-purple-400', hover: 'hover:border-purple-500/25 hover:bg-purple-500/[0.04]' },
  { href: '/uploads',  icon: Upload,        label: 'Upload',    sub: 'Add file',    color: 'text-purple-400', hover: 'hover:border-purple-500/25 hover:bg-purple-500/[0.04]' },
] as const

export default function QuickActions() {
  return (
    <div className="mx-4 mt-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-0.5">Quick Actions</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ href, icon: Icon, label, sub, color, hover }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] py-4 px-2 text-center transition-all duration-150 active:scale-[0.96] ${hover}`}
          >
            <Icon size={18} className={color} />
            <div>
              <p className={`text-xs font-semibold ${color}`}>{label}</p>
              <p className="text-[9px] text-zinc-700 font-mono mt-0.5">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
