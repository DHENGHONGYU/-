/**
 * @fileoverview 优化建议面板 — 合并「优化建议」与「Skill核查」
 * 从用户视角：两者都是系统改进类工具——一个面向业务优化，一个面向技术审计。
 * 合并后用户可在同一页面从不同角度审视系统改进点。
 */
import React, { Suspense, useState } from 'react'
import { Lightbulb, CheckCircle } from 'lucide-react'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'

const OptimizationSuggestionsPage = React.lazy(() => import('@/pages/command/agent/OptimizationSuggestionsPage'))
const SkillAuditPage = React.lazy(() => import('@/pages/command/agent/SkillAuditPage'))

type TabId = 'suggestions' | 'audit'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'suggestions', label: '优化建议', icon: Lightbulb },
  { id: 'audit', label: 'Skill 核查', icon: CheckCircle },
]

export default function OptimizationPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('suggestions')

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
        {activeTab === 'suggestions' && <OptimizationSuggestionsPage />}
        {activeTab === 'audit' && <SkillAuditPage />}
      </Suspense>
    </div>
  )
}
