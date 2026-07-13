/**
 * @fileoverview AI 中心健康评分策略接口与实现
 *
 * 职责：
 * - 定义 AI 中心健康度/诊断评分的获取策略（Strategy 模式）
 * - 将健康评分计算从 AI 中心数据提供器中解耦，支持 Mock / 真实实现注入
 *
 * 架构变更（P5-7）：
 * - 原 aiCenterProvider.ts 内含 Math.random 健康评分生成逻辑，现迁移到本策略实现
 * - MockAICenterProvider 通过 setAIHealthScoringStrategy() 注入策略
 * - 生产环境应注入真实策略，从运行时指标或后端 API 获取健康评分
 *
 * @see src/services/ai-center/aiCenterProvider.ts — 策略消费方
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
import {
  DIAGNOSTIC_LEVEL,
  HEALTH_MODULE_CATEGORY,
  HEALTH_STATUS,
} from '@/constants/health.constants'

/** Mock 智能体调用次数的随机区间上限 */
const MOCK_AGENT_CALL_COUNT_RANGE = 900
/** Mock 智能体调用次数的随机区间下限 */
const MOCK_AGENT_CALL_COUNT_MIN = 50

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

/**
 * AI 中心健康评分策略接口
 */
export interface AIHealthScoringStrategy {
  /** 获取 AI 中心统一数据：智能体列表 + 健康监控 + 诊断分析 */
  getAICenterData(): Promise<AICenterData>
}

/**
 * Mock 健康评分策略
 * @description 开发/测试环境默认策略，保留原有随机数据生成行为
 */
export class MockAIHealthScoringStrategy implements AIHealthScoringStrategy {
  async getAICenterData(): Promise<AICenterData> {
    await this.delay(500)
    return this.generateAICenterData()
  }

  private generateAICenterData(): AICenterData {
    const agents = this.generateAgentList()
    const healthMetrics = this.generateHealthMetrics()
    const diagnosticReports = this.generateDiagnosticReports()

    return { agents, healthMetrics, diagnosticReports }
  }

  private generateAgentList(): AgentListData {
    const agents: AgentItem[] = MOCK_AGENT_NAMES.map((meta) => {
      const typeKey = meta.type
      const typeMeta = AGENT_TYPE_MAP[typeKey]
      const status = AGENT_STATUS_VALUES[Math.floor(Math.random() * AGENT_STATUS_VALUES.length)]!
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

  private generateHealthMetrics(): HealthMetricsData {
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

  private generateDiagnosticReports(): DiagnosticReportsData {
    const modules = ['量化选股', '板块轮动', '风险预警', '知识检索', '复盘生成']
    const reports: DiagnosticReportItem[] = modules.map((moduleName) => {
      const healthScore = Math.floor(Math.random() * 30) + 65
      const successRate = Math.floor(Math.random() * 20) + 78
      const stabilityScore = Math.floor(Math.random() * 25) + 70
      const level =
        healthScore >= 85
          ? DIAGNOSTIC_LEVEL.EXCELLENT
          : healthScore >= 75
            ? DIAGNOSTIC_LEVEL.GOOD
            : healthScore >= 60
              ? DIAGNOSTIC_LEVEL.AVERAGE
              : DIAGNOSTIC_LEVEL.POOR

      return {
        id: `diag_${nanoid(6)}`,
        name: `${moduleName}诊断`,
        module: moduleName,
        healthScore,
        successRate,
        stabilityScore,
        level,
        detail: `${moduleName}模块综合健康度${this.scoreLabel(healthScore)}，成功率${successRate}%，稳定性${this.scoreLabel(stabilityScore)}。`,
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

  private scoreLabel(score: number): string {
    if (score >= 85) return '优秀'
    if (score >= 70) return '良好'
    if (score >= 55) return '一般'
    return '偏弱'
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * 真实健康评分策略（占位实现）
 * @description 生产环境应注入此策略，从运行时指标、服务健康检查或后端 API 获取真实评分
 */
export class RealAIHealthScoringStrategy implements AIHealthScoringStrategy {
  async getAICenterData(): Promise<AICenterData> {
    // TODO: 接入真实运行时指标或后端健康检查 API
    throw new Error('RealAIHealthScoringStrategy.getAICenterData() not implemented')
  }
}
