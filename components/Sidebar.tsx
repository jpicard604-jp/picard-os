'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CalendarDays, FolderKanban, Activity, Pill, Mic, Upload, Settings } from 'lucide-react'
import { JACKSON } from '@/lib/mock-data'

const PRIMARY_NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/xodus', icon: MessageSquare, label: 'XODUS' },
  { href: '/daily', icon: CalendarDays, label: 'Daily Log' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/fitness', icon: Activity, label: 'Fitness' },
] as const

const SECONDARY_NAV = [
  { href: '/stack', icon: Pill, label: 'Stack' },
  { href: '/voice', icon: Mic, label: 'Voice' },
  { href: '/uploads', icon: Upload, label: 'Uploads' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const

export default function Sidebar() {
  const pathname = usePathname()
  const recovery = JACKSON.today.recovery

  const recoveryColor =
    recovery.score >= 70 ? 'text-green-400' : recovery.score >= 50 ? 'text-sky-400' : 'text-red-400'
  const recoveryBarColor =
    recovery.score >= 70 ? 'bg-green-500' : recovery.score >= 50 ? 'bg-sky-500' : 'bg-red-500'

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 z-40 bg-[#07070a] border-r border-white/[0.05]">
      {/* Brand */}
      <div className="px-5 py-[18px] border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex-shrink-0">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-sky-500/20 to-indigo-600/15 border border-sky-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-[10px] font-semibold text-sky-300 leading-none tracking-tight">JP</span>
            </div>
          </div>
          <div>
            <span className="font-display text-[13px] font-medium text-white leading-none tracking-tight">
              Picard OS
            </span>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-4 space-y-px overflow-y-auto no-scrollbar">
        {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                active
                  ? 'bg-pink-500/[0.16] border border-pink-500/25 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035] border border-transparent'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-pink-400' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}
              />
              {label}
              {active && (
                <span className="ml-auto w-1 h-1 rounded-full bg-pink-400/70" />
              )}
            </Link>
          )
        })}

        <div className="pt-5 pb-2 px-3">
          <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-700">Tools</span>
        </div>

        {SECONDARY_NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                active
                  ? 'bg-pink-500/[0.16] border border-pink-500/25 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.035] border border-transparent'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-pink-400' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Recovery footer */}
      <div className="px-5 py-4 border-t border-white/[0.05]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700">Recovery</span>
          <span className={`text-[10px] font-mono font-semibold ${recoveryColor}`}>{recovery.score}%</span>
        </div>
        <div className="h-px bg-white/[0.07] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${recoveryBarColor} transition-all`}
            style={{ width: `${recovery.score}%` }}
          />
        </div>
        <p className="text-[9px] text-zinc-700 mt-2 font-mono">
          HRV {recovery.hrv}ms · RHR {recovery.restingHR}bpm
        </p>
      </div>
    </aside>
  )
}
