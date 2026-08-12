/**
 * @module CollectionStrategyPage
 * @description 采集策略配置 — 合并原「七维采集配置」与「抓取引擎配置」为统一 Tab 面板。
 *
 * 两个 Tab：
 * - 七维策略：原 SevenDimConfigPage（七维采集维度开关、优先级、降级链配置）
 * - 抓取引擎：原 FetcherConfigPage（数据源 URL、超时、重试、编码等抓取器参数）
 *
 * 合并理由：
 * 1. 两者都是「采集配置」，属于同一配置域
 * 2. 减少 sidebar 项数，统一配置入口
 * 3. 用户可在同一页面内切换「策略层」与「引擎层」配置
 */

import React, { useState, Suspense, lazy } from 'react'
import { cn } from '@/lib/utils'

const SevenDimConfigPage = lazy(() => import('@/pages/input/SevenDimConfigPage'))
const FetcherConfigPage = lazy(() => import('@/pages/input/FetcherConfigPage'))

type StrategyTab = 'seven-dim' | 'fetcher'

const TAB_BASE = 'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-out'
const TAB_ACTIVE = 'bg-card text-foreground shadow-sm shadow-primary/5'
const TAB_INACTIVE = 'text-muted-foreground hover:text-foreground hover:bg-muted/50'

export default function CollectionStrategyPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<StrategyTab>('seven-dim')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">采集策略配置</h2>
        <p className="text-sm text-muted-foreground">
          七维采集维度 · 抓取引擎参数 · 降级链与重试策略
        </p>
      </div>

      <div className={cn('inline-flex rounded-xl bg-muted/60 p-1')}>
        <button
          onClick={() => setActiveTab('seven-dim')}
          className={`${TAB_BASE} ${activeTab === 'seven-dim' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          七维策略
        </button>
        <button
          onClick={() => setActiveTab('fetcher')}
          className={`${TAB_BASE} ${activeTab === 'fetcher' ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          抓取引擎
        </button>
      </div>

      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载配置中...</div>}>
        {activeTab === 'seven-dim' ? <SevenDimConfigPage /> : <FetcherConfigPage />}
      </Suspense>
    </div>
  )
}
