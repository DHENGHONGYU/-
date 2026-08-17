/**
 * @module Agents
 * @lifecycle @Global
 * @description Agent 系统统一入口，整合 Registry/Runtime/HealthMonitor/ConfigManager
 *
 * 初始化策略（v2 优化）：
 *   - 不再在模块导入时自动初始化
 *   - 通过 `triggerAgentInit()` 在用户首次交互时触发
 *   - MCP 核心 Server 注册完成后自动链式触发 Agent 初始化
 *   - 非核心 MCP Server 后台懒加载，不阻塞首屏
 *
 * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014, V9-DOC-QA-077]
*/

import { getLogger } from '@/lib/logger'
import { mcpRegistry } from '@/mcp/core/registry'
import { mcpReadyPromise, ensureMCPRegistered } from '@/mcp/register'
import { MCP_SERVER_REGISTRY } from '@/config/mcpServerRegistry'
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
// Lazy Server 依赖检测
// ============================================================================

/**
 * 判断指定 serverName 是否指向一个 lazy 加载的 MCP Server
 *
 * 匹配规则：serverName 作为前缀匹配配置名（如 'llm' 匹配 'llm:main'）
 */
function isLazyServer(serverName: string): boolean {
  const entry = MCP_SERVER_REGISTRY.find(
    (e) => e.name === serverName || e.name.startsWith(serverName + ':'),
  )
  return entry?.lazy === true
}

// ============================================================================
// Agent 依赖不变量校验（F5）
// ============================================================================

/**
 * 校验已注册 Agent 依赖的 MCP Server 是否均已注册且启用。
 *
 * Lazy Server 处理：标记为 lazy 的 Server 若未注册，仅记录警告而非错误，
 * 因为它们将在后台异步加载完成。
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
      if (isLazyServer(serverName)) {
        logger.warn(`[AgentSystem] Agent "${config.id}" depends on lazy MCP server "${serverName}" (not yet loaded, will be loaded in background)`)
        continue
      }
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
 * - 依赖校验（lazy server 仅警告不阻塞）
 */
export function initAgentSystem(): void {
  if (initialized) {
    logger.warn('[AgentSystem] Already initialized')
    return
  }

  const _initStart = performance.now()
  logger.info('[AgentSystem] Initializing...')

  const _t0 = performance.now(); const registry = getAgentRegistry(); const _t1 = performance.now()
  const _t2 = performance.now(); const configManager = getAgentConfigManager(); const _t3 = performance.now()
  const _t4 = performance.now(); const healthMonitor = getAgentHealthMonitor(); const _t5 = performance.now()
  logger.info(`[AgentSystem] singleton getters: registry=${(_t1-_t0).toFixed(2)}ms configManager=${(_t3-_t2).toFixed(2)}ms healthMonitor=${(_t5-_t4).toFixed(2)}ms`)

  // 注册默认 Agent 配置
  let _regTotal = 0
  for (const config of DEFAULT_AGENTS) {
    const _a0 = performance.now()
    const validation = configManager.validateConfig(config)
    if (!validation.valid) {
      logger.error(`[AgentSystem] Invalid config for "${config.id}":`, { errors: validation.errors })
      continue
    }
    configManager.setDefault(config.id, config)
    registry.register(config, ['default', 'system'])
    agentRuntime.register(config)
    const _a1 = performance.now()
    _regTotal += (_a1 - _a0)
    logger.info(`[AgentSystem] Agent "${config.id}" registered in ${(_a1-_a0).toFixed(2)}ms`)
  }
  logger.info(`[AgentSystem] ALL agents registered: ${DEFAULT_AGENTS.length} agents total=${_regTotal.toFixed(2)}ms`)

  // 启动期不变量校验
  const _d0 = performance.now()
  const depViolations = validateAgentMcpDependencies()
  const _d1 = performance.now()
  if (depViolations.length > 0) {
    logger.error(`[AgentSystem] ${depViolations.length} agent MCP dependency violation(s) detected`, { violations: depViolations })
  }
  logger.info(`[AgentSystem] MCP dependency check: ${depViolations.length} violations in ${(_d1-_d0).toFixed(2)}ms`)

  // 启动健康监控（间隔由 resolveHealthCheckIntervalMs 解析：环境变量可配，默认 30s）
  const _h0 = performance.now()
  healthMonitor.start()
  const _h1 = performance.now()
  logger.info(`[AgentSystem] healthMonitor.start: ${(_h1-_h0).toFixed(2)}ms`)

  initialized = true
  const _initElapsed = (performance.now() - _initStart).toFixed(2)
  logger.info(`[AgentSystem] ▶ INIT COMPLETE in ${_initElapsed}ms`, {
    agents: registry.getStats().total,
    healthMonitor: 'running',
  })
}

/**
 * 关闭 Agent 系统
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
// 延迟初始化：由首次交互触发
// ============================================================================

const _agentImportTs = Date.now()
logger.info(`[Agent] ⧉ MODULE LOADED at ${new Date(_agentImportTs).toISOString()} (dev=${import.meta.env.DEV})`)

let agentReadyResolver: (() => void) | null = null

/**
 * Agent 系统就绪信号
 *
 * 调用方（如 UI 组件、Agent 任务触发器）通过 `await agentReadyPromise`
 * 确保 Agent 系统已初始化完成后再执行操作。
 */
export const agentReadyPromise: Promise<void> = new Promise<void>((resolve) => {
  agentReadyResolver = resolve
})

let triggerCalled = false

/**
 * 触发 Agent 系统初始化
 *
 * 1. 调用 ensureMCPRegistered() 启动 MCP Server 注册
 * 2. 等待 mcpReadyPromise（核心 MCP Server 就绪）
 * 3. 自动调用 initAgentSystem() 完成 Agent 注册
 * 4. resolve agentReadyPromise 通知所有等待方
 *
 * 幂等：多次调用仅触发一次初始化链路。
 */
export function triggerAgentInit(): void {
  if (triggerCalled) {
    logger.info('[Agent] ⏭ init already triggered, skip (idempotent guard)')
    return
  }
  triggerCalled = true

  const elapsed = Date.now() - _agentImportTs
  logger.info(`[Agent] ▶ TRIGGER INIT (import→elapsed=${elapsed}ms)`)

  // 1. 确保 MCP 注册已触发
  logger.info('[Agent]   calling ensureMCPRegistered()...')
  ensureMCPRegistered()
  const _mcpWaitStart = performance.now()

  // 2. 等待核心 MCP Server 就绪后初始化 Agent
  logger.info('[Agent]   awaiting mcpReadyPromise...')
  mcpReadyPromise
    .then(() => {
      const _mcpWaitElapsed = (performance.now() - _mcpWaitStart).toFixed(1)
      logger.info(`[Agent]   ✅ mcpReadyPromise resolved in ${_mcpWaitElapsed}ms, starting initAgentSystem()`)
      const _initStart = performance.now()
      initAgentSystem()
      const _initElapsed = (performance.now() - _initStart).toFixed(1)
      logger.info(`[Agent]   initAgentSystem() completed in ${_initElapsed}ms`)
      if (agentReadyResolver) {
        agentReadyResolver()
        agentReadyResolver = null
      }
      logger.info(`[Agent] ▶ AGENT READY (total=${Date.now() - _agentImportTs}ms from import)`)
    })
    .catch((err) => {
      logger.error('[Agent]   ❌ initialization chain failed', { error: String(err), stack: err instanceof Error ? err.stack : undefined })
      if (agentReadyResolver) {
        agentReadyResolver()
        agentReadyResolver = null
      }
    })
}