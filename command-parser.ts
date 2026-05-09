import Link from 'next/link'
import { CalendarDays, MessageSquare, Dumbbell, Upload, Mic, FolderKanban } from 'lucide-react'

const ACTIONS = [
  { href: '/daily', icon: CalendarDays, label: 'Log Daily', sub: 'Track today', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { href: '/xodus', icon: MessageSquare, label: 'XODUS', sub: 'AI brief', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { href: '/fitness', icon: Dumbbell, label: 'Fitness', sub: 'Training', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { href: '/projects', icon: FolderKanban, label: 'Projects', sub: 'Manage', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { href: '/voice', icon: Mic, label: 'Voice Log', sub: 'Record', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { href: '/uploads', icon: Upload, label: 'Upload', sub: 'Add file', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
] as const

export default function QuickActions() {
  return (
    <div className="mx-4 mt-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-0.5">Quick Actions</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ href, icon: Icon, label, sub, color, bg }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-2 text-center transition-all duration-150 active:scale-[0.96] ${bg}`}
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
