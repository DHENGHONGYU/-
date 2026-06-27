/**
 * AI 智能体调度中心常量
 * @description 所有 Agent 状态、标签、颜色、图标配置均从此文件读取，组件内禁止硬编码
 */

// ============================================================
// Agent 运行状态枚举
// @remarks 与服务端 statusCode 保持一一映射
// ============================================================
export const AGENT_STATUS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  PAUSED: 'PAUSED',
} as const

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS]

/**
 * Agent 状态映射表
 * @description 将服务端返回的状态码映射为中文标签、颜色、图标等 UI 展示信息
 */
export const AI_AGENT_STATUS_MAP: Record<
  AgentStatus,
  {
    /** 中文状态标签 */
    label: string
    /** 语义化颜色 Token */
    color: string
    /** Tailwind 背景类 */
    bgClass: string
    /** Tailwind 文字类 */
    textClass: string
    /** 图标名称（配置驱动，组件内根据名称渲染对应图标） */
    icon: string
  }
> = {
  [AGENT_STATUS.NORMAL]: {
    label: '正常',
    color: '#22c55e',
    bgClass: 'bg-green-500',
    textClass: 'text-green-500',
    icon: 'check-circle',
  },
  [AGENT_STATUS.WARNING]: {
    label: '预警',
    color: '#f59e0b',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-500',
    icon: 'alert-triangle',
  },
  [AGENT_STATUS.ERROR]: {
    label: '异常',
    color: '#ef4444',
    bgClass: 'bg-red-500',
    textClass: 'text-red-500',
    icon: 'x-circle',
  },
  [AGENT_STATUS.PAUSED]: {
    label: '已暂停',
    color: '#9ca3af',
    bgClass: 'bg-gray-400',
    textClass: 'text-gray-400',
    icon: 'pause-circle',
  },
}

// ============================================================
// Agent 标签枚举
// @remarks 与服务端 tagCode 保持一一映射
// ============================================================
export const AGENT_TAG = {
  LLM: 'LLM',
  KNOWLEDGE: 'KNOWLEDGE',
  TOOL: 'TOOL',
  STRATEGY: 'STRATEGY',
} as const

export type AgentTag = (typeof AGENT_TAG)[keyof typeof AGENT_TAG]

/**
 * Agent 标签映射表
 */
export const AGENT_TAG_MAP: Record<
  AgentTag,
  {
    label: string
    color: string
    bgClass: string
    icon: string
  }
> = {
  [AGENT_TAG.LLM]: {
    label: 'LLM模型',
    color: '#8b5cf6',
    bgClass: 'bg-violet-500',
    icon: 'brain',
  },
  [AGENT_TAG.KNOWLEDGE]: {
    label: '知识库',
    color: '#3b82f6',
    bgClass: 'bg-blue-500',
    icon: 'book-open',
  },
  [AGENT_TAG.TOOL]: {
    label: '工具链',
    color: '#10b981',
    bgClass: 'bg-emerald-500',
    icon: 'wrench',
  },
  [AGENT_TAG.STRATEGY]: {
    label: '策略',
    color: '#f59e0b',
    bgClass: 'bg-amber-500',
    icon: 'trending-up',
  },
}

// ============================================================
// Agent 类型/角色映射（图标与名称配置）
// ============================================================
export const AGENT_TYPE_MAP: Record<
  string,
  {
    name: string
    icon: string
    description: string
  }
> = {
  agentAssistant: {
    name: 'Agent 助手',
    icon: 'bot',
    description: '通用对话与任务调度助手',
  },
  stockStrategy: {
    name: '股票策略',
    icon: 'line-chart',
    description: '量化选股与策略执行智能体',
  },
  llmIntegration: {
    name: '大模型集成',
    icon: 'brain-circuit',
    description: '多模型路由与推理编排',
  },
  knowledgeRetrieval: {
    name: '知识库检索',
    icon: 'search',
    description: '本地知识库与文档检索',
  },
}

// ============================================================
// 顶部总览卡片配置
// ============================================================
export const AGENT_OVERVIEW_CARDS = [
  { key: 'totalAgents', label: '智能体总数', icon: 'bot', color: '#3b82f6' },
  { key: 'knowledgeUsage', label: '知识库使用', icon: 'book-open', color: '#8b5cf6' },
  { key: 'taskExecutions', label: '任务执行', icon: 'zap', color: '#f59e0b' },
  { key: 'monitorAlerts', label: '监控告警', icon: 'bell', color: '#ef4444' },
] as const

// ============================================================
// 默认数据源配置
// ============================================================
export const AI_CENTER_DATA_SOURCE = {
  agents: {
    endpoint: '/ai-center/agents',
    mode: 'polling' as const,
    interval: 5000,
  },
  healthMetrics: {
    endpoint: '/ai-center/health',
    mode: 'polling' as const,
    interval: 5000,
  },
  diagnosticReports: {
    endpoint: '/ai-center/diagnostics',
    mode: 'polling' as const,
    interval: 10000,
  },
}
