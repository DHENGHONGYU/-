import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import type { LocalDoc } from '@/data/types'
import {
  categorizeDocument,
  createLocalDoc,
  extractSummary,
  importFilesToDatabase,
  listLocalDocs,
  parseSymbolFromFilename,
  scanFolder,
  searchLocalDocs,
  splitIntoChunks,
} from '@/services/system/localDocService'
import type { ScanResult } from '@/services/system/localDocService'

describe('localDocService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  describe('parseSymbolFromFilename', () => {
    it('detects A-share codes', () => {
      expect(parseSymbolFromFilename('600519_茅台研报.txt').symbol).toBe(
        '600519.SH',
      )
      expect(parseSymbolFromFilename('000001_平安银行.txt').symbol).toBe(
        '000001.SZ',
      )
      expect(parseSymbolFromFilename('300750_宁德时代.md').symbol).toBe(
        '300750.SZ',
      )
      expect(parseSymbolFromFilename('588000_科创板ETF.txt').symbol).toBe(
        '588000.SH',
      )
    })

    it('detects HK codes', () => {
      expect(parseSymbolFromFilename('00700.HK_腾讯.txt').symbol).toBe(
        '00700.HK',
      )
      expect(parseSymbolFromFilename('700.HK.txt').symbol).toBe('00700.HK')
      expect(parseSymbolFromFilename('hk700.txt').symbol).toBe('00700.HK')
    })

    it('detects common names', () => {
      expect(parseSymbolFromFilename('茅台2026.txt').symbol).toBe('600519.SH')
      expect(parseSymbolFromFilename('腾讯新闻.html').symbol).toBe('00700.HK')
      expect(parseSymbolFromFilename('比亚迪财报.docx').symbol).toBe(
        '002594.SZ',
      )
      expect(parseSymbolFromFilename('宁德时代分析.txt').symbol).toBe(
        '300750.SZ',
      )
    })

    it('returns ALL for broad market docs', () => {
      expect(parseSymbolFromFilename('行业分析报告.txt').symbol).toBe('ALL')
      expect(parseSymbolFromFilename('宏观策略.md').symbol).toBe('ALL')
      expect(parseSymbolFromFilename('策略笔记.txt').symbol).toBe('ALL')
    })

    it('returns UNKNOWN when no symbol is found', () => {
      expect(parseSymbolFromFilename('random.txt').symbol).toBe('UNKNOWN')
      expect(parseSymbolFromFilename('readme.md').symbol).toBe('UNKNOWN')
    })
  })

  describe('categorizeDocument', () => {
    it('categorizes by keywords', () => {
      expect(categorizeDocument('某研报.txt', '')).toBe('研报')
      expect(categorizeDocument('某股research报告.md', '')).toBe('研报')
      expect(categorizeDocument('年报.docx', '2026年财报')).toBe('财报')
      expect(categorizeDocument('行业分析.md', '新能源')).toBe('行业分析')
      expect(categorizeDocument('sector展望.txt', '')).toBe('行业分析')
      expect(categorizeDocument('新闻.html', '')).toBe('新闻')
      expect(categorizeDocument('某news事件.txt', '')).toBe('新闻')
      expect(categorizeDocument('策略笔记.txt', '')).toBe('策略笔记')
      expect(categorizeDocument('某strategy方案.md', '')).toBe('策略笔记')
      expect(categorizeDocument('foo.txt', 'random')).toBe('其他')
    })
  })

  describe('extractSummary', () => {
    it('returns the first maxLen characters', () => {
      expect(extractSummary('hello world', 5)).toBe('hello')
      expect(extractSummary('short', 100)).toBe('short')
      expect(extractSummary('', 10)).toBe('')
    })

    it('uses default maxLen of 300', () => {
      const long = 'a'.repeat(500)
      expect(extractSummary(long).length).toBe(300)
    })
  })

  describe('splitIntoChunks', () => {
    it('splits text with a sliding window', () => {
      const text = 'abcdefghij'
      const chunks = splitIntoChunks(text, 4, 1)
      expect(chunks).toEqual(['abcd', 'defg', 'ghij'])
    })

    it('returns a single chunk when text is short', () => {
      expect(splitIntoChunks('abc', 5, 1)).toEqual(['abc'])
    })

    it('returns empty array for invalid chunk size', () => {
      expect(splitIntoChunks('abc', 0, 0)).toEqual([])
    })
  })

  describe('createLocalDoc', () => {
    it('saves a doc and returns it', async () => {
      const doc: Omit<LocalDoc, 'id' | 'addedAt'> = {
        symbol: '600519.SH',
        name: '茅台研报',
        content: '贵州茅台业绩优秀',
        category: '研报',
        tags: ['研报', '600519.SH'],
        sourcePath: '',
        size: 100,
      }

      const result = await createLocalDoc(doc)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBeDefined()
      expect(result.data?.symbol).toBe('600519.SH')
      expect(result.data?.addedAt).toBeGreaterThan(0)

      const list = await listLocalDocs()
      expect(list.data).toHaveLength(1)
    })
  })

  describe('listLocalDocs', () => {
    it('lists all docs and filters by symbol', async () => {
      await createLocalDoc({
        symbol: '600519.SH',
        name: '茅台研报',
        content: '',
        category: '研报',
        tags: ['研报', '600519.SH'],
        sourcePath: '',
        size: 100,
      })

      await createLocalDoc({
        symbol: '00700.HK',
        name: '腾讯新闻',
        content: '',
        category: '新闻',
        tags: ['新闻', '00700.HK'],
        sourcePath: '',
        size: 100,
      })

      const all = await listLocalDocs()
      expect(all.data).toHaveLength(2)

      const filtered = await listLocalDocs('600519.SH')
      expect(filtered.data).toHaveLength(1)
      expect(filtered.data?.[0]?.symbol).toBe('600519.SH')
    })
  })

  describe('searchLocalDocs', () => {
    beforeEach(async () => {
      await createLocalDoc({
        symbol: '600519.SH',
        name: '茅台研报',
        content: '贵州茅台业绩优秀',
        category: '研报',
        tags: ['研报', '600519.SH'],
        sourcePath: '',
        size: 100,
      })

      await createLocalDoc({
        symbol: '00700.HK',
        name: '腾讯新闻',
        content: '腾讯财报发布',
        category: '新闻',
        tags: ['新闻', '00700.HK'],
        sourcePath: '',
        size: 100,
      })

      await createLocalDoc({
        symbol: '300750.SZ',
        name: '宁德时代分析',
        content: '新能源电池龙头',
        category: '行业分析',
        tags: ['行业分析', '300750.SZ'],
        sourcePath: '',
        size: 100,
      })
    })

    it('filters by exact symbol first', async () => {
      const result = await searchLocalDocs('600519.SH')
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0]?.symbol).toBe('600519.SH')
    })

    it('filters by content keyword', async () => {
      const result = await searchLocalDocs('财报')
      expect(result.data?.length).toBeGreaterThanOrEqual(1)
      expect(
        result.data?.some((doc) => doc.content.includes('财报')),
      ).toBe(true)
    })

    it('ranks symbol match before content match', async () => {
      const result = await searchLocalDocs('600519.SH')
      expect(result.data?.[0]?.symbol).toBe('600519.SH')
    })
  })

  describe('scanFolder', () => {
    it('returns null when File System Access API is unavailable', async () => {
      const result = await scanFolder()
      expect(result).toBeNull()
    })
  })

  describe('importFilesToDatabase', () => {
    it('imports scan result into the database', async () => {
      const scan: ScanResult = {
        files: [
          {
            name: '600519_茅台研报.txt',
            path: '600519_茅台.txt',
            size: 20,
            content: '茅台业绩',
            lastModified: Date.now(),
          },
        ],
        totalSize: 20,
        errors: [],
      }

      const result = await importFilesToDatabase(scan)
      expect(result.imported).toBe(1)
      expect(result.errors).toHaveLength(0)

      const list = await listLocalDocs()
      expect(list.data).toHaveLength(1)
      expect(list.data?.[0]?.symbol).toBe('600519.SH')
      expect(list.data?.[0]?.tags).toContain('600519.SH')
      expect(list.data?.[0]?.tags).toContain('研报')
    })
  })
})
