/**
 * @module services/skills/layerAnalysisSkillFactory
 * @description Batch D LLM 层分析 SKILL 工厂
 *
 * 为 V6 中可被 LLM 增强的层（L0/L1/L2/L4/L5/L6/L7）提供统一实现模板，
 * 每个层只需配置名称、层ID 与专属 systemPrompt，即可产出符合
 * SkillRegistry 调用的 SkillDefinition。
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { chat as llmChat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'
import { toStructuredOptions } from './skillTypes'

const logger = getLogger()

/**
 * CitationSchema
 */
export const CitationSchema = z.object({
  source: z.string().min(1),
  content: z.string().min(1),
  url: z.string().optional(),
  date: z.string().optional(),
})

/**
 * LayerAnalysisOutputSchema
 */
export const LayerAnalysisOutputSchema = z.object({
  layerId: z.string(),
  score: z.number().min(0).max(5),
  summary: z.string().min(1),
  keyPoints: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  citations: z.array(CitationSchema),
})

export type LayerAnalysisOutput = z.infer<typeof LayerAnalysisOutputSchema>

/**
 * LayerAnalysisInputSchema
 */
export const LayerAnalysisInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 规则引擎给出的基础分（0-5） */
    baseScore: z.number().min(0).max(5).optional(),
    /** 规则引擎 summary */
    baseSummary: z.string().optional(),
    /** 规则证据/数据快照 */
    evidence: z.array(z.string()).optional(),
    /** 相关资讯标题 */
    newsTitles: z.array(z.string()).optional(),
    /** 财务/估值快照 */
    financialSnapshot: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
})

export type LayerAnalysisInput = z.infer<typeof LayerAnalysisInputSchema>

export interface LayerAnalysisSkillConfig {
  /** SKILL 唯一标识 */
  name: string
  /** 人类可读标题 */
  title: string
  /** 对应 V6 层 ID */
  layerId: string
  /** 触发时机描述 */
  description: string
  /** 给 LLM 的 system prompt（限定角色与输出格式） */
  systemPrompt: string
  /** 版本 */
  version?: string
}

function buildMessages(ctx: SkillContext, cfg: LayerAnalysisSkillConfig): LlmMessage[] {
  const params = ctx.params ?? {}
  const baseScore = params.baseScore as number | undefined
  const baseSummary = params.baseSummary as string | undefined
  const evidence = (params.evidence as string[] | undefined) ?? []
  const newsTitles = (params.newsTitles as string[] | undefined) ?? []
  const financialSnapshot = params.financialSnapshot as Record<string, unknown> | undefined

  const user = [
    `股票: ${ctx.symbol} (${ctx.stockName ?? '未知'})`,
    `分析维度: ${cfg.title}（${cfg.layerId}）`,
    baseScore !== undefined ? `规则引擎基础分: ${baseScore.toFixed(2)}/5` : '规则引擎基础分: 无',
    baseSummary ? `规则摘要: ${baseSummary}` : '',
    '',
    '数据证据:',
    evidence.length > 0 ? evidence.map((e, i) => `${i + 1}. ${e}`).join('\n') : '暂无',
    '',
    '相关资讯:',
    newsTitles.length > 0 ? newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '暂无',
    '',
    '财务/估值快照:',
    financialSnapshot ? JSON.stringify(financialSnapshot, null, 2) : '暂无',
    '',
    '请按 system 要求的 JSON 格式输出本维度分析结论。',
  ].join('\n')

  return [
    { role: 'system', content: cfg.systemPrompt },
    { role: 'user', content: user },
  ]
}

/**
 * createLayerAnalysisSkill
 * @param cfg
 * @returns SkillDefinition<LayerAnalysisOutput>
 */
export function createLayerAnalysisSkill(cfg: LayerAnalysisSkillConfig): SkillDefinition<LayerAnalysisOutput> {
  async function executor(ctx: SkillContext): Promise<SkillResult<LayerAnalysisOutput>> {
    const startedAt = Date.now()
    const messages = buildMessages(ctx, cfg)

    logger.info(`[${cfg.name}] 开始 LLM 层分析`, {
      symbol: ctx.symbol,
      layerId: cfg.layerId,
    })

    try {
      const response = await llmChat(messages, {
        caller: cfg.name,
        callerId: 'analysisOrchestrator',
        allowFallback: true,
        structured: toStructuredOptions(skillDef),
      })

      const parsed = response.parsed as LayerAnalysisOutput | undefined
      const durationMs = Date.now() - startedAt

      if (!parsed) {
        return {
          skillId: cfg.name,
          status: 'failed',
          evidence: [],
          error: 'LLM 未返回结构化层分析结果',
          meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
        }
      }

      return {
        skillId: cfg.name,
        status: 'success',
        data: { ...parsed, layerId: cfg.layerId },
        rawText: response.content,
        confidence: parsed.confidence,
        evidence: [
          `llm-layer:${cfg.layerId}`,
          `model:${response.model}`,
          `citations:${parsed.citations.length}`,
        ],
        meta: { startedAt, durationMs, model: response.model, tokenUsage: response.usage },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[${cfg.name}] LLM 层分析失败: ${message}`, { symbol: ctx.symbol })
      return {
        skillId: cfg.name,
        status: 'failed',
        evidence: [],
        error: message,
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }
  }

  const skillDef: SkillDefinition<LayerAnalysisOutput> = {
    name: cfg.name,
    title: cfg.title,
    description: cfg.description,
    inputSchema: LayerAnalysisInputSchema,
    outputSchema: LayerAnalysisOutputSchema,
    executor,
    requiresLlm: true,
    version: cfg.version ?? '1.0.0',
  }

  return skillDef
}
