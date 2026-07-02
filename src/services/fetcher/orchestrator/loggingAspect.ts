/**
 * AOP 日志切面（Cross-cutting Concern）
 *
 * 使用高阶函数包裹编排步骤，在执行前后自动注入日志埋点。
 * 编排核心和 Phase 步骤内部不再需要手写 logger.info 调用，
 * 主流程代码体积可缩减 60%+。
 *
 * 设计原则：
 *   - 日志是横切关注点，绝不能侵入主业务代码
 *   - 使用高阶函数（而非装饰器语法），兼容性更好
 *   - 异常不吞：记录后向上抛出，由编排核心决定降级策略
 */

import { getLogger } from '@/lib/logger'
import type { IWorkflowStep, OrchestratorContext } from './ports'

const logger = getLogger()

/**
 * 高阶函数：为编排步骤自动注入日志埋点。
 *
 * 注入的埋点：
 *   - 执行前：step 名称、sessionId、开始时间、标的数量
 *   - 执行后：耗时、成功/失败数、stale/partial 标记
 *   - 异常时：耗时、错误信息（不吞异常，向上抛出）
 *
 * @example
 * const loggedStep = withLogging(new Phase1Step(fetcher, writer))
 */
export function withLogging(
  step: IWorkflowStep<OrchestratorContext>,
): IWorkflowStep<OrchestratorContext> {
  return {
    name: step.name,
    async execute(ctx: OrchestratorContext): Promise<OrchestratorContext> {
      const startTs = Date.now()
      logger.info('[Orchestrator] Step 开始', {
        step: step.name,
        sessionId: ctx.sessionId,
        startTime: startTs,
        symbolCount: ctx.symbols.length,
      })

      try {
        const result = await step.execute(ctx)
        const durationMs = Date.now() - startTs
        const lastSummary = result.phaseSummaries[result.phaseSummaries.length - 1]
        logger.info('[Orchestrator] Step 完成', {
          step: step.name,
          sessionId: ctx.sessionId,
          durationMs,
          successCount: lastSummary?.successCount ?? 0,
          failedCount: lastSummary?.failedCount ?? 0,
          stale: lastSummary?.stale ?? false,
          partial: lastSummary?.partial ?? false,
        })
        return result
      } catch (err) {
        const durationMs = Date.now() - startTs
        logger.error('[Orchestrator] Step 异常', {
          step: step.name,
          sessionId: ctx.sessionId,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
  }
}

/**
 * 高阶函数：为任意异步函数注入计时埋点。
 * 用于单维度采集等非编排步骤场景。
 *
 * @example
 * const timedFetch = withTiming('fetchQuote', fetcher.fetchQuote.bind(fetcher))
 */
export function withTiming<TArgs extends unknown[], TResult>(
  label: string,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const startTs = Date.now()
    logger.info('[Orchestrator] 计时开始', { label, startTime: startTs })
    try {
      const result = await fn(...args)
      const durationMs = Date.now() - startTs
      logger.info('[Orchestrator] 计时结束', { label, durationMs })
      return result
    } catch (err) {
      const durationMs = Date.now() - startTs
      logger.warn('[Orchestrator] 计时结束(异常)', {
        label,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}

/**
 * 高阶函数：为单标的采集注入详细埋点。
 * 记录每个标的的采集开始、完成、耗时、来源。
 *
 * @example
 * const tracedCollect = withSymbolTrace('01_basic', collectOne)
 */
export function withSymbolTrace<TArgs extends unknown[], TResult>(
  dimension: string,
  phase: string,
  fn: (code: string, ...rest: TArgs) => Promise<TResult>,
): (code: string, ...rest: TArgs) => Promise<TResult> {
  return async (code: string, ...rest: TArgs): Promise<TResult> => {
    const startTs = Date.now()
    logger.info('[Orchestrator] 标的采集开始', {
      phase,
      dimension,
      code,
      startTime: startTs,
    })
    try {
      const result = await fn(code, ...rest)
      const durationMs = Date.now() - startTs
      logger.info('[Orchestrator] 标的采集完成', {
        phase,
        dimension,
        code,
        durationMs,
      })
      return result
    } catch (err) {
      const durationMs = Date.now() - startTs
      logger.warn('[Orchestrator] 标的采集失败', {
        phase,
        dimension,
        code,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}
