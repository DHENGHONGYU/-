/**
 * @test_id V9-TEST-ST-188
 * directDataAPI 股票代码转换函数单元测试
 *
 * 覆盖：getMarketPrefix, stripCodeSuffix, buildTencentCode, buildSinaCode, getNeteaseCode
 * 场景：
 *   - 沪市 A 股（6/5/11/13 开头，.SH 后缀和纯数字）
 *   - 深市 A 股（0/3/15/16/18 开头，.SZ 后缀和纯数字）
 *   - 港股（.HK 后缀，大小写，数字位数不足 5 位补零）
 *   - 代码前后空格处理
 * @covers_docs [V9-DOC-BACK-012]
 */

import { describe, test, expect, vi } from 'vitest'
import {
  getMarketPrefix,
  stripCodeSuffix,
  buildTencentCode,
  buildSinaCode,
  getNeteaseCode,
} from './directDataAPI'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('getMarketPrefix', () => {
  describe('沪市 A 股', () => {
    test('6 开头纯数字识别为 sh', () => {
      expect(getMarketPrefix('600519')).toBe('sh')
      expect(getMarketPrefix('600036')).toBe('sh')
      expect(getMarketPrefix('601318')).toBe('sh')
      expect(getMarketPrefix('603259')).toBe('sh')
      expect(getMarketPrefix('605117')).toBe('sh')
    })
    test('5 开头 ETF 识别为 sh', () => {
      expect(getMarketPrefix('510300')).toBe('sh')
      expect(getMarketPrefix('511880')).toBe('sh')
      expect(getMarketPrefix('513100')).toBe('sh')
    })
    test('11/13 开头可转债识别为 sh', () => {
      expect(getMarketPrefix('113050')).toBe('sh')
      expect(getMarketPrefix('110044')).toBe('sh')
    })
    test('带 .SH 后缀识别为 sh', () => {
      expect(getMarketPrefix('600519.SH')).toBe('sh')
      expect(getMarketPrefix('600036.sh')).toBe('sh')
    })
  })

  describe('深市 A 股', () => {
    test('0 开头主板/中小板识别为 sz', () => {
      expect(getMarketPrefix('000001')).toBe('sz')
      expect(getMarketPrefix('000858')).toBe('sz')
      expect(getMarketPrefix('002415')).toBe('sz')
      expect(getMarketPrefix('000063')).toBe('sz')
    })
    test('3 开头创业板识别为 sz', () => {
      expect(getMarketPrefix('300750')).toBe('sz')
      expect(getMarketPrefix('300059')).toBe('sz')
    })
    test('带 .SZ 后缀识别为 sz', () => {
      expect(getMarketPrefix('000858.SZ')).toBe('sz')
      expect(getMarketPrefix('002230.sz')).toBe('sz')
    })
  })

  describe('港股', () => {
    test('带 .HK 后缀识别为 hk', () => {
      expect(getMarketPrefix('0700.HK')).toBe('hk')
      expect(getMarketPrefix('0700.hk')).toBe('hk')
      expect(getMarketPrefix('9988.HK')).toBe('hk')
      expect(getMarketPrefix('0005.HK')).toBe('hk')
    })
    test('5 位数字 + .HK 识别为 hk', () => {
      expect(getMarketPrefix('09988.HK')).toBe('hk')
    })
  })

  describe('前后空格', () => {
    test('空格被忽略', () => {
      expect(getMarketPrefix('  600519.SH  ')).toBe('sh')
      expect(getMarketPrefix('  0700.HK ')).toBe('hk')
      expect(getMarketPrefix('  000858.SZ')).toBe('sz')
    })
  })
})

describe('stripCodeSuffix', () => {
  test('去除 .SH/.SZ/.HK 后缀并转大写', () => {
    expect(stripCodeSuffix('600519.SH')).toBe('600519')
    expect(stripCodeSuffix('000858.SZ')).toBe('000858')
    expect(stripCodeSuffix('0700.HK')).toBe('0700')
    expect(stripCodeSuffix('0700.hk')).toBe('0700')
    expect(stripCodeSuffix('0005.hk')).toBe('0005')
  })
  test('无后缀时返回原值（转大写）', () => {
    expect(stripCodeSuffix('600519')).toBe('600519')
    expect(stripCodeSuffix('000858')).toBe('000858')
    expect(stripCodeSuffix('0700')).toBe('0700')
  })
  test('空格被忽略', () => {
    expect(stripCodeSuffix('  600519.SH  ')).toBe('600519')
    expect(stripCodeSuffix('  0700.HK ')).toBe('0700')
  })
})

describe('buildTencentCode', () => {
  test('沪市 A 股 → sh + 代码', () => {
    expect(buildTencentCode('600519')).toBe('sh600519')
    expect(buildTencentCode('600519.SH')).toBe('sh600519')
  })
  test('深市 A 股 → sz + 代码', () => {
    expect(buildTencentCode('000858')).toBe('sz000858')
    expect(buildTencentCode('002230.SZ')).toBe('sz002230')
  })
  test('港股 → s_hk + 5 位补零', () => {
    expect(buildTencentCode('0700.HK')).toBe('s_hk00700')
    expect(buildTencentCode('0005.HK')).toBe('s_hk00005')
    expect(buildTencentCode('9988.HK')).toBe('s_hk09988')
    expect(buildTencentCode('09988.HK')).toBe('s_hk09988')
  })
})

describe('buildSinaCode', () => {
  test('沪市 A 股 → sh + 代码', () => {
    expect(buildSinaCode('600519')).toBe('sh600519')
    expect(buildSinaCode('600036.SH')).toBe('sh600036')
  })
  test('深市 A 股 → sz + 代码', () => {
    expect(buildSinaCode('000001')).toBe('sz000001')
    expect(buildSinaCode('300750.SZ')).toBe('sz300750')
  })
  test('港股 → rt_hk + 5 位补零', () => {
    expect(buildSinaCode('0700.HK')).toBe('rt_hk00700')
    expect(buildSinaCode('0005.HK')).toBe('rt_hk00005')
    expect(buildSinaCode('9988.HK')).toBe('rt_hk09988')
  })
})

describe('getNeteaseCode', () => {
  test('沪市 A 股 → 0 + 代码', () => {
    expect(getNeteaseCode('600519')).toBe('0600519')
    expect(getNeteaseCode('600036.SH')).toBe('0600036')
  })
  test('深市 A 股 → 1 + 代码', () => {
    expect(getNeteaseCode('000858')).toBe('1000858')
    expect(getNeteaseCode('002230.SZ')).toBe('1002230')
  })
  test('港股 → 1 + 5 位补零（网易历史接口港股使用深市前缀）', () => {
    expect(getNeteaseCode('0700.HK')).toBe('100700')
    expect(getNeteaseCode('0005.HK')).toBe('100005')
    expect(getNeteaseCode('9988.HK')).toBe('109988')
  })

  test('深市 A 股与港股不碰撞：长度差异区分（深市 7 位 vs 港股 6 位）', () => {
    // 深市 000858.SZ → 1 + 000858 = 1000858（7 位）
    // 港股 0700.HK  → 1 + 00700 = 100700（6 位）
    expect(getNeteaseCode('000858.SZ')).toBe('1000858')
    expect(getNeteaseCode('0700.HK')).toBe('100700')
    expect(getNeteaseCode('000858.SZ')).not.toBe(getNeteaseCode('0700.HK'))
  })

  test('超长港股代码（>5 位）→ 抛错避免与深市 A 股碰撞', () => {
    // 6 位港股代码补零后为 7 位（1+6），与深市 A 股格式相同 → 碰撞
    expect(() => getNeteaseCode('123456.HK')).toThrow(/碰撞风险/)
    expect(() => getNeteaseCode('099999.HK')).toThrow(/超过 5 位/)
  })
})
