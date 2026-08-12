/**
 * @module Agents
 * @lifecycle @Global
 * @description Agent 系统统一入口，整合 Registry/Runtime/HealthMonitor/ConfigManager
  * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-077]
*/

import { getLogger } from '@/lib/logger'
import '@/mcp/register'
import { mcpRegistry } from '@/mcp/core/registry'
import { agentRuntime, type AgentConfig } from './agentRuntime'
import { getAgentRegistry, AgentRegistry } from './agentRegistry'
import { getAgentHealthMonitor, AgentHealthMonitor } from './agentHealthMonitor'
import { getAgentConfigManager } from './agentConfigManager'

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

/** 多因子筛选 Agent */
export const AGENT_SCREENING: AgentConfig = {
  id: 'screening-agent',
  name: '多因子筛选 Agent',
  description: '执行全量多因子筛选与单股评估',
  defaultTimeout: 25000,
  maxConcurrent: 3,
  mcpServerName: 'screening',
  defaultToolName: 'run_screening',
}

/** 股票池管理 Agent */
export const AGENT_POOL: AgentConfig = {
  id: 'pool-agent',
  name: '股票池管理 Agent',
  description: '管理股票池研究状态流转与分组',
  defaultTimeout: 15000,
  maxConcurrent: 5,
  mcpServerName: 'pool',
  defaultToolName: 'list_pool_items',
}

/** 回测引擎 Agent */
export const AGENT_BACKTEST: AgentConfig = {
  id: 'backtest-agent',
  name: '回测引擎 Agent',
  description: '执行策略回测与绩效分析',
  defaultTimeout: 60000,
  maxConcurrent: 2,
  mcpServerName: 'backtest',
  defaultToolName: 'run_backtest',
}

/** 默认 Agent 配置列表 */
export const DEFAULT_AGENTS: AgentConfig[] = [
  AGENT_V6_SCORING,
  AGENT_V4_INDUSTRIAL,
  AGENT_LLM_INTelligent,
  AGENT_FETCHER,
  AGENT_NEWS_ANALYZER,
  AGENT_SCREENING,
  AGENT_POOL,
  AGENT_BACKTEST,
]

// ============================================================================
// Agent 依赖不变量校验（F5）
// ============================================================================

/**
 * 校验已注册 Agent 依赖的 MCP Server 是否均已注册且启用。
 *
 * 不变量：每个 Agent 的 `mcpServerName ?? id` 必须解析到注册表中
 * 一个 `enabled` 的 Server，否则该 Agent 在运行时必失败。
 *
 * @returns 违反不变量（依赖缺失/禁用）的 Agent 列表；空数组表示全部满足。
 */
export function validateAgentMcpDependencies(): Array<{ agentId: string; serverName: string; reason: string }> {
  const violations: Array<{ agentId: string; serverName: string; reason: string }> = []
  const registry = getAgentRegistry()

  for (const entry of registry.getAll()) {
    const config = entry.config
    const serverName = config.mcpServerName ?? config.id
    const server = mcpRegistry.getServer(serverName)

    if (!server) {
      violations.push({ agentId: config.id, serverName, reason: 'MCP server not registered' })
      logger.error(`[AgentSystem] Agent "${config.id}" depends on unregistered MCP server "${serverName}"`)
      continue
    }
    if (server.options.enabled === false) {
      violations.push({ agentId: config.id, serverName, reason: 'MCP server disabled' })
      logger.error(`[AgentSystem] Agent "${config.id}" depends on disabled MCP server "${serverName}"`)
    }
  }

  if (violations.length === 0) {
    logger.info('[AgentSystem] All agent MCP dependencies satisfied')
  }
  return violations
}

// ============================================================================
// Agent 系统初始化
// ============================================================================

let initialized = false

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

  // 启动期不变量校验：Agent 依赖的 MCP Server 必须已注册且启用（F5 守卫）
  const depViolations = validateAgentMcpDependencies()
  if (depViolations.length > 0) {
    logger.error(`[AgentSystem] ${depViolations.length} agent MCP dependency violation(s) detected`, { violations: depViolations })
  }

  // 启动健康监控（30s 检查周期）
  healthMonitor.start(30000)

  // Store 订阅由 src/store/agentStore.ts 模块加载时自初始化（initAgentSubscriptions），
  // agents 层不再直接依赖 store，保持分层契约（agents 仅依赖 core/data）。

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