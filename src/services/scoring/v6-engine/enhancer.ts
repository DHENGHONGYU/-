/**
 * LLMScoreEnhancer — LLM 增强装饰器
 *
 * 包装任一 LayerCalculator，在规则引擎输出的基础上调用 LLM 提升评分质量。
 * 仅对设计为"LLM 可增强"的层启用（L0/L1/L2/L4/L5/L6/L7），
 * 确定性层（L3a/L3v/L-1/L8）不调用 LLM。
 *
 * 架构：Enhancer 不替代计算器，而是在计算器结果之上做增强。
 * 离线模式或 LLM 不可用时，Enhancer 透传原始结果。
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
*/

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator, LayerId, AuditEntry } from './types'
import type { LlmConfig } from '@/config/llmConfig'
import { isLlmConfigured } from '@/config/llmConfig'
import { chat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { LOG_SNIPPET_MAX_CHARS } from '@/constants/math.constants'

const logger = getLogger()

/**
 * 一条引用依据，用于 LLM 增强的追溯审计（M2 依据追溯闸）
 * 当 LLM 调整评分时必须提供至少一条 Citation，否则回退到规则引擎评分。
 */
export interface Citation {
  /** 引用来源：研报/新闻/财报/行业报告/公告等 */
  source: string
  /** 引用的关键内容摘要 */
  content: string
  /** 可选的引用链接 */
  url?: string
  /** 引用时间（ISO 日期或"实时"） */
  date?: string
}

/**
 * 结构化审计条目（M2 深化）：将 Citation 升级为可机器查询的 AuditTrail 条目。
 * 每条引证对应一条 entry，写入 LayerScore.auditTrail。
 * 与 evidence 文本并存：evidence 负责展示、auditTrail 负责检索与校验。
 * 结构兼容 AuditEntry（含 input/output 占位），可直接追加到 auditTrail 数组。
 */
export interface CitationAuditEntry {
  timestamp: number
  layerId: string
  step: 'llm-citation'
  /** 引证数据 */
  citation: Citation
  /** [AuditEntry 兼容] 输入快照（LLM 增强前评分） */
  input?: Record<string, unknown>
  /** [AuditEntry 兼容] 输出（引证来源） */
  output?: Record<string, unknown>
}

/** LLM 增强结果（含引证字段） */
export interface LlmEnhancementResult {
  score?: number
  summary?: string
  rationale?: string
  risks?: string[]
  /** 引证依据数组；为空时若评分配置变更则触发依据追溯闸回退 */
  citations: Citation[]
}

/** 可被 LLM 增强的层 */
const LLM_ENHANCEABLE_LAYERS: ReadonlySet<LayerId> = new Set<LayerId>(['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7'])

/**
 * LLMScoreEnhancer
 */
export class LLMScoreEnhancer {
  private llmConfig: LlmConfig | null = null
  private enabled = false

  /** 配置 LLM 增强 */
  configure(config: LlmConfig): void {
    if (isLlmConfigured(config)) {
      this.llmConfig = { ...config }
      this.enabled = true
      logger.info('[LLMScoreEnhancer] LLM 增强已启用')
    } else {
      this.enabled = false
      logger.warn('[LLMScoreEnhancer] LLM 配置不完整，增强已禁用')
    }
  }

  /** 禁用 LLM 增强 */
  disable(): void {
    this.enabled = false
    logger.info('[LLMScoreEnhancer] LLM 增强已禁用')
  }

  /** 是否启用 */
  isEnabled(): boolean {
    return this.enabled && this.llmConfig !== null
  }

  /**
   * 包装计算器为 LLM 增强版本
   * 返回一个新的计算器：先执行原始计算，再（可选）调用 LLM 增强。
   */
  enhance(calculator: LayerCalculator): LayerCalculator {
    return {
      layerId: calculator.layerId,
      calculate: async (input: LayerInput): Promise<LayerScore> => {
        // 1. 先执行规则引擎计算
        const baseResult = await calculator.calculate(input)

        // 防御性校验：验证 baseResult 结构完整性
        if (!baseResult || typeof baseResult.score !== 'number') {
          logger.warn(
            `[LLMScoreEnhancer] 层 ${calculator.layerId} baseResult 无效，跳过增强`,
            { score: baseResult?.score, hasLayerId: !!baseResult?.layerId },
          )
          return baseResult
        }

        // 2. 判断是否需要 LLM 增强
        if (!this.isEnabled() || !LLM_ENHANCEABLE_LAYERS.has(calculator.layerId)) {
          return baseResult
        }

        if (!this.llmConfig) {
          return baseResult
        }

        try {
          const enhanced = await this.callLLM(calculator.layerId, baseResult, input)

          // [M2 依据追溯闸] 检查 LLM 是否提供了引证来源
          const hasCitations = enhanced.citations.length > 0
          const scoreChanged = typeof enhanced.score === 'number' &&
            Math.abs(enhanced.score - baseResult.score) > 0.001

          if (scoreChanged && !hasCitations) {
            // 引证闸激活：LLM 调整了评分但未提供引用来源 → 拒绝评分变更，回退到规则引擎结果
            logger.warn(
              `[LLMScoreEnhancer] 层 ${calculator.layerId} 引证闸激活：` +
                `LLM 建议评分 ${enhanced.score!.toFixed(2)} 但未提供引用来源，已回退到规则评分 ${baseResult.score.toFixed(2)}`,
            )
            const fallbackEvidence = enhanced.rationale
              ? [...baseResult.evidence, `[LLM增强-无引用(已拒绝)] ${enhanced.rationale}`]
              : [...baseResult.evidence]

            return {
              ...baseResult,
              summary: enhanced.summary ?? baseResult.summary,
              evidence: fallbackEvidence,
              risks: [...baseResult.risks, ...(enhanced.risks ?? [])],
            }
          }

          // LLM 增强成功（有引证或未改变评分）：合并结果
          const mergedScore = enhanced.score ?? baseResult.score
          const citationEvidence = hasCitations
            ? enhanced.citations.map(c =>
                `[引用:${c.source}] ${c.content}${c.date ? ` (${c.date})` : ''}${c.url ? ` 链接:${c.url}` : ''}`,
              )
            : []
          const mergedEvidence = [
            ...baseResult.evidence,
            ...citationEvidence,
            ...(enhanced.rationale ? [`[LLM增强] ${enhanced.rationale}`] : []),
          ]

          // [M2 深化] 结构化审计：将 Citation 写入 auditTrail（机器可查询）
          // evidence 负责展示，auditTrail 负责检索与校验
          const now = Date.now()
          const citationAuditEntries: CitationAuditEntry[] = hasCitations
            ? enhanced.citations.map(c => ({
                timestamp: now,
                layerId: calculator.layerId,
                step: 'llm-citation' as const,
                citation: c,
                // AuditEntry 结构兼容字段
                input: { baseScore: baseResult.score, layerName: baseResult.layerName },
                output: { source: c.source, content: c.content },
              }))
            : []

          return {
            ...baseResult,
            score: mergedScore,
            summary: enhanced.summary ?? baseResult.summary,
            evidence: mergedEvidence,
            risks: [...baseResult.risks, ...(enhanced.risks ?? [])],
            // [M2 深化] 追加结构化引证审计条目（不覆盖既有 rule engine 审计）
            auditTrail: [
              ...(baseResult.auditTrail ?? []),
              ...citationAuditEntries,
            ] as AuditEntry[],
          }
        } catch (error) {
          logger.warn(
            `[LLMScoreEnhancer] 层 ${calculator.layerId} LLM 增强失败，回退到规则结果: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
          return baseResult
        }
      },
    }
  }

  private async callLLM(
    layerId: string,
    baseResult: LayerScore,
    input: LayerInput,
  ): Promise<LlmEnhancementResult> {
    // 输入防护：确保 score 可安全格式化为字符串
    const safeScore = Number.isFinite(baseResult.score) ? baseResult.score : 0
    const safeSummary = baseResult.summary ?? '无摘要'
    const safeEvidence = Array.isArray(baseResult.evidence) ? baseResult.evidence.join('；') : ''

    const systemPrompt = `你是一位专业的股票分析师，请对以下评分层的规则引擎结果进行复核和增强。

当前层：${baseResult.layerName}
规则引擎评分：${safeScore.toFixed(2)}/5
规则引擎摘要：${safeSummary}
已有证据：${safeEvidence}

请以 JSON 格式返回增强建议，任何评分调整必须附带引用依据（citations）：
{
  "score": number,         // 修正后的评分（0-5），如果规则引擎评分合理则保持原值
  "summary": "string",     // 增强后的摘要
  "rationale": "string",   // 增强理由
  "risks": ["string"],     // 额外识别到的风险
  "citations": [           // 引证依据数组；若调整评分则必须提供至少一条
    {
      "source": "string",  // 引用来源：研报/新闻/财报/行业报告/公告等
      "content": "string", // 引用的关键内容摘要
      "url": "string",     // 可选：引用链接
      "date": "string"     // 可选：引用时间
    }
  ]
}

重要：若你认为当前评分为合理而不做调整，citations 数组可为空。
若你调整了评分（score 不同于原始值），则必须提供至少一条 citations 以证明调整依据。`

    const userPrompt = `请对以下股票进行 ${baseResult.layerName} 的复核增强：
股票：${input.stock.symbol} ${input.stock.name ?? ''}
行业：${input.stock.sector ?? '未知'}
规则引擎当前评分：${safeScore.toFixed(2)}/5
评分摘要：${safeSummary}

请返回 JSON 格式的增强建议。
注意：若你调整了评分，必须在 citations 字段中至少提供一条引用来源以证明依据。`

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const response = await chat(messages, this.llmConfig!)
    logger.info(`[LLMScoreEnhancer] ${layerId} LLM 返回: ${response.content.slice(0, LOG_SNIPPET_MAX_CHARS)}`)

    return this.parseResponse(response.content)
  }

  private parseResponse(content: string): LlmEnhancementResult {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      const jsonStr = jsonMatch?.[1] ?? content
      const parsed = JSON.parse(jsonStr.trim())
      const parsedScore = parsed.score
      const rawCitations = Array.isArray(parsed.citations) ? parsed.citations : []
      return {
        score: typeof parsedScore === 'number' ? Math.max(0, Math.min(5, parsedScore)) : undefined,
        summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : undefined,
        citations: rawCitations.map((c: Record<string, unknown>) => ({
          source: typeof c.source === 'string' ? c.source : '未知来源',
          content: typeof c.content === 'string' ? c.content : '无内容',
          url: typeof c.url === 'string' ? c.url : undefined,
          date: typeof c.date === 'string' ? c.date : undefined,
        })),
      }
    } catch {
      logger.warn('[LLMScoreEnhancer] LLM 返回内容无法解析', { snippet: content.slice(0, LOG_SNIPPET_MAX_CHARS) })
      return { citations: [] }
    }
  }
}

/** 全局单例 */
export const llmEnhancer = new LLMScoreEnhancer()