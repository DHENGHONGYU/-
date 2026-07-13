/**
 * V6 评分引擎 Web Worker
 *
 * 将 V6 评分计算 offload 到独立线程，避免主线程阻塞。
 * Worker 职责：纯计算，不触及 IndexedDB 或 DOM。
 *
 * Vite 模块 Worker 用法：
 *   new Worker(new URL('./v6ScoreWorker.ts', import.meta.url), { type: 'module' })
 */

/// <reference lib="webworker" />

import { createV6Engine } from '@/services/scoring/v6-engine'
import type {
  V6ScoreInput,
  CompositeScore,
  V6ScoreEngineConfig,
} from '@/services/scoring/v6-engine'

// ─── 消息协议 ────────────────────────────────────────────────

export interface WorkerCalculateRequest {
  id: string
  type: 'calculate'
  input: V6ScoreInput
  config?: V6ScoreEngineConfig
}

export interface WorkerPingRequest {
  id: string
  type: 'ping'
}

export type WorkerRequest = WorkerCalculateRequest | WorkerPingRequest

export interface WorkerResultResponse {
  id: string
  type: 'result'
  result: CompositeScore
}

export interface WorkerErrorResponse {
  id: string
  type: 'error'
  error: string
}

export interface WorkerPongResponse {
  id: string
  type: 'pong'
}

export type WorkerResponse = WorkerResultResponse | WorkerErrorResponse | WorkerPongResponse

// ─── Worker 入口 ─────────────────────────────────────────────

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data

  if (req.type === 'ping') {
    ctx.postMessage({ id: req.id, type: 'pong' } satisfies WorkerPongResponse)
    return
  }

  if (req.type !== 'calculate') {
    const unknownReq = req as WorkerRequest
    const unknownType = unknownReq.type
    ctx.postMessage({
      id: unknownReq.id,
      type: 'error',
      error: `Unknown request type: ${unknownType}`,
    } satisfies WorkerErrorResponse)
    return
  }

  try {
    const engine = createV6Engine(req.config)
    const result = await engine.calculateAll(req.input)
    ctx.postMessage({ id: req.id, type: 'result', result } satisfies WorkerResultResponse)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    ctx.postMessage({ id: req.id, type: 'error', error } satisfies WorkerErrorResponse)
  }
}

// 显式导出空对象，确保该文件被识别为 module
declare const self: DedicatedWorkerGlobalScope
export {}
