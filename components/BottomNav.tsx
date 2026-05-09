'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CalendarDays, FolderKanban, Pill } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/xodus', icon: MessageSquare, label: 'XODUS' },
  { href: '/daily', icon: CalendarDays, label: 'Daily' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/stack', icon: Pill, label: 'Stack' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 nav-safe-bottom">
      <div className="max-w-2xl mx-auto bg-[#0d0d0d]/96 backdrop-blur-xl border-t border-white/[0.08]">
        <div className="flex">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2.5 min-h-[3.5rem] transition-colors duration-150"
              >
                <div
                  className={`flex items-center justify-center w-10 h-7 rounded-lg transition-all duration-200 ${
                    active ? 'bg-blue-500/15' : ''
                  }`}
                >
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.5 : 1.75}
                    className={active ? 'text-blue-400' : 'text-zinc-600'}
                  />
                </div>
                <span
                  className={`text-[9px] font-medium tracking-wide transition-colors duration-150 ${
                    active ? 'text-blue-400' : 'text-zinc-700'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
