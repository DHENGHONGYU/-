/**
 * @test_id V9-TEST-ST-150
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useFileImportStore } from './fileImportStore'
import type {
  FileValidationResult,
  DiffAnalysisResult,
  HashComparisonResult,
  FileImportProofreadReport,
} from '@/types/modules/data-sync.types'

// ============================================================
// Mocks
// ============================================================

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}))

vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: vi.fn(),
  createBroadcaster: vi.fn(),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    DATA_TEST_CHANGED: 'data:test:changed',
  },
}))

// ============================================================
// Helpers
// ============================================================

function createValidationResult(overrides: Partial<FileValidationResult> = {}): FileValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    metadata: {
      fileName: 'test.csv',
      fileSize: 1024,
      fileType: 'stocks',
      mimeType: 'text/csv',
      encoding: 'utf-8',
      hash: 'abc123',
    },
    ...overrides,
  } as FileValidationResult
}

function createDiffResult(overrides: Partial<DiffAnalysisResult> = {}): DiffAnalysisResult {
  return {
    summary: {
      totalRecords: 100,
      newRecords: 10,
      modifiedRecords: 5,
      unchangedRecords: 80,
      deletedRecords: 3,
      conflictRecords: 2,
    },
    recordDiffs: [],
    fieldStats: [],
    recommendation: 'import-all',
    ...overrides,
  } as DiffAnalysisResult
}

function createHashComparison(overrides: Partial<HashComparisonResult> = {}): HashComparisonResult {
  return {
    fileHash: 'abc123',
    lastImportHash: 'def456',
    fileChanged: true,
    recordHashes: [
      { symbol: 'AAPL', existingHash: 'h1', newHash: 'h2', changed: true },
      { symbol: 'TSLA', existingHash: 'h3', newHash: 'h3', changed: false },
    ],
    changedRecords: ['AAPL'],
    ...overrides,
  } as HashComparisonResult
}

function createProofreadReport(overrides: Partial<FileImportProofreadReport> = {}): FileImportProofreadReport {
  return {
    meta: {
      reportId: 'report-001',
      generatedAt: '2024-01-01T00:00:00Z',
      fileName: 'test.csv',
      fileSize: 1024,
      fileHash: 'abc123',
      dataType: 'stocks',
      targetStore: 'stocks' as const,
    },
    validation: createValidationResult(),
    diff: createDiffResult(),
    hashComparison: createHashComparison(),
    conflicts: [],
    recommendations: [],
    summary: {
      overallStatus: 'pass',
      totalFindings: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      estimatedImportTime: '10s',
    },
    ...overrides,
  } as FileImportProofreadReport
}

// ============================================================
// Tests
// ============================================================

describe('useFileImportStore', () => {
  beforeEach(() => {
    useFileImportStore.getState().reset()
    vi.clearAllMocks()
  })

  // --------------------------------------------------------
  // 初始状态
  // --------------------------------------------------------
  describe('初始状态', () => {
    it('所有字段应为初始值', () => {
      const state = useFileImportStore.getState()
      expect(state.step).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.currentFileName).toBeNull()
      expect(state.currentFileHash).toBeNull()
      expect(state.validationResult).toBeNull()
      expect(state.diffResult).toBeNull()
      expect(state.hashComparison).toBeNull()
      expect(state.proofreadReport).toBeNull()
      expect(state.reportHistory).toEqual([])
      expect(state.errorMessage).toBeNull()
    })
  })

  // --------------------------------------------------------
  // setStep
  // --------------------------------------------------------
  describe('setStep', () => {
    it('应正确设置步骤', () => {
      useFileImportStore.getState().setStep('uploading')
      expect(useFileImportStore.getState().step).toBe('uploading')

      useFileImportStore.getState().setStep('parsing')
      expect(useFileImportStore.getState().step).toBe('parsing')

      useFileImportStore.getState().setStep('complete')
      expect(useFileImportStore.getState().step).toBe('complete')
    })

    it('应支持所有步骤枚举值', () => {
      const steps: Array<'idle' | 'uploading' | 'validating' | 'parsing' | 'diffing' | 'reviewing' | 'importing' | 'complete' | 'error'> = [
        'idle', 'uploading', 'validating', 'parsing', 'diffing',
        'reviewing', 'importing', 'complete', 'error',
      ]
      for (const step of steps) {
        useFileImportStore.getState().setStep(step)
        expect(useFileImportStore.getState().step).toBe(step)
      }
    })
  })

  // --------------------------------------------------------
  // setProgress
  // --------------------------------------------------------
  describe('setProgress', () => {
    it('应正确设置进度值', () => {
      useFileImportStore.getState().setProgress(50)
      expect(useFileImportStore.getState().progress).toBe(50)
    })

    it('进度应限制在 0-100 范围内（下限裁剪）', () => {
      useFileImportStore.getState().setProgress(-10)
      expect(useFileImportStore.getState().progress).toBe(0)
    })

    it('进度应限制在 0-100 范围内（上限裁剪）', () => {
      useFileImportStore.getState().setProgress(150)
      expect(useFileImportStore.getState().progress).toBe(100)
    })

    it('边界值: 0 和 100 应正常设置', () => {
      useFileImportStore.getState().setProgress(0)
      expect(useFileImportStore.getState().progress).toBe(0)

      useFileImportStore.getState().setProgress(100)
      expect(useFileImportStore.getState().progress).toBe(100)
    })
  })

  // --------------------------------------------------------
  // setFileInfo
  // --------------------------------------------------------
  describe('setFileInfo', () => {
    it('应正确设置文件名和哈希', () => {
      useFileImportStore.getState().setFileInfo('data.csv', 'hash-abc')
      const state = useFileImportStore.getState()
      expect(state.currentFileName).toBe('data.csv')
      expect(state.currentFileHash).toBe('hash-abc')
    })

    it('多次调用应覆盖之前的值', () => {
      useFileImportStore.getState().setFileInfo('first.csv', 'hash-1')
      useFileImportStore.getState().setFileInfo('second.csv', 'hash-2')
      const state = useFileImportStore.getState()
      expect(state.currentFileName).toBe('second.csv')
      expect(state.currentFileHash).toBe('hash-2')
    })
  })

  // --------------------------------------------------------
  // setValidationResult
  // --------------------------------------------------------
  describe('setValidationResult', () => {
    it('应正确设置校验结果（通过）', () => {
      const result = createValidationResult()
      useFileImportStore.getState().setValidationResult(result)
      const state = useFileImportStore.getState()
      expect(state.validationResult).toEqual(result)
      expect(state.validationResult!.valid).toBe(true)
    })

    it('应正确设置校验结果（失败，含错误和警告）', () => {
      const result = createValidationResult({
        valid: false,
        errors: [
          { code: 'E001', message: '格式错误', field: 'format' },
          { code: 'E002', message: '文件过大', field: 'size' },
        ],
        warnings: [
          { code: 'W001', message: '编码非 UTF-8', suggestion: '转换为 UTF-8' },
        ],
      })
      useFileImportStore.getState().setValidationResult(result)
      const state = useFileImportStore.getState()
      expect(state.validationResult!.valid).toBe(false)
      expect(state.validationResult!.errors).toHaveLength(2)
      expect(state.validationResult!.warnings).toHaveLength(1)
    })
  })

  // --------------------------------------------------------
  // setDiffResult
  // --------------------------------------------------------
  describe('setDiffResult', () => {
    it('应同时设置差异分析和哈希比对结果', () => {
      const diff = createDiffResult()
      const hash = createHashComparison()
      useFileImportStore.getState().setDiffResult(diff, hash)
      const state = useFileImportStore.getState()
      expect(state.diffResult).toEqual(diff)
      expect(state.hashComparison).toEqual(hash)
    })

    it('差异摘要统计应正确存储', () => {
      const diff = createDiffResult({
        summary: {
          totalRecords: 500,
          newRecords: 50,
          modifiedRecords: 30,
          unchangedRecords: 400,
          deletedRecords: 15,
          conflictRecords: 5,
        },
      })
      const hash = createHashComparison()
      useFileImportStore.getState().setDiffResult(diff, hash)
      const state = useFileImportStore.getState()
      expect(state.diffResult!.summary.totalRecords).toBe(500)
      expect(state.diffResult!.summary.newRecords).toBe(50)
      expect(state.diffResult!.summary.conflictRecords).toBe(5)
    })
  })

  // --------------------------------------------------------
  // setProofreadReport
  // --------------------------------------------------------
  describe('setProofreadReport', () => {
    it('应设置校对报告并添加到历史记录', () => {
      const report = createProofreadReport({ meta: { reportId: 'report-001' } as any })
      useFileImportStore.getState().setProofreadReport(report)
      const state = useFileImportStore.getState()
      expect(state.proofreadReport).toEqual(report)
      expect(state.reportHistory).toHaveLength(1)
      expect(state.reportHistory[0]).toEqual(report)
    })

    it('历史记录应为倒序（最新在前）', () => {
      const r1 = createProofreadReport({ meta: { reportId: 'report-001' } as any })
      const r2 = createProofreadReport({ meta: { reportId: 'report-002' } as any })
      useFileImportStore.getState().setProofreadReport(r1)
      useFileImportStore.getState().setProofreadReport(r2)
      const state = useFileImportStore.getState()
      expect(state.reportHistory[0]!.meta.reportId).toBe('report-002')
      expect(state.reportHistory[1]!.meta.reportId).toBe('report-001')
    })

    it('历史记录最多保留 50 条', () => {
      for (let i = 0; i < 60; i++) {
        const report = createProofreadReport({ meta: { reportId: `report-${i}` } as any })
        useFileImportStore.getState().setProofreadReport(report)
      }
      const state = useFileImportStore.getState()
      expect(state.reportHistory).toHaveLength(50)
      // 最新的应该在最前面
      expect(state.reportHistory[0]!.meta.reportId).toBe('report-59')
      // 最旧的应该是第10条（因为60-50=10条被丢弃）
      expect(state.reportHistory[49]!.meta.reportId).toBe('report-10')
    })
  })

  // --------------------------------------------------------
  // setError
  // --------------------------------------------------------
  describe('setError', () => {
    it('应设置错误信息并将步骤改为 error', () => {
      useFileImportStore.getState().setStep('parsing')
      useFileImportStore.getState().setError('解析失败: 格式不支持')
      const state = useFileImportStore.getState()
      expect(state.step).toBe('error')
      expect(state.errorMessage).toBe('解析失败: 格式不支持')
    })

    it('多次设置错误应覆盖之前的错误信息', () => {
      useFileImportStore.getState().setError('第一个错误')
      useFileImportStore.getState().setError('第二个错误')
      expect(useFileImportStore.getState().errorMessage).toBe('第二个错误')
    })
  })

  // --------------------------------------------------------
  // reset
  // --------------------------------------------------------
  describe('reset', () => {
    it('应将所有状态重置为初始值', () => {
      const actions = useFileImportStore.getState()

      // 先设置各种状态
      actions.setStep('importing')
      actions.setProgress(75)
      actions.setFileInfo('test.csv', 'hash-abc')
      actions.setValidationResult(createValidationResult())
      actions.setDiffResult(createDiffResult(), createHashComparison())
      actions.setProofreadReport(createProofreadReport())
      actions.setError('some error')

      // 验证状态已变更
      const stateBefore = useFileImportStore.getState()
      expect(stateBefore.step).not.toBe('idle')
      expect(stateBefore.progress).not.toBe(0)
      expect(stateBefore.currentFileName).not.toBeNull()

      // 重置
      actions.reset()

      // 验证已重置
      const stateAfter = useFileImportStore.getState()
      expect(stateAfter.step).toBe('idle')
      expect(stateAfter.progress).toBe(0)
      expect(stateAfter.currentFileName).toBeNull()
      expect(stateAfter.currentFileHash).toBeNull()
      expect(stateAfter.validationResult).toBeNull()
      expect(stateAfter.diffResult).toBeNull()
      expect(stateAfter.hashComparison).toBeNull()
      expect(stateAfter.proofreadReport).toBeNull()
      expect(stateAfter.reportHistory).toEqual([])
      expect(stateAfter.errorMessage).toBeNull()
    })
  })

  // --------------------------------------------------------
  // 综合场景：完整导入流程
  // --------------------------------------------------------
  describe('完整导入流程', () => {
    it('从 idle → uploading → validating → parsing → diffing → importing → complete', () => {
      const actions = useFileImportStore.getState()

      // 开始上传
      actions.setStep('uploading')
      actions.setFileInfo('stocks.csv', 'hash-123')
      actions.setProgress(20)
      let state = useFileImportStore.getState()
      expect(state.step).toBe('uploading')
      expect(state.currentFileName).toBe('stocks.csv')
      expect(state.progress).toBe(20)

      // 校验中
      actions.setStep('validating')
      actions.setProgress(40)
      const validation = createValidationResult()
      actions.setValidationResult(validation)
      state = useFileImportStore.getState()
      expect(state.step).toBe('validating')
      expect(state.validationResult).toEqual(validation)

      // 解析中
      actions.setStep('parsing')
      actions.setProgress(60)
      state = useFileImportStore.getState()
      expect(state.step).toBe('parsing')

      // 差异分析
      actions.setStep('diffing')
      actions.setProgress(80)
      const diff = createDiffResult()
      const hash = createHashComparison()
      actions.setDiffResult(diff, hash)
      state = useFileImportStore.getState()
      expect(state.step).toBe('diffing')
      expect(state.diffResult).toEqual(diff)

      // 导入中
      actions.setStep('importing')
      actions.setProgress(95)
      state = useFileImportStore.getState()
      expect(state.step).toBe('importing')

      // 完成
      actions.setStep('complete')
      actions.setProgress(100)
      const report = createProofreadReport()
      actions.setProofreadReport(report)
      state = useFileImportStore.getState()
      expect(state.step).toBe('complete')
      expect(state.progress).toBe(100)
      expect(state.proofreadReport).toEqual(report)
    })

    it('导入失败场景: uploading → validating → error', () => {
      const actions = useFileImportStore.getState()

      actions.setStep('uploading')
      actions.setFileInfo('bad.csv', 'hash-bad')
      actions.setProgress(30)

      actions.setStep('validating')
      actions.setError('文件格式不支持: 缺少必要列')

      const state = useFileImportStore.getState()
      expect(state.step).toBe('error')
      expect(state.errorMessage).toBe('文件格式不支持: 缺少必要列')
      expect(state.currentFileName).toBe('bad.csv')
    })

    it('错误后重置可重新开始', () => {
      const actions = useFileImportStore.getState()

      actions.setError('失败了')
      expect(useFileImportStore.getState().step).toBe('error')

      actions.reset()
      const stateAfterReset = useFileImportStore.getState()
      expect(stateAfterReset.step).toBe('idle')
      expect(stateAfterReset.errorMessage).toBeNull()

      // 可以重新开始
      actions.setStep('uploading')
      expect(useFileImportStore.getState().step).toBe('uploading')
    })
  })
})
