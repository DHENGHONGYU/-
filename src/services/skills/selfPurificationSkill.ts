/**
 * @module services/skills/selfPurificationSkill
 * @description S-16 SKILL 自我净化/迭代 SKILL（Batch B）
 *
 * 结合 Self-Refine、Reflexion、CRITIC 与 DSPy 思想，对任意上游 SKILL 的
 * 结构化输出进行批判性审查与迭代优化，输出问题清单、修正后的结构化结果
 * 与置信度。默认单轮自净，支持最多 3 轮迭代。
 */

import { z } from 'zod'
import { getLogger } from '@/lib/logger'
import { chat as llmChat } from '@/services/llm/llmGateway'
import type { LlmMessage } from '@/services/llm/llmTypes'
import type { SkillContext, SkillDefinition, SkillResult } from './skillTypes'
import { toStructuredOptions } from './skillTypes'

const logger = getLogger()

const DEFAULT_CRITERIA = [
  '与内部评分（V6）及已有证据保持一致',
  '关键风险披露完整，不回避重大不确定性',
  '机会与风险论述平衡，避免过度乐观或悲观',
  '结论与论据之间逻辑自洽',
]

const MAX_ITERATIONS = 3

const IssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string().min(1),
  suggestion: z.string().min(1),
})

export const SelfPurificationOutputSchema = z.object({
  iterationCount: z.number().int().min(1),
  stopReason: z.enum(['converged', 'max_iterations', 'no_issue', 'failed']),
  critique: z.string().min(1),
  issues: z.array(IssueSchema),
  refinedOutput: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
})

export type SelfPurificationOutput = z.infer<typeof SelfPurificationOutputSchema>

export const SelfPurificationInputSchema = z.object({
  symbol: z.string(),
  stockName: z.string().optional(),
  userIntent: z.string().optional(),
  params: z.object({
    /** 待净化的原始 SKILL 输出 */
    originalOutput: z.record(z.string(), z.unknown()),
    /** 来源 SKILL 标识 */
    originalSkillId: z.string().optional(),
    /** 原始证据/来源列表 */
    originalEvidence: z.array(z.string()).optional(),
    /** 审查维度，默认覆盖一致性、风险、平衡、逻辑自洽 */
    criteria: z.array(z.string()).optional(),
    /** 最大迭代轮数，限制 1-3，默认 1 */
    maxIterations: z.number().int().min(1).max(MAX_ITERATIONS).optional(),
  }).optional(),
})

export type SelfPurificationInput = z.infer<typeof SelfPurificationInputSchema>

function buildMessages(
  ctx: SkillContext,
  currentOutput: Record<string, unknown>,
  criteria: string[],
  originalEvidence: string[],
  iteration: number,
): LlmMessage[] {
  const params = ctx.params ?? {}
  const originalSkillId = (params.originalSkillId as string | undefined) ?? 'unknown'

  const system = [
    '你是一位严苛的量化研究审稿人。你的任务是基于原始证据和审查维度，对上游 SKILL 的结构化输出进行批判性检查，并给出修正后的版本。',
    '请严格按以下 JSON 格式输出，不要包含其他文字：',
    '{',
    '  "iterationCount": 当前迭代轮次（数字）,',
    '  "stopReason": "converged" | "max_iterations" | "no_issue" | "failed",',
    '  "critique": "对当前输出的总体批判性评价",',
    '  "issues": [',
    '    { "severity": "high" | "medium" | "low", "description": "问题描述", "suggestion": "修改建议" }',
    '  ],',
    '  "refinedOutput": { /* 修正后的完整结构化输出 */ },',
    '  "confidence": 0.0-1.0,',
    '  "rationale": "为何给出该修正与置信度"',
    '}',
    `stopReason 规则：若 issues 为空则填 "no_issue"；若 refinedOutput 与输入实质一致则填 "converged"；否则填 "max_iterations"。`,
  ].join('\n')

  const user = [
    `股票: ${ctx.symbol} (${ctx.stockName ?? '未知'})`,
    `来源 SKILL: ${originalSkillId}`,
    `当前迭代轮次: ${iteration}`,
    '',
    '审查维度:',
    criteria.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    '',
    '原始证据/来源:',
    originalEvidence.length > 0
      ? originalEvidence.map((e, i) => `${i + 1}. ${e}`).join('\n')
      : '无',
    '',
    '待审查输出（JSON）:',
    JSON.stringify(currentOutput, null, 2),
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

async function runSingleIteration(
  ctx: SkillContext,
  currentOutput: Record<string, unknown>,
  criteria: string[],
  originalEvidence: string[],
  iteration: number,
): Promise<SelfPurificationOutput | undefined> {
  const messages = buildMessages(ctx, currentOutput, criteria, originalEvidence, iteration)

  const response = await llmChat(messages, {
    caller: 'selfPurificationSkill',
    callerId: 'selfPurificationSkill',
    allowFallback: true,
    structured: toStructuredOptions(selfPurificationSkill),
  })

  return response.parsed as SelfPurificationOutput | undefined
}

function outputsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export async function executeSelfPurificationSkill(
  ctx: SkillContext,
): Promise<SkillResult<SelfPurificationOutput>> {
  const startedAt = Date.now()
  const params = ctx.params ?? {}
  const originalOutput = (params.originalOutput as Record<string, unknown> | undefined) ?? {}
  const originalEvidence = (params.originalEvidence as string[] | undefined) ?? []
  const criteria = (params.criteria as string[] | undefined) ?? DEFAULT_CRITERIA
  const maxIterations = Math.min(
    MAX_ITERATIONS,
    Math.max(1, (params.maxIterations as number | undefined) ?? 1),
  )

  logger.info('[selfPurificationSkill] 开始自我净化', {
    symbol: ctx.symbol,
    originalSkillId: params.originalSkillId as string | undefined,
    maxIterations,
    criteriaCount: criteria.length,
  })

  let currentOutput = { ...originalOutput }
  let lastResult: SelfPurificationOutput | undefined

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const parsed = await runSingleIteration(
        ctx,
        currentOutput,
        criteria,
        originalEvidence,
        iteration,
      )

      if (!parsed) {
        logger.warn('[selfPurificationSkill] LLM 未返回结构化自净结果', { symbol: ctx.symbol })
        return {
          skillId: selfPurificationSkill.name,
          status: 'failed',
          evidence: [],
          error: 'LLM 未返回结构化自净结果',
          meta: { startedAt, durationMs: Date.now() - startedAt },
        }
      }

      const refinedOutput = typeof parsed.refinedOutput === 'object' && parsed.refinedOutput !== null
        ? (parsed.refinedOutput as Record<string, unknown>)
        : { ...currentOutput }

      const stopReason = parsed.issues.length === 0
        ? 'no_issue'
        : outputsEqual(currentOutput, refinedOutput)
          ? 'converged'
          : iteration === maxIterations
            ? 'max_iterations'
            : parsed.stopReason

      lastResult = {
        ...parsed,
        iterationCount: iteration,
        stopReason,
        refinedOutput,
      }

      logger.info(`[selfPurificationSkill] 第 ${iteration} 轮自净完成`, {
        symbol: ctx.symbol,
        iteration,
        stopReason,
        issueCount: lastResult.issues.length,
        confidence: lastResult.confidence,
      })

      if (stopReason === 'no_issue' || stopReason === 'converged') {
        break
      }

      currentOutput = refinedOutput
    }

    if (!lastResult) {
      return {
        skillId: selfPurificationSkill.name,
        status: 'failed',
        evidence: [],
        error: '自净迭代未产生任何结果',
        meta: { startedAt, durationMs: Date.now() - startedAt },
      }
    }

    logger.info('[selfPurificationSkill] 自我净化完成', {
      symbol: ctx.symbol,
      iterationCount: lastResult.iterationCount,
      stopReason: lastResult.stopReason,
      issueCount: lastResult.issues.length,
      confidence: lastResult.confidence,
    })

    return {
      skillId: selfPurificationSkill.name,
      status: 'success',
      data: lastResult,
      evidence: [
        `self-refine:iterationCount=${lastResult.iterationCount}`,
        `stopReason=${lastResult.stopReason}`,
        `issues=${lastResult.issues.length}`,
        `confidence=${lastResult.confidence.toFixed(2)}`,
      ],
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[selfPurificationSkill] 自我净化执行异常: ${message}`, { symbol: ctx.symbol })
    return {
      skillId: selfPurificationSkill.name,
      status: 'failed',
      evidence: [],
      error: message,
      meta: { startedAt, durationMs: Date.now() - startedAt },
    }
  }
}

export const selfPurificationSkill: SkillDefinition<SelfPurificationOutput> = {
  name: 'self-purification',
  title: 'SKILL 自我净化/迭代',
  description: '基于 Self-Refine / CRITIC 框架对上游 SKILL 输出进行批判性审查与迭代优化',
  inputSchema: SelfPurificationInputSchema,
  outputSchema: SelfPurificationOutputSchema,
  executor: executeSelfPurificationSkill,
  requiresLlm: true,
  version: '1.0.0',
}
