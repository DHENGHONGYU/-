/**
 * @module mcp/servers/workflow
 * @description
 *  AI 工作流自动化 MCP Server —— 让 AI Agent 通过 MCP 工具定义、执行、调度与
 *  事件触发多步骤投研流程（链式任务 / 批处理 / 定时调度 / 事件驱动自动化）。
 *
 *  设计理念：
 *   - **控制面与引擎分离**：MCP 工具本身是无状态的（每次调用独立、立即返回），
 *     "运行实例状态 / 调度器 / 事件监听" 放在 Server 内部的有状态引擎中，工具只是控制面。
 *   - **编排而非重写**：工作流步骤通过 `mcpRegistry` 在运行时动态调用任意已注册 Server 的
 *     Tool（如 scoring:v6、news、export），天然复用现有能力，不重复造轮子、不硬耦合依赖。
 *   - **金融级权限**：引擎内部以 `system` 角色调用下游 Tool（全权限），而工作流工具本身
 *     仍受外部 caller（agent/ui/ci）的 ACL 约束 —— 纵深防御。
 *
 * @created 2026-07-13 - AI 工作流自动化服务器
  * @doc [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-021, V9-DOC-AI-022]
*/

import { MCPServerBase } from '@/mcp/core/server'
import type {
  ServerInfo,
  ToolDescriptor,
  ResourceTemplate,
  PromptTemplate,
  ToolResult,
  MCPServer,
  McpCallerContext,
} from '@/mcp/core/types'
import { mcpRegistry } from '@/mcp/core/registry'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { recordPerf } from '@/lib/perf'
import { createRepository } from '@/data/repository'
import { STORE_NAME } from '@/config/dbConfig'
import type { Repository } from '@/data/repository'

const logger = getLogger()

/** 工作流 Server 唯一标识（与 src/config/mcpServerRegistry.ts 的 entry.name 保持一致） */
export const WORKFLOW_SERVER_NAME = 'workflow:main'

/** 工作流定义持久化键（localStorage 回退，node/测试环境自动降级为纯内存） */
const WORKFLOW_DEFS_STORAGE_KEY = 'mcp:workflow:defs'

/** 运行实例内存上限，超过时自动清理最旧记录（防 OOM） */
const MAX_RUNS_IN_MEMORY = 500

/** 单步执行默认超时（毫秒），防止下游 tool 挂起导致 run 永久 stuck */
const STEP_TIMEOUT_MS = 300_000

/** 运行历史保留天数（超过自动清理） */
const RUN_HISTORY_RETENTION_DAYS = 7

/** 工作流性能监控标签（配合 lib/perf.ts 的 measureAsync/recordPerf 使用） */
const PERF_WORKFLOW = {
  EXECUTE_RUN: 'workflow:executeRun',
  EXECUTE_STEP: 'workflow:executeStep',
} as const

// ============================================================
// 数据模型
// ============================================================

import type {
  WorkflowDef,
  WorkflowRun,
  ScheduleDef,
  TriggerDef,
  WorkflowStep,
  StepRunResult,
  RunStatus,
  ScheduleUnit,
  ScheduleEvery,
} from '@/types/modules/workflow.types'

// 保持向后兼容：从 workflowServer.ts 仍可导入这些类型
export type {
  WorkflowDef,
  WorkflowRun,
  ScheduleDef,
  TriggerDef,
  WorkflowStep,
  StepRunResult,
  RunStatus,
  ScheduleUnit,
  ScheduleEvery,
} from '@/types/modules/workflow.types'

// ============================================================
// 服务器实现
// ============================================================

/** 时间单位 → 毫秒换算表（零硬编码锚点，集中管理） */
const UNIT_TO_MS: Readonly<Record<ScheduleUnit, number>> = {
  ms: 1,
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
}

/**
 * AI 工作流自动化 MCP Server
 *
 * 暴露工作流 CRUD、执行/监控、定时调度、事件触发四类工具，并内置有状态执行引擎。
 */
export class WorkflowServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: WORKFLOW_SERVER_NAME,
    version: '1.0.0',
    description: 'AI 工作流自动化 —— 定义/执行/调度/事件触发多步骤投研流程（链式任务·批处理·定时·事件驱动）',
    dependencies: [],
  }

  /** 工作流定义（内存 + 可选 localStorage 持久化） */
  private readonly defs = new Map<string, WorkflowDef>()
  /** 运行实例 */
  private readonly runs = new Map<string, WorkflowRun>()
  /** 定时调度定义 */
  private readonly schedules = new Map<string, ScheduleDef>()
  /** 调度定时器 */
  private readonly scheduleTimers = new Map<string, ReturnType<typeof setInterval>>()
  /** 事件触发器定义 */
  private readonly triggers = new Map<string, TriggerDef>()
  /** 触发器取消订阅函数 */
  private readonly triggerUnsubs = new Map<string, () => void>()

  // ── IndexedDB Repository（write-through 异步备份层，不可用时静默降级） ──
  private defRepo: Repository<WorkflowDef> | null = null
  private scheduleRepo: Repository<ScheduleDef> | null = null
  private triggerRepo: Repository<TriggerDef> | null = null
  private runRepo: Repository<WorkflowRun> | null = null

  constructor() {
    // 引擎内部以 system 角色调用下游 Tool（全权限）；外部 caller 仍受自身 ACL 约束
    super('system')

    // C1: 先从 localStorage 加载 defs（向后兼容旧数据）
    this.loadDefsFromLocalStorage()

    // C1/C2/C3/D2: 异步从 IndexedDB 加载更完整的状态，并重建调度/触发/恢复
    this.initFromIndexedDB().catch((err) =>
      logger.warn('[WorkflowServer] IndexedDB init failed, running in memory-only mode', { error: err }),
    )

    logger.info('[WorkflowServer] initialized', { loadedDefs: this.defs.size })
  }

  /**
   * 异步初始化：从 IndexedDB 加载数据 + 重建调度器 + 重订阅事件 + 恢复中断运行。
   *
   * 设计原则：
   * - 内存是主存储，IndexedDB 是异步备份层
   * - initFromIndexedDB 失败时静默降级为纯内存运行（不阻止 Server 启动）
   * - 测试环境无 IndexedDB 时自动降级（与之前行为一致）
   */
  private async initFromIndexedDB(): Promise<void> {
    // 初始化 Repository（DB 不可用时静默返回 null）
    await this.initRepositories()
    if (!this.defRepo) return // DB 不可用，纯内存运行

    // C1: 从 IndexedDB 加载 defs（不覆盖内存中已从 localStorage 加载的）
    try {
      const storedDefs = await this.defRepo.getAll()
      for (const d of storedDefs) {
        if (!this.defs.has(d.id)) {
          this.defs.set(d.id, d)
        }
      }
    } catch (err) {
      logger.warn('[WorkflowServer] load defs from IndexedDB failed', { error: err })
    }

    // C2: 从 IndexedDB 加载 schedules + 重建定时器
    try {
      const storedSchedules = this.scheduleRepo ? await this.scheduleRepo.getAll() : []
      for (const s of storedSchedules) {
        this.schedules.set(s.id, s)
      }
      this.rebuildSchedules()
    } catch (err) {
      logger.warn('[WorkflowServer] load schedules from IndexedDB failed', { error: err })
    }

    // C3: 从 IndexedDB 加载 triggers + 重订阅事件
    try {
      const storedTriggers = this.triggerRepo ? await this.triggerRepo.getAll() : []
      for (const t of storedTriggers) {
        this.triggers.set(t.id, t)
      }
      this.resubscribeTriggers()
    } catch (err) {
      logger.warn('[WorkflowServer] load triggers from IndexedDB failed', { error: err })
    }

    // D2: 从 IndexedDB 加载未完成的 runs + 标记中断
    try {
      const storedRuns = this.runRepo ? await this.runRepo.getAll() : []
      for (const r of storedRuns) {
        this.runs.set(r.runId, r)
      }
      this.recoverIncompleteRuns()
      this.pruneExpiredRuns()
    } catch (err) {
      logger.warn('[WorkflowServer] load runs from IndexedDB failed', { error: err })
    }
  }

  /**
   * 安全初始化 Repository 实例（IndexedDB 不可用时静默降级）。
   */
  private async initRepositories(): Promise<void> {
    try {
      this.defRepo = createRepository<WorkflowDef>({
        store: STORE_NAME.workflowDefs,
        writeAction: 'saveWorkflowDef',
        deleteAction: 'deleteWorkflowDef',
        keyOf: (d) => d.id,
      })
      this.scheduleRepo = createRepository<ScheduleDef>({
        store: STORE_NAME.workflowSchedules,
        writeAction: 'saveWorkflowSchedule',
        deleteAction: 'deleteWorkflowSchedule',
        keyOf: (s) => s.id,
      })
      this.triggerRepo = createRepository<TriggerDef>({
        store: STORE_NAME.workflowTriggers,
        writeAction: 'saveWorkflowTrigger',
        deleteAction: 'deleteWorkflowTrigger',
        keyOf: (t) => t.id,
      })
      this.runRepo = createRepository<WorkflowRun>({
        store: STORE_NAME.workflowRuns,
        writeAction: 'saveWorkflowRun',
        deleteAction: 'saveWorkflowRun', // run 不删除，用 TTL 清理
        keyOf: (r) => r.runId,
      })
    } catch (err) {
      logger.warn('[WorkflowServer] Repository init failed, running in memory-only mode', {
        error: err instanceof Error ? err.message : String(err),
      })
      this.defRepo = null
      this.scheduleRepo = null
      this.triggerRepo = null
      this.runRepo = null
    }
  }

  /**
   * 重建定时调度器（C2）：遍历已加载的 schedules，为 enabled=true 的重建 setInterval。
   */
  private rebuildSchedules(): void {
    let count = 0
    for (const [, s] of this.schedules) {
      if (!s.enabled) continue
      const intervalMs = this.toMs(s.every)
      if (intervalMs <= 0) continue
      const id = s.id
      const timer = setInterval(() => {
        const sch = this.schedules.get(id)
        if (!sch?.enabled) return
        sch.lastRunAt = Date.now()
        sch.nextRunAt = Date.now() + intervalMs
        void this.runScheduled(id)
      }, intervalMs)
      this.scheduleTimers.set(id, timer)
      count++
    }
    if (count > 0) {
      logger.info('[WorkflowServer] rebuildSchedules', { restored: count })
    }
  }

  /**
   * 重订阅事件触发器（C3）：遍历已加载的 triggers，为 enabled=true 的重建 eventBus.on()。
   */
  private resubscribeTriggers(): void {
    let count = 0
    for (const [, t] of this.triggers) {
      if (!t.enabled) continue
      const id = t.id
      const unsub = eventBus.on(t.event, (payload) => {
        const trig = this.triggers.get(id)
        if (!trig?.enabled) return
        const targets = trig.targets ?? this.extractTargetsFromPayload(payload)
        void this.runTriggered(id, targets)
      })
      this.triggerUnsubs.set(id, unsub)
      count++
    }
    if (count > 0) {
      logger.info('[WorkflowServer] resubscribeTriggers', { restored: count })
    }
  }

  /**
   * 恢复中断的运行（D2）：标记 status='running' 的 run 为失败。
   * 进程崩溃时正在执行的 run 会卡在 running 态，需要标记为 failed。
   */
  private recoverIncompleteRuns(): void {
    let count = 0
    for (const [, r] of this.runs) {
      if (r.status === 'running') {
        r.status = 'failed'
        r.error = 'interrupted by server restart'
        r.finishedAt = Date.now()
        count++
      }
    }
    if (count > 0) {
      logger.info('[WorkflowServer] recoverIncompleteRuns', { recovered: count })
    }
  }

  /**
   * 清理过期运行记录（D2）：删除 createdAt > RUN_HISTORY_RETENTION_DAYS 的已终态 run。
   */
  private pruneExpiredRuns(): void {
    const cutoff = Date.now() - RUN_HISTORY_RETENTION_DAYS * 86_400_000
    const terminalStates = new Set<RunStatus>(['success', 'failed', 'partial', 'cancelled'])
    let count = 0
    for (const [id, r] of this.runs) {
      if (terminalStates.has(r.status) && r.createdAt < cutoff) {
        this.runs.delete(id)
        count++
      }
    }
    if (count > 0) {
      logger.info('[WorkflowServer] pruneExpiredRuns', { pruned: count })
    }
  }

  // ============================================================
  // Tool 定义
  // ============================================================

  protected getTools(): ToolDescriptor[] {
    return [
      // ---------- 工作流 CRUD ----------
      {
        name: 'create_workflow',
        description: '创建投研工作流定义（链式步骤）。步骤 type 支持 mcp_tool(调用其他Server的Tool)/delay(等待)/note(标记)。mcp_tool 的 args 支持变量 {{target}}(当前标的) 与 {{steps.<id>.output}}(上一步输出)。',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '工作流名称' },
            description: { type: 'string', description: '工作流描述（可选）' },
            steps: {
              type: 'array',
              description: '步骤数组，按序串行执行',
              items: { type: 'object', description: '单步：{ id, type, server?, tool?, args?, ms?, onError?, retry? }' },
            },
          },
          required: ['name', 'steps'],
        },
        handler: async (args) => {
          const name = args.name as string
          const description = (args.description as string | undefined) ?? undefined
          const steps = (args.steps as WorkflowStep[]) ?? []
          if (!Array.isArray(steps) || steps.length === 0) {
            return this.err('steps 必须为非空数组')
          }
          const id = this.genId('wf')
          const now = Date.now()
          const def: WorkflowDef = { id, name, description, steps, createdAt: now, updatedAt: now }
          this.defs.set(id, def)
          this.persistDefs()
          this.persistDefToRepo(def)
          logger.info('[WorkflowServer] create_workflow', { id, name, stepCount: steps.length })
          return this.ok(def)
        },
      },
      {
        name: 'list_workflows',
        description: '列出所有已定义的工作流（含步骤数、创建时间）',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          const list = Array.from(this.defs.values()).map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description ?? '',
            stepCount: d.steps.length,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }))
          return this.ok(list)
        },
      },
      {
        name: 'get_workflow',
        description: '获取指定工作流的完整定义（含全部步骤）',
        inputSchema: {
          type: 'object',
          properties: { workflowId: { type: 'string', description: '工作流 ID' } },
          required: ['workflowId'],
        },
        handler: async (args) => {
          const def = this.defs.get(args.workflowId as string)
          if (!def) return this.err(`workflow not found: ${String(args.workflowId)}`)
          return this.ok(def)
        },
      },
      {
        name: 'update_workflow',
        description: '更新工作流定义（name/description/steps 部分更新，未传字段保持不变）',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流 ID' },
            name: { type: 'string', description: '新名称（可选）' },
            description: { type: 'string', description: '新描述（可选）' },
            steps: { type: 'array', description: '新步骤数组（可选，替换全部）', items: { type: 'object' } },
          },
          required: ['workflowId'],
        },
        handler: async (args) => {
          const def = this.defs.get(args.workflowId as string)
          if (!def) return this.err(`workflow not found: ${String(args.workflowId)}`)
          if (typeof args.name === 'string') def.name = args.name
          if (typeof args.description === 'string') def.description = args.description
          if (Array.isArray(args.steps)) def.steps = args.steps as WorkflowStep[]
          def.updatedAt = Date.now()
          this.persistDefs()
          this.persistDefToRepo(def)
          logger.info('[WorkflowServer] update_workflow', { id: def.id })
          return this.ok(def)
        },
      },
      {
        name: 'delete_workflow',
        description: '删除工作流定义（不影响已运行的实例）',
        inputSchema: {
          type: 'object',
          properties: { workflowId: { type: 'string', description: '工作流 ID' } },
          required: ['workflowId'],
        },
        handler: async (args) => {
          const ok = this.defs.delete(args.workflowId as string)
          if (!ok) return this.err(`workflow not found: ${String(args.workflowId)}`)
          this.persistDefs()
          this.deleteDefFromRepo(args.workflowId as string)
          logger.info('[WorkflowServer] delete_workflow', { id: args.workflowId })
          return this.ok({ deleted: true, workflowId: args.workflowId })
        },
      },

      // ---------- 执行与监控 ----------
      {
        name: 'run_workflow',
        description: '触发执行工作流，立即返回 runId（无状态：不会阻塞等待完成）。支持 targets 批处理（对每个标的顺序跑完整步骤链）。用 get_run_status(runId) 轮询进度与结果。',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流 ID' },
            targets: { type: 'array', description: '批处理标的列表（如股票代码）；不填则无标的单次运行', items: { type: 'string' } },
            trigger: { type: 'string', description: '触发来源标记（默认 manual），用于审计', default: 'manual' },
          },
          required: ['workflowId'],
        },
        handler: async (args) => {
          const def = this.defs.get(args.workflowId as string)
          if (!def) return this.err(`workflow not found: ${String(args.workflowId)}`)
          const targets = Array.isArray(args.targets) ? (args.targets as string[]) : []
          const run = this.createRun(def, targets, (args.trigger as string) ?? 'manual')
          void this.executeRun(run).catch((err) =>
            logger.error('[WorkflowServer] executeRun unexpected error', { runId: run.runId, error: err }),
          )
          logger.info('[WorkflowServer] run_workflow started', { runId: run.runId, targets: targets.length })
          return this.ok({
            runId: run.runId,
            status: run.status,
            targets,
            message: 'Workflow started. Poll get_run_status with runId.',
          })
        },
      },
      {
        name: 'get_run_status',
        description: '查询某次运行的实时状态、进度、逐步结果与错误。支持 stepResults 分页（limit/offset）。',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: '运行 ID' },
            limit: { type: 'number', description: 'stepResults 返回条数上限（默认 100，填 0 则不返回）', default: 100 },
            offset: { type: 'number', description: 'stepResults 起始偏移（默认 0）', default: 0 },
          },
          required: ['runId'],
        },
        handler: async (args) => {
          const run = this.runs.get(args.runId as string)
          if (!run) return this.err(`run not found: ${String(args.runId)}`)
          const resultLimit = typeof args.limit === 'number' ? (args.limit) : 100
          const resultOffset = typeof args.offset === 'number' ? (args.offset) : 0
          const totalStepResults = run.stepResults.length
          const page = resultLimit <= 0
            ? []
            : run.stepResults.slice(resultOffset, resultOffset + resultLimit)
          return this.ok({
            ...run,
            stepResults: page,
            stepResultsTotal: totalStepResults,
            stepResultsPage: { offset: resultOffset, limit: resultLimit, returned: page.length },
          })
        },
      },
      {
        name: 'list_runs',
        description: '列出运行历史（默认倒序，可按工作流过滤、限制数量）',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '按工作流过滤（可选）' },
            limit: { type: 'number', description: '返回条数上限（默认 50）', default: 50 },
          },
        },
        handler: async (args) => {
          const workflowId = args.workflowId as string | undefined
          const limit = typeof args.limit === 'number' ? (args.limit) : 50
          const list = Array.from(this.runs.values())
            .filter((r) => (workflowId ?? '') === '' || r.workflowId === workflowId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit)
            .map((r) => ({
              runId: r.runId,
              workflowId: r.workflowId,
              workflowName: r.workflowName,
              status: r.status,
              targetCount: r.targets.length,
              stepResults: r.stepResults.length,
              trigger: r.trigger,
              createdAt: r.createdAt,
              finishedAt: r.finishedAt,
            }))
          return this.ok(list)
        },
      },
      {
        name: 'cancel_run',
        description: '取消正在运行的实例（已完成的步骤结果保留）',
        inputSchema: {
          type: 'object',
          properties: { runId: { type: 'string', description: '运行 ID' } },
          required: ['runId'],
        },
        handler: async (args) => {
          const run = this.runs.get(args.runId as string)
          if (!run) return this.err(`run not found: ${String(args.runId)}`)
          if (run.status === 'success' || run.status === 'failed' || run.status === 'cancelled') {
            return this.ok({ cancelled: false, status: run.status, message: 'run already finished' })
          }
          run.cancelled = true
          run.status = 'cancelled'
          run.finishedAt = Date.now()
          logger.info('[WorkflowServer] cancel_run', { runId: run.runId })
          return this.ok({ cancelled: true, runId: run.runId, status: run.status })
        },
      },

      // ---------- 定时调度 ----------
      {
        name: 'schedule_workflow',
        description: '注册定时调度：按固定间隔自动运行工作流（单位 ms/seconds/minutes/hours/days）。返回调度 ID 与下次运行时间。',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流 ID' },
            everyUnit: {
              type: 'string',
              description: '执行间隔单位',
              enum: ['ms', 'seconds', 'minutes', 'hours', 'days'],
            },
            everyValue: { type: 'number', description: '间隔数值（>=1）' },
            targets: { type: 'array', description: '批处理标的（可选）', items: { type: 'string' } },
          },
          required: ['workflowId', 'every'],
        },
        handler: async (args) => {
          const def = this.defs.get(args.workflowId as string)
          if (!def) return this.err(`workflow not found: ${String(args.workflowId)}`)
          const every = args.every as ScheduleEvery
          const intervalMs = this.toMs(every)
          if (intervalMs <= 0) return this.err('every.value 必须为正数')
          const id = this.genId('sch')
          const now = Date.now()
          const schedule: ScheduleDef = {
            id,
            workflowId: def.id,
            workflowName: def.name,
            every,
            targets: Array.isArray(args.targets) ? (args.targets as string[]) : undefined,
            enabled: true,
            nextRunAt: now + intervalMs,
            createdAt: now,
          }
          this.schedules.set(id, schedule)
          // C2: write-through 持久化到 IndexedDB（fire-and-forget）
          this.persistScheduleToRepo(schedule)
          const timer = setInterval(() => {
            const s = this.schedules.get(id)
            if (!s?.enabled) return
            s.lastRunAt = Date.now()
            s.nextRunAt = Date.now() + intervalMs
            void this.runScheduled(id)
          }, intervalMs)
          this.scheduleTimers.set(id, timer)
          logger.info('[WorkflowServer] schedule_workflow', { id, workflowId: def.id, intervalMs })
          return this.ok(schedule)
        },
      },
      {
        name: 'list_schedules',
        description: '列出所有定时调度',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          return this.ok(Array.from(this.schedules.values()))
        },
      },
      {
        name: 'remove_schedule',
        description: '移除定时调度并停止其定时器',
        inputSchema: {
          type: 'object',
          properties: { scheduleId: { type: 'string', description: '调度 ID' } },
          required: ['scheduleId'],
        },
        handler: async (args) => {
          const ok = this.removeSchedule(args.scheduleId as string)
          if (!ok) return this.err(`schedule not found: ${String(args.scheduleId)}`)
          return this.ok({ removed: true, scheduleId: args.scheduleId })
        },
      },

      // ---------- 事件触发 ----------
      {
        name: 'register_trigger',
        description: '注册事件触发器：当指定 EventBus 事件发生时自动运行工作流（如数据采集完成事件）。返回触发器 ID。',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流 ID' },
            event: { type: 'string', description: '订阅的 EventBus 事件名（如 collect:complete）' },
            targets: { type: 'array', description: '事件触发时注入的标的（可选；不填则尝试从事件 payload 提取 symbol）', items: { type: 'string' } },
          },
          required: ['workflowId', 'event'],
        },
        handler: async (args) => {
          const def = this.defs.get(args.workflowId as string)
          if (!def) return this.err(`workflow not found: ${String(args.workflowId)}`)
          const event = args.event as string
          if (!event) return this.err('event 不能为空')
          const id = this.genId('trig')
          const now = Date.now()
          const trigger: TriggerDef = {
            id,
            workflowId: def.id,
            workflowName: def.name,
            event,
            targets: Array.isArray(args.targets) ? (args.targets as string[]) : undefined,
            enabled: true,
            createdAt: now,
          }
          const unsub = eventBus.on(event, (payload) => {
            const t = this.triggers.get(id)
            if (!t?.enabled) return
            const targets = t.targets ?? this.extractTargetsFromPayload(payload)
            void this.runTriggered(id, targets)
          })
          this.triggers.set(id, trigger)
          this.triggerUnsubs.set(id, unsub)
          // C3: write-through 持久化到 IndexedDB（fire-and-forget）
          this.persistTriggerToRepo(trigger)
          logger.info('[WorkflowServer] register_trigger', { id, event, workflowId: def.id })
          return this.ok(trigger)
        },
      },
      {
        name: 'list_triggers',
        description: '列出所有事件触发器',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          return this.ok(Array.from(this.triggers.values()))
        },
      },
      {
        name: 'remove_trigger',
        description: '移除事件触发器并取消订阅',
        inputSchema: {
          type: 'object',
          properties: { triggerId: { type: 'string', description: '触发器 ID' } },
          required: ['triggerId'],
        },
        handler: async (args) => {
          const ok = this.removeTrigger(args.triggerId as string)
          if (!ok) return this.err(`trigger not found: ${String(args.triggerId)}`)
          return this.ok({ removed: true, triggerId: args.triggerId })
        },
      },

      // ---------- 导出/导入（F4） ----------
      {
        name: 'export_workflows',
        description: '导出全部工作流定义为 JSON 字符串（含 defs/schedules/triggers），用于备份与迁移',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          const payload = {
            exportedAt: Date.now(),
            version: '1.0',
            defs: Array.from(this.defs.values()),
            schedules: Array.from(this.schedules.values()),
            triggers: Array.from(this.triggers.values()),
          }
          return this.ok(payload)
        },
      },
      {
        name: 'import_workflows',
        description: '从 JSON 字符串导入工作流定义。支持增量导入（同名不覆盖）。返回导入统计。',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: '由 export_workflows 导出的完整 JSON 字符串',
            },
            overwrite: {
              type: 'boolean',
              description: '是否覆盖已有同名定义（默认 false=跳过已有）',
              default: false,
            },
          },
          required: ['data'],
        },
        handler: async (args) => {
          const overwrite = args.overwrite === true
          let payload: { defs?: WorkflowDef[]; schedules?: ScheduleDef[]; triggers?: TriggerDef[] }
          try {
            payload = JSON.parse(args.data as string) as { defs?: WorkflowDef[]; schedules?: ScheduleDef[]; triggers?: TriggerDef[] }
          } catch (err) { logger.warn('[workflowServer.ts]', { error: err });
            return this.err('data 不是有效的 JSON 字符串')
          }
          const stats = { imported: 0, skipped: 0, errors: 0 }
          if (Array.isArray(payload.defs)) {
            for (const d of payload.defs) {
              if (!d.id || !d.name || !Array.isArray(d.steps)) {
                stats.errors++
                continue
              }
              if (this.defs.has(d.id) && !overwrite) {
                stats.skipped++
                continue
              }
              d.updatedAt = Date.now()
              this.defs.set(d.id, d)
              this.persistDefs()
              this.persistDefToRepo(d)
              stats.imported++
            }
          }
          return this.ok(stats)
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'workflow://defs',
        name: '工作流定义列表',
        description: '所有已定义工作流的完整定义',
        mimeType: 'application/json',
        resolver: async (uri) => this.safeResolve(uri, Array.from(this.defs.values())),
      },
      {
        uriTemplate: 'workflow://runs',
        name: '运行实例快照',
        description: '当前所有运行实例的状态快照',
        mimeType: 'application/json',
        resolver: async (uri) => this.safeResolve(uri, Array.from(this.runs.values())),
      },
      {
        uriTemplate: 'workflow://schedules',
        name: '定时调度列表',
        description: '所有定时调度定义',
        mimeType: 'application/json',
        resolver: async (uri) => this.safeResolve(uri, Array.from(this.schedules.values())),
      },
      {
        uriTemplate: 'workflow://{runId}/run',
        name: '单个运行详情',
        description: '按 runId 查询某次运行的完整详情',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const match = uri.match(/^workflow:\/\/([^/]+)\/run$/)
          const runId = match?.[1] ?? ''
          const run = runId !== '' ? this.runs.get(runId) : undefined
          if (run === undefined) return { uri, mimeType: 'application/json', text: JSON.stringify({ error: `run not found: ${runId}` }) }
          return this.safeResolve(uri, run)
        },
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'workflow_designer',
        description: '引导 AI Agent 设计投研工作流的 Prompt 模板',
        arguments: [
          { name: 'goal', description: '工作流要达成的业务目标（如"每日收盘后对新纳入股票池的标的做评分并生成简报"）', required: true },
          { name: 'availableServers', description: '可编排的 Server/Tool 清单（可选，用于约束步骤设计）', required: false },
        ],
        generator: async (args) => {
          const goal = args.goal ?? ''
          const servers = args.availableServers ?? '（请先通过 MCPBridge.listAllTools() 获取可用 Tool 清单）'
          const text = [
            '你是一名投研工作流架构师。请基于以下目标设计一个 MCP 工作流定义。',
            '',
            `目标：${goal}`,
            '',
            '可用能力：',
            String(servers),
            '',
            '设计要求：',
            '1. 每个步骤 type 为 mcp_tool / delay / note。',
            '2. mcp_tool 步骤需指定 server 与 tool，args 中用 {{target}} 引用当前标的、{{steps.<id>.output}} 引用上一步输出。',
            '3. 需要批量处理多个标的时，在 run_workflow 的 targets 参数传入列表，步骤链会自动对每个标的重跑。',
            '4. 易错步骤设置 onError: "continue" 避免单点失败中断整体；必要时设置 retry。',
            '',
            '请输出符合 create_workflow 工具 inputSchema 的 JSON（name / description / steps[]）。',
          ].join('\n')
          return [{ role: 'user', content: { type: 'text', text } }]
        },
      },
    ]
  }

  // ============================================================
  // 执行引擎
  // ============================================================

  /**
   * 创建运行实例（pending 状态，不立即执行）
   */
  private createRun(def: WorkflowDef, targets: string[], trigger: string): WorkflowRun {
    const run: WorkflowRun = {
      runId: this.genId('run'),
      workflowId: def.id,
      workflowName: def.name,
      status: 'pending',
      targets,
      currentTargetIndex: 0,
      stepResults: [],
      createdAt: Date.now(),
      trigger,
    }
    this.runs.set(run.runId, run)
    this.pruneRuns()
    return run
  }

  /**
   * 清理超出上限的运行实例，防止内存无限增长（A3）。
   *
   * 按 createdAt 升序排列，删除最旧的记录直到 size <= MAX_RUNS_IN_MEMORY。
   */
  private pruneRuns(): void {
    if (this.runs.size <= MAX_RUNS_IN_MEMORY) return
    const sorted = [...this.runs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    const toRemove = sorted.slice(0, sorted.length - MAX_RUNS_IN_MEMORY)
    for (const [id] of toRemove) {
      this.runs.delete(id)
    }
    if (toRemove.length > 0) {
      logger.info('[WorkflowServer] pruneRuns', { removed: toRemove.length, remaining: this.runs.size })
    }
  }

  /**
   * 执行整个运行：对每个标的串行跑完整步骤链，收集结果并更新状态。
   * 该方法 fire-and-forget（run_workflow 同步返回 runId，agent 轮询）。
   *
   * 容错设计（A1）：顶层 try-catch 兜底，确保任何未捕获异常都将 run 标记为 failed，
   * 防止僵尸 run（status='running' 永不到终态）。
   * 监控设计（A4）：用 recordPerf 记录执行耗时，支持 P50/P95/max 聚合统计。
  /**
   * 统一判断 run 是否已取消（消除 executeRun 中 3 处重复条件）。
   */
  private isCancelled(run: WorkflowRun): boolean {
    return (run.cancelled ?? false) === true
  }

  /**
   * 判定 run 的最终状态，消除 executeRun 中的深层 if-else 链。
   */
  private resolveRunStatus(run: WorkflowRun, aborted: boolean): RunStatus {
    if (this.isCancelled(run)) return 'cancelled'
    if (aborted) return 'failed'
    const anyFailed = run.stepResults.some((r) => r.status === 'failed')
    if (!anyFailed) return 'success'
    return run.stepResults.every((r) => r.status === 'failed') ? 'failed' : 'partial'
  }

  /**
   * 处理单个 target 的所有 step，返回 true 表示执行被中止（取消/失败）。
   * 提取自 executeRun 内层循环，将嵌套层级从 9 层降至 4 层（audit:complexity L3）。
   */
  private async processTargetSteps(
    run: WorkflowRun,
    def: WorkflowDef,
    target: string,
  ): Promise<boolean> {
    const prevOutputs: Record<string, unknown> = {}

    for (const step of def.steps) {
      if (this.isCancelled(run)) return true

      const result = await this.executeStep(step, target, prevOutputs)
      run.stepResults.push(result)
      // D1: checkpoint — 每步完成时异步写 IndexedDB（fire-and-forget，不阻塞执行）
      this.persistRunCheckpoint(run)

      if (result.status === 'success' && result.output !== undefined) {
        prevOutputs[step.id] = result.output
      }

      if (result.status === 'failed') {
        if (step.onError !== 'continue') return true
        logger.warn('[WorkflowServer] step failed but continue', { stepId: step.id, runId: run.runId })
      }
    }
    return false
  }

  private async executeRun(run: WorkflowRun): Promise<void> {
    const runStartTime = performance.now()
    try {
      const def = this.defs.get(run.workflowId)
      if (!def) {
        run.status = 'failed'
        run.error = 'workflow definition not found'
        run.finishedAt = Date.now()
        return
      }
      run.status = 'running'
      logger.info('[WorkflowServer] executeRun start', { runId: run.runId, targets: run.targets.length })

      const targetList = run.targets.length > 0 ? run.targets : ['']
      let aborted = false

      for (const target of targetList) {
        if (this.isCancelled(run)) break
        run.currentTargetIndex++
        if (await this.processTargetSteps(run, def, target)) {
          aborted = true
          break
        }
      }

      run.status = this.resolveRunStatus(run, aborted)
      run.finishedAt = Date.now()
      logger.info('[WorkflowServer] executeRun done', { runId: run.runId, status: run.status })
    } catch (err) {
      // A1: 顶层兜底 —— 任何未捕获异常都将 run 标记为 failed，防僵尸 run
      run.status = 'failed'
      run.error = err instanceof Error ? err.message : String(err)
      run.finishedAt = Date.now()
      logger.error('[WorkflowServer] executeRun crashed', { runId: run.runId, error: run.error })
    } finally {
      // A4: 记录执行耗时到性能监控
      const durationMs = performance.now() - runStartTime
      const ok = run.status === 'success'
      recordPerf(PERF_WORKFLOW.EXECUTE_RUN, durationMs, ok, {
        runId: run.runId,
        status: run.status,
        targets: run.targets.length,
        steps: run.stepResults.length,
      })
    }
  }

  /**
   * 执行单个步骤（含重试、变量替换与超时保护）。
   *
   * 容错设计（A2）：mcp_tool 类型步骤用 Promise.race 实现超时保护，
   * 默认 STEP_TIMEOUT_MS=5min，防止下游 tool 挂起导致 run 永久 stuck。
   * 监控设计（A4）：用 recordPerf 记录每步耗时，支持 P50/P95/max 聚合统计。
   */
  private async executeStep(
    step: WorkflowStep,
    target: string,
    prevOutputs: Record<string, unknown>,
  ): Promise<StepRunResult> {
    const stepStartTime = performance.now()
    const startedAt = Date.now()
    const base = { stepId: step.id, stepName: step.name, target, startedAt, finishedAt: startedAt }

    try {
      if (step.type === 'delay') {
        const ms = typeof step.ms === 'number' ? step.ms : 0
        await this.sleep(ms)
        return { ...base, status: 'success', output: { waitedMs: ms }, finishedAt: Date.now() }
      }

      if (step.type === 'note') {
        return { ...base, status: 'success', output: { note: step.name ?? step.id }, finishedAt: Date.now() }
      }

      if (step.type === 'mcp_tool') {
        // A2: 超时保护 —— 用 Promise.race 确保 mcp_tool 不会无限挂起
        const result = await this.executeMcpToolWithTimeout(step, target, prevOutputs, base)
        return result
      }

      return { ...base, status: 'failed', error: `unknown step type: ${String(step.type)}`, finishedAt: Date.now() }
    } catch (err) {
      return {
        ...base,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        finishedAt: Date.now(),
      }
    } finally {
      // A4: 记录步骤耗时到性能监控
      const durationMs = performance.now() - stepStartTime
      recordPerf(PERF_WORKFLOW.EXECUTE_STEP, durationMs, true, {
        stepId: step.id,
        stepType: step.type,
        target,
      })
    }
  }

  /**
   * 带超时保护的 mcp_tool 步骤执行（A2）。
   *
   * 用 Promise.race 将实际调用与超时 Promise 竞速，
   * 超时后返回 failed 结果而非无限等待。
   *
   * 重构（audit:complexity）：原 for→try→catch→if 嵌套达 depth=4。
   * 抽出 attemptMcpStep helper 收 try-catch，主循环仅剩 for→if (depth=2)。
   */
  private async executeMcpToolWithTimeout(
    step: WorkflowStep,
    target: string,
    prevOutputs: Record<string, unknown>,
    base: { stepId: string; stepName?: string; target: string; startedAt: number; finishedAt: number },
  ): Promise<StepRunResult> {
    const retry = typeof step.retry === 'number' ? step.retry : 0
    let lastErr: string | undefined

    for (let attempt = 0; attempt <= retry; attempt++) {
      const outcome = await this.attemptMcpStep(step, target, prevOutputs, base)
      if (outcome.ok) return outcome.result
      lastErr = outcome.error
      if (attempt < retry) {
        logger.warn('[WorkflowServer] step retry', { stepId: step.id, attempt, error: lastErr })
        continue
      }
    }
    return { ...base, status: 'failed', error: lastErr, finishedAt: Date.now() }
  }

  /**
   * 单次 mcp_tool 步骤尝试：解析 server → 替换变量 → Promise.race 超时 → 解析结果。
   * 抽出后 try-catch 内的 if 最高仅 depth=2，避免触发 deeplyNestedBlocks 闸门。
   */
  private async attemptMcpStep(
    step: WorkflowStep,
    target: string,
    prevOutputs: Record<string, unknown>,
    base: { stepId: string; stepName?: string; target: string; startedAt: number; finishedAt: number },
  ): Promise<{ ok: true; result: StepRunResult } | { ok: false; error: string }> {
    try {
      const server = this.resolveServer(step.server ?? '')
      if (!server) throw new Error(`server not found: ${step.server}`)
      const resolvedArgs = this.resolveArgs(step.args ?? {}, target, prevOutputs)
      const ctx: McpCallerContext = { caller: 'system' }

      // A2: Promise.race 超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`step "${step.id}" timed out after ${STEP_TIMEOUT_MS}ms`)),
          STEP_TIMEOUT_MS,
        )
      })
      const res = await Promise.race([
        server.callTool(step.tool ?? '', resolvedArgs, ctx),
        timeoutPromise,
      ])
      if ((res.isError ?? false) === true) throw new Error(this.extractText(res))
      return { ok: true, result: { ...base, status: 'success', output: this.parseResult(res), finishedAt: Date.now() } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * 模糊解析目标 Server：先精确匹配 info.name，再按 "短名后缀" 匹配。
   */
  private resolveServer(name: string): MCPServer | undefined {
    if (!name) return undefined
    const exact = mcpRegistry.getServer(name)
    if (exact) return exact.server
    const found = mcpRegistry
      .listServers()
      .find((rs) => rs.server.info.name === name || rs.server.info.name.endsWith(':' + name))
    return found?.server
  }

  /**
   * 变量替换：递归处理 args 中的字符串占位符。
   * - `{{target}}` → 当前批处理标的
   * - `{{steps.<id>.output}}` 或 `{{steps.<id>.output.path.to.field}}` → 上一步输出（支持点路径）
   */
  private resolveArgs(
    args: Record<string, unknown>,
    target: string,
    prevOutputs: Record<string, unknown>,
  ): Record<string, unknown> {
    const replace = (val: unknown): unknown => {
      if (typeof val === 'string') {
        return val
          .replace(/\{\{target\}\}/g, target)
          .replace(/\{\{steps\.([\w-]+)\.output(?:\.([\w.]+))?\}\}/g, (_m, id: string, path?: string) => {
            const out = prevOutputs[id]
            if (out === undefined) return ''
            if (!path) return typeof out === 'string' ? out : JSON.stringify(out)
            const nested = path.split('.').reduce<unknown>((o, k) => ((o !== null && o !== undefined && typeof o === 'object') ? (o as Record<string, unknown>)[k] : undefined), out)
            return nested === undefined ? '' : typeof nested === 'string' ? nested : JSON.stringify(nested)
          })
      }
      if (Array.isArray(val)) return val.map(replace)
      if (val !== null && val !== undefined && typeof val === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(val)) out[k] = replace(v)
        return out
      }
      return val
    }
    return replace(args) as Record<string, unknown>
  }

  // ============================================================
  // 调度 / 触发
  // ============================================================

  /** 定时调度触发：运行目标工作流（使用调度自带 targets） */
  private async runScheduled(scheduleId: string): Promise<void> {
    const s = this.schedules.get(scheduleId)
    if (!s) return
    const def = this.defs.get(s.workflowId)
    if (!def) return
    const run = this.createRun(def, s.targets ?? [], `schedule:${scheduleId}`)
    logger.info('[WorkflowServer] scheduled run fired', { scheduleId, runId: run.runId })
    await this.executeRun(run)
  }

  /** 事件触发：运行目标工作流（使用触发器 targets 或从 payload 提取） */
  private async runTriggered(triggerId: string, targets: string[]): Promise<void> {
    const t = this.triggers.get(triggerId)
    if (!t) return
    const def = this.defs.get(t.workflowId)
    if (!def) return
    const run = this.createRun(def, targets, `event:${t.event}`)
    logger.info('[WorkflowServer] trigger fired', { triggerId, event: t.event, runId: run.runId })
    await this.executeRun(run)
  }

  /** 从事件 payload 中提取标的（尝试常见字段 symbol/code/targets） */
  private extractTargetsFromPayload(payload: unknown): string[] {
    if (payload === null || payload === undefined || typeof payload !== 'object') return []
    const p = payload as Record<string, unknown>
    if (typeof p.symbol === 'string') return [p.symbol]
    if (typeof p.code === 'string') return [p.code]
    if (Array.isArray(p.targets)) return p.targets.filter((x) => typeof x === 'string')
    if (Array.isArray(p.symbols)) return p.symbols.filter((x) => typeof x === 'string')
    return []
  }

  /** 移除调度并清理定时器（同步删内存 + 异步删 Repository） */
  private removeSchedule(id: string): boolean {
    const timer = this.scheduleTimers.get(id)
    if (timer) {
      clearInterval(timer)
      this.scheduleTimers.delete(id)
    }
    const existed = this.schedules.delete(id)
    if (existed && this.scheduleRepo) {
      void this.scheduleRepo.delete(id).catch(() => {})
    }
    return existed
  }

  /** 移除触发器并取消订阅（同步删内存 + 异步删 Repository） */
  private removeTrigger(id: string): boolean {
    const unsub = this.triggerUnsubs.get(id)
    if (unsub) {
      unsub()
      this.triggerUnsubs.delete(id)
    }
    const existed = this.triggers.delete(id)
    if (existed && this.triggerRepo) {
      void this.triggerRepo.delete(id).catch(() => {})
    }
    return existed
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /** 清理所有定时器与事件订阅（页面/进程销毁时调用，防内存泄漏） */
  dispose(): void {
    this.scheduleTimers.forEach((t) => clearInterval(t))
    this.scheduleTimers.clear()
    this.triggerUnsubs.forEach((u) => u())
    this.triggerUnsubs.clear()
    logger.info('[WorkflowServer] disposed')
  }

  /** 成功结果封装 */
  private ok(data: unknown): ToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }

  /** 错误结果封装 */
  private err(message: string): ToolResult {
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }
  }

  /** 生成带前缀的唯一 ID */
  private genId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  /** 间隔单位换算为毫秒 */
  private toMs(every: ScheduleEvery): number {
    const unitMs = UNIT_TO_MS[every.unit]
    const value = typeof every.value === 'number' ? every.value : 0
    return unitMs * value
  }

  /** 提取 ToolResult 的纯文本 */
  private extractText(res: ToolResult): string {
    const texts = (res.content ?? []).map((c) => c.text).filter((t): t is string => Boolean(t))
    return texts.join('\n') || 'tool returned error'
  }

  /** 解析下游 Tool 返回文本（尝试 JSON，失败则原样返回） */
  private parseResult(res: ToolResult): unknown {
    const joined = this.extractText(res)
    try {
      return JSON.parse(joined)
    } catch (err) { logger.warn('[workflowServer.ts]', { error: err });
      return joined
    }
  }

  /** Promise 延时 */
  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** 安全序列化资源内容（避免循环引用导致 JSON.stringify 崩溃） */
  private safeResolve(uri: string, data: unknown): { uri: string; mimeType: string; text: string } {
    let text: string
    try {
      text = JSON.stringify(data, null, 2)
    } catch (err) {
      text = JSON.stringify({ error: 'serialization failed', detail: err instanceof Error ? err.message : String(err) })
    }
    return { uri, mimeType: 'application/json', text }
  }

  /** 从 localStorage 加载持久化的工作流定义（向后兼容旧数据） */
  private loadDefsFromLocalStorage(): void {
    if (typeof globalThis.localStorage === 'undefined') return
    try {
      const raw = globalThis.localStorage.getItem(WORKFLOW_DEFS_STORAGE_KEY)
      if (!raw) return
      const arr = JSON.parse(raw) as WorkflowDef[]
      for (const d of arr) this.defs.set(d.id, d)
    } catch (err) {
      logger.warn('[WorkflowServer] loadDefsFromLocalStorage failed', { error: err })
    }
  }

  /** 持久化工作流定义到 localStorage（不可用时静默跳过） */
  private persistDefs(): void {
    if (typeof globalThis.localStorage === 'undefined') return
    try {
      globalThis.localStorage.setItem(WORKFLOW_DEFS_STORAGE_KEY, JSON.stringify(Array.from(this.defs.values())))
    } catch (err) {
      logger.warn('[WorkflowServer] persistDefs failed', { error: err })
    }
  }

  // ── IndexedDB write-through 辅助方法（fire-and-forget，失败静默降级） ──

  private persistDefToRepo(def: WorkflowDef): void {
    if (!this.defRepo) return
    void this.defRepo.put(def, def.id).catch(() => {})
  }

  private deleteDefFromRepo(id: string): void {
    if (!this.defRepo) return
    void this.defRepo.delete(id).catch(() => {})
  }

  private persistScheduleToRepo(schedule: ScheduleDef): void {
    if (!this.scheduleRepo) return
    void this.scheduleRepo.put(schedule, schedule.id).catch(() => {})
  }

  private persistTriggerToRepo(trigger: TriggerDef): void {
    if (!this.triggerRepo) return
    void this.triggerRepo.put(trigger, trigger.id).catch(() => {})
  }

  /**
   * 异步持久化运行实例到 IndexedDB（D1 checkpoint）。
   * 每步完成后由 executeRun 调用，fire-and-forget 不阻塞执行流。
   */
  private persistRunCheckpoint(run: WorkflowRun): void {
    if (!this.runRepo) return
    void this.runRepo.put(run, run.runId).catch(() => {})
  }
}
