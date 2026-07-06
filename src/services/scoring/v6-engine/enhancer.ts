/**
 * LLMScoreEnhancer — LLM 增强装饰器
 *
 * 包装任一 LayerCalculator，在规则引擎输出的基础上调用 LLM 提升评分质量。
 * 仅对设计为"LLM 可增强"的层启用（L0/L1/L2/L4/L5/L6/L7），
 * 确定性层（L3a/L3v/L-1/L8）不调用 LLM。
 *
 * 架构：Enhancer 不替代计算器，而是在计算器结果之上做增强。
 * 离线模式或 LLM 不可用时，Enhancer 透传原始结果。
 */

import { getLogger } from '@/lib/logger'
import type { LayerInput, LayerScore, LayerCalculator } from './types'
import type { LlmConfig } from '@/config/llmConfig'
import { isLlmConfigured } from '@/config/llmConfig'
import { chat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { LOG_SNIPPET_MAX_CHARS } from '@/config/mathConstants'

const logger = getLogger()

/** 可被 LLM 增强的层 */
const LLM_ENHANCEABLE_LAYERS = new Set(['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7'])

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
          // LLM 增强成功：合并结果
          const mergedScore = enhanced.score ?? baseResult.score
          const mergedEvidence = enhanced.rationale
            ? [...baseResult.evidence, `[LLM增强] ${enhanced.rationale}`]
            : [...baseResult.evidence]

          return {
            ...baseResult,
            score: mergedScore,
            summary: enhanced.summary ?? baseResult.summary,
            evidence: mergedEvidence,
            risks: [...baseResult.risks, ...(enhanced.risks ?? [])],
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
  ): Promise<{ score?: number; summary?: string; rationale?: string; risks?: string[] }> {
    // 输入防护：确保 score 可安全格式化为字符串
    const safeScore = Number.isFinite(baseResult.score) ? baseResult.score : 0
    const safeSummary = baseResult.summary ?? '无摘要'
    const safeEvidence = Array.isArray(baseResult.evidence) ? baseResult.evidence.join('；') : ''

    const systemPrompt = `你是一位专业的股票分析师，请对以下评分层的规则引擎结果进行复核和增强。

当前层：${baseResult.layerName}
规则引擎评分：${safeScore.toFixed(2)}/5
规则引擎摘要：${safeSummary}
已有证据：${safeEvidence}

请以 JSON 格式返回增强建议：
{
  "score": number,         // 修正后的评分（0-5），如果规则引擎评分合理则保持原值
  "summary": "string",     // 增强后的摘要
  "rationale": "string",   // 增强理由
  "risks": ["string"]      // 额外识别到的风险
}`

    const userPrompt = `请对以下股票进行 ${baseResult.layerName} 的复核增强：
股票：${input.stock.symbol} ${input.stock.name ?? ''}
行业：${input.stock.sector ?? '未知'}
规则引擎当前评分：${safeScore.toFixed(2)}/5
评分摘要：${safeSummary}

请返回 JSON 格式的增强建议。`

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const response = await chat(messages, this.llmConfig!)
    logger.info(`[LLMScoreEnhancer] ${layerId} LLM 返回: ${response.content.slice(0, LOG_SNIPPET_MAX_CHARS)}`)

    return this.parseResponse(response.content)
  }

  private parseResponse(content: string): { score?: number; summary?: string; rationale?: string; risks?: string[] } {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      const jsonStr = jsonMatch?.[1] ?? content
      const parsed = JSON.parse(jsonStr.trim())
      const parsedScore = parsed.score
      return {
        score: typeof parsedScore === 'number' ? Math.max(0, Math.min(5, parsedScore)) : undefined,
        summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : undefined,
      }
    } catch {
      logger.warn('[LLMScoreEnhancer] LLM 返回内容无法解析', { snippet: content.slice(0, LOG_SNIPPET_MAX_CHARS) })
      return {}
    }
  }
}

/** 全局单例 */
export const llmEnhancer = new LLMScoreEnhancer()