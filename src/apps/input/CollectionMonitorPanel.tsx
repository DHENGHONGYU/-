/**
 * @module CollectionMonitorPanel
 * @description 采集监控台 — 合并原「采集测试」与「采集任务监控」为统一 Tab 面板。
 *
 * 两个 Tab：
 * - 链路测试：原 DataTestPanel（服务健康、单/批量链路测试、质量指标、时间线、日志流）
 * - 任务监控：原 CollectTask 页面（任务列表、数据质量、维度健康、评分分析）
 *
 * 合并理由：
 * 1. 两者都围绕「采集」主题，功能高度互补
 * 2. 减少 sidebar 项数，降低用户认知负担
 * 3. 用户可在同一页面内切换「测试」与「监控」视角
 */

import React, { useState, Suspense, lazy } from 'react'
import { cn } from '@/lib/utils'
import { TAB_BASE, TAB_ACTIVE, TAB_INACTIVE } from './tab.constants'
import DataTestPanel from './DataTestPanel'

const CollectTaskPage = lazy(() => import('@/pages/input/CollectTask'))

type MonitorTab = 'trace' | 'tasks'

export default function CollectionMonitorPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<MonitorTab>('trace')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">采集监控台</h2>
        <p className="text-sm text-muted-foreground">
          链路测试 · 任务监控 · 质量指标 · 实时日志
        </p>
      </div>

      <div className={cn('inline-flex rounded-xl bg-muted/60 p-1')}>
        <button
          onClick={() => setActiveTab('trace')}
          className={`${TAB_BASE} ${activeTab === 'trace' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          链路测试
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`${TAB_BASE} ${activeTab === 'tasks' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          任务监控
        </button>
      </div>

      {activeTab === 'trace' ? (
        <DataTestPanel />
      ) : (
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载采集任务监控中...</div>}>
          <CollectTaskPage />
        </Suspense>
      )}
    </div>
  )
}
