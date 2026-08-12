/**
 * @fileoverview 模型配置面板 — 合并「LLM管理」「API配置」「模型升级」
 * 从用户视角：用户配置 AI 模型的完整流程是
 *   选择模型(LLM) → 配置API密钥 → 检查模型升级
 * 三者紧密关联，合并为一个页面通过 Tab 切换。
 */
import React, { Suspense, useState } from 'react'
import { Sparkles, Code, TrendingUp } from 'lucide-react'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'

const LlmManagement = React.lazy(() => import('@/pages/command/agent/LlmManagement'))
const ApiConfigurationPage = React.lazy(() => import('@/pages/command/agent/ApiConfigurationPage'))
const ModelUpgradePage = React.lazy(() => import('@/pages/command/agent/ModelUpgradePage'))

type TabId = 'llm' | 'api' | 'upgrade'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'llm', label: '模型选择', icon: Sparkles },
  { id: 'api', label: 'API 密钥', icon: Code },
  { id: 'upgrade', label: '模型升级', icon: TrendingUp },
]

export default function ModelConfigPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('llm')

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
        {activeTab === 'llm' && <LlmManagement />}
        {activeTab === 'api' && <ApiConfigurationPage />}
        {activeTab === 'upgrade' && <ModelUpgradePage />}
      </Suspense>
    </div>
  )
}
