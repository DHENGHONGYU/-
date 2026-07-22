/**
 * @test_id V9-TEST-ST-???
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ProofreadReport } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
const mockRunFullProofread = vi.hoisted(() => vi.fn())
const mockGetRules = vi.hoisted(() => vi.fn().mockReturnValue([]))
const mockGetCurrentVersion = vi.hoisted(() => vi.fn().mockReturnValue('1.0.0'))
const mockSyncRules = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/hybrid-proofread', () => ({
  runFullProofread: (...args: unknown[]) => mockRunFullProofread(...args),
  ruleEngine: {
    getRules: (...args: unknown[]) => mockGetRules(...args),
    getCurrentVersion: (...args: unknown[]) => mockGetCurrentVersion(...args),
    syncRules: (...args: unknown[]) => mockSyncRules(...args),
  },
}))

// ============================================================
// Imports
// ============================================================

import { useHybridProofreadStore } from './hybridProofreadStore'

// ============================================================
// Helpers
// ============================================================

function createMockReport(overrides: Partial<ProofreadReport> = {}): ProofreadReport {
  return {
    id: 'rpt-001',
    project_id: 'proj-001',
    project_name: '测试项目',
    scan_time: Date.now(),
    local_scan: {
      project_id: 'proj-001',
      scan_time: Date.now(),
      total_files: 100,
      scanned_files: 95,
      skipped_files: 5,
      rule_matches: [],
      hashes: [],
    },
    cloud_risk: null,
    overall_risk_level: 0,
    total_issues: 0,
    critical_issues: 0,
    high_issues: 0,
    medium_issues: 0,
    low_issues: 0,
    summary: '安全',
    recommendations: [],
    ...overrides,
  }
}

describe('useHybridProofreadStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useHybridProofreadStore.getState().clearReport()
  })

  it('初始状态验证', () => {
    const state = useHybridProofreadStore.getState()
    expect(state.report).toBeNull()
    expect(state.localScan).toBeNull()
    expect(state.cloudRisk).toBeNull()
    expect(state.rules).toEqual([])
    expect(state.isScanning).toBe(false)
    expect(state.scanProgress).toBe(0)
    expect(state.scanStatus).toBe('idle')
    expect(state.error).toBeNull()
    expect(state.rulesVersion).toBe('1.0.0')
  })

  it('clearReport: 清除报告和扫描状态', () => {
    useHybridProofreadStore.setState({
      report: createMockReport(),
      scanStatus: 'completed',
      scanProgress: 100,
      error: 'some error',
    })

    useHybridProofreadStore.getState().clearReport()

    const state = useHybridProofreadStore.getState()
    expect(state.report).toBeNull()
    expect(state.localScan).toBeNull()
    expect(state.cloudRisk).toBeNull()
    expect(state.error).toBeNull()
    expect(state.scanStatus).toBe('idle')
    expect(state.scanProgress).toBe(0)
  })

  it('startScan: 成功扫描后设置 report', async () => {
    const report = createMockReport({ total_issues: 3, overall_risk_level: 2 })
    mockRunFullProofread.mockResolvedValue({ success: true, report })

    await useHybridProofreadStore.getState().startScan('proj-001', '测试项目', '/tmp/project')

    const state = useHybridProofreadStore.getState()
    expect(mockRunFullProofread).toHaveBeenCalledWith('proj-001', '测试项目', '/tmp/project')
    expect(state.report).toEqual(report)
    expect(state.localScan).toEqual(report.local_scan)
    expect(state.scanStatus).toBe('completed')
    expect(state.scanProgress).toBe(100)
    expect(state.isScanning).toBe(false)
    expect(state.error).toBeNull()
  })

  it('startScan: 扫描失败时设置 error 和 scanStatus', async () => {
    mockRunFullProofread.mockResolvedValue({ success: false, error: '权限不足' })

    await useHybridProofreadStore.getState().startScan('proj-002', '失败项目', '/tmp/fail')

    const state = useHybridProofreadStore.getState()
    expect(state.error).toBe('权限不足')
    expect(state.scanStatus).toBe('error')
    expect(state.isScanning).toBe(false)
    expect(state.report).toBeNull()
  })

  it('startScan: 扫描中重复调用被忽略', async () => {
    let resolvePromise!: (value: unknown) => void
    mockRunFullProofread.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    const scanPromise = useHybridProofreadStore.getState().startScan('proj-001', '测试', '/tmp')

    // 重复调用
    await useHybridProofreadStore.getState().startScan('proj-001', '测试', '/tmp')
    expect(mockRunFullProofread).toHaveBeenCalledTimes(1)

    resolvePromise({ success: true, report: createMockReport() })
    await scanPromise
  })

  it('cancelScan: 取消扫描', () => {
    useHybridProofreadStore.setState({ isScanning: true, scanStatus: 'scanning', scanProgress: 50 })

    useHybridProofreadStore.getState().cancelScan()

    const state = useHybridProofreadStore.getState()
    expect(state.isScanning).toBe(false)
    expect(state.scanStatus).toBe('idle')
    expect(state.scanProgress).toBe(0)
    expect(state.error).toBe('Scan cancelled')
  })

  // ============================================================
  // syncRules —— 规则同步
  // ============================================================
  describe('syncRules', () => {
    beforeEach(() => {
      // clearReport 不重置 isSyncingRules，需显式重置避免并发锁测试污染后续用例
      useHybridProofreadStore.setState({ isSyncingRules: false })
    })

    // @test_id 追加：syncRules 成功/并发锁/异常路径
    it('成功：应更新 rulesVersion 和 rules 并记录日志', async () => {
      const mockRules = [{ id: 'r1', name: '规则1' }]
      mockSyncRules.mockResolvedValueOnce({ updated: true, latest_version: '2.0.0' })
      mockGetRules.mockReturnValue(mockRules)

      await useHybridProofreadStore.getState().syncRules()

      const state = useHybridProofreadStore.getState()
      expect(state.rulesVersion).toBe('2.0.0')
      expect(state.rules).toEqual(mockRules)
      expect(state.isSyncingRules).toBe(false)
      expect(mockLogger.info).toHaveBeenCalledWith('[HybridProofreadStore] Rules synced', {
        updated: true,
        version: '2.0.0',
        ruleCount: 1,
      })
    })

    it('并发锁：isSyncingRules=true 时应跳过并 warn', async () => {
      useHybridProofreadStore.setState({ isSyncingRules: true })

      await useHybridProofreadStore.getState().syncRules()

      expect(mockSyncRules).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[HybridProofreadStore] Rules sync already in progress',
      )
    })

    it('异常：ruleEngine.syncRules 抛出 Error 时应记录错误并重置 isSyncingRules', async () => {
      mockSyncRules.mockRejectedValueOnce(new Error('同步失败'))

      await useHybridProofreadStore.getState().syncRules()

      expect(useHybridProofreadStore.getState().isSyncingRules).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[HybridProofreadStore] Rules sync failed',
        { error: '同步失败' },
      )
    })

    it('异常：非 Error 对象应使用 String(error)', async () => {
      mockSyncRules.mockRejectedValueOnce('字符串错误')

      await useHybridProofreadStore.getState().syncRules()

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[HybridProofreadStore] Rules sync failed',
        { error: '字符串错误' },
      )
    })
  })

  // ============================================================
  // refreshRules —— 规则刷新
  // ============================================================
  describe('refreshRules', () => {
    // @test_id 追加：refreshRules 从 ruleEngine 刷新
    it('应从 ruleEngine 刷新 rules 和 rulesVersion 并记录日志', () => {
      const mockRules = [{ id: 'r1' }, { id: 'r2' }]
      mockGetRules.mockReturnValue(mockRules)
      mockGetCurrentVersion.mockReturnValue('3.0.0')

      useHybridProofreadStore.getState().refreshRules()

      const state = useHybridProofreadStore.getState()
      expect(state.rules).toEqual(mockRules)
      expect(state.rulesVersion).toBe('3.0.0')
      expect(mockLogger.info).toHaveBeenCalledWith('[HybridProofreadStore] Rules refreshed', {
        ruleCount: 2,
        version: '3.0.0',
      })
    })
  })
})
