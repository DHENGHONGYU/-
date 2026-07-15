/**
 * @module services/skills/bullBearDebateSkill
 * @description S-08b 多空辩论 SKILL（Batch D LLM 层）
 *
 * 同时生成看多与看空两个角色的结构化论证，并给出辩论裁决，
 * 用于暴露单一方向分析的盲区，提升结论稳健性。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { chat as llmChat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'
import { toStructuredOptions } from './skillTypes'
import { CitationSchema } from './layerAnalysisSkillFactory'

const logger = getLogger()

const ArgumentSchema = z.object({
  side: z.enum(['bull', 'bear']),
  thesis: z.string().min(1),
  keyPoints: z.array(z.string()),
  evidence: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  citations: z.array(CitationSchema),
})

export const BullBearDebateOutputSchema = z.object({
  bullArgument: ArgumentSchema,
  bearArgument: ArgumentSchema,
  verdict: z.enum(['bullish', 'bearish', 'neutral', 'inconclusive']),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
})

export type BullBearDebateOutput = z.infer<typeof BullBearDebateOutputSchema>

export const BullBearDebateInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 看多/看空需考量的新闻/资讯 */
    newsTitles: z.array(z.string()).optional(),
    /** 已知的多头论据 */
    bullPoints: z.array(z.string()).optional(),
    /** 已知的空头论据 */
    bearPoints: z.array(z.string()).optional(),
  }).optional(),
})

export type BullBearDebateInput = z.infer<typeof BullBearDebateInputSchema>

function buildMessages(ctx: SkillContext): LlmMessage[] {
  const params = ctx.params ?? {}
  const newsTitles = (params.newsTitles as string[] | undefined) ?? []
  const bullPoints = (params.bullPoints as string[] | undefined) ?? []
  const bearPoints = (params.bearPoints as string[] | undefined) ?? []

  const system = [
    '你是一位投资辩论主持人，同时扮演看多（Bull）与看空（Bear）两方角色。',
    '基于提供的资讯和已知论点，分别生成两方的结构化论证，然后以中立视角给出辩论裁决与置信度。',
    '请严格按以下 JSON 格式输出（不要包含其他文字）：',
    '{',
    '  "bullArgument": {',
    '    "side": "bull",',
    '    "thesis": "看多核心论点",',
    '    "keyPoints": ["要点1"],',
    '    "evidence": ["证据1"],',
    '    "risks": ["看多方的风险/前提"],',
    '    "confidence": 0-1,',
    '    "citations": [{"source": "来源", "content": "引用摘要", "date": "可选"}]',
    '  },',
    '  "bearArgument": { 同上，side="bear" },',
    '  "verdict": "bullish" | "bearish" | "neutral" | "inconclusive",',
    '  "reasoning": "裁决理由",',
    '  "confidence": 0-1',
    '}',
  ].join('\n')

  const user = [
    `股票: ${ctx.symbol} (${ctx.stockName ?? '未知'})`,
    '',
    '资讯:',
    newsTitles.length > 0
      ? newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '暂无资讯',
    '',
    '已知多头论点:',
    bullPoints.length > 0
      ? bullPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '暂无',
    '',
    '已知空头论点:',
    bearPoints.length > 0
      ? bearPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '暂无',
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export async function executeBullBearDebateSkill(
  ctx: SkillContext,
): Promise<SkillResult<BullBearDebateOutput>> {
  const startedAt = Date.now()
  const messages = buildMessages(ctx)

  logger.info('[bullBearDebateSkill] 开始多空辩论', { symbol: ctx.symbol })

  try {
    const response = await llmChat(messages, {
      caller: 'bullBearDebateSkill',
      callerId: 'analysisOrchestrator',
      allowFallback: true,
      structured: toStructuredOptions(bullBearDebateSkill),
    })

    const parsed = response.parsed as BullBearDebateOutput | undefined
    const durationMs = Date.now() - startedAt

    if (!parsed) {
      return {
        skillId: bullBearDebateSkill.name,
        status: 'failed',
        evidence: [],
        error: 'LLM 未返回结构化辩论结果',
        meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
      }
    }

    return {
      skillId: bullBearDebateSkill.name,
      status: 'success',
      data: parsed,
      rawText: response.content,
      confidence: parsed.confidence,
      evidence: [
        'llm-bull-bear-debate',
        `model:${response.model}`,
        `verdict:${parsed.verdict}`,
      ],
      meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[bullBearDebateSkill] 多空辩论失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: bullBearDebateSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

export const bullBearDebateSkill: SkillDefinition<BullBearDebateOutput> = {
  name: 'bull-bear-debate',
  title: 'S-08b 多空辩论',
  description: '同时生成看多/看空两方论证并给出辩论裁决',
  inputSchema: BullBearDebateInputSchema,
  outputSchema: BullBearDebateOutputSchema,
  executor: executeBullBearDebateSkill,
  requiresLlm: true,
  version: '1.0.0',
}
