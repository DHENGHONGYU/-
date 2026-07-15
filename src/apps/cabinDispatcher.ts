/**
 * @fileoverview 舱室应用分发器（Cabin Dispatcher）
 *
 * 职责：
 * 1. 统一声明五舱应用的懒加载入口，避免 PortalShell 直接耦合具体文件路径。
 * 2. 提供 `preloadCabinApps` 预加载能力，在浏览器空闲时提前加载相邻舱室 chunk，
 *    降低舱室切换时的白屏等待。
 * 3. 保留 `MCPServerDashboardPage` 特殊分发（总控舱的 MCP 管理页面）。
 *
 * @module apps/cabinDispatcher
 */

import React from 'react'
import type { CabinType } from '@/store/workflowStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const InputApp = React.lazy(() => import('@/apps/input'))
const AnalysisApp = React.lazy(() => import('@/apps/analysis'))
const TradingApp = React.lazy(() => import('@/apps/trading'))
const OutputApp = React.lazy(() => import('@/apps/output'))
const CommandApp = React.lazy(() => import('@/apps/command'))
const AgentApp = React.lazy(() => import('@/apps/command/AgentApp'))
const MCPServerDashboardPage = React.lazy(() => import('@/pages/command/MCPServerDashboardPage'))

/** 五舱应用懒加载映射 */
export const CABIN_APPS: Record<CabinType, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  input: InputApp,
  analysis: AnalysisApp,
  trading: TradingApp,
  output: OutputApp,
  command: CommandApp,
}

/** 各舱室相邻舱室（用于预加载） */
const CABIN_ADJACENCY: Record<CabinType, CabinType[]> = {
  input: ['analysis'],
  analysis: ['input', 'trading'],
  trading: ['analysis', 'output'],
  output: ['trading', 'command'],
  command: ['output'],
}

/** 预加载任务去重集合 */
const preloadedCabins = new Set<CabinType>()

/**
 * 根据当前舱室获取应渲染的应用组件。
 *
 * @param activeCabin 当前激活舱室
 * @param isAgentPath 是否处于 /command/agents 路径
 * @param isMCPPath 是否处于 /command/mcp-servers 路径
 */
export function getActiveApp(
  activeCabin: CabinType,
  isAgentPath: boolean,
  isMCPPath: boolean,
): React.LazyExoticComponent<React.ComponentType<unknown>> {
  if (activeCabin === 'command' && isAgentPath) {
    return AgentApp
  }
  if (activeCabin === 'command' && isMCPPath) {
    return MCPServerDashboardPage
  }
  return CABIN_APPS[activeCabin]
}

const PRELOADERS: Record<CabinType, () => Promise<unknown>> = {
  input: () => import('@/apps/input'),
  analysis: () => import('@/apps/analysis'),
  trading: () => import('@/apps/trading'),
  output: () => import('@/apps/output'),
  command: () => import('@/apps/command'),
}

/**
 * 预加载相邻舱室应用 chunk。
 *
 * 使用 requestIdleCallback（或 setTimeout 兜底）在浏览器空闲时触发，
 * 避免阻塞首屏渲染。已预加载的舱室会被去重。
 */
export function preloadCabinApps(activeCabin: CabinType): void {
  const adjacent = CABIN_ADJACENCY[activeCabin]
  if (!adjacent || adjacent.length === 0) return

  const schedule = typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200)

  schedule(() => {
    for (const cabin of adjacent) {
      if (preloadedCabins.has(cabin)) continue
      preloadedCabins.add(cabin)
      PRELOADERS[cabin]()
        .then(() => {
          logger.info('[cabinDispatcher] 预加载完成', { cabin })
        })
        .catch((err) => {
          logger.warn('[cabinDispatcher] 预加载失败', { cabin, error: err })
        })
    }
  })
}

/**
 * 重置预加载状态（主要用于测试）
 */
export function resetPreloadedCabins(): void {
  preloadedCabins.clear()
}
