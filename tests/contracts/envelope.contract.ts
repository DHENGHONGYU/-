/**
 * @fileoverview Envelope 契约验证器
 * @description 定义 DataBridge Envelope 跨层数据封装的运行时契约
 *
 * 契约来源：src/core/envelope.ts::StandardEnvelope
 */

import { z } from 'zod'

// ============================================================
// Envelope 契约定义
// ============================================================

/**
 * EnvelopeMeta 契约
 * 对应类型：src/config/dbConfig.ts::EnvelopeMeta
 */
export const EnvelopeMetaSchema = z.object({
  /** 消息来源模块 */
  source: z.string().min(1, 'source 不能为空'),
  /** 消息目标模块 */
  target: z.string().min(1, 'target 不能为空'),
  /** 消息动作 */
  action: z.string().min(1, 'action 不能为空'),
  /** 追踪 ID */
  traceId: z.string().min(1, 'traceId 不能为空'),
  /** 时间戳 */
  timestamp: z.number().int().positive(),
  /** 模块 ID（可选） */
  moduleId: z.string().optional(),
  /** 会话 ID（可选） */
  sessionId: z.string().optional(),
  /** 用户 ID（可选） */
  userId: z.string().optional(),
  /** 额外元数据（可选） */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * StandardEnvelope 契约
 * 对应类型：src/core/envelope.ts::StandardEnvelope
 *
 * 验证 DataBridge 跨层数据封装的数据形状
 */
export const StandardEnvelopeSchema = z.object({
  /** 元数据 */
  meta: EnvelopeMetaSchema,
  /** 负载数据（可以是任意类型） */
  payload: z.unknown(),
})

// ============================================================
// 工厂函数（生成符合契约的测试数据）
// ============================================================

/**
 * 创建符合 StandardEnvelope 契约的测试数据
 */
export function createMockEnvelope(
  overrides: {
    meta?: Partial<z.infer<typeof EnvelopeMetaSchema>>
    payload?: unknown
  } = {},
): z.infer<typeof StandardEnvelopeSchema> {
  const now = Date.now()
  return {
    meta: {
      source: 'test-source',
      target: 'test-target',
      action: 'TEST_ACTION',
      traceId: `trace-${now}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: now,
      ...overrides.meta,
    },
    payload: overrides.payload ?? null,
  }
}

/**
 * 创建符合 EnvelopeMeta 契约的测试数据
 */
export function createMockEnvelopeMeta(
  overrides: Partial<z.infer<typeof EnvelopeMetaSchema>> = {},
): z.infer<typeof EnvelopeMetaSchema> {
  const now = Date.now()
  return {
    source: 'test-source',
    target: 'test-target',
    action: 'TEST_ACTION',
    traceId: `trace-${now}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: now,
    ...overrides,
  }
}

// ============================================================
// 导出类型
// ============================================================

export type EnvelopeMetaContract = z.infer<typeof EnvelopeMetaSchema>
export type StandardEnvelopeContract = z.infer<typeof StandardEnvelopeSchema>
