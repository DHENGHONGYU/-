/**
 * @test_id V9-TEST-ST-070
 * @module collectionReportService.test
 * @description collectionReportService 单元测试
 *
 * 验证从 traceSpans / taskStatuses 聚合为进度与汇报数据的正确性。
  * @covers_docs []
*/

import { describe, it, expect, vi } from 'vitest'
import {
  buildCollectionReport,
  formatCollectionTime,
  formatCollectionTimeRange,
} from './collectionReportService'
import type { CollectionTraceSpan, CollectionTaskRuntime } from '@/types/modules/collection.types'
import { DEFAULT_DIMENSIONS } from '@/config/collectConfig'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

let spanCounter = 0

function makeSpan(
  dimensionCode: string,
  result: CollectionTraceSpan['result'],
  overrides: Partial<CollectionTraceSpan> = {},
): CollectionTraceSpan {
  const now = Date.now()
  spanCounter++
  return {
    traceId: `span-${dimensionCode}-${now}-${spanCounter}`,
    taskId: `task-${dimensionCode}`,
    dimensionCode,
    symbol: '600519.SH',
    startedAt: now - 1000,
    completedAt: now,
    totalDurationMs: 1000,
    result,
    stages: [],
    fallbackCount: 0,
    error: result === 'fail' ? '网络超时' : undefined,
    ...overrides,
  }
}

function makeTask(
  dimensionCode: string,
  status: CollectionTaskRuntime['status'],
  progress = 0,
): CollectionTaskRuntime {
  return {
    taskId: `task-${dimensionCode}`,
    dimensionCode,
    symbol: '600519.SH',
    status,
    progress,
    startedAt: Date.now() - 1000,
    completedAt: Date.now(),
  }
}

describe('collectionReportService', () => {
  it('空数据时返回默认维度个数的维度，状态均为 not_ready', () => {
    const report = buildCollectionReport({}, {})
    expect(report.progressItems).toHaveLength(DEFAULT_DIMENSIONS.length)
    expect(report.reportItems).toHaveLength(DEFAULT_DIMENSIONS.length)
    expect(report.overallProgress).toBe(0)
    expect(report.hasRunningTask).toBe(false)
    for (const item of report.progressItems) {
      expect(item.status).toBe('not_ready')
    }
  })

  it('成功 span 产生 completed 状态与 100% 成功率', () => {
    const span = makeSpan('01', 'success')
    const report = buildCollectionReport({ [span.traceId]: span }, {})
    const item = report.progressItems.find((i) => i.code === '01')!
    expect(item.status).toBe('completed')
    expect(item.progress).toBe(100)
    expect(item.success).toBe(1)
    expect(item.failed).toBe(0)

    const reportItem = report.reportItems.find((i) => i.code === '01')!
    expect(reportItem.successRate).toBe(100)
    expect(reportItem.collectedCount).toBe(1)
    expect(reportItem.failures).toHaveLength(0)
  })

  it('失败 span 记录到失败列表并降低成功率', () => {
    const success = makeSpan('02', 'success', { symbol: '000001.SZ' })
    const fail = makeSpan('02', 'fail', { symbol: '600519.SH', error: '接口限流' })
    const report = buildCollectionReport(
      { [success.traceId]: success, [fail.traceId]: fail },
      {},
    )
    const item = report.progressItems.find((i) => i.code === '02')!
    expect(item.success).toBe(1)
    expect(item.failed).toBe(1)

    const reportItem = report.reportItems.find((i) => i.code === '02')!
    expect(reportItem.successRate).toBe(50)
    expect(reportItem.failures).toHaveLength(1)
    expect(reportItem.failures[0]!.symbol).toBe('600519.SH')
    expect(reportItem.failures[0]!.error).toBe('接口限流')
  })

  it('running 任务使维度状态为 running，进度为任务平均进度', () => {
    const task = makeTask('03', 'running', 45)
    const report = buildCollectionReport({}, { [task.taskId]: task })
    const item = report.progressItems.find((i) => i.code === '03')!
    expect(item.status).toBe('running')
    expect(item.progress).toBe(45)
    expect(report.hasRunningTask).toBe(true)
  })

  it('unsupported 占位失败被识别为 not_ready，不混入异常', () => {
    const span = makeSpan('04', 'fail', {
      stages: [{ stage: 'complete', message: '暂不支持该维度', timestamp: Date.now() }],
    })
    const report = buildCollectionReport({ [span.traceId]: span }, {})
    const item = report.progressItems.find((i) => i.code === '04')!
    expect(item.status).toBe('not_ready')
  })

  it('多维度总体进度为各维度进度平均值', () => {
    const s1 = makeSpan('01', 'success')
    const s2 = makeSpan('02', 'success')
    const report = buildCollectionReport(
      { [s1.traceId]: s1, [s2.traceId]: s2 },
      {},
    )
    // 01 与 02 完成，其余 (DEFAULT_DIMENSIONS.length - 2) 个维度 not_ready(0 进度)
    expect(report.overallProgress).toBe(Math.round((100 + 100 + 0 * (DEFAULT_DIMENSIONS.length - 2)) / DEFAULT_DIMENSIONS.length))
  })

  it('formatCollectionTime 处理空值与正常时间', () => {
    expect(formatCollectionTime(null)).toBe('—')
    const ts = new Date('2026-07-10T08:30:00').getTime()
    const formatted = formatCollectionTime(ts)
    expect(formatted).toContain('07')
    expect(formatted).toContain('10')
    expect(formatted).toContain('08:30')
  })

  it('formatCollectionTimeRange 处理空值与范围', () => {
    expect(formatCollectionTimeRange(null, null)).toBe('—')
    const start = new Date('2026-07-10T08:00:00').getTime()
    const end = new Date('2026-07-10T08:30:00').getTime()
    const range = formatCollectionTimeRange(start, end)
    expect(range).toContain('~')
  })
})
