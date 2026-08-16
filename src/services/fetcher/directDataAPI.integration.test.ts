/**
 * @test_id V9-TEST-ST-189
 * directDataAPI 集成测试 — Vite proxy + 港股代码转换 + 降级场景
 *
 * 覆盖：
 *   1. A 股行情（tencentQuote）：验证 Vite proxy URL + 腾讯行情解析
 *   2. 港股行情（tencentQuote）：验证 s_hk00700 代码转换 + 港股行情解析
 *   3. A 股 K 线（tencentKline）：验证 Vite proxy URL + qfqday 解析
 *   4. 港股 K 线（tencentKline）：腾讯 K 线接口港股代码为 hk00700（无 s_ 前缀）→ 成功解析（此前 s_hk00700 导致 param error）
 *   5. 新浪港股行情（sinaQuote）：验证 rt_hk00700 代码转换 + 新浪行情解析
 *   6. Vite proxy URL 路径验证：所有 fetch 请求必须走 /api/proxy/... 同源路径
 *   7. 异常降级：网络错误 / HTTP 500 / 超时（AbortError）→ DirectDataAPIError
 *   8. v_pv_none_match 场景：K 线响应含 v_pv_none_match → 返回空数组
 *   9. K 线 day 降级：qfqday 缺失但 day 存在 → 正确解析 day 数组
 *  10. 行情解析异常：响应格式不合法 / 字段不足 → 抛 DirectDataAPIError
 *  11. 批量行情（tencentBatchQuotes / sinaBatchQuotes）：A 股 + 港股混合
 *  12. 网易历史 K 线（neteaseHistory）：CSV 解析 + A 股/港股代码转换
 *  13. 降级编排：tencentQuote 失败 → sinaQuote 成功的链式降级
 *  14. 特殊代码场景：ETF（510300）/ 可转债（113050）/ 科创板（688）
 *  15. JSON 解析失败降级：tencentKline 收到非 JSON 文本 → 抛错或返回空
 *  16. 代码转换函数直接验证：getMarketPrefix / buildTencentCode / buildSinaCode / getNeteaseCode
 *
 * Mock 策略：vi.stubGlobal('fetch', mockFetch) 拦截所有 HTTP 请求
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-DATA-047]
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  tencentQuote,
  tencentBatchQuotes,
  tencentKline,
  sinaQuote,
  sinaBatchQuotes,
  neteaseHistory,
  getMarketPrefix,
  buildTencentCode,
  buildSinaCode,
  getNeteaseCode,
  type StockQuote,
  type KlineItem,
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
// 辅助函数：创建 mock Response
// ============================================================

/**
 * 创建文本响应 mock（腾讯行情 v_xxx="..." / 新浪 hq_str_xxx="..." 格式专用）。
 *
 * 关键：json 方法延迟解析 — 仅在被调用时尝试 JSON.parse，且非 JSON 文本时
 * 抛出与浏览器一致的 SyntaxError，避免在 mock 初始化阶段就抛错。
 */
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

/**
 * 创建 JSON 响应 mock（腾讯 K 线 / 结构化 JSON 格式专用）。
 * text 方法返回序列化后的 JSON 字符串，json 方法直接返回原始对象。
 */
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
// 真实响应数据样本（从 Vite proxy 实际请求中采集）
// ============================================================

/** 腾讯 A 股行情真实响应（600519.SH 贵州茅台） */
const TENCENT_A_QUOTE_RAW = `v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~12060~12916~1309.22~2~1309.21~5~1309.20~97~1309.19~3~1309.18~13~1309.23~1~1309.28~1~1309.70~1~1309.79~2~1309.80~1~~20260807~15:00:00/00/";`

/** 腾讯港股行情真实响应（0700.HK 腾讯控股） */
const TENCENT_HK_QUOTE_RAW = `v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";`

/** 腾讯 A 股 K 线真实响应（600519.SH 日 K 前复权 3 根） */
const TENCENT_A_KLINE_JSON = {
  code: 0,
  msg: '',
  data: {
    sh600519: {
      qfqday: [
        ['2026-08-05', '1328.360', '1306.450', '1333.800', '1303.500', '42689.000'],
        ['2026-08-06', '1310.000', '1308.550', '1314.400', '1300.010', '25463.000'],
        ['2026-08-07', '1309.220', '1308.660', '1315.280', '1301.000', '24976.000'],
      ],
    },
  },
}

/** 腾讯 K 线无前复权数据、仅有 day 数组时的降级场景 */
const TENCENT_A_KLINE_DAY_ONLY_JSON = {
  code: 0,
  msg: '',
  data: {
    sh600519: {
      day: [
        ['2026-08-05', '1328.360', '1306.450', '1333.800', '1303.500', '42689.000'],
        ['2026-08-06', '1310.000', '1308.550', '1314.400', '1300.010', '25463.000'],
      ],
    },
  },
}

/** 腾讯 K 线 v_pv_none_match 错误响应（param 参数被错误编码时返回） */
const TENCENT_KLINE_VPV_NONE_MATCH = 'v_pv_none_match="1";'

/** 腾讯港股 K 线空响应（接口返回空 data → 降级为空数组） */
const TENCENT_HK_KLINE_EMPTY_JSON = { code: 0, msg: '', data: {} }

/** 腾讯港股 K 线真实响应 — 注意 data key 为 hk00700（无 s_ 前缀，区别于实时行情的 s_hk00700） */
const TENCENT_HK_KLINE_JSON = {
  code: 0,
  msg: '',
  data: {
    hk00700: {
      qfqday: [
        ['2026-08-06', '479.000', '478.800', '483.200', '475.400', '16319939.000'],
        ['2026-08-07', '478.800', '480.000', '482.000', '476.000', '15000000.000'],
      ],
    },
  },
}


/** 新浪港股行情真实响应（0700.HK 腾讯控股） */
const SINA_HK_QUOTE_RAW = `var hq_str_rt_hk00700="TENCENT,腾讯控股,479.000,479.200,483.200,475.400,478.800,-0.400,-0.083,478.600,478.800,7803757295.250,16319939,17.403,0.000,675.134,411.000,2026/08/07,16:08:22,1";`

/** 新浪 A 股行情真实响应（600519.SH 贵州茅台） */
const SINA_A_QUOTE_RAW = `var hq_str_sh600519="贵州茅台,1308.000,1308.550,1309.220,1315.280,1301.000,24976,3274560000,12060,1309.220,12916,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-08-07,15:00:00,00";`

/** 腾讯批量行情响应（A 股 + 港股混合） */
const TENCENT_BATCH_QUOTE_RAW = `v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~12060~12916~1309.22~2~1309.21~5~1309.20~97~1309.19~3~1309.18~13~1309.23~1~1309.28~1~1309.70~1~1309.79~2~1309.80~1~~20260807~15:00:00/00/";v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";`

/** 新浪批量行情响应（A 股 + 港股混合） */
const SINA_BATCH_QUOTE_RAW = `var hq_str_sh600519="贵州茅台,1308.000,1308.550,1309.220,1315.280,1301.000,24976,3274560000,12060,1309.220,12916,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-08-07,15:00:00,00";\nvar hq_str_rt_hk00700="TENCENT,腾讯控股,479.000,479.200,483.200,475.400,478.800,-0.400,-0.083,478.600,478.800,7803757295.250,16319939,17.403,0.000,675.134,411.000,2026/08/07,16:08:22,1";`

/** 网易历史 K 线 CSV 真实响应（600519.SH 2 行数据） */
const NETEASE_CSV_A_SHARE = `日期,股票代码,名称,收盘价,最高价,最低价,开盘价,成交量,成交金额\n2026-08-06,600519,贵州茅台,1308.55,1314.4,1300.01,1310,2546300,3336400000\n2026-08-07,600519,贵州茅台,1309.22,1315.28,1301,1308.66,2497600,3274560000`

/** 网易历史 K 线 CSV 港股响应 */
const NETEASE_CSV_HK = `日期,股票代码,名称,收盘价,最高价,最低价,开盘价,成交量,成交金额\n2026-08-07,00700,腾讯控股,478.8,483.2,475.4,479.0,16319939,7803757295`

// ============================================================
// 测试用例
// ============================================================

describe('directDataAPI 集成测试 — Vite proxy + 港股代码转换', () => {
  // ============================================================
  // 1. A 股行情（tencentQuote）
  // ============================================================
  describe('A 股行情 tencentQuote', () => {
    test('600519.SH → 正确解析行情数据', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_QUOTE_RAW))

      const quote = await tencentQuote('600519.SH')

      expect(quote.code).toBe('600519.SH')
      expect(quote.name).toBe('贵州茅台')
      expect(quote.price).toBe(1309.22)
      expect(quote.prevClose).toBe(1308.55)
      expect(quote.open).toBe(1308.66)
      expect(quote.source).toBe('tencent')
      expect(quote.change).toBeCloseTo(0.67, 2)
      expect(quote.changePercent).toBeCloseTo(0.0512, 3)
    })

    test('fetch URL 使用 Vite proxy 同源路径 /api/proxy/tencent/', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_QUOTE_RAW))

      await tencentQuote('600519.SH')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/tencent/')
      expect(calledUrl).toContain('sh600519')
      expect(calledUrl).not.toMatch(/^https?:\/\//)
    })
  })

  // ============================================================
  // 2. 港股行情（tencentQuote）
  // ============================================================
  describe('港股行情 tencentQuote', () => {
    test('0700.HK → s_hk00700 代码转换 + 港股行情解析（字段正确映射）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      const quote = await tencentQuote('0700.HK')

      expect(quote.code).toBe('0700.HK')
      // 港股字段已修复：[1]名称 [3]当前价 [4]涨跌额 [5]涨跌幅 [6]成交量 [7]成交额
      expect(quote.name).toBe('腾讯控股')
      expect(quote.price).toBe(478.8)       // fields[3] = 当前价
      expect(quote.change).toBe(-0.4)       // fields[4] = 涨跌额
      expect(quote.changePercent).toBe(-0.08) // fields[5] = 涨跌幅
      expect(quote.volume).toBe(16319939)   // fields[6] = 成交量（不需要*100）
      expect(quote.amount).toBe(7803757295.25) // fields[7] = 成交额（不需要*10000）
      expect(quote.prevClose).toBe(479.2)   // price - change = 478.8 - (-0.4) = 479.2
      // 腾讯港股行情不提供 open/high/low
      expect(quote.open).toBe(0)
      expect(quote.high).toBe(0)
      expect(quote.low).toBe(0)
      expect(quote.source).toBe('tencent')
    })

    test('fetch URL 包含 s_hk00700（5 位补零）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('0700.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/tencent/')
      expect(calledUrl).toContain('s_hk00700')
    })

    test('9988.HK → s_hk09988 代码转换', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('9988.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk09988')
    })
  })

  // ============================================================
  // 3. A 股 K 线（tencentKline）
  // ============================================================
  describe('A 股 K 线 tencentKline', () => {
    test('600519.SH → 正确解析 qfqday 前复权日 K 数据', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_A_KLINE_JSON))

      const klines = await tencentKline('600519.SH', 'day', 3)

      expect(klines).toHaveLength(3)
      expect(klines[0]!.date).toBe('2026-08-05')
      expect(klines[0]!.open).toBe(1328.36)
      expect(klines[0]!.close).toBe(1306.45)
      expect(klines[0]!.high).toBe(1333.8)
      expect(klines[0]!.low).toBe(1303.5)
      expect(klines[0]!.volume).toBe(42689)
      expect(klines[0]!.source).toBe('tencent')
    })

    test('fetch URL 使用 Vite proxy 路径 + sh600519 + qfq 参数', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_A_KLINE_JSON))

      await tencentKline('600519.SH', 'day', 10)

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/tencent-kline/')
      expect(calledUrl).toContain('appstock/app/fqkline/get')
      expect(calledUrl).toContain('param=sh600519,day,,,10,qfq')
      expect(calledUrl).not.toMatch(/^https?:\/\//)
    })

    test('000858.SZ → sz000858 深市代码', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: { sz000858: { qfqday: [['2026-08-07', '130.00', '131.00', '132.00', '129.00', '50000']] } },
      }))

      await tencentKline('000858.SZ', 'day', 1)

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('sz000858')
    })
  })

  // ============================================================
  // 4. 港股 K 线（tencentKline）— 腾讯 K 线接口港股代码为 hk00700（无 s_ 前缀）
  // ============================================================
  describe('港股 K 线 tencentKline', () => {
    test('0700.HK → hk00700 代码 + 真实港股 K 线解析成功', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_HK_KLINE_JSON))

      const klines = await tencentKline('0700.HK', 'day', 10)

      expect(klines).toHaveLength(2)
      expect(klines[0]!.date).toBe('2026-08-06')
      expect(klines[0]!.open).toBe(479.0)
      expect(klines[0]!.close).toBe(478.8)
      expect(klines[0]!.high).toBe(483.2)
      expect(klines[0]!.low).toBe(475.4)
      expect(klines[0]!.volume).toBe(16319939)
      expect(klines[0]!.source).toBe('tencent')
    })

    test('0700.HK → fetch URL 包含 hk00700（非 s_hk00700）', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_HK_KLINE_JSON))

      await tencentKline('0700.HK', 'day', 10)

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/tencent-kline/')
      expect(calledUrl).toContain('hk00700')
      expect(calledUrl).not.toContain('s_hk00700')
    })

    test('0700.HK → 腾讯返回空 data → 返回空数组（降级）', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_HK_KLINE_EMPTY_JSON))

      const klines = await tencentKline('0700.HK', 'day', 10)

      expect(klines).toEqual([])
    })

    test('v_pv_none_match 响应（非 JSON）→ 抛出 Error（触发上层降级）', async () => {
      // v_pv_none_match 是腾讯 K 线参数错误时返回的纯文本响应（非 JSON）
      // tencentKline 调用 response.json() 会抛 SyntaxError，被包装为 DirectDataAPIError
      // 这是预期行为：让上层 orchestrator 捕获后降级到下一个数据源
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_KLINE_VPV_NONE_MATCH))

      await expect(tencentKline('0700.HK', 'day', 10)).rejects.toThrow()
    })
  })

  // ============================================================
  // 5. 新浪港股行情（sinaQuote）
  // ============================================================
  describe('新浪行情 sinaQuote', () => {
    test('0700.HK → rt_hk00700 代码转换 + 港股行情解析（字段正确映射）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_HK_QUOTE_RAW))

      const quote = await sinaQuote('0700.HK')

      expect(quote.code).toBe('0700.HK')
      // 港股字段已修复：[1]中文名 [2]开盘 [3]昨收 [4]最高 [5]最低 [6]当前价
      expect(quote.name).toBe('腾讯控股')
      expect(quote.price).toBe(478.8)     // fields[6] = 当前价
      expect(quote.prevClose).toBe(479.2) // fields[3] = 昨收价
      expect(quote.open).toBe(479.0)      // fields[2] = 开盘价
      expect(quote.high).toBe(483.2)      // fields[4] = 最高价
      expect(quote.low).toBe(475.4)       // fields[5] = 最低价
      expect(quote.change).toBe(-0.4)     // fields[7] = 涨跌额
      expect(quote.changePercent).toBe(-0.083) // fields[8] = 涨跌幅
      expect(quote.volume).toBe(16319939) // fields[12] = 成交量
      expect(quote.amount).toBe(7803757295.25) // fields[11] = 成交额
      expect(quote.source).toBe('sina')
    })

    test('600519.SH → sh600519 代码转换 + A 股行情解析', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_A_QUOTE_RAW))

      const quote = await sinaQuote('600519.SH')

      expect(quote.code).toBe('600519.SH')
      expect(quote.name).toBe('贵州茅台')
      expect(quote.price).toBe(1309.22)
      expect(quote.prevClose).toBe(1308.55)
      expect(quote.source).toBe('sina')
    })

    test('fetch URL 使用 Vite proxy 路径 /api/proxy/sina/', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_HK_QUOTE_RAW))

      await sinaQuote('0700.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/sina/')
      expect(calledUrl).toContain('rt_hk00700')
      expect(calledUrl).not.toMatch(/^https?:\/\//)
    })
  })

  // ============================================================
  // 6. Vite proxy URL 路径验证（集中验证所有 API 走同源路径）
  // ============================================================
  describe('Vite proxy URL 路径验证', () => {
    test('所有 fetch 请求均走 /api/proxy/ 同源路径，不走绝对 URL', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_QUOTE_RAW))
      await tencentQuote('600519.SH')
      expect(mockFetch.mock.calls[0]?.[0]).toMatch(/^\/api\/proxy\//)

      mockFetch.mockClear()
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_A_KLINE_JSON))
      await tencentKline('600519.SH', 'day', 3)
      expect(mockFetch.mock.calls[0]?.[0]).toMatch(/^\/api\/proxy\//)

      mockFetch.mockClear()
      mockFetch.mockResolvedValue(createTextResponse(SINA_HK_QUOTE_RAW))
      await sinaQuote('0700.HK')
      expect(mockFetch.mock.calls[0]?.[0]).toMatch(/^\/api\/proxy\//)
    })

    test('请求 URL 不包含 https://qt.gtimg.cn 或 https://hq.sinajs.cn', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_A_QUOTE_RAW))
      await tencentQuote('600519.SH')
      const tencentUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(tencentUrl).not.toContain('qt.gtimg.cn')
      expect(tencentUrl).not.toContain('web.ifzq.gtimg.cn')

      mockFetch.mockClear()
      mockFetch.mockResolvedValue(createTextResponse(SINA_A_QUOTE_RAW))
      await sinaQuote('600519.SH')
      const sinaUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(sinaUrl).not.toContain('hq.sinajs.cn')
    })
  })

  // ============================================================
  // 7. 异常降级场景
  // ============================================================
  describe('异常降级 — 网络错误 / HTTP 错误 / 超时', () => {
    test('tencentQuote: fetch 抛出网络错误 → 抛出 Error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentQuote: HTTP 500 → 抛出 Error 包含 HTTP 500', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Server Error', 500))

      await expect(tencentQuote('600519.SH')).rejects.toThrow(/HTTP 500/)
    })

    test('tencentQuote: HTTP 403 → 抛出 Error 包含 HTTP 403', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Forbidden', 403))

      await expect(tencentQuote('600519.SH')).rejects.toThrow(/HTTP 403/)
    })

    test('tencentQuote: AbortError（超时）→ 抛出 Error', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch.mockRejectedValue(abortErr)

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentKline: fetch 抛出网络错误 → 抛出 Error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'))

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow()
    })

    test('tencentKline: HTTP 500 → 抛出 Error 包含 HTTP 500', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Server Error', 500))

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow(/HTTP 500/)
    })

    test('tencentKline: AbortError（超时）→ 抛出 Error', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch.mockRejectedValue(abortErr)

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow()
    })

    test('sinaQuote: fetch 抛出网络错误 → 抛出 Error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })

    test('sinaQuote: HTTP 502 → 抛出 Error 包含 HTTP 502', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Bad Gateway', 502))

      await expect(sinaQuote('0700.HK')).rejects.toThrow(/HTTP 502/)
    })
  })

  // ============================================================
  // 8. 行情解析异常场景
  // ============================================================
  describe('行情解析异常', () => {
    test('tencentQuote: 空响应 → 抛出 Error（解析失败）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(''))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentQuote: 响应格式不匹配 v_xxx="..." → 抛出 Error', async () => {
      mockFetch.mockResolvedValue(createTextResponse('invalid response format'))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentQuote: 字段不足 10 个 → 抛出 Error', async () => {
      mockFetch.mockResolvedValue(createTextResponse('v_sh600519="1~贵州茅台~600519"'))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('sinaQuote: 空响应 → 抛出 Error', async () => {
      mockFetch.mockResolvedValue(createTextResponse(''))

      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })

    test('sinaQuote: 响应格式不匹配 hq_str_... → 抛出 Error', async () => {
      mockFetch.mockResolvedValue(createTextResponse('totally wrong'))

      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })
  })

  // ============================================================
  // 9. K 线数据降级场景
  // ============================================================
  describe('K 线数据降级', () => {
    test('qfqday 缺失但 day 存在 → 降级解析 day 数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse(TENCENT_A_KLINE_DAY_ONLY_JSON))

      const klines = await tencentKline('600519.SH', 'day', 2)

      expect(klines).toHaveLength(2)
      expect(klines[0]!.date).toBe('2026-08-05')
      expect(klines[0]!.source).toBe('tencent')
    })

    test('qfqday 和 day 均缺失 → 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: { sh600519: {} },
      }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })

    test('data 字段缺失 → 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({ code: 0, msg: '' }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })

    test('data 中无匹配的股票 key → 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: { other_stock: { qfqday: [] } },
      }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })

    test('qfqday 行数据不是数组 → 该行被跳过', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: {
          sh600519: {
            qfqday: [
              'not-an-array',
              ['2026-08-07', '1309.00', '1308.00', '1315.00', '1301.00', '24976'],
            ],
          },
        },
      }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toHaveLength(1)
      expect(klines[0]!.date).toBe('2026-08-07')
    })
  })

  // ============================================================
  // 10. 港股代码转换边界场景
  // ============================================================
  describe('港股代码转换边界', () => {
    test('0005.HK → s_hk00005（4 位补零到 5 位）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('0005.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk00005')
    })

    test('09988.HK → s_hk09988（5 位数字不变）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('09988.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk09988')
    })

    test('0700.HK 新浪代码 → rt_hk00700', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_HK_QUOTE_RAW))

      await sinaQuote('0700.HK')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('rt_hk00700')
    })

    test('0700.hk 小写后缀也能正确识别', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('0700.hk')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk00700')
    })

    test('  0700.HK  带空格也能正确识别', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_HK_QUOTE_RAW))

      await tencentQuote('  0700.HK ')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk00700')
    })
  })

  // ============================================================
  // 11. 批量行情（tencentBatchQuotes / sinaBatchQuotes）— A 股 + 港股混合
  // ============================================================
  describe('批量行情 — A 股 + 港股混合', () => {
    test('tencentBatchQuotes: 同时请求 600519.SH + 0700.HK → 返回 2 条行情', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_QUOTE_RAW))

      const quotes = await tencentBatchQuotes(['600519.SH', '0700.HK'])

      expect(quotes).toHaveLength(2)
      // 第一条 A 股（code 带后缀，与 tencentQuote 格式统一）
      expect(quotes[0]!.code).toBe('600519.SH')
      expect(quotes[0]!.name).toBe('贵州茅台')
      expect(quotes[0]!.price).toBe(1309.22)
      // 第二条港股（code 带后缀，与 tencentQuote 格式统一）
      expect(quotes[1]!.code).toBe('0700.HK')
      expect(quotes[1]!.name).toBe('腾讯控股')
      expect(quotes[1]!.price).toBe(478.8)
      expect(quotes[1]!.change).toBe(-0.4)
      expect(quotes[1]!.volume).toBe(16319939)
      expect(quotes[1]!.amount).toBe(7803757295.25)
      expect(quotes[1]!.prevClose).toBe(479.2)
    })

    test('tencentBatchQuotes: fetch URL 包含 sh600519 和 s_hk00700', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_QUOTE_RAW))

      await tencentBatchQuotes(['600519.SH', '0700.HK'])

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/tencent/')
      expect(calledUrl).toContain('sh600519')
      expect(calledUrl).toContain('s_hk00700')
      // 用逗号分隔，验证未被二次编码
      expect(calledUrl).toContain('sh600519,s_hk00700')
      expect(calledUrl).not.toContain('%2C')
    })

    test('tencentBatchQuotes: 空数组 → 直接返回空数组（不发起 fetch）', async () => {
      const quotes = await tencentBatchQuotes([])
      expect(quotes).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('tencentBatchQuotes: HTTP 500 → 抛出 Error 包含 HTTP 500', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Server Error', 500))

      await expect(tencentBatchQuotes(['600519.SH'])).rejects.toThrow(/HTTP 500/)
    })

    test('tencentBatchQuotes: 响应中部分 segment 无法匹配 → 仅返回成功解析的行情', async () => {
      // 第一条正常、第二条无 v_xxx="..." 格式
      const partialResponse = `v_sh600519="1~贵州茅台~600519~1309.22~1308.55~1308.66~24976~12060~12916~1309.22~2~1309.21~5~1309.20~97~1309.19~3~1309.18~13~1309.23~1~1309.28~1~1309.70~1~1309.79~2~1309.80~1~~20260807~15:00:00/00/";invalid segment without pattern;`

      mockFetch.mockResolvedValue(createTextResponse(partialResponse))

      const quotes = await tencentBatchQuotes(['600519.SH', '000001.SZ'])

      expect(quotes).toHaveLength(1)
      expect(quotes[0]!.code).toBe('600519.SH')
    })

    test('sinaBatchQuotes: 同时请求 600519.SH + 0700.HK → 返回 2 条行情', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_BATCH_QUOTE_RAW))

      const quotes = await sinaBatchQuotes(['600519.SH', '0700.HK'])

      expect(quotes).toHaveLength(2)
      // A 股
      expect(quotes[0]!.name).toBe('贵州茅台')
      expect(quotes[0]!.price).toBe(1309.22)
      // 港股（字段已修复，price 取 fields[6]=当前价 478.800）
      expect(quotes[1]!.price).toBe(478.8)
    })

    test('sinaBatchQuotes: fetch URL 包含 sh600519 和 rt_hk00700', async () => {
      mockFetch.mockResolvedValue(createTextResponse(SINA_BATCH_QUOTE_RAW))

      await sinaBatchQuotes(['600519.SH', '0700.HK'])

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/sina/')
      expect(calledUrl).toContain('sh600519')
      expect(calledUrl).toContain('rt_hk00700')
      expect(calledUrl).not.toContain('%2C')
    })

    // ============================================================
    // 格式统一验证：深市 + 港股 + 超长代码（阶段 3）
    // ============================================================
    test('tencentBatchQuotes: 深市 A 股 + 港股 → code 均带后缀（.SZ/.HK）', async () => {
      // 深市 000858.SZ（五粮液）+ 港股 0700.HK（腾讯控股）
      const batchResponse = `v_sz000858="1~五粮液~000858~130.00~131.00~132.00~50000~25000~25000~130.00~2~129.99~5~129.98~97~129.97~3~129.96~13~130.01~1~130.02~1~130.50~1~130.60~2~130.80~1~~20260807~15:00:00/00/~~132.00~129.00~~5000000";v_s_hk00700="100~腾讯控股~00700~478.800~-0.400~-0.08~16319939.0~7803757295.250~~43488.0714";`
      mockFetch.mockResolvedValue(createTextResponse(batchResponse))

      const quotes = await tencentBatchQuotes(['000858.SZ', '0700.HK'])

      expect(quotes).toHaveLength(2)
      // 深市 A 股 → 带后缀 .SZ（非裸码 000858）
      expect(quotes[0]!.code).toBe('000858.SZ')
      expect(quotes[0]!.name).toBe('五粮液')
      // 港股 → 带后缀 .HK（非裸码 00700）
      expect(quotes[1]!.code).toBe('0700.HK')
      expect(quotes[1]!.name).toBe('腾讯控股')
    })

    test('sinaBatchQuotes: 深市 A 股 + 港股 → code 均带后缀（.SZ/.HK）', async () => {
      const batchResponse = `var hq_str_sz000858="五粮液,131.00,131.00,130.00,132.00,129.00,50000,6500000,25000,130.00,25000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-08-07,15:00:00,00";\nvar hq_str_rt_hk00700="TENCENT,腾讯控股,479.000,479.200,483.200,475.400,478.800,-0.400,-0.083,478.600,478.800,7803757295.250,16319939,17.403,0.000,675.134,411.000,2026/08/07,16:08:22,1";`
      mockFetch.mockResolvedValue(createTextResponse(batchResponse))

      const quotes = await sinaBatchQuotes(['000858.SZ', '0700.HK'])

      expect(quotes).toHaveLength(2)
      expect(quotes[0]!.code).toBe('000858.SZ')
      expect(quotes[0]!.name).toBe('五粮液')
      expect(quotes[1]!.code).toBe('0700.HK')
      expect(quotes[1]!.name).toBe('腾讯控股')
    })

    test('tencentBatchQuotes: 超长港股代码（>5 位）→ buildTencentCode 补零后仍正常请求', async () => {
      // 港股代码 09988（5 位，阿里巴巴-W）→ buildTencentCode 生成 s_hk09988
      // 验证 5 位港股代码在批量请求中格式统一生效
      const batchResponse = `v_s_hk09988="100~阿里巴巴-W~09988~85.200~0.300~0.35~5000000.0~426000000.000~~12345.6789";`
      mockFetch.mockResolvedValue(createTextResponse(batchResponse))

      const quotes = await tencentBatchQuotes(['9988.HK'])

      expect(quotes).toHaveLength(1)
      expect(quotes[0]!.code).toBe('9988.HK')
      expect(quotes[0]!.name).toBe('阿里巴巴-W')
      // 验证 fetch URL 使用 s_hk09988（5 位补零）
      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('s_hk09988')
    })

    test('tencentBatchQuotes: 格式统一 — 返回 code 与 tencentQuote 格式一致（均带后缀）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_BATCH_QUOTE_RAW))

      const [batchQuotes] = await Promise.all([
        tencentBatchQuotes(['600519.SH', '0700.HK']),
      ])

      // 所有 code 均带后缀，不含裸码
      for (const q of batchQuotes) {
        expect(q.code).toMatch(/\.(SH|SZ|HK)$/)
      }
    })
  })

  // ============================================================
  // 12. 网易历史 K 线（neteaseHistory）— CSV 解析 + A 股/港股代码转换
  // ============================================================
  describe('网易历史 K 线 neteaseHistory', () => {
    test('600519.SH → 正确解析 CSV 行情数据', async () => {
      mockFetch.mockResolvedValue(createTextResponse(NETEASE_CSV_A_SHARE))

      const klines = await neteaseHistory('600519.SH', '20260806', '20260807')

      expect(klines).toHaveLength(2)
      expect(klines[0]!.date).toBe('2026-08-06')
      expect(klines[0]!.close).toBe(1308.55)
      expect(klines[0]!.high).toBe(1314.4)
      expect(klines[0]!.low).toBe(1300.01)
      expect(klines[0]!.open).toBe(1310)
      expect(klines[0]!.source).toBe('netease')
      expect(klines[1]!.date).toBe('2026-08-07')
      expect(klines[1]!.close).toBe(1309.22)
    })

    test('600519.SH → fetch URL 使用 0 + 沪市代码（0600519）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(NETEASE_CSV_A_SHARE))

      await neteaseHistory('600519.SH', '20260101', '20260807')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('/api/proxy/netease')
      expect(calledUrl).toContain('code=0600519')
      expect(calledUrl).toContain('start=20260101')
      expect(calledUrl).toContain('end=20260807')
    })

    test('000858.SZ → fetch URL 使用 1 + 深市代码（1000858）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(NETEASE_CSV_A_SHARE))

      await neteaseHistory('000858.SZ', '20260101', '20260807')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('code=1000858')
    })

    test('0700.HK → fetch URL 使用 1 + 5 位补零（100700）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(NETEASE_CSV_HK))

      await neteaseHistory('0700.HK', '20260101', '20260807')

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string
      expect(calledUrl).toContain('code=100700')
    })

    test('空 CSV 响应（仅表头）→ 返回空数组', async () => {
      mockFetch.mockResolvedValue(createTextResponse('日期,股票代码,名称,收盘价,最高价,最低价,开盘价,成交量,成交金额'))

      const klines = await neteaseHistory('600519.SH', '20260101', '20260807')

      expect(klines).toEqual([])
    })

    test('完全空响应 → 返回空数组（不抛异常）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(''))

      const klines = await neteaseHistory('600519.SH', '20260101', '20260807')

      expect(klines).toEqual([])
    })

    test('HTTP 500 → 抛出 Error 包含 HTTP 500', async () => {
      mockFetch.mockResolvedValue(createTextResponse('Server Error', 500))

      await expect(neteaseHistory('600519.SH', '20260101', '20260807')).rejects.toThrow(/HTTP 500/)
    })

    test('AbortError → 抛出 Error', async () => {
      mockFetch.mockRejectedValue(new DOMException('aborted', 'AbortError'))

      await expect(neteaseHistory('600519.SH', '20260101', '20260807')).rejects.toThrow()
    })
  })

  // ============================================================
  // 13. 降级编排 — tencentQuote 失败 → sinaQuote 成功
  // ============================================================
  describe('降级编排（模拟 orchestrator 链）', () => {
    test('tencentQuote 失败 → 降级到 sinaQuote 成功获取港股行情', async () => {
      // 第一次（tencentQuote）失败，第二次（sinaQuote）成功
      mockFetch
        .mockResolvedValueOnce(createTextResponse('Server Error', 500))
        .mockResolvedValueOnce(createTextResponse(SINA_HK_QUOTE_RAW))

      let quote: StockQuote | null = null
      try {
        quote = await tencentQuote('0700.HK')
      } catch {
        // 腾讯失败，降级到新浪
        quote = await sinaQuote('0700.HK')
      }

      expect(quote).not.toBeNull()
      expect(quote!.code).toBe('0700.HK')
      // 港股字段已修复，price 取 fields[6]=当前价 478.800
      expect(quote!.price).toBe(478.8)
      expect(quote!.source).toBe('sina')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('tencentQuote + sinaQuote 均失败 → 最终抛出 Error', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(createTextResponse('Bad Gateway', 502))

      await expect(
        (async () => {
          try {
            return await tencentQuote('0700.HK')
          } catch {
            return await sinaQuote('0700.HK')
          }
        })(),
      ).rejects.toThrow(/HTTP 502/)
    })

    test('tencentKline 失败 → 降级到 neteaseHistory 成功获取 A 股 K 线', async () => {
      // 腾讯 K 线 HTTP 500，网易 CSV 成功
      mockFetch
        .mockResolvedValueOnce(createTextResponse('Server Error', 500))
        .mockResolvedValueOnce(createTextResponse(NETEASE_CSV_A_SHARE))

      let klines: KlineItem[] = []
      try {
        klines = await tencentKline('600519.SH', 'day', 10)
      } catch {
        klines = await neteaseHistory('600519.SH', '20260101', '20260807')
      }

      expect(klines.length).toBeGreaterThan(0)
      expect(klines[0]!.source).toBe('netease')
      expect(klines.some((k) => k.date === '2026-08-07')).toBe(true)
    })

    test('tencentKline 港股返回空 data → 不降级（直接返回空数组）', async () => {
      // 腾讯港股 K 线（hk00700）返回空 data（不抛异常），orchestrator 无需降级
      mockFetch.mockResolvedValueOnce(createJsonResponse(TENCENT_HK_KLINE_EMPTY_JSON))

      const klines = await tencentKline('0700.HK', 'day', 10)

      expect(klines).toEqual([])
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 14. 特殊代码场景 — ETF / 可转债 / 科创板
  // ============================================================
  describe('特殊代码场景', () => {
    test('ETF 510300.SH → sh 前缀（5 开头归沪市）', () => {
      expect(getMarketPrefix('510300.SH')).toBe('sh')
      expect(buildTencentCode('510300.SH')).toBe('sh510300')
      expect(buildSinaCode('510300.SH')).toBe('sh510300')
      expect(getNeteaseCode('510300.SH')).toBe('0510300')
    })

    test('ETF 513100.SH（跨境 ETF）→ sh 前缀', () => {
      expect(getMarketPrefix('513100.SH')).toBe('sh')
      expect(buildTencentCode('513100.SH')).toBe('sh513100')
    })

    test('可转债 113050.SH（11 开头归沪市）→ sh 前缀', () => {
      expect(getMarketPrefix('113050.SH')).toBe('sh')
      expect(buildTencentCode('113050.SH')).toBe('sh113050')
      expect(getNeteaseCode('113050.SH')).toBe('0113050')
    })

    test('可转债 110044.SH（11 开头归沪市）→ sh 前缀', () => {
      expect(getMarketPrefix('110044.SH')).toBe('sh')
      expect(buildTencentCode('110044.SH')).toBe('sh110044')
    })

    test('可转债 123001.SZ（12 开头归深市）→ sz 前缀', () => {
      expect(getMarketPrefix('123001.SZ')).toBe('sz')
      expect(buildTencentCode('123001.SZ')).toBe('sz123001')
    })

    test('科创板 688981.SH（6 开头归沪市）→ sh 前缀', () => {
      expect(getMarketPrefix('688981.SH')).toBe('sh')
      expect(buildTencentCode('688981.SH')).toBe('sh688981')
    })

    test('创业板 300750.SZ（3 开头归深市）→ sz 前缀', () => {
      expect(getMarketPrefix('300750.SZ')).toBe('sz')
      expect(buildTencentCode('300750.SZ')).toBe('sz300750')
    })

    test('港股 09988.HK（5 位数字）→ s_hk09988', () => {
      expect(getMarketPrefix('09988.HK')).toBe('hk')
      expect(buildTencentCode('09988.HK')).toBe('s_hk09988')
      expect(buildSinaCode('09988.HK')).toBe('rt_hk09988')
      expect(getNeteaseCode('09988.HK')).toBe('109988')
    })

    test('港股 0005.HK（4 位补零到 5 位）→ s_hk00005', () => {
      expect(buildTencentCode('0005.HK')).toBe('s_hk00005')
      expect(buildSinaCode('0005.HK')).toBe('rt_hk00005')
      expect(getNeteaseCode('0005.HK')).toBe('100005')
    })

    test('纯数字代码无后缀也能识别市场', () => {
      expect(getMarketPrefix('600519')).toBe('sh')
      expect(getMarketPrefix('000858')).toBe('sz')
      expect(getMarketPrefix('300750')).toBe('sz')
      expect(getMarketPrefix('688981')).toBe('sh')
    })
  })

  // ============================================================
  // 15. JSON 解析失败降级 — tencentKline 收到非 JSON 文本
  // ============================================================
  describe('JSON 解析失败降级', () => {
    test('tencentKline: 收到 v_pv_none_match 文本响应（非 JSON）→ 抛出 Error（触发上层降级）', async () => {
      // v_pv_none_match 是腾讯 K 线参数错误时的纯文本响应，调用 response.json() 抛 SyntaxError
      // 被包装为 DirectDataAPIError，预期行为是抛错让上层 orchestrator 降级
      mockFetch.mockResolvedValue(createTextResponse(TENCENT_KLINE_VPV_NONE_MATCH))

      await expect(tencentKline('0700.HK', 'day', 10)).rejects.toThrow()
    })

    test('tencentKline: 收到 HTML 错误页（非 JSON）→ 抛出 Error（json 解析失败）', async () => {
      const htmlErrorPage = '<html><body><h1>503 Service Unavailable</h1></body></html>'
      mockFetch.mockResolvedValue(createTextResponse(htmlErrorPage))

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow()
    })

    test('tencentKline: 收到空字符串 → 抛出 Error（json 解析失败）', async () => {
      mockFetch.mockResolvedValue(createTextResponse(''))

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow()
    })

    test('tencentKline: JSON 合法但结构异常 → 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({ unexpected: 'structure' }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })

    test('tencentKline: JSON.data 中 stock key 存在但 qfqday 是 null → 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: { sh600519: { qfqday: null } },
      }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })

    test('tencentKline: JSON.data 中 stock key 存在但 qfqday 是对象（非数组）→ 返回空数组', async () => {
      mockFetch.mockResolvedValue(createJsonResponse({
        code: 0,
        msg: '',
        data: { sh600519: { qfqday: { not: 'array' } } },
      }))

      const klines = await tencentKline('600519.SH', 'day', 10)

      expect(klines).toEqual([])
    })
  })

  // ============================================================
  // 16. 代码转换函数直接验证（集中覆盖，与单元测试互为补充）
  // ============================================================
  describe('代码转换函数集成验证', () => {
    test('getMarketPrefix: A 股/港股全覆盖', () => {
      // 沪市
      expect(getMarketPrefix('600519.SH')).toBe('sh')
      expect(getMarketPrefix('601318.SH')).toBe('sh')
      expect(getMarketPrefix('510300.SH')).toBe('sh')
      expect(getMarketPrefix('113050.SH')).toBe('sh')
      // 深市
      expect(getMarketPrefix('000001.SZ')).toBe('sz')
      expect(getMarketPrefix('000858.SZ')).toBe('sz')
      expect(getMarketPrefix('300750.SZ')).toBe('sz')
      expect(getMarketPrefix('123001.SZ')).toBe('sz')
      // 港股
      expect(getMarketPrefix('0700.HK')).toBe('hk')
      expect(getMarketPrefix('09988.HK')).toBe('hk')
      expect(getMarketPrefix('0005.HK')).toBe('hk')
      // 大小写
      expect(getMarketPrefix('0700.hk')).toBe('hk')
      expect(getMarketPrefix('0700.Hk')).toBe('hk')
    })

    test('buildTencentCode: 全市场代码生成', () => {
      expect(buildTencentCode('600519.SH')).toBe('sh600519')
      expect(buildTencentCode('000858.SZ')).toBe('sz000858')
      expect(buildTencentCode('0700.HK')).toBe('s_hk00700')
      expect(buildTencentCode('09988.HK')).toBe('s_hk09988')
      expect(buildTencentCode('0005.HK')).toBe('s_hk00005')
    })

    test('buildSinaCode: 全市场代码生成', () => {
      expect(buildSinaCode('600519.SH')).toBe('sh600519')
      expect(buildSinaCode('000858.SZ')).toBe('sz000858')
      expect(buildSinaCode('0700.HK')).toBe('rt_hk00700')
      expect(buildSinaCode('09988.HK')).toBe('rt_hk09988')
      expect(buildSinaCode('0005.HK')).toBe('rt_hk00005')
    })

    test('getNeteaseCode: 全市场代码生成', () => {
      // 沪市 A 股: 0 + 代码
      expect(getNeteaseCode('600519.SH')).toBe('0600519')
      expect(getNeteaseCode('510300.SH')).toBe('0510300')
      // 深市 A 股: 1 + 代码
      expect(getNeteaseCode('000858.SZ')).toBe('1000858')
      expect(getNeteaseCode('300750.SZ')).toBe('1300750')
      // 港股: 1 + 5 位补零
      expect(getNeteaseCode('0700.HK')).toBe('100700')
      expect(getNeteaseCode('09988.HK')).toBe('109988')
      expect(getNeteaseCode('0005.HK')).toBe('100005')
    })
  })

  // ============================================================
  // 17. 极端网络超时场景 — 全链路降级 / 网关错误 / 响应体异常 / 间歇恢复
  // ============================================================
  describe('极端网络超时场景', () => {
    // ---------- 全链路超时降级 ----------

    test('全链路超时：tencentQuote AbortError → sinaQuote AbortError → 链式降级均失败', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch.mockRejectedValue(abortErr)

      // 腾讯超时
      await expect(tencentQuote('0700.HK')).rejects.toThrow()
      // 新浪也超时（模拟降级链第二跳也失败）
      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })

    test('全链路网络错误：tencentQuote TypeError → sinaQuote TypeError → 均抛错', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
      await expect(sinaQuote('600519.SH')).rejects.toThrow()
    })

    test('间歇性超时恢复：tencentQuote 第一次超时 → 降级到 sinaQuote 成功', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch
        .mockRejectedValueOnce(abortErr)   // 腾讯超时
        .mockResolvedValueOnce(createTextResponse(SINA_HK_QUOTE_RAW)) // 新浪成功

      // 模拟 orchestrator 降级编排：腾讯失败 → 新浪成功
      let quote: StockQuote | null = null
      try {
        quote = await tencentQuote('0700.HK')
      } catch {
        quote = await sinaQuote('0700.HK')
      }

      expect(quote).not.toBeNull()
      expect(quote!.code).toBe('0700.HK')
      expect(quote!.name).toBe('腾讯控股')
      expect(quote!.source).toBe('sina')
    })

    // ---------- HTTP 网关错误（502/503/504）----------

    test('tencentQuote: HTTP 502 Bad Gateway → 抛出 DirectDataAPIError', async () => {
      mockFetch.mockResolvedValue(createTextResponse('', 502))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentQuote: HTTP 503 Service Unavailable → 抛出 DirectDataAPIError', async () => {
      mockFetch.mockResolvedValue(createTextResponse('', 503))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentQuote: HTTP 504 Gateway Timeout → 抛出 DirectDataAPIError', async () => {
      mockFetch.mockResolvedValue(createTextResponse('', 504))

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('sinaQuote: HTTP 502 → 抛出 Error（降级链可捕获）', async () => {
      mockFetch.mockResolvedValue(createTextResponse('', 502))

      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })

    test('neteaseHistory: HTTP 503 → 抛出 Error', async () => {
      mockFetch.mockResolvedValue(createTextResponse('', 503))

      await expect(neteaseHistory('600519.SH', '20260101', '20260807')).rejects.toThrow()
    })

    // ---------- 响应体读取失败 ----------

    test('tencentQuote: fetch 成功但 text() 抛错 → 抛出 Error', async () => {
      const badResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockRejectedValue(new TypeError('network error while reading body')),
        json: vi.fn(),
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
      mockFetch.mockResolvedValue(badResponse)

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
    })

    test('tencentKline: fetch 成功但 json() 抛错 → 抛出 Error', async () => {
      const badResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: vi.fn().mockResolvedValue('not-json'),
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON')),
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
      mockFetch.mockResolvedValue(badResponse)

      await expect(tencentKline('600519.SH', 'day', 10)).rejects.toThrow()
    })

    // ---------- 混合异常场景 ----------

    test('混合降级：tencentQuote HTTP 500 → sinaQuote 超时 → 全链路失败', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch
        .mockResolvedValueOnce(createTextResponse('', 500)) // 腾讯 HTTP 500
        .mockRejectedValueOnce(abortErr)                     // 新浪超时

      await expect(tencentQuote('0700.HK')).rejects.toThrow()
      await expect(sinaQuote('0700.HK')).rejects.toThrow()
    })

    test('混合降级：tencentQuote 网络错误 → sinaQuote HTTP 502 → 全链路失败', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch')) // 腾讯网络错误
        .mockResolvedValueOnce(createTextResponse('', 502))       // 新浪 502

      await expect(tencentQuote('600519.SH')).rejects.toThrow()
      await expect(sinaQuote('600519.SH')).rejects.toThrow()
    })

    test('K 线降级链：tencentKline 超时 → neteaseHistory 成功', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch
        .mockRejectedValueOnce(abortErr)                        // 腾讯 K 线超时
        .mockResolvedValueOnce(createTextResponse(NETEASE_CSV_A_SHARE)) // 网易成功

      // 模拟 orchestrator K 线降级：腾讯失败 → 网易成功
      let klines: KlineItem[] = []
      try {
        klines = await tencentKline('600519.SH', 'day', 10)
      } catch {
        klines = await neteaseHistory('600519.SH', '20260101', '20260807')
      }

      expect(klines.length).toBeGreaterThan(0)
      expect(klines[0]!.source).toBe('netease')
    })

    // ---------- 边界超时场景 ----------

    test('tencentQuote: 超时后重试同一源仍超时 → 持续抛错', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch.mockRejectedValue(abortErr)

      // 连续 3 次调用均超时
      await expect(tencentQuote('600519.SH')).rejects.toThrow()
      await expect(tencentQuote('600519.SH')).rejects.toThrow()
      await expect(tencentQuote('600519.SH')).rejects.toThrow()

      // 验证 fetch 被调用了 3 次
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    test('tencentBatchQuotes: 全部超时 → 抛出 Error（不返回空数组）', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError')
      mockFetch.mockRejectedValue(abortErr)

      await expect(tencentBatchQuotes(['600519.SH', '0700.HK'])).rejects.toThrow()
    })

    test('sinaBatchQuotes: 全部网络错误 → 抛出 Error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(sinaBatchQuotes(['600519.SH', '0700.HK'])).rejects.toThrow()
    })
  })
})
