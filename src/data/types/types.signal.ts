/**
 * @fileoverview 信号域类型（L1 信号业务域）
 *
 * 包含信号快照、信号、研究日志等类型。
 *
 * @module data/types/types.signal
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** 信号快照（技术指标）  * @doc [V9-DOC-ARCH-007, V9-DOC-BACK-015, V9-DOC-QA-066]
*/
export interface SignalSnapshot {
  pePercentile?: number
  pbPercentile?: number
  priceToMA20?: number
  priceToMA60?: number
  volumeRatio?: number
  rsi14?: number
  macdDirection?: 'red' | 'green' | 'neutral'
}

/** 交易信号 */
export interface Signal {
  id: string
  symbol: string
  direction: 'buy' | 'sell' | 'hold' | 'watch'
  type: string
  strategy: string
  confidence: number
  rationale: string
  snapshot: SignalSnapshot
  createdAt: number
}

/** 研究日志（P0-5：统一字段结构，补充 audit 审计元数据） */
export interface ResearchLog {
  id?: number
  traceId: string
  timestamp: number
  actor: string
  action: string
  targetType: string
  targetCode: string
  payload?: string
  /** 审计元数据（P0-5：对齐 writeAuditLog 结构，与 AuditMeta 保持一致） */
  audit?: {
    createdAt: number
    updatedAt: number
    version: number
    operator: string
  }
}
