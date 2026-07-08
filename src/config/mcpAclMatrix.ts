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
  ui: {
    allowedServers: [
      'fetcher',
      'stockpool',
      'scoring:v6',
      'analysis',
      'news',
      'llm',
      'portfolio',
      'screening',
      'backtest',
    ],
    allowedTools: [
      'health_check',
      'list_*',
      'get_*',
      'fetch_*',
      'score_stock',
      'screen_stocks',
      'run_backtest',
      'list_pool_stocks',
      'list_groups',
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
