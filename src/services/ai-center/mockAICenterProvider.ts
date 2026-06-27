import type {
  AgentItem,
  AgentListData,
  HealthMetricItem,
  HealthMetricsData,
  DiagnosticReportItem,
  DiagnosticReportsData,
} from '@/types/modules/ai-center.types'
import { AGENT_STATUS, AGENT_TAG, AGENT_TYPE_MAP } from '@/constants/ai-center.constants'
import type { AgentTag } from '@/constants/ai-center.constants'
import {
  HEALTH_STATUS,
  HEALTH_MODULE_CATEGORY,
  DIAGNOSTIC_LEVEL,
  HEALTH_SCORE_THRESHOLDS,
} from '@/constants/health.constants'

/**
 * AI 中心 Mock 数据提供者
 * @description 为 Agent 调度、健康监控、诊断分析提供随机模拟数据
 * @remarks 开发环境使用；生产环境切换为 REST/WebSocket Collector
 */
export class MockAICenterProvider {
  /**
   * 获取 Agent 列表与总览数据
   */
  static getAgentList(page = 1, pageSize = 8): Promise<AgentListData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateAgentList(page, pageSize)), 500)
    })
  }

  /**
   * 获取系统健康监控数据
   */
  static getHealthMetrics(): Promise<HealthMetricsData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateHealthMetrics()), 600)
    })
  }

  /**
   * 获取诊断分析报告
   */
  static getDiagnosticReports(): Promise<DiagnosticReportsData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateDiagnosticReports()), 700)
    })
  }
}

// ============================================================
// 数据生成器
// ============================================================

const AGENT_TYPE_KEYS = Object.keys(AGENT_TYPE_MAP)

function generateAgentList(page = 1, pageSize = 8): AgentListData {
  const allAgents: AgentItem[] = Array.from({ length: 16 }).map((_, index) => {
    const typeKey = AGENT_TYPE_KEYS[index % AGENT_TYPE_KEYS.length]!
    const typeConfig = AGENT_TYPE_MAP[typeKey] ?? { name: '未知 Agent', icon: 'bot', description: '' }
    const status = generateAgentStatus()

    return {
      id: `agent_${index + 1}`,
      type: typeKey,
      name: `${typeConfig.name}-${index + 1}`,
      tags: generateAgentTags(),
      description: typeConfig.description,
      callCount: Math.floor(Math.random() * 500) + 10,
      status,
      lastActiveAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60),
      knowledgeUsage: Math.floor(Math.random() * 200),
    }
  })

  const start = (page - 1) * pageSize
  const end = start + pageSize
  const agents = allAgents.slice(start, end)

  return {
    agents,
    overview: {
      totalAgents: allAgents.length,
      knowledgeUsage: allAgents.reduce((sum, a) => sum + (a.knowledgeUsage ?? 0), 0),
      taskExecutions: allAgents.reduce((sum, a) => sum + a.callCount, 0),
      monitorAlerts: allAgents.filter((a) => a.status !== AGENT_STATUS.NORMAL).length,
    },
    total: allAgents.length,
    page,
    pageSize,
  }
}

function generateAgentStatus() {
  const rand = Math.random()
  // 80% 正常，10% 预警，6% 异常，4% 暂停
  if (rand < 0.8) return AGENT_STATUS.NORMAL
  if (rand < 0.9) return AGENT_STATUS.WARNING
  if (rand < 0.96) return AGENT_STATUS.ERROR
  return AGENT_STATUS.PAUSED
}

function generateAgentTags(): AgentTag[] {
  const tags = Object.values(AGENT_TAG)
  const count = Math.floor(Math.random() * 2) + 1
  const shuffled = [...tags].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

const HEALTH_MODULE_NAMES: Record<string, string[]> = {
  [HEALTH_MODULE_CATEGORY.CORE]: ['Agent 助手', '股票策略', '大模型集成', '知识库检索'],
  [HEALTH_MODULE_CATEGORY.SYSTEM]: ['任务调度器', '消息队列', '缓存服务', '日志服务'],
  [HEALTH_MODULE_CATEGORY.AGENT]: ['对话 Agent', '选股 Agent', '复盘 Agent'],
  [HEALTH_MODULE_CATEGORY.DATA]: ['行情数据服务', '用户数据服务', '量化数据服务'],
}

function generateHealthMetrics(): HealthMetricsData {
  const metrics: HealthMetricItem[] = Object.entries(HEALTH_MODULE_NAMES).flatMap(([category, names]) =>
    names.map((name, index) => {
      const healthScore = Math.floor(Math.random() * 40) + 60 // 60-100
      return {
        id: `health_${category}_${index}`,
        name,
        category: category as HealthMetricItem['category'],
        healthScore,
        status: scoreToHealthStatus(healthScore),
        extra: {
          successRate: `${(healthScore - Math.random() * 10).toFixed(1)}%`,
          responseTime: `${Math.floor(Math.random() * 200 + 20)}ms`,
        },
        checkedAt: Date.now(),
      }
    })
  )

  const overallScore = Math.round(metrics.reduce((sum, m) => sum + m.healthScore, 0) / metrics.length)

  return {
    metrics,
    overallScore,
    overallStatus: scoreToHealthStatus(overallScore),
    lastUpdatedAt: Date.now(),
  }
}

function scoreToHealthStatus(score: number) {
  if (score >= HEALTH_SCORE_THRESHOLDS.EXCELLENT) return HEALTH_STATUS.HEALTHY
  if (score >= HEALTH_SCORE_THRESHOLDS.WARNING) return HEALTH_STATUS.WARNING
  return HEALTH_STATUS.CRITICAL
}

const DIAGNOSTIC_MODULE_NAMES = [
  'Agent 响应成功率',
  '大模型推理耗时',
  '知识库召回率',
  '策略回测稳定性',
  '行情数据延迟',
  '任务队列堆积',
  'WebSocket 连接稳定性',
  '数据库存储性能',
]

function generateDiagnosticReports(): DiagnosticReportsData {
  const reports: DiagnosticReportItem[] = DIAGNOSTIC_MODULE_NAMES.map((name, index) => {
    const healthScore = Math.floor(Math.random() * 40) + 60
    const successRate = Math.min(100, healthScore + Math.floor(Math.random() * 10))
    const stabilityScore = Math.min(100, healthScore + Math.floor(Math.random() * 10 - 5))

    return {
      id: `diag_${index}`,
      name,
      module: ['核心模块', '系统组件', '数据服务'][index % 3]!,
      healthScore,
      successRate,
      stabilityScore,
      level: scoreToDiagnosticLevel(healthScore),
      detail: '基于最近 1 小时采样数据的综合分析',
      reportedAt: Date.now(),
    }
  })

  const avgScore = Math.round(reports.reduce((sum, r) => sum + r.healthScore, 0) / reports.length)

  return {
    reports,
    overallLevel: scoreToDiagnosticLevel(avgScore),
    lastUpdatedAt: Date.now(),
  }
}

function scoreToDiagnosticLevel(score: number) {
  if (score >= HEALTH_SCORE_THRESHOLDS.EXCELLENT) return DIAGNOSTIC_LEVEL.EXCELLENT
  if (score >= HEALTH_SCORE_THRESHOLDS.GOOD) return DIAGNOSTIC_LEVEL.GOOD
  if (score >= HEALTH_SCORE_THRESHOLDS.WARNING) return DIAGNOSTIC_LEVEL.AVERAGE
  return DIAGNOSTIC_LEVEL.POOR
}
