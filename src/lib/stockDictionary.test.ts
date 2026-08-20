/**
 * lib/stockDictionary — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量 Round 2）：新增独立测试文件，不编辑/不删除已有测试。
 *
 * 被测文件 src/lib/stockDictionary.ts 只 re-export findStockBySymbol 与 StockDictItem 类型。
 * 实现位于 services/stock/stockDictionary.ts L8409-L8411：
 *   const normalized = symbol.replace(/\.(SH|SZ|BJ|HK)$/i, '').trim().toUpperCase()
 *   return ALL_STOCKS.find((s) => s.symbol === normalized)
 *
 * 关键分支覆盖率目标（每条语句/分支独立触发）：
 *   ① replace 正则 HIT（.SH/.SZ/.BJ/.HK 任一后缀位于字符串末尾）
 *   ② replace 正则 MISS（无后缀或后缀不在末尾，含「后缀后有空格」情形）
 *   ③ trim 生效（含前后空格 / 全空白输入）
 *   ④ toUpperCase 生效（小写后缀 → 大写归一化）
 *   ⑤ .find() HIT（返回 StockDictItem）
 *   ⑥ .find() MISS（返回 undefined）
 *
 * 数据来源（已校验 services/stock/stockDictionary.ts 中真实存在）：
 *   - 600000 SH 浦发银行（L30）、600004 SH 白云机场（L31）、600009 SH 上海机场（L36）
 *   - 920000 BJ 安徽凤凰（L5248）  — BJ 段首个条目
 *   - 00001  HK 长和     （L5579）  — HK 段首个条目
 */
import { describe, it, expect } from 'vitest'
import { findStockBySymbol } from './stockDictionary'

describe('lib/stockDictionary', () => {
  describe('findStockBySymbol() — .find 命中分支 + replace 正则命中/未命中 + trim + uppercase', () => {
    it('纯代码（无后缀）→ replace 正则 MISS + .find HIT', () => {
      const r = findStockBySymbol('600000')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600000')
      expect(r!.name).toBe('浦发银行')
      expect(r!.market).toBe('SH')
    })

    it('后缀 .SH 大写（末尾）→ replace 正则 HIT（SH 替代分支）', () => {
      const r = findStockBySymbol('600000.SH')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600000')
      expect(r!.market).toBe('SH')
    })

    it('后缀 .sh 小写（末尾）→ replace 正则 HIT 大小写不敏感 + toUpperCase 分支生效', () => {
      const r = findStockBySymbol('600009.sh')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600009')
      expect(r!.name).toBe('上海机场')
    })

    it('后缀 .BJ → replace 正则 HIT（BJ 替代分支，920000 BJ 安徽凤凰真实存在）', () => {
      const r = findStockBySymbol('920000.BJ')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('920000')
      expect(r!.market).toBe('BJ')
      expect(r!.name).toBe('安徽凤凰')
    })

    it('后缀 .hk 小写 → replace 正则 HIT（HK 替代分支，00001 HK 长和真实存在）', () => {
      const r = findStockBySymbol('00001.hk')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('00001')
      expect(r!.market).toBe('HK')
      expect(r!.name).toBe('长和')
    })

    it('仅前导空格 + 纯代码 → trim 生效（replace 正则仍 MISS）', () => {
      const r = findStockBySymbol('  600000')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600000')
    })

    it('前后都有空格 + 纯代码 → trim 生效', () => {
      const r = findStockBySymbol('  600000  ')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600000')
    })

    it('前导空格 + 后缀在末尾（无后置空格）→ trim + replace 正则均生效', () => {
      // 要点：后缀必须在字符串末尾，replace 的 $ 锚点才能命中
      const r = findStockBySymbol('  600004.SH')
      expect(r).toBeDefined()
      expect(r!.symbol).toBe('600004')
      expect(r!.name).toBe('白云机场')
    })

    it('不存在的代码 999999 → .find MISS（返回 undefined 分支）', () => {
      expect(findStockBySymbol('999999')).toBeUndefined()
    })

    it('不存在的代码加后缀 → replace 命中 + .find MISS', () => {
      expect(findStockBySymbol('999999.SH')).toBeUndefined()
    })

    it('空字符串输入 → trim 后为空 → .find MISS → undefined', () => {
      expect(findStockBySymbol('')).toBeUndefined()
    })

    it('全空格输入 → trim 后为空 → .find MISS → undefined', () => {
      expect(findStockBySymbol('     ')).toBeUndefined()
    })
  })
})
