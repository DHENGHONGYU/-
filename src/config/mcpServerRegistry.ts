/**
 * MCP Server 注册配置
 *
 * @description
 * 配置驱动的 MCP Server 自动注册与热更新。
 * 新增/移除/禁用 Server 只需修改此文件，无需改动注册逻辑。
 *
 * 使用方式：
 *   - 应用启动：`import '@/mcp/register'` → 自动读取本配置并注册
 *   - 热更新：`syncWithConfig()` → 增量同步（添加新 Server / 移除已删 Server）
 *
 * @module config/mcpServerRegistry
 */

import type { ServerRegistrationOptions } from '@/types/modules/mcp.types'

// ============================================================
// 类型定义
// ============================================================

/** MCP Server 注册配置条目 */
export interface MCPServerConfigEntry {
  /** Server 唯一标识（用于日志与调试，对应 MCPServer.info.name） */
  name: string
  /** 模块路径（Vite 相对路径，用于动态 import） */
  modulePath: string
  /** 导出类名（模块中 export 的 Server 类名） */
  exportName: string
  /** 注册优先级 */
  priority: ServerRegistrationOptions['priority']
  /** 是否启用（false 则跳过注册） */
  enabled: boolean
}

/** Server 模块的导出签名 */
export interface MCPServerModule {
  [key: string]: new () => unknown
}

// ============================================================
// Server 注册清单
// ============================================================

/**
 * MCP Server 注册清单
 *
 * 新增 Server 只需在此数组中追加条目；
 * 移除 Server 只需删除对应条目（或设 enabled: false）；
 * 然后调用 syncWithConfig() 即可增量同步。
 */
export const MCP_SERVER_REGISTRY: ReadonlyArray<MCPServerConfigEntry> = [
  // Phase 1: 核心业务 Server（高优先级）
  {
    name: 'fetcher:data',
    modulePath: '@/mcp/servers/fetcher/dataFetcherServer',
    exportName: 'DataFetcherServer',
    priority: 'high',
    enabled: true,
  },
  {
    name: 'scoring:v6',
    modulePath: '@/mcp/servers/scoring/v6ScoringServer',
    exportName: 'V6ScoringServer',
    priority: 'high',
    enabled: true,
  },
  {
    name: 'trading:main',
    modulePath: '@/mcp/servers/trading/tradingServer',
    exportName: 'TradingServer',
    priority: 'high',
    enabled: true,
  },

  // Phase 2: 分析/新闻/LLM Server（中优先级）
  {
    name: 'analysis:main',
    modulePath: '@/mcp/servers/analysis/analysisServer',
    exportName: 'AnalysisServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'news:main',
    modulePath: '@/mcp/servers/news/newsServer',
    exportName: 'NewsServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'llm:main',
    modulePath: '@/mcp/servers/llm/llmServer',
    exportName: 'LLMServer',
    priority: 'medium',
    enabled: true,
  },

  // Phase 3: 扩展业务 Server（中优先级）
  {
    name: 'portfolio:main',
    modulePath: '@/mcp/servers/portfolio/portfolioServer',
    exportName: 'PortfolioServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'screening:main',
    modulePath: '@/mcp/servers/screening/screeningServer',
    exportName: 'ScreeningServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'backtest:main',
    modulePath: '@/mcp/servers/backtest/backtestServer',
    exportName: 'BacktestServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'stockpool:main',
    modulePath: '@/mcp/servers/stockpool/stockPoolServer',
    exportName: 'StockPoolServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'system:main',
    modulePath: '@/mcp/servers/system/systemServer',
    exportName: 'SystemServer',
    priority: 'medium',
    enabled: true,
  },

  // Phase 4: 补充缺失的 MCP Server（2026-07-05）
  {
    name: 'data-collector:main',
    modulePath: '@/mcp/servers/data-collector/dataCollectorServer',
    exportName: 'DataCollectorServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'execution:main',
    modulePath: '@/mcp/servers/execution/executionServer',
    exportName: 'ExecutionServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'export:main',
    modulePath: '@/mcp/servers/export/exportServer',
    exportName: 'ExportServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'input:main',
    modulePath: '@/mcp/servers/input/inputServer',
    exportName: 'InputServer',
    priority: 'medium',
    enabled: true,
  },
  {
    name: 'trade:main',
    modulePath: '@/mcp/servers/trade/tradeServer',
    exportName: 'TradeServer',
    priority: 'medium',
    enabled: true,
  },
] as const
