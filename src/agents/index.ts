/**
 * @module Agents
 * @lifecycle @Global
 * @description Agent 系统统一入口，整合 Registry/Runtime/HealthMonitor/ConfigManager
 */

import { getLogger } from '@/lib/logger'
import { agentRuntime, type AgentConfig } from './agentRuntime'
import { getAgentRegistry, AgentRegistry } from './agentRegistry'
import { getAgentHealthMonitor, AgentHealthMonitor } from './agentHealthMonitor'
import { getAgentConfigManager } from './agentConfigManager'
import { initAgentSubscriptions } from '@/store/agentStore'

const logger = getLogger()

// 导出所有 Agent 模块
export { agentRuntime, type AgentConfig } from './agentRuntime'
export { getAgentRegistry, createAgentRegistry, type AgentRegistryEntry } from './agentRegistry'
export { getAgentHealthMonitor, createAgentHealthMonitor, type AgentHealthReport, type HealthThresholds } from './agentHealthMonitor'
export { getAgentConfigManager, createAgentConfigManager, type AgentConfigOverride, type AgentConfigSnapshot } from './agentConfigManager'

// ============================================================================
// 预定义 Agent 配置
// ============================================================================

/** V6 自动评分 Agent */
export const AGENT_V6_SCORING: AgentConfig = {
  id: 'v6-scoring-agent',
  name: 'V6 自动评分 Agent',
  description: '执行 V6 九维评分计算，返回评分结果与因子明细',
  defaultTimeout: 30000,
  maxConcurrent: 5,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'score_stock',
}

/** V4 行业评分 Agent */
export const AGENT_V4_INDUSTRIAL: AgentConfig = {
  id: 'v4-industrial-agent',
  name: 'V4 行业评分 Agent',
  description: '执行 V4 行业评分计算，返回行业强弱与板块轮动信号',
  defaultTimeout: 45000,
  maxConcurrent: 3,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'analyze_hot_sector',
}

/** LLM 智能评分 Agent */
export const AGENT_LLM_INTelligent: AgentConfig = {
  id: 'llm-intelligent-agent',
  name: 'LLM 智能评分 Agent',
  description: '调用 LLM API 进行个股深度分析，返回智能评分与投资建议',
  defaultTimeout: 60000,
  maxConcurrent: 2,
  mcpServerName: 'llm',
  defaultToolName: 'chat_completion',
}

/** 数据采集 Agent */
export const AGENT_FETCHER: AgentConfig = {
  id: 'fetcher-agent',
  name: '数据采集 Agent',
  description: '执行股票基础数据/行情数据/财务数据的采集任务',
  defaultTimeout: 15000,
  maxConcurrent: 10,
  mcpServerName: 'fetcher',
  defaultToolName: 'fetch_stock_basic',
}

/** 新闻分析 Agent */
export const AGENT_NEWS_ANALYZER: AgentConfig = {
  id: 'news-analyzer-agent',
  name: '新闻分析 Agent',
  description: '执行新闻情感分析、股票关联提取、热点识别任务',
  defaultTimeout: 20000,
  maxConcurrent: 5,
  mcpServerName: 'news',
  defaultToolName: 'fetch_news',
}

/** 默认 Agent 配置列表 */
export const DEFAULT_AGENTS: AgentConfig[] = [
  AGENT_V6_SCORING,
  AGENT_V4_INDUSTRIAL,
  AGENT_LLM_INTelligent,
  AGENT_FETCHER,
  AGENT_NEWS_ANALYZER,
]

// ============================================================================
// Agent 系统初始化
// ============================================================================

let initialized = false
let cleanup: (() => void) | null = null

/**
 * 初始化 Agent 系统
 * - 注册默认 Agent
 * - 启动健康监控
 * - 初始化 Store 订阅
 */
export function initAgentSystem(): void {
  if (initialized) {
    logger.warn('[AgentSystem] Already initialized')
    return
  }

  logger.info('[AgentSystem] Initializing...')

  const registry = getAgentRegistry()
  const configManager = getAgentConfigManager()
  const healthMonitor = getAgentHealthMonitor()

  // 注册默认 Agent 配置
  for (const config of DEFAULT_AGENTS) {
    const validation = configManager.validateConfig(config)
    if (!validation.valid) {
      logger.error(`[AgentSystem] Invalid config for "${config.id}":`, { errors: validation.errors })
      continue
    }
    configManager.setDefault(config.id, config)
    registry.register(config, ['default', 'system'])
    agentRuntime.register(config)
    logger.info(`[AgentSystem] Agent "${config.id}" registered`)
  }

  // 启动健康监控（30s 检查周期）
  healthMonitor.start(30000)

  // 初始化 Store 订阅
  cleanup = initAgentSubscriptions()

  initialized = true
  logger.info('[AgentSystem] Initialization complete', {
    agents: registry.getStats().total,
    healthMonitor: 'running',
  })
}

/**
 * 关闭 Agent 系统
 * - 停止健康监控
 * - 清理 Store 订阅
 */
export function shutdownAgentSystem(): void {
  if (!initialized) {
    logger.warn('[AgentSystem] Not initialized, skip shutdown')
    return
  }

  logger.info('[AgentSystem] Shutting down...')

  const healthMonitor = getAgentHealthMonitor()
  healthMonitor.stop()

  if (cleanup) {
    cleanup()
    cleanup = null
  }

  initialized = false
  logger.info('[AgentSystem] Shutdown complete')
}

/**
 * 获取 Agent 系统状态
 */
export function getAgentSystemStatus(): {
  initialized: boolean
  runtimeStats: ReturnType<typeof agentRuntime.getStats>
  registryStats: ReturnType<AgentRegistry['getStats']>
  healthReports: ReturnType<AgentHealthMonitor['getAllReports']>
} {
  return {
    initialized,
    runtimeStats: agentRuntime.getStats(),
    registryStats: getAgentRegistry().getStats(),
    healthReports: getAgentHealthMonitor().getAllReports(),
  }
}

// ============================================================================
// 自动初始化（在模块导入时执行）
// ============================================================================

// 在开发环境下，延迟初始化以便日志系统先就绪
if (import.meta.env.DEV) {
  setTimeout(() => {
    initAgentSystem()
  }, 100)
} else {
  // 生产环境立即初始化
  initAgentSystem()
}