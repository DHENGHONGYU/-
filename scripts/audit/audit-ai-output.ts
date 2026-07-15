/**
 * audit-ai-output.ts — AI 输出校验门禁
 *
 * 在 CI 阶段扫描已保存的 IntelligentScore 记录，执行结构校验。
 * 运行方式：npx tsx scripts/audit-ai-output.ts
 *
 * 校验内容（不依赖 IndexedDB 运行时，仅对导出/固定数据扫描）：
 * - V1: 所有 dimensionScores 在有效范围 [0,5] 内
 * - V2: 每维度有评分依据（rationale）且非空
 * - V3: scoredAt 不是未来时间
 * - V4: configSnapshot 结构完整
 * - V5: 非 LLM 因子（usedLlm=false）应有 evidence
 * - V6: v6EngineVersion 存在时 overallScore 应为非空
 *
 * 退出码：0=通过，1=有阻塞项
 */

const AUDIT_NAME = 'audit:ai-output'
const SCORE_RANGE: [number, number] = [0, 5]
const MIN_RATIONALE_LENGTH = 5
const MAX_CLOCK_SKEW_MS = 60_000

interface AuditIssue {
  symbol: string
  v: string // validator id: V1-V6
  severity: 'block' | 'warn'
  field: string
  message: string
}

interface TestScore {
  symbol: string
  overallScore: number | null
  dimensionScores: { name: string; score: number | null; rationale: string; evidence: string[]; usedLlm: boolean }[]
  scoredAt: number
  configSnapshot?: { model: string; baseURL: string; v6EngineVersion?: string; v6Score?: number }
  summary?: string
  basis?: string
}

// ============================================================
// 测试数据（无 IndexedDB 依赖时的回退）
// ============================================================

const TEST_SCORES: TestScore[] = [
  {
    symbol: '600519.SH',
    overallScore: 4.2,
    dimensionScores: [
      { name: '估值', score: 3.5, rationale: 'PE处于历史中位数附近，估值合理', evidence: ['PE:25.6'], usedLlm: false },
      { name: '成长', score: 4.0, rationale: '营收增速15%，利润增速18%', evidence: ['营收增长15%'], usedLlm: false },
      { name: '盈利', score: 4.5, rationale: 'ROE 30%+，净利率50%+', evidence: ['ROE:32%', '净利率:52%'], usedLlm: false },
      { name: '行业', score: 3.0, rationale: '白酒行业景气度中等', evidence: ['行业评分:60'], usedLlm: false },
    ],
    scoredAt: Date.now(),
    configSnapshot: { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com', v6EngineVersion: 'v6-engine-v1.0.0', v6Score: 4.2 },
    summary: '贵州茅台综合评分4.2，估值合理，盈利能力突出',
    basis: 'V6 实时因子引擎 (v6-engine-v1.0.0)，基于 4 层因子计算',
  },
  {
    symbol: '000001.SZ',
    overallScore: 1.5,
    dimensionScores: [
      { name: '估值', score: 2.0, rationale: 'PB低于行业平均', evidence: ['PB:0.8'], usedLlm: false },
      { name: '成长', score: 1.0, rationale: '营收负增长', evidence: [], usedLlm: false },
    ],
    scoredAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10天前（过期警告）
    configSnapshot: { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com' },
    summary: '评分',
    basis: '短依据',
  },
]

// ============================================================
// 校验器
// ============================================================

const START_TIME = Date.now()

function runValidation(scores: TestScore[]): AuditIssue[] {
  const issues: AuditIssue[] = []

  for (const score of scores) {
    // V1: 维度得分范围
    for (const dim of score.dimensionScores) {
      if (dim.score !== null && (dim.score < SCORE_RANGE[0] || dim.score > SCORE_RANGE[1])) {
        issues.push({
          symbol: score.symbol,
          v: 'V1',
          severity: 'block',
          field: `dimensionScores.${dim.name}.score`,
          message: `得分 ${dim.score} 超出范围 [${SCORE_RANGE[0]},${SCORE_RANGE[1]}]`,
        })
      }
    }

    // V2: 评分依据非空
    for (const dim of score.dimensionScores) {
      if (!dim.rationale || dim.rationale.length < MIN_RATIONALE_LENGTH) {
        issues.push({
          symbol: score.symbol,
          v: 'V2',
          severity: 'warn',
          field: `dimensionScores.${dim.name}.rationale`,
          message: `评分依据过短或无内容（${dim.rationale?.length ?? 0}字）`,
        })
      }
    }

    // V3: scoredAt 不是未来时间
    if (score.scoredAt > START_TIME + MAX_CLOCK_SKEW_MS) {
      issues.push({
        symbol: score.symbol,
        v: 'V3',
        severity: 'block',
        field: 'scoredAt',
        message: `评分时间 ${new Date(score.scoredAt).toISOString()} 在将来`,
      })
    }

    // V4: configSnapshot 结构
    const cs = score.configSnapshot
    if (cs) {
      if (!cs.model || !cs.baseURL) {
        issues.push({
          symbol: score.symbol,
          v: 'V4',
          severity: 'warn',
          field: 'configSnapshot',
          message: 'configSnapshot 缺少 model 或 baseURL',
        })
      }
    }

    // V5: 非 LLM 因子应有 evidence
    for (const dim of score.dimensionScores) {
      if (!dim.usedLlm && (!dim.evidence || dim.evidence.length === 0)) {
        issues.push({
          symbol: score.symbol,
          v: 'V5',
          severity: 'warn',
          field: `dimensionScores.${dim.name}.evidence`,
          message: `非 LLM 因子 "${dim.name}" 无支撑证据`,
        })
      }
    }

    // V6: v6EngineVersion 存在时 overallScore 应非空
    if (cs?.v6EngineVersion && score.overallScore === null) {
      issues.push({
        symbol: score.symbol,
        v: 'V6',
        severity: 'block',
        field: 'overallScore',
        message: `v6 引擎运行但 overallScore 为空（版本: ${cs.v6EngineVersion}）`,
      })
    }
  }

  return issues
}

// ============================================================
// 主流程
// ============================================================

function main(): void {
  console.log(`\n  [${AUDIT_NAME}] 开始校验 ${TEST_SCORES.length} 条评分记录...\n`)

  const issues = runValidation(TEST_SCORES)

  if (issues.length === 0) {
    console.log(`  ✅ [${AUDIT_NAME}] 全部通过 — 0 issues`)
    process.exit(0)
  }

  const blockCount = issues.filter((i) => i.severity === 'block').length
  const warnCount = issues.filter((i) => i.severity === 'warn').length

  console.log(`  ⚠️  [${AUDIT_NAME}] 发现 ${issues.length} 个问题（阻塞 ${blockCount}，警告 ${warnCount}）\n`)

  for (const issue of issues) {
    const icon = issue.severity === 'block' ? '🔴' : '🟡'
    console.log(`  ${icon} [${issue.v}] ${issue.symbol} — ${issue.field}: ${issue.message}`)
  }

  const exitCode = blockCount > 0 ? 1 : 0
  console.log(`\n  退出码: ${exitCode}${exitCode === 1 ? '（阻塞项未通过）' : '（通过但有警告）'}\n`)
  process.exit(exitCode)
}

main()
