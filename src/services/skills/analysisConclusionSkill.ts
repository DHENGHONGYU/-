/**
 * @module services/skills/analysisConclusionSkill
 * @description 分析结论 SKILL（Batch A 首个 LLM SKILL）
 *
 * 将 AnalysisOrchestrator 中对 LLM 的调用封装为 SkillRegistry 可调用的 SKILL，
 * 使用结构化输出强制返回 JSON，并做 Zod Schema 校验。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { chat as llmChat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'
import { toStructuredOptions } from './skillTypes'

const logger = getLogger()

const RATINGS = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'] as const

/**
 * AnalysisConclusionSchema
 */
export const AnalysisConclusionSchema = z.object({
  rating: z.enum(RATINGS),
  summary: z.string().min(1),
  keyRisks: z.array(z.string()),
  opportunities: z.array(z.string()),
  confidence: z.number().min(0).max(1).optional(),
  consistentWithV6: z.boolean().optional(),
})

export type AnalysisConclusionOutput = z.infer<typeof AnalysisConclusionSchema>

/**
 * AnalysisConclusionInputSchema
 */
export const AnalysisConclusionInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    v6Score: z.number().optional(),
    v6Rating: z.string().optional(),
    newsTitles: z.array(z.string()).optional(),
  }).optional(),
})

export type AnalysisConclusionInput = z.infer<typeof AnalysisConclusionInputSchema>

function buildMessages(ctx: SkillContext): LlmMessage[] {
  const params = ctx.params ?? {}
  const newsTitles = (params.newsTitles as string[] | undefined) ?? []

  const system = [
    '你是一位专业的股票分析师。基于提供的外部资讯和内部评分数据，给出结构化的分析结论。',
    '请严格按以下 JSON 格式输出（不要包含其他文字）：',
    '{',
    '  "rating": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",',
    '  "summary": "一句话总结分析结论",',
    '  "keyRisks": ["风险1", "风险2"],',
    '  "opportunities": ["机会1", "机会2"],',
    '  "confidence": 0.85',
    '}',
  ].join('\n')

  const newsLines = newsTitles.length > 0
    ? newsTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')
    : '暂无资讯'

  const user = [
    `股票: ${ctx.symbol} (${ctx.stockName ?? '未知'})`,
    `V6评分: ${(params.v6Score as number | undefined) ?? 'N/A'} | 评级: ${(params.v6Rating as string | undefined) ?? 'N/A'}`,
    '',
    '资讯摘要:',
    newsLines,
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * executeAnalysisConclusionSkill
 */
export async function executeAnalysisConclusionSkill(
  ctx: SkillContext,
): Promise<SkillResult<AnalysisConclusionOutput>> {
  const startedAt = Date.now()
  const messages = buildMessages(ctx)

  try {
    const response = await llmChat(messages, {
      caller: 'analysisConclusionSkill',
      callerId: 'analysisOrchestrator',
      allowFallback: true,
      structured: toStructuredOptions(analysisConclusionSkill),
    })

    const parsed = response.parsed as AnalysisConclusionOutput | undefined
  const durationMs = Date.now() - startedAt

  if (!parsed) {
    return {
      skillId: analysisConclusionSkill.name,
      status: 'failed',
      rawText: response.content,
      evidence: [],
      error: 'LLM 未返回结构化结论',
      meta: {
        startedAt,
        durationMs,
        model: response.model,
        tokenUsage: response.usage,
      },
    }
  }

  return {
    skillId: analysisConclusionSkill.name,
    status: 'success',
    data: {
      ...parsed,
      consistentWithV6: parsed.rating === (ctx.params?.v6Rating as string | undefined),
    },
    rawText: response.content,
    confidence: parsed.confidence,
    evidence: ['llm-structured-output', `model:${response.model}`],
    meta: {
      startedAt,
      durationMs,
      model: response.model,
      tokenUsage: response.usage,
    },
  }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[analysisConclusionSkill] 执行失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: analysisConclusionSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: {
        startedAt,
        durationMs: Date.now() - startedAt,
      },
    }
  }
}

/**
 * analysisConclusionSkill
 */
export const analysisConclusionSkill: SkillDefinition<AnalysisConclusionOutput> = {
  name: 'analysis-conclusion',
  title: '分析结论生成',
  description: '基于 V6 评分和资讯生成结构化分析结论',
  inputSchema: AnalysisConclusionInputSchema,
  outputSchema: AnalysisConclusionSchema,
  executor: executeAnalysisConclusionSkill,
  requiresLlm: true,
  version: '1.0.0',
}
