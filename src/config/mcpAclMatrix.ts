/**
 * MCP 权限矩阵
 *
 * @description
 * 定义不同调用方角色可访问的 MCP Server 和 Tool 范围。
 * 与 DataBridge 的 ACL_MATRIX 形成纵深防御：
 *   - ACL_MATRIX: 数据层权限（module → store → operation）
 *   - MCP_ACL_MATRIX: 工具层权限（caller → server → tool）
 *
 * 通配符规则：
 *   - `'*'`：匹配任意字符串
 *   - `'prefix_*'`：匹配以 `prefix_` 开头的字符串
 *
 * @module config/mcpAclMatrix
 * @created 2026-07-08 - P0 MCP 权限控制修复
  * @doc [V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-AI-013, V9-DOC-AI-021, V9-DOC-AI-022]
*/

import type { McpCallerRole } from '@/types/modules/mcp.types'

/** MCP 权限规则 —— 描述某角色的可访问范围 */
export interface McpPermissionRule {
  /** 允许访问的 Server 名称列表（`'*'` 表示全部） */
  readonly allowedServers: readonly string[]
  /** 允调用的 Tool 名称模式列表（支持 `'*'`、`'prefix_*'` 通配符） */
  readonly allowedTools: readonly string[]
}

/**
 * MCP 权限矩阵 —— 按调用方角色定义。
 *
 * 设计原则：
 *   - `agent`：AI Agent 自主调用，全权限（用于 agent runtime）
 *   - `ui`：UI 层调用，仅查询类 Tool，禁止交易类写操作
 *   - `ci`：CI 流水线调用，仅 system Server 的查询/迁移工具
 *   - `system`：系统内部调用（bootstrap、迁移），全权限
 */
export const MCP_ACL_MATRIX: Readonly<Record<McpCallerRole, McpPermissionRule>> = {
  // AI Agent：可调用所有 Server 的所有 Tool
  agent: {
    allowedServers: ['*'],
    allowedTools: ['*'],
  },

  // UI 层：仅可调用查询类 Tool，禁止交易类写操作
  // 2026-07-13 变更：移除已废弃/合并的 trade/input/export Server，
  //   实际功能已合并至 trading:main / fetcher:data。
  // 2026-08-15 变更（P0-3 僵尸 Server 清理）：移除已 Disabled 的
  //   analysis / portfolio / knowledge / execution / workflow Server，
  //   这些 Server 已在 mcpServerRegistry.ts 中 enabled:false，
  //   UI 层不应再持有调用入口，避免 UI→MCP→失败 的死链路。
  //   恢复条件：对应 Server 在 mcpServerRegistry.ts 重新 enabled:true 后同步加入。
  // 显式排除的写操作（allowedTools 中故意不列出）：
  //   execute_trade_action / create_buy_order / create_sell_order（交易执行）
  //   list_pool_items / list_groups / transition_pool_item（股票池写入）
  ui: {
    allowedServers: [
      'fetcher',
      'pool',
      'scoring:v6',
      'news',
      'llm',
      'screening',
      'backtest',
      'system',
      'trading',
      // 腾讯自选股数据源（技术方案 §5.1）：仅只读 westock_* Tool
      'marketdata',
      // 2026-08-20 恢复：IndustryDashboardPage / IndustryScorePage 需调用 analyze_industry_v4
      'analysis',
    ],
    allowedTools: [
      'health_check',
      'list_*',
      'get_*',
      'fetch_*',
      'score_stock',
      'screen_stocks',
      'run_backtest',
      'list_pool_items',
      'list_groups',
      // trading（信号/订单/仓位/快照 查询与交易分析，纯读）
      'scan_signals',
      'advise_stock',
      'get_orders',
      'check_order_risk',
      'calculate_position',
      'get_strategy_snapshot',
      'generate_trade_review',
      'generate_mock_trading_data',
      // 腾讯自选股数据源（只读实采，前缀通配覆盖全部 westock_* Tool）
      'westock_*',
      'check_health',
      // 2026-08-20 恢复：行业分析工具
      'analyze_industry_v4',
    ],
  },

  // CI 流水线：仅可调用系统管理类 Tool
  ci: {
    allowedServers: ['system'],
    allowedTools: ['get_*', 'generate_migration_report'],
  },

  // 系统内部调用：超级权限（用于 bootstrap、迁移等系统级操作）
  system: {
    allowedServers: ['*'],
    allowedTools: ['*'],
  },
}

/** 默认调用方角色（向后兼容：未传入 caller 时使用） */
export const DEFAULT_MCP_CALLER: McpCallerRole = 'agent'
