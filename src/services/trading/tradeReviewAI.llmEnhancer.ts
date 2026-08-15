/**
 * LLM 增强模块
 *
 * 负责：
 * - 构建 AI 深度洞察的 LLM Prompt
 * - 解析 LLM 返回的 JSON 结果
 * - 降级处理（LLM 失败时回退到规则引擎）
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

import { getLogger } from '@/lib/logger'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { TradeSummary, ErrorAnalysis, DisciplineAnalysis, AIDeepInsight } from './tradeReviewAI.types'
import { LOG_TRUNCATE_LENGTH } from '@/constants/trade.constants'

const logger = getLogger()

/**
 * 生成 LLM 深度洞察 Prompt
 */
export function buildAIDeepInsightPrompt(
  summary: TradeSummary,
  errorAnalysis: ErrorAnalysis,
  discipline: DisciplineAnalysis,
): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `你是一位资深交易心理与行为分析专家。请根据交易者的交易统计数据和心理画像，生成深度个性化洞察。

输出格式（严格 JSON，不要 markdown 代码块或额外解释）：
{
  "pnlAttribution": ["盈亏归因分析1", "盈亏归因分析2"],
  "dataPatterns": ["数据规律洞察1", "数据规律洞察2"],
  "personalizedAdvice": ["个性化建议1", "个性化建议2"]
}

要求：
- 每个数组 3-5 条，每条 30-60 字
- 必须结合具体数据（胜率、盈亏比、错误次数等）
- 建议必须可操作、可量化
- 不使用空泛套话`,
    },
    {
      role: 'user',
      content: `请分析以下交易数据并生成深度洞察：

## 交易摘要
- 总交易笔数: ${summary.totalTrades}
- 胜率: ${summary.winRate}%
- 盈亏比: ${summary.profitLossRatio}
- 平均盈利: ${summary.avgProfit}%
- 平均亏损: ${summary.avgLoss}%
- 总盈亏: ${summary.totalPnL}%
- 错误总数: ${summary.totalErrors}

## 心理画像
- 类型: ${errorAnalysis.psychologicalProfile.name}
- 特征: ${errorAnalysis.psychologicalProfile.characteristics.join('、')}
- 心理根源: ${errorAnalysis.psychologicalProfile.rootCause}

## 纪律分析
- 计划遵守率: ${discipline.planAdherenceRate}%
- 止损执行率: ${discipline.stopLossExecutionRate}%
- 仓位管理评分: ${discipline.positionManagementScore}
- 情绪控制评分: ${discipline.emotionControlScore}
- 综合纪律评分: ${discipline.overallScore}

## TOP5 错误
${errorAnalysis.topErrors.map((e, i) => `${i + 1}. ${e.name}（${e.count}次，${e.severity}）：${e.psychologicalRoot}`).join('\n')}`,
    },
  ]
}

/** 解析 LLM 洞察 JSON */
export function parseAIDeepInsightFromLlm(content: string): AIDeepInsight {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    const jsonStr = jsonMatch?.[1] ?? content
    // no-unsafe 治理：JSON.parse 返回 unknown，经 Record 收窄后逐字段类型守卫
    const parsed: unknown = JSON.parse(jsonStr.trim())
    const obj: Record<string, unknown> =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
    return {
      pnlAttribution: Array.isArray(obj.pnlAttribution) ? obj.pnlAttribution.map(String) : [],
      dataPatterns: Array.isArray(obj.dataPatterns) ? obj.dataPatterns.map(String) : [],
      personalizedAdvice: Array.isArray(obj.personalizedAdvice) ? obj.personalizedAdvice.map(String) : [],
    }
  } catch {
    logger.warn('[TradeReviewAI] LLM 洞察解析失败，降级为规则模板', { snippet: content.slice(0, LOG_TRUNCATE_LENGTH) })
    return { pnlAttribution: [], dataPatterns: [], personalizedAdvice: [] }
  }
}
