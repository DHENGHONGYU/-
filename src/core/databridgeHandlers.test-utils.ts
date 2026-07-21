/**
 * @test_id V9-TEST-ST-020-SHARED
 * @covers_docs [V9-DOC-BACK-010, V9-DOC-PROJ-003]
 *
 * DataBridge Handlers 测试共享工具模块
 * 仅提供纯工具函数，不含任何 vi.mock（mock 须在各自测试文件顶部声明）。
 */
import { vi } from 'vitest'
import { type EnvelopeAction } from '@/config/dbConfig'
import { type StandardEnvelope } from './envelope'

// ──────────────────────────────────────────────
// 共享 mock（供 edge / mutation / query 测试复用）
// ──────────────────────────────────────────────
export const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

export const dbModule = {
  db: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    getAllByIndex: vi.fn(),
    withTransaction: vi.fn(),
  },
  now: vi.fn(() => Date.now()),
}

// ──────────────────────────────────────────────
// 辅助函数
// ──────────────────────────────────────────────
export function makeEnvelope(
  action: EnvelopeAction,
  payload: unknown,
  traceId = 'test-trace-001',
): StandardEnvelope {
  return {
    meta: {
      source: 'pool',
      target: 'db',
      action,
      traceId,
      timestamp: Date.now(),
    },
    payload,
  }
}
