/**
 * @fileoverview 工作流持久化实体类型
 *
 * 对应 IndexedDB `workflow_defs` / `workflow_schedules` / `workflow_triggers` /
 * `workflow_runs` 四个 store。
 */

/** 工作流步骤类型 */
export type WorkflowStepType = 'mcp_tool' | 'delay' | 'note'

/** 步骤执行出错时的处理策略 */
export type StepOnError = 'stop' | 'continue'

/** 工作流步骤定义 */
export interface WorkflowStep {
  /** 步骤唯一 ID */
  id: string
  /** 步骤类型 */
  type: WorkflowStepType
  /** 步骤名称（可选） */
  name?: string
  /** type=mcp_tool 时的目标 Server 名 */
  server?: string
  /** type=mcp_tool 时的 Tool 名 */
  tool?: string
  /** type=mcp_tool 时的参数（支持变量替换） */
  args?: Record<string, unknown>
  /** type=delay 时的等待毫秒数 */
  ms?: number
  /** 出错时策略：stop（默认）/ continue */
  onError?: StepOnError
  /** 失败重试次数（默认 0） */
  retry?: number
}

/** 工作流定义 */
export interface WorkflowDef {
  /** 工作流 ID */
  id: string
  /** 工作流名称 */
  name: string
  /** 描述 */
  description?: string
  /** 步骤列表（按数组顺序串行执行） */
  steps: WorkflowStep[]
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/** 运行实例状态 */
export type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled'

/** 单步执行结果 */
export interface StepRunResult {
  /** 对应步骤 ID */
  stepId: string
  /** 步骤名称 */
  stepName?: string
  /** 执行状态 */
  status: 'success' | 'failed' | 'skipped'
  /** 当前批处理标的（无标的运行则为空串） */
  target?: string
  /** 成功时的输出 */
  output?: unknown
  /** 失败时的错误信息 */
  error?: string
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  finishedAt: number
}

/** 工作流运行实例 */
export interface WorkflowRun {
  /** 运行 ID */
  runId: string
  /** 所属工作流 ID */
  workflowId: string
  /** 所属工作流名称 */
  workflowName: string
  /** 运行状态 */
  status: RunStatus
  /** 批处理标的列表（空数组表示无标的单次运行） */
  targets: string[]
  /** 当前处理到的标的索引 */
  currentTargetIndex: number
  /** 各步骤执行结果（扁平化，含 target 字段便于追溯） */
  stepResults: StepRunResult[]
  /** 创建时间 */
  createdAt: number
  /** 结束时间 */
  finishedAt?: number
  /** 整体错误信息 */
  error?: string
  /** 触发来源：manual / schedule:<id> / event:<eventName> */
  trigger?: string
  /** 取消标志（executeRun 循环检查） */
  cancelled?: boolean
}

/** 定时调度单位 */
export type ScheduleUnit = 'ms' | 'seconds' | 'minutes' | 'hours' | 'days'

/** 定时调度配置 */
export interface ScheduleEvery {
  /** 时间单位 */
  unit: ScheduleUnit
  /** 数值 */
  value: number
}

/** 定时调度定义 */
export interface ScheduleDef {
  /** 调度 ID */
  id: string
  /** 目标工作流 ID */
  workflowId: string
  /** 目标工作流名称 */
  workflowName: string
  /** 执行间隔 */
  every: ScheduleEvery
  /** 批处理标的（可选，不填则无标的运行） */
  targets?: string[]
  /** 是否启用 */
  enabled: boolean
  /** 下次运行时间 */
  nextRunAt?: number
  /** 上次运行时间 */
  lastRunAt?: number
  /** 创建时间 */
  createdAt: number
}

/** 事件触发器定义 */
export interface TriggerDef {
  /** 触发器 ID */
  id: string
  /** 目标工作流 ID */
  workflowId: string
  /** 目标工作流名称 */
  workflowName: string
  /** 订阅的 EventBus 事件名 */
  event: string
  /** 事件触发时注入的标的（可选；不填则尝试从事件 payload 提取 symbol） */
  targets?: string[]
  /** 是否启用 */
  enabled: boolean
  /** 创建时间 */
  createdAt: number
}
