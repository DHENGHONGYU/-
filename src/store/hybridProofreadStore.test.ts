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
})
