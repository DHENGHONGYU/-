import { describe, expect, it } from 'vitest'
import {
  CORE_RESOURCE_THEME,
  getThemeConfig,
  getThemesForStock,
  matchesTheme,
} from '@/config/themeRegistry'
import type { Stock } from '@/data/types'

describe('themeRegistry', () => {
  it('应该expose the core resource theme', () => {
    const theme = getThemeConfig(CORE_RESOURCE_THEME.id)
    expect(theme).toBeDefined()
    expect(theme?.name).toBe('第四次工业革命稀缺核心资源')
    expect(theme?.totalAllocationPct).toBe(40)
    expect(theme?.singleMaxPct).toBe(8)
    expect(theme?.minCompositeScore).toBe(4.0)
  })

  it('应该匹配 stock by explicit theme tag', () => {
    const stock: Stock = {
      symbol: 'TEST001',
      name: '测试',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
      theme: ['第四次工业革命稀缺核心资源'],
    }

    expect(matchesTheme(stock, CORE_RESOURCE_THEME)).toBe(true)
  })

  it('应该匹配 stock by symbol whitelist', () => {
    const stock: Stock = {
      symbol: '002371.SZ',
      name: '北方华创',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
    }

    expect(matchesTheme(stock, CORE_RESOURCE_THEME)).toBe(true)
  })

  it('应该匹配 stock by sector keyword', () => {
    const stock: Stock = {
      symbol: 'TEST002',
      name: '半导体测试',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
      sector: '半导体设备',
    }

    expect(matchesTheme(stock, CORE_RESOURCE_THEME)).toBe(true)
  })

  it('应该匹配 stock by industry code pattern', () => {
    const stock: Stock = {
      symbol: 'TEST003',
      name: 'AI测试',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
      industryCode: 'C39 计算机、通信和其他电子设备制造业',
    }

    expect(matchesTheme(stock, CORE_RESOURCE_THEME)).toBe(true)
  })

  it('不应该 match unrelated stock', () => {
    const stock: Stock = {
      symbol: 'TEST004',
      name: '食品饮料',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
      sector: '白酒',
      industryCode: 'C15 酒、饮料和精制茶制造业',
    }

    expect(matchesTheme(stock, CORE_RESOURCE_THEME)).toBe(false)
  })

  it('应该返回 matched theme ids for a stock', () => {
    const stock: Stock = {
      symbol: '002371.SZ',
      name: '北方华创',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
    }

    const themes = getThemesForStock(stock)
    expect(themes).toContain(CORE_RESOURCE_THEME.id)
  })
})
