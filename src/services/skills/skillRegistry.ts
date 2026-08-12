/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'
import type { SkillContext, SkillDefinition, SkillExecutionOptions, SkillResult } from './skillTypes'

const logger = getLogger()

/**
 * SkillRegistry
 */
export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>()

  /**
   * 注册一个 SKILL。
   *
   * @param def SKILL 定义
   */
  register<T>(def: SkillDefinition<T>): void {
    if (this.skills.has(def.name)) {
      logger.warn(`[SkillRegistry] SKILL ${def.name} 已存在，将被覆盖`)
    }
    this.skills.set(def.name, def)
    logger.info(`[SkillRegistry] 注册 SKILL: ${def.name} (v${def.version})`)
  }

  /**
   * 批量注册 SKILL。
   */
  registerAll(defs: SkillDefinition[]): void {
    for (const def of defs) {
      this.register(def)
    }
  }

  /**
   * 获取 SKILL 定义。
   */
  get<T>(name: string): SkillDefinition<T> | undefined {
    return this.skills.get(name) as SkillDefinition<T> | undefined
  }

  /**
   * 列出所有已注册 SKILL。
   */
  list(): string[] {
    return Array.from(this.skills.keys())
  }

  /**
   * 执行指定 SKILL。
   *
   * 执行前校验输入 Schema，执行后校验输出 Schema（如执行器未返回结构化的 SkillResult，
   * 则按 outputSchema 自动封装）。
   */
  async execute<T>(name: string, ctx: SkillContext, options?: SkillExecutionOptions): Promise<SkillResult<T>> {
    const startedAt = Date.now()
    const def = this.get<T>(name)

    if (!def) {
      return buildErrorResult(name, startedAt, `SKILL ${name} 未注册`)
    }

    // 输入 Schema 校验
    const inputValidation = def.inputSchema.safeParse(ctx)
    if (!inputValidation.success) {
      const message = `输入 Schema 校验失败: ${inputValidation.error.issues.map((i) => i.message).join('; ')}`
      logger.warn(`[SkillRegistry] ${name}: ${message}`, { symbol: ctx.symbol })
      return buildErrorResult(name, startedAt, message)
    }

    try {
      const mergedOptions = { ...def.defaultOptions, ...options }
      const executorResult = await def.executor(ctx, mergedOptions)

      // 确保返回的是 SkillResult 结构
      if (!isSkillResult(executorResult)) {
        logger.warn(`[SkillRegistry] ${name} 执行器未返回 SkillResult，按 outputSchema 自动封装`, {
          symbol: ctx.symbol,
        })
        const wrapped: SkillResult<T> = {
          skillId: name,
          status: 'success',
          data: executorResult,
          evidence: ['executor-raw-output'],
          meta: { startedAt, durationMs: Date.now() - startedAt },
        }
        return validateAndReturn(def, wrapped, startedAt)
      }

      const result = executorResult

      // 若执行器已返回 SkillResult，但 data 存在，再校验一次输出 Schema
      if (result.data !== undefined) {
        return validateAndReturn(def, result, startedAt)
      }

      return {
        ...result,
        skillId: name,
        meta: { ...result.meta, durationMs: Date.now() - startedAt },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[SkillRegistry] ${name} 执行异常: ${message}`, { symbol: ctx.symbol })
      return buildErrorResult(name, startedAt, message)
    }
  }
}

function buildErrorResult<T>(name: string, startedAt: number, error: string): SkillResult<T> {
  return {
    skillId: name,
    status: 'failed',
    evidence: [],
    error,
    meta: {
      startedAt,
      durationMs: Date.now() - startedAt,
    },
  }
}

function validateAndReturn<T>(def: SkillDefinition<T>, result: SkillResult<T>, startedAt: number): SkillResult<T> {
  const outputValidation = def.outputSchema.safeParse(result.data)
  if (!outputValidation.success) {
    const message = `输出 Schema 校验失败: ${outputValidation.error.issues.map((i) => i.message).join('; ')}`
    logger.warn(`[SkillRegistry] ${def.name}: ${message}`)
    return {
      ...result,
      status: 'failed',
      error: message,
      meta: { ...result.meta, durationMs: Date.now() - startedAt },
    }
  }

  return {
    ...result,
    data: outputValidation.data,
    meta: { ...result.meta, durationMs: Date.now() - startedAt },
  }
}

function isSkillResult(value: unknown): value is SkillResult {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Partial<SkillResult>
  return typeof r.skillId === 'string' && typeof r.status === 'string' && typeof r.meta === 'object'
}

/** 全局 SKILL 注册表实例 */
export const skillRegistry = new SkillRegistry()
