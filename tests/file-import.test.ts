/**
 * @fileoverview 文件导入模块单元测试
 *
 * 覆盖 P0-1~P0-4 的核心功能：
 * - 统一文件校验（扩展名/大小/签名/编码）
 * - 解析器注册表（注册/查询/分发）
 * - CSV 解析器（分隔符检测/表头/数据类型推断）
 * - JSON 解析器（数组/对象格式）
 * - 哈希比对（记录哈希/文件哈希）
 * - 差异分析（新增/修改/冲突/删除）
 * - 校对报告生成
 *
 * @module tests/file-import.test
 * @created 2026-07-14 - 双通道整改 P0 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { validateFile } from '@/services/file-import/unifiedFileValidator'
import { registerParser, getParser, parseFile, clearParsers, getSupportedExtensions } from '@/services/file-import/parserRegistry'
import { csvParser } from '@/services/file-import/parsers/csvParser'
import { jsonParser } from '@/services/file-import/parsers/jsonParser'
import { computeRecordHash, compareHashes } from '@/services/file-import/hashComparator'
import { analyzeDiff, quickDiff } from '@/services/file-import/diffAnalyzer'
import { generateProofreadReport, renderReportAsMarkdown } from '@/services/file-import/proofreadReportGenerator'
import type { FileValidationResult, DiffAnalysisResult, HashComparisonResult } from '@/types/modules/data-sync.types'

// ============================================================
// 辅助函数
// ============================================================

/** 创建模拟 File 对象 */
function createMockFile(name: string, content: string, type: string = 'text/csv'): File {
  return new File([content], name, { type })
}

// ============================================================
// 测试
// ============================================================

describe('P0-1: 统一文件校验', () => {
  it('应通过有效的 CSV 文件校验', async () => {
    const file = createMockFile('stocks.csv', 'code,name\n600000,浦发银行\n600519,贵州茅台')
    const result = await validateFile(file)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.metadata.fileName).toBe('stocks.csv')
    expect(result.metadata.hash).toBeTruthy()
  })

  it('应拒绝不支持的扩展名', async () => {
    const file = createMockFile('data.exe', 'binary', 'application/octet-stream')
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'INVALID_EXTENSION')).toBe(true)
  })

  it('应拒绝空文件', async () => {
    const file = createMockFile('empty.csv', '', 'text/csv')
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'EMPTY_FILE')).toBe(true)
  })

  it('应检测 ZIP 签名并拒绝', async () => {
    // ZIP 文件头：PK (0x50 0x4b)
    const zipContent = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const file = new File([zipContent], 'fake.csv', { type: 'text/csv' })
    const result = await validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'REJECTED_SIGNATURE')).toBe(true)
  })

  it('应计算 SHA-256 哈希', async () => {
    const file = createMockFile('test.csv', 'a,b\n1,2')
    const result = await validateFile(file)
    expect(result.metadata.hash).toMatch(/^[a-f0-9]{64}$|^fallback-/)
  })
})

describe('P0-1: 解析器注册表', () => {
  beforeEach(() => {
    clearParsers()
  })

  it('应注册并查询解析器', () => {
    registerParser(csvParser)
    expect(getParser('csv')).toBe(csvParser)
    expect(getParser('CSV')).toBe(csvParser) // 大小写不敏感
  })

  it('应返回支持的扩展名列表', () => {
    registerParser(csvParser)
    registerParser(jsonParser)
    const exts = getSupportedExtensions()
    expect(exts).toContain('csv')
    expect(exts).toContain('json')
  })

  it('未注册时应返回 null', () => {
    expect(getParser('unknown')).toBeNull()
  })
})

describe('P0-2: CSV 解析器', () => {
  beforeEach(() => {
    clearParsers()
    registerParser(csvParser)
  })

  it('应解析标准 CSV', async () => {
    const file = createMockFile('stocks.csv', 'code,name\n600000,浦发银行\n600519,贵州茅台')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(2)
    expect(result.records[0]?.code).toBe('600000')
    expect(result.parseMeta.parsedRows).toBe(2)
  })

  it('应自动检测分号分隔符', async () => {
    const file = createMockFile('data.csv', 'code;name\n600000;浦发银行')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.code).toBe('600000')
  })

  it('应推断行情数据类型', async () => {
    const file = createMockFile('kline.csv', 'symbol,date,open,close,high,low,volume\n600000,2026-07-14,10.0,10.5,10.8,9.9,1000000')
    const result = await parseFile(file)
    expect(result.dataType).toBe('dailyQuotes')
  })

  it('应处理空文件', async () => {
    const file = createMockFile('empty.csv', '')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(0)
  })

  it('应跳过空行', async () => {
    const file = createMockFile('data.csv', 'code,name\n600000,浦发银行\n\n600519,贵州茅台')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(2)
  })
})

describe('P0-2: JSON 解析器', () => {
  beforeEach(() => {
    clearParsers()
    registerParser(jsonParser)
  })

  it('应解析数组格式 JSON', async () => {
    const content = JSON.stringify([
      { code: '600000', name: '浦发银行' },
      { code: '600519', name: '贵州茅台' },
    ])
    const file = createMockFile('stocks.json', content, 'application/json')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(2)
    expect(result.records[0]?.code).toBe('600000')
  })

  it('应解析对象格式 JSON（含 data 字段）', async () => {
    const content = JSON.stringify({
      dataType: 'stocks',
      data: [{ code: '600000', name: '浦发银行' }],
    })
    const file = createMockFile('stocks.json', content, 'application/json')
    const result = await parseFile(file)
    expect(result.records).toHaveLength(1)
  })

  it('应在无效 JSON 时抛出错误', async () => {
    const file = createMockFile('bad.json', '{invalid}', 'application/json')
    await expect(parseFile(file)).rejects.toThrow()
  })
})

describe('P0-3: 哈希比对', () => {
  it('应计算记录哈希', async () => {
    const record = { code: '600000', name: '浦发银行', price: 10.5 }
    const hash = await computeRecordHash(record)
    expect(hash).toMatch(/^[a-f0-9]{64}$|^fnv1a-/)
  })

  it('相同业务数据应产生相同哈希', async () => {
    const record1 = { code: '600000', name: '浦发银行', lastUpdated: '2026-07-14' }
    const record2 = { code: '600000', name: '浦发银行', lastUpdated: '2026-07-15' }
    const hash1 = await computeRecordHash(record1)
    const hash2 = await computeRecordHash(record2)
    expect(hash1).toBe(hash2) // lastUpdated 被排除
  })

  it('应识别变更记录', async () => {
    const newRecords = [
      { symbol: '600000', price: 10.5 },
      { symbol: '600519', price: 1800 },
    ]
    const existingRecords = [
      { symbol: '600000', price: 10.0 }, // 价格变了
      // 600519 是新增的
    ]
    const result = await compareHashes(newRecords, existingRecords)
    expect(result.changedRecords).toContain('600000')
    expect(result.changedRecords).toContain('600519')
  })
})

describe('P0-3: 差异分析', () => {
  it('应识别新增记录', async () => {
    const newRecords = [{ symbol: '600000', name: '浦发银行' }]
    const existing: Record<string, unknown>[] = []
    const result = await analyzeDiff(newRecords, existing)
    expect(result.summary.newRecords).toBe(1)
    expect(result.recordDiffs[0]?.status).toBe('added')
  })

  it('应识别未变化记录', async () => {
    const records = [{ symbol: '600000', name: '浦发银行', price: 10.5 }]
    const result = await analyzeDiff(records, records)
    expect(result.summary.unchangedRecords).toBe(1)
  })

  it('应识别冲突记录（关键字段变化）', async () => {
    const newRecords = [
      { symbol: '600000', price: 10.5 },
      { symbol: '600001', name: '正常股票' },
      { symbol: '600002', name: '另一只' },
    ]
    const existingRecords = [
      { symbol: '600000', price: 10.0 }, // 价格变了 → 冲突
      { symbol: '600001', name: '正常股票' }, // 未变化
      { symbol: '600002', name: '另一只' }, // 未变化
    ]
    const result = await analyzeDiff(newRecords, existingRecords)
    expect(result.summary.conflictRecords).toBe(1)
    expect(result.recommendation).toBe('review-conflicts')
  })

  it('应识别删除记录', async () => {
    const newRecords: Record<string, unknown>[] = []
    const existingRecords = [{ symbol: '600000', name: '浦发银行' }]
    const result = await analyzeDiff(newRecords, existingRecords)
    expect(result.summary.deletedRecords).toBe(1)
  })

  it('无冲突时应建议全部导入', async () => {
    const newRecords = [
      { symbol: '600000', name: '浦发银行' },
      { symbol: '600519', name: '贵州茅台', note: '新增备注' },
    ]
    const existingRecords = [{ symbol: '600519', name: '贵州茅台' }]
    const result = await analyzeDiff(newRecords, existingRecords)
    expect(result.recommendation).toBe('import-all')
  })

  it('quickDiff 应返回变更 symbol 列表', async () => {
    const newRecords = [{ symbol: '600000', price: 10.5 }]
    const existingRecords = [{ symbol: '600000', price: 10.0 }]
    const changed = await quickDiff(newRecords, existingRecords)
    expect(changed).toContain('600000')
  })
})

describe('P0-4: 校对报告生成', () => {
  it('应生成结构化校对报告', () => {
    const validation: FileValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        fileName: 'stocks.csv',
        fileSize: 1024,
        fileType: 'stocks',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        rowCount: 2,
        hash: 'abc123',
      },
    }
    const diff: DiffAnalysisResult = {
      summary: {
        totalRecords: 2,
        newRecords: 1,
        modifiedRecords: 0,
        unchangedRecords: 1,
        deletedRecords: 0,
        conflictRecords: 0,
      },
      recordDiffs: [],
      fieldStats: [],
      recommendation: 'import-all',
    }
    const hashComparison: HashComparisonResult = {
      fileHash: 'abc123',
      fileChanged: true,
      recordHashes: [],
      changedRecords: [],
    }

    const report = generateProofreadReport(
      validation, diff, hashComparison,
      'stocks.csv', 1024, 'abc123', 'stocks',
      'stocks' as unknown as import('@/config/dbConfig').StoreName,
    )

    expect(report.meta.fileName).toBe('stocks.csv')
    expect(report.summary.overallStatus).toBe('pass')
    expect(report.summary.totalFindings).toBe(0)
  })

  it('应渲染 Markdown 格式报告', () => {
    const validation: FileValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        fileName: 'test.csv',
        fileSize: 512,
        fileType: 'stocks',
        mimeType: 'text/csv',
        encoding: 'utf-8',
        hash: 'def456',
      },
    }
    const diff: DiffAnalysisResult = {
      summary: {
        totalRecords: 1,
        newRecords: 1,
        modifiedRecords: 0,
        unchangedRecords: 0,
        deletedRecords: 0,
        conflictRecords: 0,
      },
      recordDiffs: [],
      fieldStats: [],
      recommendation: 'import-all',
    }
    const hashComparison: HashComparisonResult = {
      fileHash: 'def456',
      fileChanged: true,
      recordHashes: [],
      changedRecords: [],
    }

    const report = generateProofreadReport(
      validation, diff, hashComparison,
      'test.csv', 512, 'def456', 'stocks',
      'stocks' as unknown as import('@/config/dbConfig').StoreName,
    )
    const md = renderReportAsMarkdown(report)
    expect(md).toContain('# 文件校对报告')
    expect(md).toContain('test.csv')
    expect(md).toContain('差异分析')
    expect(md).toContain('新增')
  })
})
