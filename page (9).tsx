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
    <>
      <CommandCenter />
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:p-6 lg:pt-5">
        {/* Left — capture + intelligence */}
        <div>
          <QuickCapture />
          <XodusCard />
          <WhatNeedsAttention />
          <TodayTimeline />
        </div>
        {/* Right — metrics */}
        <div>
          <ActivityOverview />
          <QuickStats />
          <ProjectSummary />
          <StackPreview />
        </div>
      </div>
      <div className="h-6" />
    </>
  )
}
