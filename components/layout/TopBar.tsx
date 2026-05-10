'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/':         'Dashboard',
  '/xodus':    'XODUS',
  '/daily':    'Daily Log',
  '/projects': 'Projects',
  '/fitness':  'Fitness',
  '/stack':    'Stack',
  '/voice':    'Voice',
  '/uploads':  'Uploads',
  '/settings': 'Settings',
  '/log':      'Log',
}

export default function TopBar() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Picard OS'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <header className="hidden lg:flex items-center justify-between px-6 h-[52px] border-b border-white/[0.05] flex-shrink-0 bg-[#07070a]/80 backdrop-blur-md">
      <div>
        <p className="text-[8px] font-mono uppercase tracking-[0.22em] text-zinc-700">{today}</p>
        <p className="text-[13px] font-semibold text-white tracking-tight leading-none mt-0.5">{title}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.07] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={13} className="text-zinc-500" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500/30 to-cyan-500/20 border border-pink-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(236,72,153,0.18)]">
          <span className="text-[10px] font-semibold font-mono bg-gradient-to-r from-pink-300 to-cyan-300 bg-clip-text text-transparent">JP</span>
        </div>
      </div>
    </header>
  )
}
