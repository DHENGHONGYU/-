/**
 * 系统健康监控与诊断分析常量
 * @description 所有健康状态、评分等级、语义颜色均从此文件读取
  * @doc []
*/

import { COLOR_SHADES } from '@/constants/theme.tokens'

// ============================================================
// 健康状态枚举
// @remarks 与服务端 healthStatus/statusCode 保持一一映射
// ============================================================
export const HEALTH_STATUS = {
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
} as const

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS]

/**
 * 健康状态映射表 — 颜色全部从 COLOR_SHADES 读取，禁止裸 hex
 */
export const HEALTH_STATUS_MAP: Record<
  HealthStatus,
  {
    label: string
    color: string
    bgClass: string
    textClass: string
    icon: string
  }
> = {
  [HEALTH_STATUS.HEALTHY]: {
    label: '正常',
    color: COLOR_SHADES.green.hex[500],
    bgClass: 'bg-green-500',
    textClass: 'text-green-500',
    icon: 'check-circle',
  },
  [HEALTH_STATUS.WARNING]: {
    label: '预警',
    color: COLOR_SHADES.amber.hex[500],
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-500',
    icon: 'alert-triangle',
  },
  [HEALTH_STATUS.CRITICAL]: {
    label: '异常',
    color: COLOR_SHADES.red.hex[500],
    bgClass: 'bg-red-500',
    textClass: 'text-red-500',
    icon: 'x-circle',
  },
  [HEALTH_STATUS.UNKNOWN]: {
    label: '未知',
    color: COLOR_SHADES.gray.hex[400],
    bgClass: 'bg-gray-400',
    textClass: 'text-gray-400',
    icon: 'help-circle',
  },
}

// ============================================================
// 模块分类标签（健康监控顶部筛选）
// ============================================================
export const HEALTH_MODULE_CATEGORY = {
  CORE: 'CORE',
  SYSTEM: 'SYSTEM',
  AGENT: 'AGENT',
  DATA: 'DATA',
} as const

export type HealthModuleCategory = (typeof HEALTH_MODULE_CATEGORY)[keyof typeof HEALTH_MODULE_CATEGORY]

export const HEALTH_MODULE_CATEGORY_MAP: Record<HealthModuleCategory, string> = {
  [HEALTH_MODULE_CATEGORY.CORE]: '核心模块',
  [HEALTH_MODULE_CATEGORY.SYSTEM]: '系统组件',
  [HEALTH_MODULE_CATEGORY.AGENT]: '智能体',
  [HEALTH_MODULE_CATEGORY.DATA]: '数据服务',
}

// ============================================================
// 诊断报告等级
// ============================================================
export const DIAGNOSTIC_LEVEL = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  AVERAGE: 'AVERAGE',
  POOR: 'POOR',
} as const

export type DiagnosticLevel = (typeof DIAGNOSTIC_LEVEL)[keyof typeof DIAGNOSTIC_LEVEL]

/**
 * 诊断等级映射表 — 颜色全部从 COLOR_SHADES 读取，禁止裸 hex
 */
export const DIAGNOSTIC_LEVEL_MAP: Record<
  DiagnosticLevel,
  {
    label: string
    color: string
    bgClass: string
  }
> = {
  [DIAGNOSTIC_LEVEL.EXCELLENT]: { label: '优秀', color: COLOR_SHADES.green.hex[500], bgClass: 'bg-green-500' },
  [DIAGNOSTIC_LEVEL.GOOD]: { label: '良好', color: COLOR_SHADES.blue.hex[500], bgClass: 'bg-blue-500' },
  [DIAGNOSTIC_LEVEL.AVERAGE]: { label: '一般', color: COLOR_SHADES.amber.hex[500], bgClass: 'bg-amber-500' },
  [DIAGNOSTIC_LEVEL.POOR]: { label: '较差', color: COLOR_SHADES.red.hex[500], bgClass: 'bg-red-500' },
}

// ============================================================
// 健康评分阈值
// @remarks 用于将数值评分转换为等级状态
// ============================================================
export const HEALTH_SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  WARNING: 60,
}

// ============================================================
// 监控间隔（毫秒）
// ============================================================
export const MONITOR_INTERVALS = {
  AGENT_HEARTBEAT: 5000,
  AGENT_HEALTH: 15000,
  HEALTH_CHECK: 30000,
  LOG_POLL: 10000,
  ENGINE_STATUS: 15000,
  SYSTEM_SNAPSHOT: 60000,
  TASK_QUEUE: 2000,
  LOG_STREAM: 3000,
} as const

// ============================================================
// V6 引擎评分层级
// ============================================================
export const V6_ENGINE_LAYERS = [
  { id: 'L0', name: 'L0: 数据采集', deterministic: true, llmEnhanceable: false, weight: 0.05 },
  { id: 'L1', name: 'L1: 宏观环境', deterministic: false, llmEnhanceable: true, weight: 0.10 },
  { id: 'L2', name: 'L2: 行业分析', deterministic: false, llmEnhanceable: true, weight: 0.15 },
  { id: 'L3', name: 'L3: 财务分析', deterministic: true, llmEnhanceable: false, weight: 0.20 },
  { id: 'L4', name: 'L4: 估值分析', deterministic: true, llmEnhanceable: false, weight: 0.15 },
  { id: 'L5', name: 'L5: 技术分析', deterministic: false, llmEnhanceable: true, weight: 0.10 },
  { id: 'L6', name: 'L6: 情绪分析', deterministic: false, llmEnhanceable: true, weight: 0.10 },
  { id: 'L7', name: 'L7: 风险分析', deterministic: true, llmEnhanceable: false, weight: 0.10 },
  { id: 'L8', name: 'L8: 综合评分', deterministic: true, llmEnhanceable: false, weight: 0.05 },
] as const

// ============================================================
// 系统架构分层定义 — 颜色全部从 COLOR_SHADES 读取
// ============================================================
export const SYSTEM_ARCHITECTURE_LAYERS = [
  {
    id: 'config',
    name: '配置层',
    description: '零硬编码锚点，全局配置注入',
    modules: ['dbConfig', 'inputConfig', 'routes', 'thresholds', 'dualStrategyRules'],
    color: COLOR_SHADES.indigo.hex[500],
  },
  {
    id: 'core',
    name: '核心层',
    description: '核心工具与类型守卫',
    modules: ['DataBridge', 'ACL', 'Envelope', 'MemoryCache'],
    color: COLOR_SHADES.purple.hex[500],
  },
  {
    id: 'data',
    name: '数据层',
    description: 'IndexedDB 数据访问层',
    modules: ['dataLayer', 'db', 'types', 'queryBuilder'],
    color: COLOR_SHADES.cyan.hex[500],
  },
  {
    id: 'services',
    name: '服务层',
    description: '30+ 子域业务服务',
    modules: ['analysis', 'scoring', 'fetcher', 'news', 'llm', 'execution', 'portfolio', 'input', 'data-collector', 'system'],
    color: COLOR_SHADES.emerald.hex[500],
  },
  {
    id: 'agents',
    name: '智能体层',
    description: 'AI Agent 注册与调度',
    modules: ['agentRegistry', 'baseAgent', 'analysisAgent', 'researchAgent'],
    color: COLOR_SHADES.amber.hex[500],
  },
  {
    id: 'store',
    name: '状态层',
    description: '63个Zustand Store',
    modules: ['analysisStore', 'engineStore', 'tradingStore', 'portfolioStore'],
    color: COLOR_SHADES.red.hex[500],
  },
  {
    id: 'pages',
    name: '页面层',
    description: '5舱页面入口',
    modules: ['input', 'analysis', 'trading', 'output', 'command'],
    color: COLOR_SHADES.pink.hex[500],
  },
  {
    id: 'components',
    name: '组件层',
    description: 'UI组件库',
    modules: ['ui', 'cabin', 'chart', 'pool', 'news', 'strategy'],
    color: COLOR_SHADES.orange.hex[500],
  },
] as const
