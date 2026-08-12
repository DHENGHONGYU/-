/**
 * @fileoverview 智能体任务管理面板 — 合并「任务列表」「任务触发」「反馈控制台」
 * 从用户视角：用户管理智能体任务的自然流程是
 *   查看任务列表 → 触发新任务 → 查看反馈结果
 * 三者在同一页面通过 Tab 切换，无需跨页面跳转。
 */
import React, { Suspense, useState } from 'react'
import { List, Zap, MessageSquare } from 'lucide-react'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'

const AgentTasksPage = React.lazy(() => import('@/pages/command/agent/AgentTasksPage'))
const AgentTriggerPage = React.lazy(() => import('@/pages/command/agent/AgentTriggerPage'))
const AgentFeedbackPage = React.lazy(() => import('@/pages/command/agent/AgentFeedbackPage'))

type TabId = 'tasks' | 'trigger' | 'feedback'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'tasks', label: '任务列表', icon: List },
  { id: 'trigger', label: '任务触发', icon: Zap },
  { id: 'feedback', label: '反馈控制', icon: MessageSquare },
]

export default function AgentTaskPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('tasks')

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
        {activeTab === 'tasks' && <AgentTasksPage />}
        {activeTab === 'trigger' && <AgentTriggerPage />}
        {activeTab === 'feedback' && <AgentFeedbackPage />}
      </Suspense>
    </div>
  )
}
