/**
 * @test_id V9-TEST-ST-072
 * @module missingReportDetector.test
 * @description 缺失报告检测器单元测试（E-2-6）
  * @covers_docs []
*/

 
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/dataLayerContentStores', () => ({
  missingReportStore: {
    list: vi.fn(),
    listBySymbol: vi.fn(),
    listBySeverity: vi.fn(),
    report: vi.fn(),
    incrementRetry: vi.fn(),
  },
}))

vi.mock('@/services/analysis/dataFreshnessGuard', () => ({
  checkMissingReportFreshness: vi.fn(() => ({ valid: true })),
}))

import { missingReportStore } from '@/data/dataLayerContentStores'
import {
  detect,
  listBySymbol,
  listBySeverity,
  listUnresolved,
  incrementRetry,
  clear,
  setDetectorEnabled,
  isDetectorEnabled,
} from '@/services/data-collector/missingReportDetector'
import { MISSING_REPORT_TYPE, MISSING_REPORT_SEVERITY } from '@/constants/execution.constants'

describe('missingReportDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDetectorEnabled(true)
  })

  describe('detect', () => {
    it('detects a missing report when enabled', async () => {
      vi.mocked(missingReportStore.listBySymbol).mockResolvedValue([])
      vi.mocked(missingReportStore.report).mockImplementation(async (r) => ({ success: true, data: { ...r, id: '1' } as any }))
      const report = await detect('600000', MISSING_REPORT_TYPE.RESEARCH, '缺少研报', { now: 5_000 })
      expect(report).toBeDefined()
      expect(report!.symbol).toBe('600000')
      expect(report!.reportType).toBe(MISSING_REPORT_TYPE.RESEARCH)
      expect(missingReportStore.report).toHaveBeenCalledTimes(1)
    })

    it('skips detection when disabled', async () => {
      setDetectorEnabled(false)
      const report = await detect('600000', MISSING_REPORT_TYPE.RESEARCH, '缺少研报')
      expect(report).toBeUndefined()
      expect(missingReportStore.report).not.toHaveBeenCalled()
    })

    it('skips duplicate report for same symbol and type', async () => {
      vi.mocked(missingReportStore.listBySymbol).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: '缺少研报', detectedAt: 4_000, resolvedAt: undefined, retryCount: 0 },
      ] as any)
      const report = await detect('600000', MISSING_REPORT_TYPE.RESEARCH, '缺少研报', { now: 5_000 })
      expect(report).toBeUndefined()
      expect(missingReportStore.report).not.toHaveBeenCalled()
    })

    it('allows detection when existing report is resolved', async () => {
      vi.mocked(missingReportStore.listBySymbol).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: '缺少研报', detectedAt: 4_000, resolvedAt: 4_500, retryCount: 0 },
      ] as any)
      vi.mocked(missingReportStore.report).mockResolvedValue({ success: true, data: {} as any })
      const report = await detect('600000', MISSING_REPORT_TYPE.RESEARCH, '缺少研报', { now: 5_000 })
      expect(report).toBeDefined()
    })

    it('uses custom severity when provided', async () => {
      vi.mocked(missingReportStore.listBySymbol).mockResolvedValue([])
      vi.mocked(missingReportStore.report).mockImplementation(async (r) => ({ success: true, data: { ...r, id: '1' } as any }))
      const report = await detect('600000', MISSING_REPORT_TYPE.EARNINGS, '缺少财报', {
        now: 5_000,
        severity: MISSING_REPORT_SEVERITY.CRITICAL,
      })
      expect(report).toBeDefined()
      expect(report!.severity).toBe(MISSING_REPORT_SEVERITY.CRITICAL)
    })
  })

  describe('listBySymbol', () => {
    it('returns reports for a symbol', async () => {
      vi.mocked(missingReportStore.listBySymbol).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: '缺少研报', detectedAt: 4_000, retryCount: 0 },
      ] as any)
      const result = await listBySymbol('600000')
      expect(result).toHaveLength(1)
    })
  })

  describe('listBySeverity', () => {
    it('returns reports by severity', async () => {
      vi.mocked(missingReportStore.listBySeverity).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: MISSING_REPORT_SEVERITY.CRITICAL, reason: '缺少研报', detectedAt: 4_000, retryCount: 0, createdAt: 4_000 },
      ])
      const result = await listBySeverity(MISSING_REPORT_SEVERITY.CRITICAL)
      expect(result).toHaveLength(1)
      expect(result[0]!.severity).toBe(MISSING_REPORT_SEVERITY.CRITICAL)
    })
  })

  describe('listUnresolved', () => {
    it('returns only unresolved reports under retry limit', async () => {
      vi.mocked(missingReportStore.list).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: 'r1', detectedAt: 1, resolvedAt: undefined, retryCount: 0 },
        { id: '2', symbol: '600001', reportType: MISSING_REPORT_TYPE.EARNINGS, severity: 'high', reason: 'r2', detectedAt: 2, resolvedAt: 3, retryCount: 0 },
      ] as any)
      const result = await listUnresolved()
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('1')
    })
  })

  describe('incrementRetry', () => {
    it('increments retry count for a report', async () => {
      vi.mocked(missingReportStore.incrementRetry).mockResolvedValue({ success: true, data: {} as any })
      const result = await incrementRetry('1')
      expect(result).toBeDefined()
      expect(missingReportStore.incrementRetry).toHaveBeenCalledWith('1')
    })

    it('returns undefined when increment fails', async () => {
      vi.mocked(missingReportStore.incrementRetry).mockResolvedValue({ success: false, error: 'db_error' })
      const result = await incrementRetry('1')
      expect(result).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('returns count of resolved reports to clear', async () => {
      vi.mocked(missingReportStore.list).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: 'r1', detectedAt: 1, resolvedAt: 5, retryCount: 0 },
        { id: '2', symbol: '600001', reportType: MISSING_REPORT_TYPE.EARNINGS, severity: 'high', reason: 'r2', detectedAt: 2, resolvedAt: undefined, retryCount: 0 },
      ] as any)
      const count = await clear()
      expect(count).toBe(1)
    })

    it('filters by symbol when provided', async () => {
      vi.mocked(missingReportStore.list).mockResolvedValue([
        { id: '1', symbol: '600000', reportType: MISSING_REPORT_TYPE.RESEARCH, severity: 'medium', reason: 'r1', detectedAt: 1, resolvedAt: 5, retryCount: 0 },
        { id: '2', symbol: '600001', reportType: MISSING_REPORT_TYPE.EARNINGS, severity: 'high', reason: 'r2', detectedAt: 2, resolvedAt: 6, retryCount: 0 },
      ] as any)
      const count = await clear('600000')
      expect(count).toBe(1)
    })
  })

  describe('detector enabled state', () => {
    it('setDetectorEnabled updates state', () => {
      setDetectorEnabled(false)
      expect(isDetectorEnabled()).toBe(false)
      setDetectorEnabled(true)
      expect(isDetectorEnabled()).toBe(true)
    })
  })
})
