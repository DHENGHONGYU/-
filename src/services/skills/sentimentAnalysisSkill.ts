/**
 * @module services/skills/sentimentAnalysisSkill
 * @description D9 舆情情绪分析 SKILL（Batch D LLM 层）
 *
 * 基于外部采集的新闻标题/摘要，对单只股票进行情绪评分、多空倾向与热度判断，
 * 输出结构化结论及可追溯引用，供 orchestrator 组装上下文。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { chat as llmChat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'
import { toStructuredOptions } from './skillTypes'
import { CitationSchema } from './layerAnalysisSkillFactory'

const logger = getLogger()

export const SentimentOutputSchema = z.object({
  sentimentScore: z.number().min(-1).max(1),
  bullishIntensity: z.number().min(0).max(1),
  bearishIntensity: z.number().min(0).max(1),
  heatScore: z.number().min(0).max(1),
  summary: z.string().min(1),
  keyTopics: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  citations: z.array(CitationSchema),
})

export type SentimentAnalysisOutput = z.infer<typeof SentimentOutputSchema>

export const SentimentInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 新闻标题/摘要列表 */
    newsTitles: z.array(z.string()).optional(),
    /** 社交媒体/论坛热帖（可选） */
    socialSnippets: z.array(z.string()).optional(),
  }).optional(),
})

export type SentimentAnalysisInput = z.infer<typeof SentimentInputSchema>

function buildMessages(ctx: SkillContext): LlmMessage[] {
  const params = ctx.params ?? {}
  const newsTitles = (params.newsTitles as string[] | undefined) ?? []
  const socialSnippets = (params.socialSnippets as string[] | undefined) ?? []

  const system = [
    '你是一位舆情情绪分析师。基于提供的新闻标题/摘要和社媒片段，判断该股票当前的市场情绪。',
    '请严格按以下 JSON 格式输出（不要包含其他文字）：',
    '{',
    '  "sentimentScore": -1 到 1（越高越偏多）,',
    '  "bullishIntensity": 0-1,',
    '  "bearishIntensity": 0-1,',
    '  "heatScore": 0-1（热度）,',
    '  "summary": "一句话情绪总结",',
    '  "keyTopics": ["话题1"],',
    '  "risks": ["风险1"],',
    '  "opportunities": ["机会1"],',
    '  "confidence": 0-1,',
    '  "citations": [{"source": "来源", "content": "引用摘要", "date": "可选"}]',
    '}',
  ].join('\n')

  const user = [
    `股票: ${ctx.symbol} (${ctx.stockName ?? '未知'})`,
    '',
    '新闻标题/摘要:',
    newsTitles.length > 0
      ? newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '暂无新闻',
    '',
    '社媒片段:',
    socialSnippets.length > 0
      ? socialSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '暂无社媒片段',
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export async function executeSentimentAnalysisSkill(
  ctx: SkillContext,
): Promise<SkillResult<SentimentAnalysisOutput>> {
  const startedAt = Date.now()
  const messages = buildMessages(ctx)

  logger.info('[sentimentAnalysisSkill] 开始舆情情绪分析', { symbol: ctx.symbol })

  try {
    const response = await llmChat(messages, {
      caller: 'sentimentAnalysisSkill',
      callerId: 'analysisOrchestrator',
      allowFallback: true,
      structured: toStructuredOptions(sentimentAnalysisSkill),
    })

    const parsed = response.parsed as SentimentAnalysisOutput | undefined
    const durationMs = Date.now() - startedAt

    if (!parsed) {
      return {
        skillId: sentimentAnalysisSkill.name,
        status: 'failed',
        evidence: [],
        error: 'LLM 未返回结构化情绪分析结果',
        meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
      }
    }

    return {
      skillId: sentimentAnalysisSkill.name,
      status: 'success',
      data: parsed,
      rawText: response.content,
      confidence: parsed.confidence,
      evidence: [
        'llm-sentiment',
        `model:${response.model}`,
        `sentimentScore:${parsed.sentimentScore.toFixed(2)}`,
        `citations:${parsed.citations.length}`,
      ],
      meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[sentimentAnalysisSkill] 舆情情绪分析失败: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: sentimentAnalysisSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

export const sentimentAnalysisSkill: SkillDefinition<SentimentAnalysisOutput> = {
  name: 'sentiment-analysis',
  title: 'D9 舆情情绪分析',
  description: '基于新闻与社媒片段判断市场情绪、多空倾向与热度',
  inputSchema: SentimentInputSchema,
  outputSchema: SentimentOutputSchema,
  executor: executeSentimentAnalysisSkill,
  requiresLlm: true,
  version: '1.0.0',
}
