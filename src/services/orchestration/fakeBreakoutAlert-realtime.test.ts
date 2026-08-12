/**
 * @file 实时行情推送模拟 — 验证假突破 critical 预警通知完整链路
 * @description 模拟逐笔行情推送，验证 eventBus → FakeBreakoutAlertPush → 预警通知的完整链路
 *
 * 运行：npx vitest run src/services/orchestration/fakeBreakoutAlert-realtime.test.ts --reporter=verbose
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { FakeBreakoutAlertPush, type FakeBreakoutAlert } from './fakeBreakoutAlert'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('nanoid', () => ({
  nanoid: (len?: number) => Math.random().toString(36).slice(2, 2 + (len ?? 12)),
}))

// ============================================================
// 5 只假突破股票（全市场扫描结果）
// ============================================================
const FAKE_BREAKOUT_STOCKS = [
  { symbol: 'SH-600519', name: '贵州茅台', turnover: 0.158, volumeRatio: 1.0, mainForceNet: -2.8, northboundNet: -1.2, marginChange: -0.5 },
  { symbol: 'SZ-000858', name: '五粮液', turnover: 0.165, volumeRatio: 0.95, mainForceNet: -1.5, northboundNet: -0.8, marginChange: -0.3 },
  { symbol: 'SZ-300750', name: '宁德时代', turnover: 0.142, volumeRatio: 1.1, mainForceNet: -3.2, northboundNet: -1.5, marginChange: -0.8 },
  { symbol: 'SH-601318', name: '中国平安', turnover: 0.125, volumeRatio: 1.2, mainForceNet: -2.0, northboundNet: -1.0, marginChange: -0.4 },
  { symbol: 'SH-600036', name: '招商银行', turnover: 0.082, volumeRatio: 1.0, mainForceNet: -1.2, northboundNet: -0.5, marginChange: 0.1 },
] as const

// 对照：有效突破 + v4.7 降级股票
const CONTROL_STOCKS = [
  { symbol: 'SZ-002594', name: '比亚迪', turnover: 0.048, volumeRatio: 5.2, mainForceNet: 5.8 },
  { symbol: 'SH-600276', name: '恒瑞医药', turnover: 0.095, volumeRatio: 1.2, mainForceNet: 3.2 },
] as const

describe('实时行情推送模拟 — 假突破 critical 预警通知验证', () => {
  let alertPush: FakeBreakoutAlertPush
  let receivedAlerts: FakeBreakoutAlert[] = []

  beforeEach(() => {
    receivedAlerts = []
    alertPush = new FakeBreakoutAlertPush({ watchSymbols: [], autoAlert: true })
  })

  afterEach(() => {
    alertPush.stop()
    alertPush.clear()
  })

  // ============================================================
  // 1. 逐笔行情推送 — 验证每只股票的 critical 预警通知
  // ============================================================
  test('逐笔行情推送：4 只 L5 股票逐一触发 critical 预警通知', () => {
    // 加入监控列表
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    // 订阅预警通知事件
    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    // 逐笔推送行情（模拟实时到达）
    const l5Stocks = FAKE_BREAKOUT_STOCKS.filter((s) => s.symbol !== 'SH-600036')

    console.log('\n========== 逐笔行情推送模拟 ==========')
    console.log(`监控列表: ${alertPush.getWatchSymbols().length} 只股票`)
    console.log(`预警器状态: ${alertPush.active ? '运行中' : '已停止'}`)
    console.log('')

    for (let i = 0; i < l5Stocks.length; i++) {
      const stock = l5Stocks[i]!
      const pushTime = new Date()
      console.log(`[${pushTime.toLocaleTimeString('zh-CN')}] 推送第 ${i + 1} 笔行情: ${stock.symbol} ${stock.name}`)

      // 模拟实时行情推送
      eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
        symbol: stock.symbol,
        name: stock.name,
        turnover: stock.turnover,
        volumeRatio: stock.volumeRatio,
        mainForceNet: stock.mainForceNet,
        northboundNet: stock.northboundNet,
        marginChange: stock.marginChange,
        timestamp: Date.now(),
      })

      // 验证已收到预警
      const stockAlerts = receivedAlerts.filter((a) => a.symbol === stock.symbol)
      expect(stockAlerts).toHaveLength(1)

      const alert = stockAlerts[0]!
      console.log(`  → 收到预警: [${alert.level}] ${alert.symbol} ${alert.name}`)
      console.log(`    能量: L${alert.energyLevel} ${alert.energyLabel}`)
      console.log(`    主力: ${alert.mainForceNet}亿`)
      console.log(`    原因: ${alert.reason}`)
      console.log('')

      // 验证预警级别
      expect(alert.level).toBe('critical')
      expect(alert.breakoutStyle).toBe('fake_breakout')
      expect(alert.energyLevel).toBe(5)
      expect(alert.mainForceNet).toBeLessThan(0)
    }

    // 验证总计收到 4 条 critical 预警
    expect(receivedAlerts).toHaveLength(4)
    expect(receivedAlerts.every((a) => a.level === 'critical')).toBe(true)

    console.log('========== 逐笔推送完成 ==========')
    console.log(`总计收到预警: ${receivedAlerts.length} 条`)
    console.log(`全部为 critical 级别: ✅`)

    unsub()
  })

  // ============================================================
  // 2. 批量行情推送 — 验证一次推送多只股票
  // ============================================================
  test('批量行情推送：5 只股票同时推送，4 critical + 1 warning', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    // 一次性推送全部 5 只股票行情
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: FAKE_BREAKOUT_STOCKS.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })

    expect(receivedAlerts).toHaveLength(5)

    const criticalCount = receivedAlerts.filter((a) => a.level === 'critical').length
    const warningCount = receivedAlerts.filter((a) => a.level === 'warning').length

    expect(criticalCount).toBe(4) // L5: 茅台、五粮液、宁德、平安
    expect(warningCount).toBe(1)  // L4: 招商银行

    console.log('\n========== 批量推送结果 ==========')
    console.log(`总计预警: ${receivedAlerts.length}`)
    console.log(`🔴 critical: ${criticalCount}`)
    console.log(`🟠 warning: ${warningCount}`)

    unsub()
  })

  // ============================================================
  // 3. 对照验证 — 有效突破和主力净流入不触发预警
  // ============================================================
  test('对照验证：有效突破和 v4.7 降级股票不触发预警通知', () => {
    alertPush.addWatchSymbols(
      [...FAKE_BREAKOUT_STOCKS, ...CONTROL_STOCKS].map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    // 推送对照股票行情
    for (const stock of CONTROL_STOCKS) {
      eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
        symbol: stock.symbol,
        name: stock.name,
        turnover: stock.turnover,
        volumeRatio: stock.volumeRatio,
        mainForceNet: stock.mainForceNet,
      })
    }

    // 对照股票不应产生任何预警
    expect(receivedAlerts).toHaveLength(0)

    console.log('\n========== 对照验证 ==========')
    console.log('比亚迪 (4.8%换手 + 5.2量比 → momentum_breakout): 无预警 ✅')
    console.log('恒瑞医药 (9.5%换手 + 1.2量比 + 主力+3.2亿 → v4.7降级): 无预警 ✅')

    unsub()
  })

  // ============================================================
  // 4. 预警通知内容完整性验证
  // ============================================================
  test('预警通知内容完整性：每条预警包含完整字段', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    // 推送贵州茅台行情
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      symbol: 'SH-600519',
      name: '贵州茅台',
      turnover: 0.158,
      volumeRatio: 1.0,
      mainForceNet: -2.8,
    })

    expect(receivedAlerts).toHaveLength(1)
    const alert = receivedAlerts[0]!

    // 验证所有必要字段
    expect(alert.id).toBeDefined()
    expect(alert.symbol).toBe('SH-600519')
    expect(alert.name).toBe('贵州茅台')
    expect(alert.turnover).toBe(0.158)
    expect(alert.volumeRatio).toBe(1.0)
    expect(alert.energyLevel).toBe(5)
    expect(alert.energyLabel).toBeDefined()
    expect(alert.breakoutStyle).toBe('fake_breakout')
    expect(alert.mainForceNet).toBe(-2.8)
    expect(alert.level).toBe('critical')
    expect(alert.reason).toContain('L5')
    expect(alert.reason).toContain('15.8%')
    expect(alert.detectedAt).toBeGreaterThan(0)

    console.log('\n========== 预警通知字段验证 ==========')
    console.log(`id: ${alert.id}`)
    console.log(`symbol: ${alert.symbol}`)
    console.log(`name: ${alert.name}`)
    console.log(`turnover: ${alert.turnover}`)
    console.log(`volumeRatio: ${alert.volumeRatio}`)
    console.log(`energyLevel: L${alert.energyLevel}`)
    console.log(`energyLabel: ${alert.energyLabel}`)
    console.log(`breakoutStyle: ${alert.breakoutStyle}`)
    console.log(`mainForceNet: ${alert.mainForceNet}亿`)
    console.log(`level: ${alert.level}`)
    console.log(`reason: ${alert.reason}`)
    console.log(`detectedAt: ${new Date(alert.detectedAt).toLocaleString('zh-CN')}`)
    console.log('所有字段完整 ✅')

    unsub()
  })

  // ============================================================
  // 5. 完整实时监控场景模拟
  // ============================================================
  test('完整实时监控场景：开盘 → 逐笔推送 → 批量推送 → 收盘', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    console.log('\n========== 完整实时监控场景 ==========')
    console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 系统启动，监控 ${alertPush.getWatchSymbols().length} 只股票`)

    // ---- 开盘阶段：逐笔推送前 3 只 ----
    console.log('\n--- 开盘阶段：逐笔推送 ---')
    const openingStocks = FAKE_BREAKOUT_STOCKS.slice(0, 3)
    for (const stock of openingStocks) {
      eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
        symbol: stock.symbol,
        name: stock.name,
        turnover: stock.turnover,
        volumeRatio: stock.volumeRatio,
        mainForceNet: stock.mainForceNet,
      })
    }
    console.log(`  开盘阶段预警: ${receivedAlerts.length} 条`)
    expect(receivedAlerts.length).toBe(3)
    expect(receivedAlerts.every((a) => a.level === 'critical')).toBe(true)

    // ---- 盘中阶段：批量推送剩余 2 只 ----
    console.log('\n--- 盘中阶段：批量推送 ---')
    const intradayStocks = FAKE_BREAKOUT_STOCKS.slice(3)
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: intradayStocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })
    console.log(`  盘中阶段预警: ${receivedAlerts.length - 3} 条（累计 ${receivedAlerts.length} 条）`)
    expect(receivedAlerts.length).toBe(5)

    // ---- 盘中阶段：重复推送同一只股票（应再次预警）----
    console.log('\n--- 盘中阶段：重复推送贵州茅台 ---')
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      symbol: 'SH-600519',
      name: '贵州茅台',
      turnover: 0.158,
      volumeRatio: 1.0,
      mainForceNet: -2.8,
    })
    console.log(`  重复推送后累计预警: ${receivedAlerts.length} 条`)
    expect(receivedAlerts.length).toBe(6)

    // ---- 统计 ----
    const stats = {
      total: receivedAlerts.length,
      critical: receivedAlerts.filter((a) => a.level === 'critical').length,
      warning: receivedAlerts.filter((a) => a.level === 'warning').length,
      uniqueSymbols: new Set(receivedAlerts.map((a) => a.symbol)).size,
    }

    console.log('\n--- 收盘统计 ---')
    console.log(`  总预警: ${stats.total}`)
    console.log(`  🔴 critical: ${stats.critical}`)
    console.log(`  🟠 warning: ${stats.warning}`)
    console.log(`  覆盖股票: ${stats.uniqueSymbols} 只`)

    // 验证统计
    expect(stats.total).toBe(6)
    expect(stats.critical).toBe(5) // 4 只 L5 + 1 次重复
    expect(stats.warning).toBe(1)  // 招商银行 L4
    expect(stats.uniqueSymbols).toBe(5)

    unsub()
  })

  // ============================================================
  // 6. 边界情况：行情数据不完整
  // ============================================================
  test('边界情况：缺少资金流向数据时仍发出 critical 预警', () => {
    alertPush.addWatchSymbols([{ symbol: 'SH-600519', name: '贵州茅台' }])
    alertPush.start()

    const unsub = eventBus.on(EVENT_NAMES.CHIP_ANOMALY_DETECTED, (payload: unknown) => {
      receivedAlerts.push(payload as FakeBreakoutAlert)
    })

    // 推送行情但不包含 mainForceNet（资金流向数据缺失）
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      symbol: 'SH-600519',
      name: '贵州茅台',
      turnover: 0.158,
      volumeRatio: 1.0,
      // 无 mainForceNet
    })

    // L5 + 无资金数据 → 仍为 critical（向后兼容）
    expect(receivedAlerts).toHaveLength(1)
    expect(receivedAlerts[0]!.level).toBe('critical')
    expect(receivedAlerts[0]!.mainForceNet).toBeUndefined()

    console.log('\n========== 边界验证 ==========')
    console.log('贵州茅台 L5 无资金流向数据 → critical ✅（向后兼容）')
    console.log(`原因: ${receivedAlerts[0]!.reason}`)

    unsub()
  })
})
