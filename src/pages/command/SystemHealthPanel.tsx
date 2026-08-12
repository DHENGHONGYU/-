/**
 * @fileoverview 系统健康面板 — 合并「系统监控」与「架构健康度」
 * 从用户视角：用户关心"系统是否正常运转"，而非监控和健康度是两个独立页面。
 * 通过 Tab 切换在一个页面内完成全景检查。
 */
import React, { Suspense, useState } from 'react'
import { Activity, HeartPulse } from 'lucide-react'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'

const SystemMonitorPage = React.lazy(() => import('@/pages/command/SystemMonitorPage'))
const HealthDashboardPage = React.lazy(() => import('@/pages/command/health/HealthDashboardPage'))

type TabId = 'monitor' | 'health'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'monitor', label: '系统监控', icon: Activity },
  { id: 'health', label: '架构健康', icon: HeartPulse },
]

export default function SystemHealthPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('monitor')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <Suspense fallback={<PageSkeleton />}>
        {activeTab === 'monitor' && <SystemMonitorPage />}
        {activeTab === 'health' && <HealthDashboardPage />}
      </Suspense>
    </div>
  )
}
