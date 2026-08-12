import { describe, it, expect } from 'vitest'
import { toTencentCode, toSinaCode, toNeteaseCode } from './stockCodeUtils'

describe('stockCodeUtils', () => {
  describe('toTencentCode()', () => {
    it('沪市 6 开头 → sh 前缀', () => {
      expect(toTencentCode('600519')).toBe('sh600519')
      expect(toTencentCode('601318')).toBe('sh601318')
    })

    it('沪市 9 开头 → sh 前缀（B股）', () => {
      expect(toTencentCode('900901')).toBe('sh900901')
    })

    it('深市 0 开头 → sz 前缀', () => {
      expect(toTencentCode('000001')).toBe('sz000001')
      expect(toTencentCode('002594')).toBe('sz002594')
    })

    it('深市 3 开头 → sz 前缀（创业板）', () => {
      expect(toTencentCode('300750')).toBe('sz300750')
    })

    it('北交所 8 开头 → bj 前缀', () => {
      expect(toTencentCode('835185')).toBe('bj835185')
    })

    it('北交所 4 开头 → bj 前缀', () => {
      expect(toTencentCode('430047')).toBe('bj430047')
    })

    it('.SH 后缀 → sh 前缀', () => {
      expect(toTencentCode('600519.SH')).toBe('sh600519')
      expect(toTencentCode('600519.sh')).toBe('sh600519')
    })

    it('.SZ 后缀 → sz 前缀', () => {
      expect(toTencentCode('000001.SZ')).toBe('sz000001')
      expect(toTencentCode('300750.sz')).toBe('sz300750')
    })

    it('.BJ 后缀 → bj 前缀', () => {
      expect(toTencentCode('835185.BJ')).toBe('bj835185')
    })

    it('指数代码 .SH → sh 前缀', () => {
      expect(toTencentCode('000300.SH')).toBe('sh000300')
      expect(toTencentCode('000001.SH')).toBe('sh000001')
    })

    it('未知格式默认 sh 前缀', () => {
      // 既不匹配6/9/0/3/8/4开头，也无后缀
      const result = toTencentCode('510050')
      // 5开头默认走sh
      expect(result).toMatch(/^sh/)
    })
  })

  describe('toSinaCode()', () => {
    it('与 toTencentCode 行为一致', () => {
      expect(toSinaCode('600519')).toBe(toTencentCode('600519'))
      expect(toSinaCode('000001')).toBe(toTencentCode('000001'))
      expect(toSinaCode('300750')).toBe(toTencentCode('300750'))
    })
  })

  describe('toNeteaseCode()', () => {
    it('沪市 6 开头 → 0 前缀', () => {
      expect(toNeteaseCode('600519')).toBe('0600519')
    })

    it('深市 0 开头 → 1 前缀', () => {
      expect(toNeteaseCode('000001')).toBe('1000001')
    })

    it('创业板 3 开头 → 1 前缀', () => {
      expect(toNeteaseCode('300750')).toBe('1300750')
    })

    it('北交所 8 开头 → 1 前缀', () => {
      expect(toNeteaseCode('835185')).toBe('1835185')
    })
  })
})
