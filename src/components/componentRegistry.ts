/**
 * @module components/componentRegistry
 * @description Component 集中注册表 — 所有可复用业务组件的元数据清单
 *
 * @internal 当前无运行时消费者，仅供 DevTools/文档工具使用。
 * 注册的组件状态均为 `available`（未被集成），需在对应页面集成后更新为 `active`。
 *
 * 职责：
 * 1. 提供 Component 发现能力（DevTools / 文档工具可枚举所有组件）
 * 2. 标注组件的域归属、注册状态、适用场景
 * 3. 为后续组件文档生成、Storybook 集成提供基础
 *
 * @version 1.0.0
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** Component 域分类 */
export type ComponentDomain =
  | 'system'        // 系统管理
  | 'analysis'      // 分析展示
  | 'shared'        // 通用共享
  | 'ui'            // 基础 UI

/** Component 注册状态 */
export type ComponentStatus = 'active' | 'available' | 'deprecated'

/** Component 注册条目 */
export interface ComponentRegistryEntry {
  /** Component 唯一标识（PascalCase 组件名） */
  id: string
  /** Component 显示名称 */
  name: string
  /** 所属域 */
  domain: ComponentDomain
  /** 功能描述 */
  description: string
  /** 注册状态 */
  status: ComponentStatus
  /** 导入路径 */
  importPath: string
  /** 组件类型 */
  componentType: 'page-section' | 'panel' | 'chart' | 'form' | 'layout' | 'utility'
  /** 建议集成目标页面（若已知） */
  suggestedTarget?: string
}

// ============================================================
// Component 注册表
// ============================================================

/**
 * 业务组件注册清单
 * - active: 已被页面/其他组件引用的组件
 * - available: 已注册但尚未被集成的组件（可供后续开发使用）
 * - deprecated: 已废弃待清理的组件
 */
export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  // ============================================================
  // available — 已注册但尚未被页面集成的业务组件
  // ============================================================

  // ── 系统管理组件 ────────────────────────────────────────
  {
    id: 'LogStreamPanel',
    name: '系统日志流面板',
    domain: 'system',
    description: '实时系统日志流展示，支持过滤、搜索、级别高亮',
    status: 'available',
    importPath: '@/components/system/LogStreamPanel',
    componentType: 'panel',
    suggestedTarget: 'CommandPage/系统监控面板',
  },
  {
    id: 'AgentTaskList',
    name: '智能体任务列表',
    domain: 'system',
    description: 'Agent 任务队列展示，支持状态追踪、优先级排序、超时预警',
    status: 'available',
    importPath: '@/components/system/AgentTaskList',
    componentType: 'panel',
    suggestedTarget: 'CommandPage/Agent 管理面板',
  },

  // ── 分析展示组件 ────────────────────────────────────────
  {
    id: 'NewsSentimentTrend',
    name: '资讯情感趋势图',
    domain: 'analysis',
    description: '基于资讯数据的情感趋势可视化，展示正面/负面/中性情感走势',
    status: 'available',
    importPath: '@/components/analysis/news/NewsSentimentTrend',
    componentType: 'chart',
    suggestedTarget: 'AnalysisPage/资讯分析面板',
  },
  {
    id: 'MultiFactorFilterPanel',
    name: '多因子筛选面板',
    domain: 'analysis',
    description: '多因子选股筛选条件面板，支持因子权重配置、阈值设定、实时预览',
    status: 'available',
    importPath: '@/components/analysis/screening/MultiFactorFilterPanel',
    componentType: 'form',
    suggestedTarget: 'AnalysisPage/多因子筛选页面',
  },
  {
    id: 'ScoreHistoryPanel',
    name: '评分历史面板',
    domain: 'analysis',
    description: '个股评分历史变化追踪，展示各层评分时间序列',
    status: 'available',
    importPath: '@/components/analysis/score/ScoreHistoryPanel',
    componentType: 'panel',
    suggestedTarget: 'AnalysisPage/评分详情页',
  },
  {
    id: 'AnalysisTemplateCards',
    name: '分析模板卡片',
    domain: 'analysis',
    description: '预设分析模板快速选择卡片，支持一键启动标准化分析流程',
    status: 'available',
    importPath: '@/components/analysis/hub/AnalysisTemplateCards',
    componentType: 'layout',
    suggestedTarget: 'AnalysisPage/分析中心 Hub',
  },
  {
    id: 'MultiPeriodTrendChart',
    name: '多周期趋势图表',
    domain: 'analysis',
    description: '多时间周期（日/周/月/季）评分趋势叠加对比图',
    status: 'available',
    importPath: '@/components/analysis/score/MultiPeriodTrendChart',
    componentType: 'chart',
    suggestedTarget: 'AnalysisPage/评分趋势面板',
  },
  {
    id: 'IntelligentScoreExplanation',
    name: '智能评分解释',
    domain: 'analysis',
    description: 'LLM 增强评分结果的可解释性展示，分解各因子贡献',
    status: 'available',
    importPath: '@/components/analysis/score/IntelligentScoreExplanation',
    componentType: 'panel',
    suggestedTarget: 'AnalysisPage/智能评分详情页',
  },

  // ── 通用共享组件 ────────────────────────────────────────
  {
    id: 'WidgetErrorBoundary',
    name: 'Widget 错误边界',
    domain: 'shared',
    description: 'Cockpit Widget 专用错误边界，捕获子组件渲染异常并展示降级 UI',
    status: 'available',
    importPath: '@/components/WidgetErrorBoundary',
    componentType: 'utility',
    suggestedTarget: 'CockpitShell/Widget 容器',
  },
  {
    id: 'LLMConfigWidget',
    name: 'LLM 模型配置面板',
    domain: 'shared',
    description: 'LLM 模型选择、API Key 配置、评分因子使用开关的统一配置面板',
    status: 'available',
    importPath: '@/components/shared/LLMConfigWidget',
    componentType: 'form',
    suggestedTarget: 'CommandPage/配置面板 或 AnalysisPage/评分设置',
  },
]

// ============================================================
// 查询工具函数
// ============================================================

/** 按域筛选 Component */
export function getComponentsByDomain(domain: ComponentDomain): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter((c) => c.domain === domain)
}

/** 按状态筛选 Component */
export function getComponentsByStatus(status: ComponentStatus): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter((c) => c.status === status)
}

/** 按 ID 获取 Component */
export function getComponentById(id: string): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find((c) => c.id === id)
}

/** 按类型筛选 Component */
export function getComponentsByType(type: ComponentRegistryEntry['componentType']): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter((c) => c.componentType === type)
}

/** 获取 Component 统计 */
export function getComponentStats(): {
  total: number
  active: number
  available: number
  deprecated: number
  byDomain: Record<ComponentDomain, number>
  byType: Record<string, number>
} {
  const stats = {
    total: COMPONENT_REGISTRY.length,
    active: COMPONENT_REGISTRY.filter((c) => c.status === 'active').length,
    available: COMPONENT_REGISTRY.filter((c) => c.status === 'available').length,
    deprecated: COMPONENT_REGISTRY.filter((c) => c.status === 'deprecated').length,
    byDomain: {} as Record<ComponentDomain, number>,
    byType: {} as Record<string, number>,
  }

  for (const comp of COMPONENT_REGISTRY) {
    stats.byDomain[comp.domain] = (stats.byDomain[comp.domain] ?? 0) + 1
    stats.byType[comp.componentType] = (stats.byType[comp.componentType] ?? 0) + 1
  }

  return stats
}

// ============================================================
// 初始化日志
// ============================================================

logger.info(
  `[ComponentRegistry] Initialized: ${COMPONENT_REGISTRY.length} components registered ` +
  `(${getComponentStats().active} active, ${getComponentStats().available} available)`
)
