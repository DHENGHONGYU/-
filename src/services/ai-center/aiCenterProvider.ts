/**
 * @module services/ai-center/aiCenterProvider
 * @description AI 智能体调度中心数据提供器。
 *
 * 提供 AICenterProvider 接口与本地 Mock 实现（MockAICenterProvider）。
 * 当前为纯前端个人研究工具，默认使用 Mock 实现生成本地模拟数据；
 * 未来接入后端时，新增 REST/WebSocket 实现并替换 getAICenterProvider() 工厂即可，
 * UI 与 Store 层无需改动。
 *
 * @remarks 本文件还原自被删除的 services/ai-center/mockAICenterProvider.ts，
 * 重建以补全"AI 中心"模块被砍掉的数据层接线（详见删除事项处置裁定）。
 */

import { nanoid } from 'nanoid'

import type {
  AICenterData,
  AgentItem,
  AgentListData,
  AgentOverviewMetrics,
  DiagnosticReportItem,
  DiagnosticReportsData,
  HealthMetricItem,
  HealthMetricsData,
} from '@/types/modules/ai-center.types'
import {
  AGENT_STATUS,
  AGENT_TAG,
  AGENT_TYPE_MAP,
} from '@/constants/ai-center.constants'

/** Mock 智能体调用次数的随机区间上限（避免魔法数字） */
const MOCK_AGENT_CALL_COUNT_RANGE = 900
/** Mock 智能体调用次数的随机区间下限（避免魔法数字） */
const MOCK_AGENT_CALL_COUNT_MIN = 50
import {
  DIAGNOSTIC_LEVEL,
  HEALTH_MODULE_CATEGORY,
  HEALTH_STATUS,
} from '@/constants/health.constants'


/** AI 中心数据提供器接口（可替换为 REST/WebSocket 实现） */
export interface AICenterProvider {
  /** 获取 AI 中心统一数据：智能体列表 + 健康监控 + 诊断分析 */
  getAICenterData: () => Promise<AICenterData>
}

const AGENT_TAG_VALUES = Object.values(AGENT_TAG)
const AGENT_STATUS_VALUES = Object.values(AGENT_STATUS)
const HEALTH_MODULE_VALUES = Object.values(HEALTH_MODULE_CATEGORY)

/** 模拟智能体名称池 */
const MOCK_AGENT_NAMES: Array<{ type: keyof typeof AGENT_TYPE_MAP; name: string }> = [
  { type: 'agentAssistant', name: '通用投研助手' },
  { type: 'stockStrategy', name: '量化选股智能体' },
  { type: 'stockStrategy', name: '板块轮动策略体' },
  { type: 'llmIntegration', name: '多模型路由编排' },
  { type: 'knowledgeRetrieval', name: '本地知识库检索' },
  { type: 'agentAssistant', name: '复盘写作助手' },
  { type: 'stockStrategy', name: '风险预警智能体' },
  { type: 'llmIntegration', name: '推理增强智能体' },
]

const HEALTH_MODULE_NAMES: Record<string, string> = {
  CORE: '核心引擎',
  SYSTEM: '系统服务',
  AGENT: '智能体运行时',
  DATA: '数据采集层',
}

/** 评分等级标签 */
function scoreLabel(score: number): string {
  if (score >= 85) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 55) return '一般'
  return '偏弱'
}

/**
 * AI 中心 Mock 数据提供器
 * @description 生成智能体调度、系统健康、诊断分析三类本地模拟数据
 */
export class MockAICenterProvider implements AICenterProvider {
  getAICenterData(): Promise<AICenterData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateAICenterData()), 500)
    })
  }
}

// ============================================================
// 数据生成器（内部使用）
// ============================================================

function generateAICenterData(): AICenterData {
  const agents = generateAgentList()
  const healthMetrics = generateHealthMetrics()
  const diagnosticReports = generateDiagnosticReports()

  return { agents, healthMetrics, diagnosticReports }
}

function generateAgentList(): AgentListData {
  const agents: AgentItem[] = MOCK_AGENT_NAMES.map((meta) => {
    const typeKey = meta.type
    const typeMeta = AGENT_TYPE_MAP[typeKey]
    const status = AGENT_STATUS_VALUES[Math.floor(Math.random() * AGENT_STATUS_VALUES.length)]!
    // 每个智能体分配 1~2 个标签
    const tagCount = Math.random() > 0.5 ? 2 : 1
    const tags = AGENT_TAG_VALUES.slice(0, tagCount)

    return {
      id: `agent_${nanoid(6)}`,
      type: typeKey,
      name: meta.name,
      tags,
      description: typeMeta?.description ?? '',
      callCount: Math.floor(Math.random() * MOCK_AGENT_CALL_COUNT_RANGE) + MOCK_AGENT_CALL_COUNT_MIN,
      status,
      lastActiveAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24),
      knowledgeUsage: Math.floor(Math.random() * 500),
    }
  })

  const overview: AgentOverviewMetrics = {
    totalAgents: agents.length,
    knowledgeUsage: agents.reduce((sum, a) => sum + (a.knowledgeUsage ?? 0), 0),
    taskExecutions: agents.reduce((sum, a) => sum + a.callCount, 0),
    monitorAlerts: agents.filter((a) => a.status === AGENT_STATUS.ERROR || a.status === AGENT_STATUS.WARNING).length,
  }

  return {
    agents,
    overview,
    total: agents.length,
    page: 1,
    pageSize: agents.length,
  }
}

function generateHealthMetrics(): HealthMetricsData {
  const metrics: HealthMetricItem[] = HEALTH_MODULE_VALUES.map((category) => {
    const healthScore = Math.floor(Math.random() * 35) + 65
    const status = healthScore >= 85 ? HEALTH_STATUS.HEALTHY : healthScore >= 70 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.CRITICAL

    return {
      id: `health_${category.toLowerCase()}`,
      name: HEALTH_MODULE_NAMES[category] ?? category,
      category,
      healthScore,
      status,
      extra: {
        成功率: `${Math.floor(Math.random() * 20) + 80}%`,
        响应时间: `${Math.floor(Math.random() * 200) + 50}ms`,
      },
      checkedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 5),
    }
  })

  const overallScore = Math.round(metrics.reduce((sum, m) => sum + m.healthScore, 0) / metrics.length)
  const overallStatus =
    overallScore >= 85 ? HEALTH_STATUS.HEALTHY : overallScore >= 70 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.CRITICAL

  return {
    metrics,
    overallScore,
    overallStatus,
    lastUpdatedAt: Date.now(),
  }
}

function generateDiagnosticReports(): DiagnosticReportsData {
  const modules = ['量化选股', '板块轮动', '风险预警', '知识检索', '复盘生成']
  const reports: DiagnosticReportItem[] = modules.map((moduleName) => {
    const healthScore = Math.floor(Math.random() * 30) + 65
    const successRate = Math.floor(Math.random() * 20) + 78
    const stabilityScore = Math.floor(Math.random() * 25) + 70
    const level =
      healthScore >= 85 ? DIAGNOSTIC_LEVEL.EXCELLENT : healthScore >= 75 ? DIAGNOSTIC_LEVEL.GOOD : healthScore >= 60 ? DIAGNOSTIC_LEVEL.AVERAGE : DIAGNOSTIC_LEVEL.POOR

    return {
      id: `diag_${nanoid(6)}`,
      name: `${moduleName}诊断`,
      module: moduleName,
      healthScore,
      successRate,
      stabilityScore,
      level,
      detail: `${moduleName}模块综合健康度${scoreLabel(healthScore)}，成功率${successRate}%，稳定性${scoreLabel(stabilityScore)}。`,
      reportedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 30),
    }
  })

  const avg = reports.reduce((sum, r) => sum + r.healthScore, 0) / reports.length
  const overallLevel =
    avg >= 85 ? DIAGNOSTIC_LEVEL.EXCELLENT : avg >= 75 ? DIAGNOSTIC_LEVEL.GOOD : avg >= 60 ? DIAGNOSTIC_LEVEL.AVERAGE : DIAGNOSTIC_LEVEL.POOR

  return {
    reports,
    overallLevel,
    lastUpdatedAt: Date.now(),
  }
}
