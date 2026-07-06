/**
 * @module mcp/servers/execution
 * @description 执行计划 MCP Server — 执行计划创建、查询、阶段更新、取消
 * @created 2026-07-05
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import type { Signal } from '@/data/types'
import {
  createPlan,
  listPlans,
  updatePhase,
  cancelPlan,
  getOrphanPlans,
} from '@/services/execution/executionPlanService'

const logger = getLogger()

export class ExecutionServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'execution',
    version: '1.0.0',
    description: '执行计划 — 计划创建、查询、阶段更新、取消',
    dependencies: ['trading'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'create_execution_plan',
        description: '为交易信号创建执行计划',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            direction: { type: 'string', enum: ['buy', 'sell'], description: '交易方向' },
            quantity: { type: 'number', description: '交易数量' },
            price: { type: 'number', description: '目标价格' },
          },
          required: ['symbol', 'direction', 'quantity', 'price'],
        },
        handler: async (args) => {
          logger.info('[ExecutionServer] create_execution_plan called', { symbol: args.symbol })
          const signal: Signal = {
            id: `sig-mcp-${Date.now()}`,
            symbol: args.symbol as string,
            direction: args.direction as Signal['direction'],
            type: 'mcp_manual',
            strategy: 'manual',
            confidence: 0.5,
            rationale: 'MCP 手动创建',
            snapshot: {},
            createdAt: Date.now(),
          }
          const plan = await createPlan(signal)
          return { content: [{ type: 'text', text: JSON.stringify(plan ?? { error: '创建失败' }) }] }
        },
      },
      {
        name: 'list_execution_plans',
        description: '查询执行计划列表',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码（可选）' },
          },
        },
        handler: async (args) => {
          const symbol = args.symbol as string | undefined
          logger.info('[ExecutionServer] list_execution_plans called', { symbol })
          const plans = await listPlans(symbol)
          return { content: [{ type: 'text', text: JSON.stringify(plans) }] }
        },
      },
      {
        name: 'update_execution_phase',
        description: '更新执行计划阶段',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: '执行计划 ID' },
            phase: { type: 'string', description: '目标阶段' },
          },
          required: ['planId', 'phase'],
        },
        handler: async (args) => {
          const planId = args.planId as string
          const phase = args.phase as string
          logger.info('[ExecutionServer] update_execution_phase called', { planId, phase })
          const plan = await updatePhase(planId, phase as never)
          return { content: [{ type: 'text', text: JSON.stringify(plan ?? { error: '更新失败' }) }] }
        },
      },
      {
        name: 'cancel_execution_plan',
        description: '取消执行计划',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: '执行计划 ID' },
          },
          required: ['planId'],
        },
        handler: async (args) => {
          const planId = args.planId as string
          logger.info('[ExecutionServer] cancel_execution_plan called', { planId })
          const plan = await cancelPlan(planId)
          return { content: [{ type: 'text', text: JSON.stringify(plan ?? { error: '取消失败' }) }] }
        },
      },
      {
        name: 'get_orphan_plans',
        description: '查询孤立的执行计划（无关联订单）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          logger.info('[ExecutionServer] get_orphan_plans called')
          const plans = await getOrphanPlans()
          return { content: [{ type: 'text', text: JSON.stringify(plans) }] }
        },
      },
    ]
  }
}
