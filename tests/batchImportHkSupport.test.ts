/**
 * 批量导入港股支持测试
 *
 * 校验 batchImportParsers / batchImportDetect 在扩展后：
 *  - 港股 4-5 位代码（带或不带 .HK 后缀、带或不带名称）均可解析为 symbol `00700.HK`
 *  - 港股不被 detectDuplicates 误判为 invalid
 *  - A 股既有解析行为保持不变
 *
 * 约定：解析器内部 symbol 沿用 A 股 `.SH/.SZ` 同款后缀规则（港股 → `00700.HK`），
 * 与系统权威字典的裸码 + market 约定不同，但属解析器既有内部约定，不在此改动范围。
 */
import { describe, it, expect } from 'vitest'
import {
  parseBulkInput,
  parseCsvText,
  detectExchange,
  isValidStockCode,
} from '@/services/input/batchImportParsers'
import { detectDuplicates } from '@/services/input/batchImportDetect'

describe('批量导入 · 港股解析支持', () => {
  it('detectExchange 裸 5 位码仍返回空（不破坏既有不变量）', () => {
    expect(detectExchange('12345')).toBe('')
    expect(detectExchange('600000')).toBe('SH')
    expect(detectExchange('000001')).toBe('SZ')
  })

  it('isValidStockCode 接受 A 股与港股（含 .HK 后缀与裸码）', () => {
    expect(isValidStockCode('600519')).toBe(true)
    expect(isValidStockCode('00700.HK')).toBe(true)
    expect(isValidStockCode('00700')).toBe(true)
    expect(isValidStockCode('09988')).toBe(true)
    expect(isValidStockCode('abc')).toBe(false)
    expect(isValidStockCode('123')).toBe(false)
  })

  it('parseBulkInput 港股带后缀 + 名称', () => {
    const rows = parseBulkInput('00700.HK,腾讯控股')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      code: '00700',
      name: '腾讯控股',
      symbol: '00700.HK',
      status: 'valid',
    })
  })

  it('parseBulkInput 港股裸码 + 名称', () => {
    const rows = parseBulkInput('00700,腾讯控股')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: '00700', symbol: '00700.HK', status: 'valid' })
  })

  it('parseBulkInput 港股裸码（无名称）', () => {
    const rows = parseBulkInput('00700')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: '00700', name: '00700', symbol: '00700.HK', status: 'valid' })
  })

  it('parseCsvText 港股多行解析', () => {
    const csv = '00700.HK,腾讯控股\n09988.HK,阿里巴巴-W\n01797.HK,东方甄选'
    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.symbol)).toEqual(['00700.HK', '09988.HK', '01797.HK'])
    expect(rows.every((r) => r.status === 'valid')).toBe(true)
  })

  it('parseBulkInput 港股与 A 股混合，互不干扰', () => {
    const text = ['600519,贵州茅台', '00700.HK,腾讯控股', '688981,中芯国际'].join('\n')
    const rows = parseBulkInput(text)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ code: '600519', symbol: '600519.SH' })
    expect(rows[1]).toMatchObject({ code: '00700', symbol: '00700.HK' })
    expect(rows[2]).toMatchObject({ code: '688981', symbol: '688981.SH' })
  })

  it('detectDuplicates 港股不被误判为 invalid', () => {
    const rows = parseBulkInput('00700.HK,腾讯控股\n09988.HK,阿里巴巴-W')
    const result = detectDuplicates(rows, new Set<string>())
    expect(result.every((r) => r.status === 'valid')).toBe(true)
  })

  it('detectDuplicates 港股批次内重复被标记 duplicate', () => {
    const rows = parseBulkInput('00700.HK,腾讯控股\n00700.HK,腾讯控股')
    const result = detectDuplicates(rows, new Set<string>())
    expect(result[0]!.status).toBe('valid')
    expect(result[1]!.status).toBe('duplicate')
  })
})
