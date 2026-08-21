/**
 * @test_id V9-TEST-ST-058
 * @fileoverview useCollectionTaskStats Hook 单元测试
 *
 * 验证拆分后的状态聚合逻辑：
 * - tasks: Object.values(taskStatuses)
 * - selectedTraces: 按 selectedTaskId 过滤
 * - taskStats: 按 status 分类计数
 * - dimHealth: 按 dimensionCode 聚合
 * - scoreStats: 评分统计（avg/max/min/distribution/trend）
  * @covers_docs []
*/

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock mcpBridge
vi.mock('@/mcp/bridge/mcpBridge', () => ({
  mcpBridge: {
    callTool: vi.fn(async () => ({
      isError: false,
      content: [{ type: 'text', text: JSON.stringify({
        progressItems: [],
        reportItems: [],
        overallProgress: 0,
        hasRunningTask: false,
      }) }],
    })),
  },
}))

// Mock zustand stores - 使用实际 store 但通过 setState 重置
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { useSevenDimConfigStore, type SevenDimConfigState } from '@/store/sevenDimConfigStore'
import { useIntelligentScoreStore } from '@/store/intelligentScoreStore'
import type { IntelligentScore } from '@/types'
import { useCollectionTaskStats } from '../hooks/useCollectionTaskStats'
import type { CollectionTaskRuntime, CollectionTraceSpan } from '@/types/modules/collection.types'

const makeTask = (taskId: string, status: CollectionTaskRuntime['status'], dimensionCode = 'quote'): CollectionTaskRuntime => ({
  taskId,
  status,
  dimensionCode,
  symbol: 'TEST',
  progress: status === 'completed' ? 100 : 0,
})

const makeSpan = (traceId: string, taskId: string, dimensionCode: string, result: CollectionTraceSpan['result'] = 'success'): CollectionTraceSpan => ({
  traceId,
  taskId,
  dimensionCode,
  symbol: 'TEST',
  stages: [],
  result,
  totalDurationMs: 100,
  durationMs: 100,
  fallbackCount: 0,
  startedAt: Date.now(),
})

describe('useCollectionTaskStats', () => {
  beforeEach(() => {
    // 重置所有 store
    useCollectionRuntimeStore.setState({
      taskStatuses: {},
      traceSpans: {},
      logs: [],
      overallProgress: 0,
      isRunning: false,
      stats: {
        since: Date.now(),
        totalCollects: 0,
        successCollects: 0,
        successRate: 0,
        mockCollects: 0,
        mockSuccesses: 0,
        realSuccessRate: 0,
        completeness: 0,
        sourceCounts: { tencent: 0, sina: 0, netease: 0, akshare: 0, tushare: 0, mock: 0, westock: 0, tencentnews: 0, ifind_mcp: 0, tencent_mcp: 0 },
        fallbackCount: 0,
        writeSuccess: 0,
        writeTotal: 0,
        writeRate: 0,
        mockWrites: 0,
        avgLatency: 0,
        totalLatency: 0,
      },
    })
    useSevenDimConfigStore.setState({
      dimensions: [
        { code: 'quote', name: '行情', enabled: true },
        { code: 'news', name: '新闻', enabled: true },
      ] as SevenDimConfigState['dimensions'],
    })
    useIntelligentScoreStore.setState({ history: [] })
  })

  it('初始空数据应返回安全的默认值', () => {
    const { result } = renderHook(() => useCollectionTaskStats())
    expect(result.current.tasks).toEqual([])
    expect(result.current.taskStats).toEqual({
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
    })
    expect(result.current.dimHealth.size).toBe(2) // 2 个维度
    expect(result.current.scoreStats.total).toBe(0)
  })

  it('taskStats 应按状态正确分类', () => {
    useCollectionRuntimeStore.setState({
      taskStatuses: {
        t1: makeTask('t1', 'running'),
        t2: makeTask('t2', 'completed'),
        t3: makeTask('t3', 'completed'),
        t4: makeTask('t4', 'error'),
        t5: makeTask('t5', 'paused'),
      },
    })
    const { result } = renderHook(() => useCollectionTaskStats())
    expect(result.current.taskStats).toEqual({
      runningCount: 1,
      successCount: 2,
      failedCount: 2, // error + paused
    })
    expect(result.current.tasks).toHaveLength(5)
  })

  it('dimHealth 应按 dimensionCode 聚合 success/total', () => {
    useCollectionRuntimeStore.setState({
      traceSpans: {
        s1: makeSpan('s1', 't1', 'quote', 'success'),
        s2: makeSpan('s2', 't2', 'quote', 'success'),
        s3: makeSpan('s3', 't3', 'quote', 'fail'),
        s4: makeSpan('s4', 't4', 'news', 'success'),
      },
    })
    const { result } = renderHook(() => useCollectionTaskStats())
    const quoteHealth = result.current.dimHealth.get('quote')
    const newsHealth = result.current.dimHealth.get('news')
    expect(quoteHealth).toEqual({ total: 3, success: 2, name: '行情' })
    expect(newsHealth).toEqual({ total: 1, success: 1, name: '新闻' })
  })

  it('selectedTraces 在未选中任务时应返回所有 spans', () => {
    useCollectionRuntimeStore.setState({
      traceSpans: {
        s1: makeSpan('s1', 't1', 'quote'),
        s2: makeSpan('s2', 't2', 'news'),
      },
    })
    const { result } = renderHook(() => useCollectionTaskStats())
    expect(result.current.selectedTraces).toHaveLength(2)
  })

  it('selectedTraces 在选中任务后应只返回对应 spans', () => {
    useCollectionRuntimeStore.setState({
      traceSpans: {
        s1: makeSpan('s1', 't1', 'quote'),
        s2: makeSpan('s2', 't2', 'news'),
      },
    })
    const { result } = renderHook(() => useCollectionTaskStats())
    act(() => {
      result.current.setSelectedTaskId('t1')
    })
    expect(result.current.selectedTraces).toHaveLength(1)
    expect(result.current.selectedTraces[0]?.taskId).toBe('t1')
  })

  it('scoreStats 应正确计算 avg/max/min/distribution', () => {
    useIntelligentScoreStore.setState({
      history: [
        { scoredAt: new Date('2026-07-15T10:00:00Z').getTime(), overallScore: 4.5 },
        { scoredAt: new Date('2026-07-15T09:00:00Z').getTime(), overallScore: 3.0 },
        { scoredAt: new Date('2026-07-15T08:00:00Z').getTime(), overallScore: 2.0 },
        { scoredAt: new Date('2026-07-15T07:00:00Z').getTime(), overallScore: 1.5 },
      ] as IntelligentScore[],
    })
    const { result } = renderHook(() => useCollectionTaskStats())
    expect(result.current.scoreStats.total).toBe(4)
    expect(result.current.scoreStats.avgScore).toBeCloseTo(2.75, 2)
    expect(result.current.scoreStats.maxScore).toBe(4.5)
    expect(result.current.scoreStats.minScore).toBe(1.5)
    expect(result.current.scoreStats.scoreDistribution).toEqual({
      high: 1,    // 4.5 >= 4.0
      medium: 1,  // 3.0 in [2.5, 4.0)
      low: 2,     // 2.0 < 2.5
    })
  })

  it('scoreStats 应正确处理空历史', () => {
    const { result } = renderHook(() => useCollectionTaskStats())
    expect(result.current.scoreStats).toMatchObject({
      total: 0,
      avgScore: 0,
      maxScore: 0,
      minScore: 0,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      recentTrend: [],
    })
  })

  it('handleViewTask 应设置 selectedTaskId 并切换 activeTab', () => {
    const { result } = renderHook(() => useCollectionTaskStats())
    act(() => {
      result.current.handleViewTask('t1')
    })
    expect(result.current.selectedTaskId).toBe('t1')
    expect(result.current.activeTab).toBe('timeline')
  })
})
