/**
 * @fileoverview Zod DTO Schema 统一入口 + DataBridge 边界 validateWithSchema 守卫
 *
 * 5 舱映射（P3-1 验收标准项）：
 *   ① InputStockPool      → inputStockPool.zod.ts     (输入舱)
 *   ② AnalysisV6Score     → analysisV6Score.zod.ts    (分析舱)
 *   ③ TradingPnL          → tradingPnL.zod.ts         (交易舱)
 *   ④ OutputDocExport     → outputDocExport.zod.ts    (输出舱)
 *   ⑤ ControlHealthDash   → controlHealthDash.zod.ts  (控制舱)
 *
 * 使用方式（DataBridge 入口守卫）：
 *   import { validateWithSchema, Z_INPUT_STOCK_POOL_DTO } from '@/types/zod'
 *   const input = validateWithSchema(raw, Z_INPUT_STOCK_POOL_DTO, { module: 'input-cockpit' })
 *   // 失败 → 写 audit:mock → audit:acl-consistency 审计日志 + 抛业务异常
 *   // 成功 → 返回带 TS 类型的 DTO（z.infer 天然类型一致，不用 as 断言）
 */

export * from './inputStockPool.zod'
export * from './analysisV6Score.zod'
export * from './tradingPnL.zod'
export * from './outputDocExport.zod'
export * from './controlHealthDash.zod'

import type { z, ZodTypeAny } from 'zod'
// 显式命名空间 import：确保 Z_* 顶层 DTO const 在本文件作用域可见（修复 TS2304 未定义）
import * as InputMod from './inputStockPool.zod'
import * as AnalysisMod from './analysisV6Score.zod'
import * as TradingMod from './tradingPnL.zod'
import * as OutputMod from './outputDocExport.zod'
import * as ControlMod from './controlHealthDash.zod'

// ---------- 顶层 DTO 聚合（便于批量注册 & 遍历单元测试） ----------
export const FIVE_CAPSULE_DTO_SCHEMAS = {
  InputStockPool: InputMod.Z_INPUT_STOCK_POOL_DTO,
  AnalysisV6Score: AnalysisMod.Z_ANALYSIS_V6_SCORE_DTO,
  TradingPnL: TradingMod.Z_TRADING_PNL_DTO,
  OutputDocExport: OutputMod.Z_OUTPUT_DOC_EXPORT_DTO,
  ControlHealthDash: ControlMod.Z_CONTROL_HEALTH_DASH_DTO,
} as const
export type FiveCapsuleKey = keyof typeof FIVE_CAPSULE_DTO_SCHEMAS

// ---------- validateWithSchema：DataBridge 边界守卫 ----------
// 设计：纯函数 + 错误类型分化（ZodSchemaError / 通用 unknown）
// 失败默认 throw 业务异常；如传入 onInvalid，则回调不 throw（上层可降级）

export interface ValidateWithSchemaOptions {
  /** 模块名（用于写审计日志的来源标签） */
  module?: string
  /** 失败时是否抛异常（默认 true；false 时返回 null，由上层判断） */
  throwOnInvalid?: boolean
  /** 失败钩子：写审计日志（errorBus / trace_records / conflict_log 任选） */
  onInvalid?: (err: z.ZodError, module?: string) => void
}

export class SchemaValidationError extends Error {
  override name = 'SchemaValidationError'
  constructor(
    public readonly zodError: z.ZodError,
    public readonly module?: string,
  ) {
    const flat = zodError.issues
      .map((i) => `[${i.path.join('.')}] ${i.message}`)
      .slice(0, 5)
      .join(' | ')
    super(`Zod 校验失败${module ? ` (${module})` : ''}: ${flat}${zodError.issues.length > 5 ? ` ...共${zodError.issues.length}项` : ''}`)
  }
}

export function validateWithSchema<T extends ZodTypeAny>(
  value: unknown,
  schema: T,
  options: ValidateWithSchemaOptions = {},
): z.infer<T> | null {
  const { module, throwOnInvalid = true, onInvalid } = options
  const result = schema.safeParse(value)
  if (result.success) return result.data
  onInvalid?.(result.error, module)
  if (throwOnInvalid) throw new SchemaValidationError(result.error, module)
  return null
}

/** 异步版本：validateWithSchema 的 Promise 包装（如未来引入远端 schema registry 校验可无缝替换） */
export async function validateWithSchemaAsync<T extends ZodTypeAny>(
  value: unknown,
  schema: T,
  options: ValidateWithSchemaOptions = {},
): Promise<z.infer<T> | null> {
  return validateWithSchema(value, schema, options)
}
