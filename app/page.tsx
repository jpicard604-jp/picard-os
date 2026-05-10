import CommandCenter from '@/components/dashboard/CommandCenter'
import QuickCapture from '@/components/dashboard/QuickCapture'
import XodusCard from '@/components/dashboard/XodusCard'
import WhatNeedsAttention from '@/components/dashboard/WhatNeedsAttention'
import TodayTimeline from '@/components/dashboard/TodayTimeline'
import QuickStats from '@/components/dashboard/QuickStats'
import ActivityOverview from '@/components/dashboard/ActivityOverview'
import ProjectSummary from '@/components/dashboard/ProjectSummary'
import StackPreview from '@/components/dashboard/StackPreview'

export default function DashboardPage() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Hero strip — Today Overview + Score Rings */}
      <div className="animate-in" style={{ animationDelay: '0ms' }}>
        <CommandCenter />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <div className="animate-in" style={{ animationDelay: '60ms' }}>
            <XodusCard />
          </div>
          <div className="animate-in" style={{ animationDelay: '120ms' }}>
            <ActivityOverview />
          </div>
          <div className="animate-in" style={{ animationDelay: '180ms' }}>
            <QuickCapture />
          </div>
          <div className="animate-in" style={{ animationDelay: '240ms' }}>
            <WhatNeedsAttention />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="animate-in" style={{ animationDelay: '80ms' }}>
            <QuickStats />
          </div>
          <div className="animate-in" style={{ animationDelay: '140ms' }}>
            <TodayTimeline />
          </div>
          <div className="animate-in" style={{ animationDelay: '200ms' }}>
            <ProjectSummary />
          </div>
          <div className="animate-in" style={{ animationDelay: '260ms' }}>
            <StackPreview />
          </div>
        </div>
      </div>
    </div>
  )
}
