/**
 * @test_id V9-TEST-ST-190
 * directDataAPI 港股行情解析专项测试
 *
 * 本文件为 directDataAPI.integration.test.ts 的补充，专门覆盖：
 *   1. 腾讯港股行情（parseTencentHkQuote）完整字段验证 + 边界场景
 *   2. 新浪港股行情（parseSinaHkQuote）完整字段验证 + 日期格式转换
 *   3. 港股代码转换边界（1位/2位/5位数字、前导零）
 *   4. 多只港股批量行情
 *   5. 港股降级编排（腾讯→新浪）完整字段对比
 *   6. GBK 解码后中文文本解析验证（模拟 Vite proxy 转换后场景）
 *   7. 字段不足异常处理
 *   8. change=0 时 prevClose 推导
 *   9. 港股 K 线空响应降级
 *  10. Vite proxy URL 路径验证（GBK 编码转换后）
 *
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-DATA-047, V9-DOC-FRONT-020]
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  tencentQuote,
  tencentBatchQuotes,
  tencentKline,
  sinaQuote,
  getMarketPrefix,
  buildTencentCode,
  buildSinaCode,
  getNeteaseCode,
  stripCodeSuffix,
} from './directDataAPI'

// ============================================================
// Mock 模块
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockFetch = vi.hoisted(() => vi.fn())

beforeEach(() => {
  mockFetch.mockClear()
  mockLogger.info.mockClear()
  mockLogger.warn.mockClear()
  mockLogger.error.mockClear()
  mockLogger.debug.mockClear()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================
// 辅助函数
// ============================================================

function createTextResponse(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockImplementation(() => {
      try {
        return Promise.resolve(JSON.parse(text))
      } catch (err) {
        return Promise.reject(err)
      }
    }),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response
}

function createJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    json: vi.fn().mockResolvedValue(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response
}

// ============================================================
// 港股行情测试数据（模拟 Vite proxy GBK→UTF-8 转换后的文本）
// ============================================================

/** 腾讯港股行情 — 0700.HK 腾讯控股（涨跌） */
const TENCENT_HK_0700 = `v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";`

/** 腾讯港股行情 — 9988.HK 阿里巴巴-W（涨） */
const TENCENT_HK_9988 = `v_s_hk09988="200~阿里巴巴-SW~09988~82.300~0.500~0.61~12345678~1016254321.000~~50.000";`

/** 腾讯港股行情 — 0005.HK 汇丰控股（change=0 边界） */
const TENCENT_HK_0005_ZERO_CHANGE = `v_s_hk00005="100~汇丰控股~00005~65.200~0.000~0.00~5000000~326000000.000~~0.000";`

/** 腾讯港股行情 — 字段不足（仅 5 个字段，<7） */
const TENCENT_HK_INSUFFICIENT = `v_s_hk00700="100~腾讯控股~00700~478.800~-0.400";`

/** 新浪港股行情 — 0700.HK 腾讯控股 */
const SINA_HK_0700 = `var hq_str_rt_hk00700="TENCENT,腾讯控股,479.000,479.200,483.200,475.400,478.800,-0.400,-0.083,478.600,478.800,7803757295.250,16319939,17.403,0.000,675.134,411.000,2026/08/07,16:08:22,1";`

/** 新浪港股行情 — 9988.HK 阿里巴巴-W */
const SINA_HK_9988 = `var hq_str_rt_hk09988="BABA,阿里巴巴-SW,82.000,81.800,82.500,81.500,82.300,0.500,0.61,82.200,82.300,123456789.000,12345678,9.876,0.000,100.000,50.000,2026/08/07,16:08:22,1";`

/** 新浪港股行情 — 字段不足（仅 5 个字段，<7） */
const SINA_HK_INSUFFICIENT = `var hq_str_rt_hk00700="TENCENT,腾讯控股,479.000,479.200,483.200";`

/** 腾讯 A 股行情 — 600519.SH 贵州茅台
 *  字段 [33]=最高价 [34]=最低价（代码从这两个索引取 high/low），
 *  样本须包含足够字段以避免索引越界返回 0。 */
const TENCENT_A_600519 = `v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~12060~12916~1309.22~2~1309.21~5~1309.20~97~1309.19~3~1309.18~13~1309.23~1~1309.28~1~1309.70~1~1309.79~2~1309.80~1~~20260807~15:00:00/00/~~1315.28~1301.00~~327456.00";`

/** 腾讯港股 K 线空响应 */
const TENCENT_HK_KLINE_EMPTY = { code: 0, msg: '', data: {} }

/** 腾讯批量行情 — A 股 + 港股混合 */
const TENCENT_BATCH_MIXED = `v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~12060~12916~1309.22~2~1309.21~5~1309.20~97~1309.19~3~1309.18~13~1309.23~1~1309.28~1~1309.70~1~1309.79~2~1309.80~1~~20260807~15:00:00/00/";v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";v_s_hk09988="200~阿里巴巴-SW~09988~82.300~0.500~0.61~12345678~1016254321.000~~50.000";`

// ============================================================
// 1. 腾讯港股行情完整字段验证
// ============================================================

describe('腾讯港股行情 parseTencentHkQuote', () => {
  test('0700.HK 腾讯控股 — 涨跌场景完整字段验证', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_0700))
    const q = await tencentQuote('0700.HK')

    expect(q.code).toBe('0700.HK')
    expect(q.name).toBe('腾讯控股')
    expect(q.price).toBe(478.8)
    expect(q.change).toBe(-0.4)
    expect(q.changePercent).toBe(-0.08)
    expect(q.volume).toBe(16319939)
    expect(q.amount).toBe(7803757295.25)
    expect(q.prevClose).toBe(479.2) // price - change = 478.8 - (-0.4)
    // 港股不提供 open/high/low
    expect(q.open).toBe(0)
    expect(q.high).toBe(0)
    expect(q.low).toBe(0)
    expect(q.source).toBe('tencent')
  })

  test('9988.HK 阿里巴巴-SW — 涨场景完整字段验证', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_9988))
    const q = await tencentQuote('9988.HK')

    expect(q.code).toBe('9988.HK')
    expect(q.name).toBe('阿里巴巴-SW')
    expect(q.price).toBe(82.3)
    expect(q.change).toBe(0.5)
    expect(q.changePercent).toBe(0.61)
    expect(q.volume).toBe(12345678)
    expect(q.amount).toBe(1016254321.0)
    expect(q.prevClose).toBe(81.8) // 82.3 - 0.5
    expect(q.open).toBe(0)
    expect(q.high).toBe(0)
    expect(q.low).toBe(0)
    expect(q.source).toBe('tencent')
  })

  test('0005.HK 汇丰控股 — change=0 时 prevClose=price', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_0005_ZERO_CHANGE))
    const q = await tencentQuote('0005.HK')

    expect(q.price).toBe(65.2)
    expect(q.change).toBe(0)
    expect(q.prevClose).toBe(65.2) // change=0 时 prevClose = price
    expect(q.changePercent).toBe(0)
    expect(q.volume).toBe(5000000)
    expect(q.amount).toBe(326000000)
  })

  test('字段不足（<7）→ 抛 DirectDataAPIError', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_INSUFFICIENT))
    await expect(tencentQuote('0700.HK')).rejects.toThrow('解析腾讯行情失败')
  })

  test('fetch URL 使用 Vite proxy 路径 + s_hk 代码', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_0700))
    await tencentQuote('0700.HK')

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('/api/proxy/tencent/')
    expect(url).toContain('s_hk00700')
    expect(url).not.toMatch(/^https?:\/\//)
  })
})

// ============================================================
// 2. 新浪港股行情完整字段验证
// ============================================================

describe('新浪港股行情 parseSinaHkQuote', () => {
  test('0700.HK 腾讯控股 — 完整字段验证', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_0700))
    const q = await sinaQuote('0700.HK')

    expect(q.code).toBe('0700.HK')
    expect(q.name).toBe('腾讯控股') // fields[1] 中文名
    expect(q.price).toBe(478.8) // fields[6] 当前价
    expect(q.prevClose).toBe(479.2) // fields[3] 昨收
    expect(q.open).toBe(479.0) // fields[2] 开盘
    expect(q.high).toBe(483.2) // fields[4] 最高
    expect(q.low).toBe(475.4) // fields[5] 最低
    expect(q.change).toBe(-0.4) // fields[7] 涨跌额
    expect(q.changePercent).toBe(-0.083) // fields[8] 涨跌幅
    expect(q.volume).toBe(16319939) // fields[12] 成交量
    expect(q.amount).toBe(7803757295.25) // fields[11] 成交额
    expect(q.source).toBe('sina')
  })

  test('9988.HK 阿里巴巴-W — 完整字段验证', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_9988))
    const q = await sinaQuote('9988.HK')

    expect(q.code).toBe('9988.HK')
    expect(q.name).toBe('阿里巴巴-SW')
    expect(q.price).toBe(82.3)
    expect(q.prevClose).toBe(81.8)
    expect(q.open).toBe(82.0)
    expect(q.high).toBe(82.5)
    expect(q.low).toBe(81.5)
    expect(q.change).toBe(0.5)
    expect(q.changePercent).toBe(0.61)
    expect(q.volume).toBe(12345678)
    expect(q.amount).toBe(123456789.0)
    expect(q.source).toBe('sina')
  })

  test('日期格式 YYYY/MM/DD → YYYY-MM-DD 转换验证', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_0700))
    const q = await sinaQuote('0700.HK')

    // timestamp 应对应 2026-08-07 16:08:22（而非 NaN 或 Date.now()）
    const expectedTs = new Date(2026, 7, 7, 16, 8, 22).getTime()
    expect(q.timestamp).toBe(expectedTs)
  })

  test('字段不足（<7）→ 抛 DirectDataAPIError', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_INSUFFICIENT))
    await expect(sinaQuote('0700.HK')).rejects.toThrow('解析新浪行情失败')
  })

  test('fetch URL 使用 Vite proxy 路径 + rt_hk 代码', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_0700))
    await sinaQuote('0700.HK')

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('/api/proxy/sina/')
    expect(url).toContain('rt_hk00700')
    expect(url).not.toMatch(/^https?:\/\//)
  })
})

// ============================================================
// 3. 腾讯 vs 新浪港股行情字段对比（降级编排验证）
// ============================================================

describe('港股降级编排 — 腾讯→新浪字段对比', () => {
  test('0700.HK 腾讯失败 → 新浪成功，关键字段一致', async () => {
    // 第一次（腾讯）失败，第二次（新浪）成功
    mockFetch
      .mockResolvedValueOnce(createTextResponse('', 503))
      .mockResolvedValueOnce(createTextResponse(SINA_HK_0700))

    // 腾讯失败
    await expect(tencentQuote('0700.HK')).rejects.toThrow()
    // 新浪降级成功
    const q = await sinaQuote('0700.HK')

    expect(q.price).toBe(478.8)
    expect(q.prevClose).toBe(479.2)
    expect(q.change).toBe(-0.4)
    expect(q.source).toBe('sina')
  })

  test('0700.HK 腾讯+新浪均失败 → 全链路降级', async () => {
    mockFetch
      .mockResolvedValueOnce(createTextResponse('', 500))
      .mockResolvedValueOnce(createTextResponse('', 503))

    await expect(tencentQuote('0700.HK')).rejects.toThrow()
    await expect(sinaQuote('0700.HK')).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// 4. 港股批量行情
// ============================================================

describe('港股批量行情', () => {
  test('tencentBatchQuotes — 多只港股批量请求', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_MIXED))
    const quotes = await tencentBatchQuotes(['600519.SH', '0700.HK', '9988.HK'])

    expect(quotes).toHaveLength(3)
    // A 股
    expect(quotes[0]!.name).toBe('贵州茅台')
    expect(quotes[0]!.price).toBe(1309.22)
    expect(quotes[0]!.source).toBe('tencent')
    // 港股 0700
    expect(quotes[1]!.name).toBe('腾讯控股')
    expect(quotes[1]!.price).toBe(478.8)
    expect(quotes[1]!.change).toBe(-0.4)
    expect(quotes[1]!.volume).toBe(16319939)
    expect(quotes[1]!.amount).toBe(7803757295.25)
    expect(quotes[1]!.prevClose).toBe(479.2)
    expect(quotes[1]!.source).toBe('tencent')
    // 港股 9988
    expect(quotes[2]!.name).toBe('阿里巴巴-SW')
    expect(quotes[2]!.price).toBe(82.3)
    expect(quotes[2]!.change).toBe(0.5)
    expect(quotes[2]!.source).toBe('tencent')
  })

  test('tencentBatchQuotes — 仅港股批量请求', async () => {
    const hkBatch = `v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";v_s_hk09988="200~阿里巴巴-SW~09988~82.300~0.500~0.61~12345678~1016254321.000~~50.000";`
    mockFetch.mockResolvedValue(createTextResponse(hkBatch))
    const quotes = await tencentBatchQuotes(['0700.HK', '9988.HK'])

    expect(quotes).toHaveLength(2)
    expect(quotes[0]!.name).toBe('腾讯控股')
    expect(quotes[1]!.name).toBe('阿里巴巴-SW')
  })

  test('tencentBatchQuotes — URL 包含多个 s_hk 代码（逗号分隔）', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_MIXED))
    await tencentBatchQuotes(['0700.HK', '9988.HK'])

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('s_hk00700')
    expect(url).toContain('s_hk09988')
    expect(url).toContain(',')
  })
})

// ============================================================
// 5. 港股代码转换边界场景
// ============================================================

describe('港股代码转换边界', () => {
  test('1位代码 → 5位补零', () => {
    expect(buildTencentCode('1.HK')).toBe('s_hk00001')
    expect(buildSinaCode('1.HK')).toBe('rt_hk00001')
  })

  test('2位代码 → 5位补零', () => {
    expect(buildTencentCode('07.HK')).toBe('s_hk00007')
    expect(buildSinaCode('07.HK')).toBe('rt_hk00007')
  })

  test('4位代码 → 5位补零', () => {
    expect(buildTencentCode('0700.HK')).toBe('s_hk00700')
    expect(buildSinaCode('0700.HK')).toBe('rt_hk00700')
  })

  test('5位代码 → 不补零', () => {
    expect(buildTencentCode('09988.HK')).toBe('s_hk09988')
    expect(buildSinaCode('09988.HK')).toBe('rt_hk09988')
  })

  test('5位代码（已满位）→ 原样', () => {
    expect(buildTencentCode('99999.HK')).toBe('s_hk99999')
    expect(buildSinaCode('99999.HK')).toBe('rt_hk99999')
  })

  test('小写后缀 .hk → 正确识别', () => {
    expect(getMarketPrefix('0700.hk')).toBe('hk')
    expect(buildTencentCode('0700.hk')).toBe('s_hk00700')
  })

  test('带空格 → 正确处理', () => {
    expect(getMarketPrefix('  0700.HK  ')).toBe('hk')
    expect(stripCodeSuffix('  0700.HK ')).toBe('0700')
    expect(buildTencentCode('  0700.HK ')).toBe('s_hk00700')
  })

  test('网易代码 — 港股 1 前缀 + 5位补零', () => {
    expect(getNeteaseCode('0700.HK')).toBe('100700')
    expect(getNeteaseCode('1.HK')).toBe('100001')
    expect(getNeteaseCode('09988.HK')).toBe('109988')
  })
})

// ============================================================
// 6. 港股 K 线降级场景
// ============================================================

describe('港股 K 线降级', () => {
  test('0700.HK 腾讯 K 线返回空 data → 返回空数组', async () => {
    mockFetch.mockResolvedValue(createJsonResponse(TENCENT_HK_KLINE_EMPTY))
    const klines = await tencentKline('0700.HK', 'day', 10)
    expect(klines).toEqual([])
  })

  test('0700.HK 腾讯 K 线 v_pv_none_match → 抛错（触发上层降级）', async () => {
    mockFetch.mockResolvedValue(createTextResponse('v_pv_none_match="1";'))
    await expect(tencentKline('0700.HK', 'day', 10)).rejects.toThrow()
  })

  test('0700.HK 腾讯 K 线 HTTP 500 → 抛 DirectDataAPIError', async () => {
    mockFetch.mockResolvedValue(createTextResponse('', 500))
    await expect(tencentKline('0700.HK', 'day', 10)).rejects.toThrow('HTTP 500')
  })

  test('0700.HK 腾讯 K 线 URL 使用 s_hk 代码', async () => {
    mockFetch.mockResolvedValue(createJsonResponse(TENCENT_HK_KLINE_EMPTY))
    await tencentKline('0700.HK', 'day', 10)

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('/api/proxy/tencent-kline/')
    expect(url).toContain('s_hk00700')
  })
})

// ============================================================
// 7. GBK 解码后中文文本解析验证
// ============================================================

describe('GBK 解码后中文文本解析（模拟 Vite proxy 转换后）', () => {
  test('腾讯行情 — 中文名称正确解析（非乱码）', async () => {
    // 模拟 Vite proxy GBK→UTF-8 转换后的文本
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_0700))
    const q = await tencentQuote('0700.HK')
    expect(q.name).toBe('腾讯控股')
  })

  test('新浪行情 — 中文名称正确解析（非乱码）', async () => {
    mockFetch.mockResolvedValue(createTextResponse(SINA_HK_0700))
    const q = await sinaQuote('0700.HK')
    expect(q.name).toBe('腾讯控股')
  })

  test('腾讯 A 股 — 中文名称正确解析', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_600519))
    const q = await tencentQuote('600519.SH')
    expect(q.name).toBe('贵州茅台')
  })

  test('批量行情 — 多只股票中文名称均正确', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_MIXED))
    const quotes = await tencentBatchQuotes(['600519.SH', '0700.HK', '9988.HK'])
    expect(quotes[0]!.name).toBe('贵州茅台')
    expect(quotes[1]!.name).toBe('腾讯控股')
    expect(quotes[2]!.name).toBe('阿里巴巴-SW')
  })
})

// ============================================================
// 8. A 股 vs 港股字段映射隔离验证
// ============================================================

describe('A 股 vs 港股字段映射隔离', () => {
  test('A 股行情不触发港股解析路径', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_600519))
    const q = await tencentQuote('600519.SH')

    // A 股应有 open/high/low（非 0）
    expect(q.open).toBe(1308.66)
    expect(q.high).not.toBe(0)
    expect(q.low).not.toBe(0)
    expect(q.prevClose).toBe(1308.55)
  })

  test('港股行情不使用 A 股字段索引', async () => {
    mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_0700))
    const q = await tencentQuote('0700.HK')

    // 港股 open/high/low 应为 0（不提供），而非 A 股索引的 fields[5]/[33]/[34]
    expect(q.open).toBe(0)
    expect(q.high).toBe(0)
    expect(q.low).toBe(0)
    // 港股 volume 不应 *100
    expect(q.volume).toBe(16319939) // 非 1631993900
  })

  test('新浪 A 股 vs 港股字段索引不同', async () => {
    const sinaA = `var hq_str_sh600519="贵州茅台,1308.66,1308.55,1309.22,1315.28,1301.00,24976,3274560000,...,2026-08-07,15:00:00,...";`
    mockFetch
      .mockResolvedValueOnce(createTextResponse(sinaA))
      .mockResolvedValueOnce(createTextResponse(SINA_HK_0700))

    const aQuote = await sinaQuote('600519.SH')
    const hkQuote = await sinaQuote('0700.HK')

    // A 股 name 在 fields[0]，港股 name 在 fields[1]
    expect(aQuote.name).toBe('贵州茅台')
    expect(hkQuote.name).toBe('腾讯控股') // 非 "TENCENT"

    // A 股 price 在 fields[3]，港股 price 在 fields[6]
    expect(aQuote.price).toBe(1309.22)
    expect(hkQuote.price).toBe(478.8) // 非 479.2（昨收价）
  })
})
