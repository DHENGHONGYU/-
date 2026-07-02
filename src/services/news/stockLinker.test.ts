/**
 * stockLinker 单元测试
 *
 * 覆盖：buildStockMap, linkArticleToStocks,
 *       DEFAULT_LINKER_CONFIG, DEFAULT_INDUSTRY_KEYWORDS, DEFAULT_STOCK_LIBRARY
 */

import { describe, test, expect, vi } from 'vitest'
import {
  buildStockMap,
  linkArticleToStocks,
  DEFAULT_LINKER_CONFIG,
  DEFAULT_INDUSTRY_KEYWORDS,
  DEFAULT_STOCK_LIBRARY,
} from './stockLinker'
import type { StockInfo, LinkerConfig } from './stockLinker'

vi.mock('@/data/db', () => ({
  generateId: vi.fn().mockReturnValue('test-news-id'),
}))

// ============================================================
// buildStockMap
// ============================================================

describe('buildStockMap', () => {
  test('symbol 映射', () => {
    const stocks: StockInfo[] = [
      { symbol: '600519.SH', name: '贵州茅台', industry: '白酒' },
      { symbol: '000858.SZ', name: '五粮液', industry: '白酒' },
    ]

    const map = buildStockMap(stocks)

    expect(map.get('600519.SH')).toBeDefined()
    expect(map.get('600519.SH')!.name).toBe('贵州茅台')
    expect(map.get('000858.SZ')).toBeDefined()
    expect(map.get('000858.SZ')!.name).toBe('五粮液')
  })

  test('6位代码映射', () => {
    const stocks: StockInfo[] = [
      { symbol: '600519.SH', name: '贵州茅台', industry: '白酒' },
    ]

    const map = buildStockMap(stocks)

    expect(map.get('600519')).toBeDefined()
    expect(map.get('600519')!.name).toBe('贵州茅台')
  })
})

// ============================================================
// linkArticleToStocks
// ============================================================

describe('linkArticleToStocks', () => {
  const stocks: StockInfo[] = [
    { symbol: '600519.SH', name: '贵州茅台', industry: '白酒' },
    { symbol: '000858.SZ', name: '五粮液', industry: '白酒' },
    { symbol: '002594.SZ', name: '比亚迪', industry: '新能源汽车' },
  ]

  test('空文章返回空 links', () => {
    const article = { title: '', content: '' }
    const result = linkArticleToStocks(article, stocks)

    expect(result.links).toHaveLength(0)
    expect(result.maps).toHaveLength(0)
  })

  test('精确代码匹配（600519）', () => {
    const article = {
      title: '600519 股价创新高',
      content: '今日市场走势分析',
    }
    const result = linkArticleToStocks(article, stocks)

    expect(result.links.some((l) => l.symbol === '600519.SH')).toBe(true)
    expect(result.links.find((l) => l.symbol === '600519.SH')!.matchType).toBe('exact_code')
  })

  test('精确名称匹配（贵州茅台）', () => {
    const article = {
      title: '贵州茅台年报超预期',
      content: '白酒板块整体走强',
    }
    const result = linkArticleToStocks(article, stocks)

    expect(result.links.some((l) => l.symbol === '600519.SH')).toBe(true)
    expect(result.links.find((l) => l.symbol === '600519.SH')!.matchType).toBe('exact_name')
  })

  test('模糊名称匹配（贵州）', () => {
    const article = {
      title: '贵州板块分析',
      content: '地区经济发展',
    }
    const result = linkArticleToStocks(article, stocks)

    expect(result.links.some((l) => l.symbol === '600519.SH')).toBe(true)
    expect(result.links.find((l) => l.symbol === '600519.SH')!.matchType).toBe('fuzzy_name')
  })

  test('行业关键词匹配（白酒）', () => {
    const article = {
      title: '白酒行业研究报告',
      content: '酱香型白酒市场份额持续提升',
    }
    const result = linkArticleToStocks(article, stocks)

    // 白酒行业关键词会匹配到贵州茅台和五粮液
    const baijiuLinks = result.links.filter((l) => l.matchType === 'industry')
    expect(baijiuLinks.length).toBeGreaterThanOrEqual(1)
  })

  test('标题权重高于正文', () => {
    const article = {
      title: '贵州茅台',
      content: '比亚迪 比亚迪 比亚迪 比亚迪 比亚迪',
    }
    const result = linkArticleToStocks(article, stocks)

    const moutai = result.links.find((l) => l.symbol === '600519.SH')
    const byd = result.links.find((l) => l.symbol === '002594.SZ')

    expect(moutai).toBeDefined()
    expect(byd).toBeDefined()
    // 标题权重 1.5，正文权重 1.0，因此茅台的 confidence 应该更高
    expect(moutai!.confidence).toBeGreaterThan(byd!.confidence)
  })

  test('confidence 低于阈值被过滤', () => {
    const article = {
      title: '白酒行业动态',
      content: '市场波动加剧',
    }
    const config: Partial<LinkerConfig> = {
      confidenceThreshold: 0.95, // 设置极高的阈值
    }
    const result = linkArticleToStocks(article, stocks, config)

    // 行业匹配的 confidence 为 0.5 * 1.5 = 0.75，低于 0.95
    expect(result.links).toHaveLength(0)
  })

  test('maxLinks 限制', () => {
    const article = {
      title: '白酒新能源汽车',
      content: '茅台 五粮液 比亚迪 多板块联动',
    }
    const config: Partial<LinkerConfig> = {
      maxLinks: 2,
    }
    const result = linkArticleToStocks(article, stocks, config)

    expect(result.links.length).toBeLessThanOrEqual(2)
  })

  test('同一股票取最高 confidence', () => {
    const article = {
      title: '600519',
      content: '贵州茅台',
    }
    const result = linkArticleToStocks(article, stocks)

    const moutaiLinks = result.links.filter((l) => l.symbol === '600519.SH')
    expect(moutaiLinks).toHaveLength(1)
    // 精确代码匹配的 confidence 高于精确名称匹配
    expect(moutaiLinks[0]!.matchType).toBe('exact_code')
  })

  test('返回 NewsStockMap', () => {
    const article = {
      title: '贵州茅台业绩点评',
      content: '高端白酒龙头',
    }
    const result = linkArticleToStocks(article, stocks)

    expect(result.maps.length).toBeGreaterThan(0)
    const map = result.maps[0]!
    expect(map.symbol).toBeDefined()
    expect(map.newsId).toBeDefined()
    expect(map.relevanceScore).toBeGreaterThan(0)
    expect(typeof map.isTitleMatch).toBe('boolean')
    expect(typeof map.isContentMatch).toBe('boolean')
    expect(typeof map.industryMatch).toBe('boolean')
  })
})

// ============================================================
// DEFAULT_LINKER_CONFIG
// ============================================================

describe('DEFAULT_LINKER_CONFIG', () => {
  test('默认值正确', () => {
    expect(DEFAULT_LINKER_CONFIG.enableExactCode).toBe(true)
    expect(DEFAULT_LINKER_CONFIG.enableExactName).toBe(true)
    expect(DEFAULT_LINKER_CONFIG.enableFuzzy).toBe(true)
    expect(DEFAULT_LINKER_CONFIG.enableIndustry).toBe(true)
    expect(DEFAULT_LINKER_CONFIG.minFuzzyLength).toBe(3)
    expect(DEFAULT_LINKER_CONFIG.confidenceThreshold).toBe(0.3)
    expect(DEFAULT_LINKER_CONFIG.maxLinks).toBe(5)
    expect(DEFAULT_LINKER_CONFIG.titleWeight).toBe(1.5)
    expect(DEFAULT_LINKER_CONFIG.contentWeight).toBe(1.0)
  })
})

// ============================================================
// DEFAULT_INDUSTRY_KEYWORDS
// ============================================================

describe('DEFAULT_INDUSTRY_KEYWORDS', () => {
  test('包含预期行业', () => {
    expect(DEFAULT_INDUSTRY_KEYWORDS).toHaveProperty('白酒')
    expect(DEFAULT_INDUSTRY_KEYWORDS).toHaveProperty('银行')
    expect(DEFAULT_INDUSTRY_KEYWORDS).toHaveProperty('新能源汽车')
    expect(DEFAULT_INDUSTRY_KEYWORDS).toHaveProperty('医药')
    expect(DEFAULT_INDUSTRY_KEYWORDS).toHaveProperty('电子')
  })

  test('白酒行业包含茅台关键词', () => {
    expect(DEFAULT_INDUSTRY_KEYWORDS['白酒']).toContain('茅台')
    expect(DEFAULT_INDUSTRY_KEYWORDS['白酒']).toContain('白酒')
  })
})

// ============================================================
// DEFAULT_STOCK_LIBRARY
// ============================================================

describe('DEFAULT_STOCK_LIBRARY', () => {
  test('包含预期股票', () => {
    const symbols = DEFAULT_STOCK_LIBRARY.map((s) => s.symbol)
    expect(symbols).toContain('600519.SH')
    expect(symbols).toContain('000858.SZ')
    expect(symbols).toContain('002594.SZ')
    expect(symbols).toContain('300750.SZ')
  })

  test('贵州茅台信息正确', () => {
    const moutai = DEFAULT_STOCK_LIBRARY.find((s) => s.symbol === '600519.SH')
    expect(moutai).toBeDefined()
    expect(moutai!.name).toBe('贵州茅台')
    expect(moutai!.industry).toBe('白酒')
  })
})
