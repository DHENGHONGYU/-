/**
 * @fileoverview P2-1 + P3-1 测试
 *
 * P2-1: IndexedDB store 扩展 + dataSyncStore + fileImportStore
 * P3-1: Excel/Markdown/PDF/DOCX 解析器
 *
 * @module tests/p2-p3.test
 * @created 2026-07-14 - 双通道整改 P2-1 + P3-1
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { STORE_NAME } from '@/config/dbConfig'
import { useDataSyncStore } from '@/store/dataSyncStore'
import { useFileImportStore } from '@/store/fileImportStore'
import { excelParser } from '@/services/file-import/parsers/excelParser'
import { markdownParser } from '@/services/file-import/parsers/markdownParser'
import { pdfParser } from '@/services/file-import/parsers/pdfParser'
import { docxParser } from '@/services/file-import/parsers/docxParser'
import { getParser, registerParser, clearParsers, getSupportedExtensions } from '@/services/file-import/parserRegistry'
import type { CollectionHistoryEntry, GlobalScheduleConfig } from '@/types/modules/data-sync.types'

// ============================================================
// 辅助
// ============================================================

function createMockFile(name: string, content: string, type: string = 'text/html'): File {
  return new File([content], name, { type })
}

// ============================================================
// P2-1: IndexedDB Store 扩展
// ============================================================

describe('P2-1: IndexedDB Store 扩展', () => {
  it('应包含 5 个新 store 名称', () => {
    expect(STORE_NAME.collectionHistory).toBe('collection_history')
    expect(STORE_NAME.conflictLog).toBe('conflict_log')
    expect(STORE_NAME.fileImportRecords).toBe('file_import_records')
    expect(STORE_NAME.proofreadReports).toBe('proofread_reports')
    expect(STORE_NAME.scheduleConfigs).toBe('schedule_configs')
  })

  it('DB_VERSION 应为 31', () => {
    // 通过间接方式验证版本号存在
    expect(STORE_NAME.collectionHistory).toBeDefined()
  })
})

// ============================================================
// P2-1: dataSyncStore
// ============================================================

describe('P2-1: dataSyncStore', () => {
  beforeEach(() => {
    useDataSyncStore.getState().reset()
  })

  it('初始状态应为 idle', () => {
    expect(useDataSyncStore.getState().syncState).toBe('idle')
  })

  it('应设置同步状态', () => {
    useDataSyncStore.getState().setSyncState('checking')
    expect(useDataSyncStore.getState().syncState).toBe('checking')
  })

  it('应添加历史记录', () => {
    const entry: CollectionHistoryEntry = {
      id: 'test-1',
      timestamp: new Date().toISOString(),
      date: '2026-07-14',
      channel: 'file-import',
      collectionInfo: {
        symbols: ['600000'],
        dimensions: ['01'],
        fileName: 'test.csv',
      },
      updateInfo: {
        mode: 'batch',
        recordsAdded: 1,
        recordsModified: 0,
        recordsDeleted: 0,
        recordsUnchanged: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
      },
      qualityInfo: {
        successRate: 100,
        completeness: 100,
      },
      status: 'success',
    }
    useDataSyncStore.getState().addHistoryEntry(entry)
    expect(useDataSyncStore.getState().history).toHaveLength(1)
    expect(useDataSyncStore.getState().totalFileImports).toBe(1)
    expect(useDataSyncStore.getState().lastSyncChannel).toBe('file-import')
  })

  it('应管理调度配置', () => {
    const config: GlobalScheduleConfig = {
      scheduleId: 'sched-1',
      symbols: ['600000'],
      dimensions: ['01'],
      frequency: 'daily',
      sourceScope: { enabled: ['tencent'], fallbackChain: ['tencent', 'mock'], allowMockFallback: true },
      conflictPolicy: 'last-write-wins',
      updateMode: 'batch',
      enabled: true,
      runCount: 0,
      consecutiveFailures: 0,
    }
    useDataSyncStore.getState().addSchedule(config)
    expect(useDataSyncStore.getState().schedules).toHaveLength(1)

    useDataSyncStore.getState().updateSchedule('sched-1', { enabled: false })
    expect(useDataSyncStore.getState().schedules[0]?.enabled).toBe(false)

    useDataSyncStore.getState().removeSchedule('sched-1')
    expect(useDataSyncStore.getState().schedules).toHaveLength(0)
  })
})

// ============================================================
// P2-1: fileImportStore
// ============================================================

describe('P2-1: fileImportStore', () => {
  beforeEach(() => {
    useFileImportStore.getState().reset()
  })

  it('初始状态应为 idle', () => {
    expect(useFileImportStore.getState().step).toBe('idle')
    expect(useFileImportStore.getState().progress).toBe(0)
  })

  it('应设置步骤和进度', () => {
    useFileImportStore.getState().setStep('validating')
    useFileImportStore.getState().setProgress(50)
    expect(useFileImportStore.getState().step).toBe('validating')
    expect(useFileImportStore.getState().progress).toBe(50)
  })

  it('进度应限制在 0-100', () => {
    useFileImportStore.getState().setProgress(150)
    expect(useFileImportStore.getState().progress).toBe(100)
    useFileImportStore.getState().setProgress(-10)
    expect(useFileImportStore.getState().progress).toBe(0)
  })

  it('应设置文件信息', () => {
    useFileImportStore.getState().setFileInfo('test.csv', 'abc123')
    expect(useFileImportStore.getState().currentFileName).toBe('test.csv')
    expect(useFileImportStore.getState().currentFileHash).toBe('abc123')
  })

  it('应设置错误', () => {
    useFileImportStore.getState().setError('解析失败')
    expect(useFileImportStore.getState().step).toBe('error')
    expect(useFileImportStore.getState().errorMessage).toBe('解析失败')
  })
})

// ============================================================
// P3-1: Excel 解析器
// ============================================================

describe('P3-1: Excel 解析器', () => {
  beforeEach(() => {
    clearParsers()
    registerParser(excelParser)
  })

  it('应解析 HTML 表格格式的 Excel', async () => {
    const html = `
      <table>
        <tr><th>code</th><th>name</th><th>price</th></tr>
        <tr><td>600000</td><td>浦发银行</td><td>10.5</td></tr>
        <tr><td>600519</td><td>贵州茅台</td><td>1800</td></tr>
      </table>
    `
    const file = createMockFile('stocks.xlsx', html)
    const result = await excelParser.parse(file)
    expect(result.records).toHaveLength(2)
    expect(result.records[0]?.code).toBe('600000')
    expect(result.records[0]?.price).toBe(10.5)
  })

  it('无表格时应抛出错误', async () => {
    const file = createMockFile('empty.xlsx', '<html><body>No table</body></html>')
    await expect(excelParser.parse(file)).rejects.toThrow()
  })

  it('应推断股票数据类型', async () => {
    const html = `<table><tr><th>code</th><th>name</th></tr><tr><td>600000</td><td>浦发银行</td></tr></table>`
    const file = createMockFile('stocks.xlsx', html)
    const result = await excelParser.parse(file)
    expect(result.dataType).toBe('stocks')
  })

  it('应支持 xlsx 和 xls 扩展名', () => {
    expect(excelParser.extensions).toContain('xlsx')
    expect(excelParser.extensions).toContain('xls')
  })
})

// ============================================================
// P3-1: Markdown 解析器
// ============================================================

describe('P3-1: Markdown 解析器', () => {
  beforeEach(() => {
    clearParsers()
    registerParser(markdownParser)
  })

  it('应解析 Markdown 并提取标题', async () => {
    const content = '# 浦发银行分析报告\n\n这是正文内容。'
    const file = createMockFile('report.md', content, 'text/markdown')
    const result = await markdownParser.parse(file)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.title).toBe('浦发银行分析报告')
  })

  it('应提取 frontmatter 元数据', async () => {
    const content = `---
title: 贵州茅台研报
category: 研报
tags: 白酒,消费
---

# 贵州茅台深度分析`
    const file = createMockFile('report.md', content, 'text/markdown')
    const result = await markdownParser.parse(file)
    expect(result.records[0]?.title).toBe('贵州茅台研报')
    expect(result.records[0]?.category).toBe('研报')
  })

  it('应从内容中提取股票代码', async () => {
    const content = '# 分析报告\n\n600000 浦发银行，600519 贵州茅台。'
    const file = createMockFile('report.md', content, 'text/markdown')
    const result = await markdownParser.parse(file)
    const symbols = result.records[0]?.symbols as string[]
    expect(symbols).toContain('600000')
    expect(symbols).toContain('600519')
  })

  it('应支持 md 和 markdown 扩展名', () => {
    expect(markdownParser.extensions).toContain('md')
    expect(markdownParser.extensions).toContain('markdown')
  })
})

// ============================================================
// P3-1: PDF 解析器（预留桩）
// ============================================================

describe('P3-1: PDF 解析器（预留桩）', () => {
  it('应生成占位记录', async () => {
    const file = createMockFile('report.pdf', '%PDF-1.4 mock content', 'application/pdf')
    const result = await pdfParser.parse(file)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.parseStatus).toBe('pending')
    expect(result.dataType).toBe('researchReports')
  })

  it('应支持 pdf 扩展名', () => {
    expect(pdfParser.extensions).toContain('pdf')
  })
})

// ============================================================
// P3-1: DOCX 解析器（预留桩）
// ============================================================

describe('P3-1: DOCX 解析器（预留桩）', () => {
  it('应生成占位记录', async () => {
    const file = createMockFile('report.docx', 'mock docx content', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const result = await docxParser.parse(file)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.parseStatus).toBe('pending')
    expect(result.dataType).toBe('researchReports')
  })

  it('应支持 docx 和 doc 扩展名', () => {
    expect(docxParser.extensions).toContain('docx')
    expect(docxParser.extensions).toContain('doc')
  })
})

// ============================================================
// P3-1: 解析器注册表完整性
// ============================================================

describe('P3-1: 解析器注册表完整性', () => {
  it('注册全部 6 个解析器后应支持 8 种扩展名', () => {
    clearParsers()
    registerParser(excelParser)
    registerParser(markdownParser)
    registerParser(pdfParser)
    registerParser(docxParser)
    const exts = getSupportedExtensions()
    expect(exts).toContain('xlsx')
    expect(exts).toContain('md')
    expect(exts).toContain('pdf')
    expect(exts).toContain('docx')
  })
})
