import React, { useState } from 'react'
import { LayoutDashboard, Upload, Flame, Activity, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import DashboardProto from './DashboardProto'
import BulkImportProto from './BulkImportProto'
import HotSectorProto from './HotSectorProto'
import DataTestProto from './DataTestProto'

const TABS = [
  { id: 'dashboard', label: '录入看板', icon: LayoutDashboard },
  { id: 'bulk-import', label: '批量导入', icon: Upload },
  { id: 'hot-sectors', label: '热门板块', icon: Flame },
  { id: 'data-test', label: '采集测试', icon: Activity },
] as const

type TabId = (typeof TABS)[number]['id']

export default function InputPrototype(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  const content: Record<TabId, React.JSX.Element> = {
    dashboard: <DashboardProto />,
    'bulk-import': <BulkImportProto />,
    'hot-sectors': <HotSectorProto />,
    'data-test': <DataTestProto />,
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">交互原型页</span>
        </div>
        <p className="mt-1 text-yellow-200/80">
          本页面用于模拟和校对输入舱未来交互方案，数据均为 mock，不写入真实股票池。确认后再逐步落地到正式子页。
        </p>
      </div>

      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {content[activeTab]}
    </div>
  )
}
