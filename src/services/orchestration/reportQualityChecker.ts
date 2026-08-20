/**
 * @fileoverview ReportQualityChecker — P0-3 报告质量红线告警
 *
 * 扫描输出舱所有报告的质量状态，按核心交付物标准进行检查，
 * 生成结构化的质量报告供 Dashboard 展示。
 *
 * 检查维度：
 * 1. 章节完整性（16 章节骨架）
 * 2. 置信度标注密度（≥15 处 ★ 格式）
 * 3. 关键风险条目数（≥3 条）
 * 4. 证据链完整性（evidenceChain 存在且覆盖≥2 维度）
 * 5. V6 评分一致性（conclusion.consistentWithV6）
 * 6. 数据新鲜度（lineage.dataVersions 时效性）
 *
 * @module services/orchestration/reportQualityChecker
 * @created 2026-08-20 P0-3 阶段
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { AnalysisResult, EvidenceChain } from '@/types/modules/analysisOrchestrator.types'

const logger = getLogger()

/** 报告质量告警级别 */
export type QualityAlertLevel = 'red' | 'yellow' | 'green'

/** 单维度检查结果 */
export interface QualityDimension {
  name: string
  passed: boolean
  level: QualityAlertLevel
  detail: string
}

/** 单份报告质量检查结果 */
export interface ReportQualityStatus {
  docId: string
  symbol: string
  createdAt: number
  overallLevel: QualityAlertLevel
  dimensions: QualityDimension[]
  missingCriticalDeliverables: string[]
  score: number
}

/** 全局质量扫描结果 */
export interface QualityScanResult {
  scannedAt: number
  totalReports: number
  redAlerts: number
  yellowAlerts: number
  greenAlerts: number
  reports: ReportQualityStatus[]
  summary: {
    passRate: number
    avgScore: number
    mostCommonIssues: string[]
  }
}

/** V6 报告标准章节清单（16 章） */
const V6_REPORT_SECTIONS = [
  '核心结论与评级',
  '投资建议',
  '公司概况',
  '行业定位',
  '护城河分析',
  '财务分析',
  '估值分析',
  '竞争格局',
  '技术分析',
  '筹码分析',
  '风险提示',
  '催化剂与事件',
  '操作策略',
  '情景分析',
  '结论与展望',
  '附录',
]

/** 证据链最小维度覆盖要求 */
const MIN_EVIDENCE_DIMENSIONS = 2

/** 置信度标注最小数量 */
const MIN_CONFIDENCE_ANNOTATIONS = 15

/** 关键风险最小数量 */
const MIN_KEY_RISKS = 3

/** 数据新鲜度阈值（毫秒）—— 24 小时 */
const FRESHNESS_THRESHOLD_MS = 24 * 60 * 60 * 1000

/**
 * 检查报告章节完整性
 */
function checkSectionCompleteness(result: AnalysisResult): QualityDimension {
  const sections = result.reportSections
  if (!sections || sections.length === 0) {
    return {
      name: '章节完整性',
      passed: false,
      level: 'red',
      detail: '报告无章节结构',
    }
  }

  const missing = V6_REPORT_SECTIONS.filter(
    (expected) => !sections.some((s) => s.title.includes(expected.slice(0, 4))),
  )

  const coverage = ((V6_REPORT_SECTIONS.length - missing.length) / V6_REPORT_SECTIONS.length) * 100

  if (missing.length > 8) {
    return {
      name: '章节完整性',
      passed: false,
      level: 'red',
      detail: `缺少 ${missing.length}/16 个核心章节（覆盖率 ${coverage.toFixed(0)}%）`,
    }
  }

  if (missing.length > 4) {
    return {
      name: '章节完整性',
      passed: true,
      level: 'yellow',
      detail: `缺少 ${missing.length}/16 个章节：${missing.slice(0, 3).join('、')}...`,
    }
  }

  return {
    name: '章节完整性',
    passed: true,
    level: 'green',
    detail: `章节覆盖率 ${coverage.toFixed(0)}%`,
  }
}

/**
 * 检查置信度标注密度
 */
function checkConfidenceAnnotations(result: AnalysisResult): QualityDimension {
  const rawText = result.rawLlmText ?? ''
  const starPattern = /\[\d+分\s*★/g
  const matches = rawText.match(starPattern)
  const count = matches ? matches.length : 0

  if (count < 5) {
    return {
      name: '置信度标注',
      passed: false,
      level: 'red',
      detail: `置信度标注仅 ${count} 处，远低于 ${MIN_CONFIDENCE_ANNOTATIONS} 处标准`,
    }
  }

  if (count < MIN_CONFIDENCE_ANNOTATIONS) {
    return {
      name: '置信度标注',
      passed: true,
      level: 'yellow',
      detail: `置信度标注 ${count} 处，低于 ${MIN_CONFIDENCE_ANNOTATIONS} 处标准`,
    }
  }

  return {
    name: '置信度标注',
    passed: true,
    level: 'green',
    detail: `置信度标注 ${count} 处`,
  }
}

/**
 * 检查关键风险条目数
 */
function checkKeyRisks(result: AnalysisResult): QualityDimension {
  const risks = result.conclusion?.keyRisks ?? []
  const count = risks.length

  if (count < MIN_KEY_RISKS) {
    return {
      name: '关键风险',
      passed: false,
      level: 'red',
      detail: `关键风险仅 ${count} 条，低于 ${MIN_KEY_RISKS} 条标准`,
    }
  }

  if (count < MIN_KEY_RISKS + 2) {
    return {
      name: '关键风险',
      passed: true,
      level: 'yellow',
      detail: `关键风险 ${count} 条，刚达标准`,
    }
  }

  return {
    name: '关键风险',
    passed: true,
    level: 'green',
    detail: `关键风险 ${count} 条`,
  }
}

/**
 * 检查证据链完整性
 */
function checkEvidenceChain(result: AnalysisResult): QualityDimension {
  const chain: EvidenceChain | undefined = result.conclusion?.evidenceChain

  if (!chain || chain.items.length === 0) {
    return {
      name: '证据链',
      passed: false,
      level: 'red',
      detail: '报告无结构化证据链',
    }
  }

  const dimensions = new Set(chain.items.map((i) => i.dimension))
  const coverage = dimensions.size
  const confidence = chain.confidence

  if (coverage < MIN_EVIDENCE_DIMENSIONS) {
    return {
      name: '证据链',
      passed: false,
      level: 'red',
      detail: `证据链仅覆盖 ${coverage} 个维度（需≥${MIN_EVIDENCE_DIMENSIONS}）`,
    }
  }

  if (confidence < 0.5) {
    return {
      name: '证据链',
      passed: true,
      level: 'yellow',
      detail: `证据链置信度 ${(confidence * 100).toFixed(0)}% 偏低`,
    }
  }

  return {
    name: '证据链',
    passed: true,
    level: 'green',
    detail: `证据链 ${chain.items.length} 项，覆盖 ${coverage} 维度，置信度 ${(confidence * 100).toFixed(0)}%`,
  }
}

/**
 * 检查 V6 评分一致性
 */
function checkV6Consistency(result: AnalysisResult): QualityDimension {
  const consistent = result.conclusion?.consistentWithV6
  if (consistent === undefined) {
    return {
      name: 'V6一致性',
      passed: false,
      level: 'yellow',
      detail: '未标注与 V6 评分的一致性',
    }
  }

  if (!consistent) {
    return {
      name: 'V6一致性',
      passed: false,
      level: 'red',
      detail: '结论与 V6 评分不一致，需人工复核',
    }
  }

  return {
    name: 'V6一致性',
    passed: true,
    level: 'green',
    detail: '结论与 V6 评分一致',
  }
}

/**
 * 检查数据新鲜度
 */
function checkDataFreshness(result: AnalysisResult): QualityDimension {
  const lineage = result.lineage
  if (!lineage) {
    return {
      name: '数据新鲜度',
      passed: false,
      level: 'yellow',
      detail: '无数据血缘信息',
    }
  }

  const now = Date.now()
  const versions = lineage.dataVersions
  const oldest = Math.min(
    versions.stockSnapshotAt,
    versions.v6ScoreSnapshotAt,
    versions.newsFetchedAt,
  )
  const ageMs = now - oldest

  if (ageMs > FRESHNESS_THRESHOLD_MS) {
    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1)
    return {
      name: '数据新鲜度',
      passed: false,
      level: 'red',
      detail: `最旧数据已 ${ageHours} 小时未更新`,
    }
  }

  if (ageMs > FRESHNESS_THRESHOLD_MS / 2) {
    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1)
    return {
      name: '数据新鲜度',
      passed: true,
      level: 'yellow',
      detail: `数据年龄 ${ageHours} 小时`,
    }
  }

  return {
    name: '数据新鲜度',
    passed: true,
    level: 'green',
    detail: '数据新鲜',
  }
}

/**
 * 检查单份报告质量
 */
export function checkReportQuality(result: AnalysisResult): ReportQualityStatus {
  const dimensions: QualityDimension[] = [
    checkSectionCompleteness(result),
    checkConfidenceAnnotations(result),
    checkKeyRisks(result),
    checkEvidenceChain(result),
    checkV6Consistency(result),
    checkDataFreshness(result),
  ]

  const redCount = dimensions.filter((d) => d.level === 'red').length
  const yellowCount = dimensions.filter((d) => d.level === 'yellow').length

  let overallLevel: QualityAlertLevel = 'green'
  if (redCount > 0) overallLevel = 'red'
  else if (yellowCount > 0) overallLevel = 'yellow'

  const missingCriticalDeliverables: string[] = []
  const dimensionChecks: Array<{ index: number; label: string }> = [
    { index: 0, label: '章节结构不完整' },
    { index: 1, label: '置信度标注不足' },
    { index: 2, label: '关键风险不足' },
    { index: 3, label: '缺少证据链' },
    { index: 4, label: '与V6不一致' },
  ]
  dimensionChecks.forEach(({ index, label }) => {
    const dim = dimensions[index]
    if (dim && dim.level === 'red') {
      missingCriticalDeliverables.push(label)
    }
  })

  const score = Math.round(
    (dimensions.filter((d) => d.passed).length / dimensions.length) * 100,
  )

  return {
    docId: result.docId,
    symbol: result.symbol,
    createdAt: result.createdAt,
    overallLevel,
    dimensions,
    missingCriticalDeliverables,
    score,
  }
}

/**
 * 扫描所有分析结果的质量状态
 */
export async function scanAllReportQualities(): Promise<QualityScanResult> {
  const scannedAt = Date.now()

  try {
    const result = await dataBridge.query<AnalysisResult[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.analysisResults,
      source: MODULE_ID.analyzer,
    })

    const analysisResults = result.success ? (result.data ?? []) : []

    if (analysisResults.length === 0) {
      return {
        scannedAt,
        totalReports: 0,
        redAlerts: 0,
        yellowAlerts: 0,
        greenAlerts: 0,
        reports: [],
        summary: {
          passRate: 0,
          avgScore: 0,
          mostCommonIssues: [],
        },
      }
    }

    const reports = analysisResults.map(checkReportQuality)

    const redAlerts = reports.filter((r) => r.overallLevel === 'red').length
    const yellowAlerts = reports.filter((r) => r.overallLevel === 'yellow').length
    const greenAlerts = reports.filter((r) => r.overallLevel === 'green').length
    const totalScore = reports.reduce((sum, r) => sum + r.score, 0)

    const issueCounter = new Map<string, number>()
    reports.forEach((r) => {
      r.missingCriticalDeliverables.forEach((issue) => {
        issueCounter.set(issue, (issueCounter.get(issue) ?? 0) + 1)
      })
    })

    const mostCommonIssues = [...issueCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => `${issue}(${count})`)

    const scanResult: QualityScanResult = {
      scannedAt,
      totalReports: reports.length,
      redAlerts,
      yellowAlerts,
      greenAlerts,
      reports,
      summary: {
        passRate: greenAlerts / reports.length,
        avgScore: Math.round(totalScore / reports.length),
        mostCommonIssues,
      },
    }

    logger.info(
      `[reportQualityChecker] 质量扫描完成: ${reports.length} 份报告, ` +
      `red=${redAlerts} yellow=${yellowAlerts} green=${greenAlerts}`,
    )

    return scanResult
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[reportQualityChecker] 质量扫描失败: ${message}`)
    return {
      scannedAt,
      totalReports: 0,
      redAlerts: 0,
      yellowAlerts: 0,
      greenAlerts: 0,
      reports: [],
      summary: {
        passRate: 0,
        avgScore: 0,
        mostCommonIssues: [],
      },
    }
  }
}
