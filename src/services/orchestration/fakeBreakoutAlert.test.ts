/**
 * @file 假突破监控列表设置与预警验证测试
 * @description 将全市场扫描出的 5 只假突破股票加入自选监控列表，
 *              启动 FakeBreakoutAlertPush 预警器，并验证预警规则
 *
 * 运行：npx vitest run src/services/orchestration/fakeBreakoutAlert.test.ts --reporter=verbose
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { FakeBreakoutAlertPush } from './fakeBreakoutAlert'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('nanoid', () => ({
  nanoid: (len?: number) => Math.random().toString(36).slice(2, 2 + (len ?? 12)),
}))

// ============================================================
// 全市场扫描出的 5 只假突破股票
// ============================================================
const FAKE_BREAKOUT_STOCKS = [
  { symbol: 'SH-600519', name: '贵州茅台', turnover: 0.158, volumeRatio: 1.0, mainForceNet: -2.8, energyLevel: 5 },
  { symbol: 'SZ-000858', name: '五粮液', turnover: 0.165, volumeRatio: 0.95, mainForceNet: -1.5, energyLevel: 5 },
  { symbol: 'SZ-300750', name: '宁德时代', turnover: 0.142, volumeRatio: 1.1, mainForceNet: -3.2, energyLevel: 5 },
  { symbol: 'SH-601318', name: '中国平安', turnover: 0.125, volumeRatio: 1.2, mainForceNet: -2.0, energyLevel: 5 },
  { symbol: 'SH-600036', name: '招商银行', turnover: 0.082, volumeRatio: 1.0, mainForceNet: -1.2, energyLevel: 4 },
] as const

// ============================================================
// 对照股票（不应触发假突破预警）
// ============================================================
const NORMAL_STOCKS = [
  // 有效突破：高换手 + 高量比
  { symbol: 'SZ-002594', name: '比亚迪', turnover: 0.048, volumeRatio: 5.2, mainForceNet: 5.8 },
  // v4.7 降级：高换手 + 低量比但主力净流入
  { symbol: 'SH-600276', name: '恒瑞医药', turnover: 0.095, volumeRatio: 1.2, mainForceNet: 3.2 },
] as const

describe('假突破监控列表设置与预警验证', () => {
  let alertPush: FakeBreakoutAlertPush

  beforeEach(() => {
    // 每次测试创建新实例
    alertPush = new FakeBreakoutAlertPush({
      watchSymbols: [],
      autoAlert: true,
    })
  })

  afterEach(() => {
    alertPush.stop()
    alertPush.clear()
  })

  // ============================================================
  // 1. 加入自选监控列表
  // ============================================================
  test('将 5 只假突破股票加入自选监控列表', () => {
    // 批量添加 5 只假突破股票
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )

    const watchList = alertPush.getWatchSymbols()
    expect(watchList).toHaveLength(5)
    expect(watchList).toContain('SH-600519')
    expect(watchList).toContain('SZ-000858')
    expect(watchList).toContain('SZ-300750')
    expect(watchList).toContain('SH-601318')
    expect(watchList).toContain('SH-600036')

    console.log('\n========== 自选监控列表 ==========')
    console.log(`监控股票数: ${watchList.length}`)
    for (const s of FAKE_BREAKOUT_STOCKS) {
      console.log(`  ${s.symbol} ${s.name} | 换手${(s.turnover * 100).toFixed(1)}% | 量比${s.volumeRatio} | L${s.energyLevel} | 主力${s.mainForceNet}亿`)
    }
  })

  // ============================================================
  // 2. 启动预警并验证 L5 假突破触发 critical 级别
  // ============================================================
  test('启动预警器并验证 L5 假突破触发 critical 预警', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()
    expect(alertPush.active).toBe(true)

    // 模拟行情更新：贵州茅台 L5 假突破 + 主力净流出
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: [
        {
          symbol: 'SH-600519',
          name: '贵州茅台',
          turnover: 0.158,
          volumeRatio: 1.0,
          mainForceNet: -2.8,
        },
      ],
    })

    const alerts = alertPush.getAlerts('SH-600519')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.level).toBe('critical')
    expect(alerts[0]!.breakoutStyle).toBe('fake_breakout')
    expect(alerts[0]!.energyLevel).toBe(5)

    console.log('\n========== L5 假突破预警触发 ==========')
    console.log(`股票: ${alerts[0]!.symbol} ${alerts[0]!.name}`)
    console.log(`级别: ${alerts[0]!.level}`)
    console.log(`能量: L${alerts[0]!.energyLevel} ${alerts[0]!.energyLabel}`)
    console.log(`原因: ${alerts[0]!.reason}`)
  })

  // ============================================================
  // 3. 验证全部 5 只股票的预警
  // ============================================================
  test('全量验证：5 只假突破股票均触发预警', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    // 模拟全部 5 只股票的行情更新
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: FAKE_BREAKOUT_STOCKS.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })

    const allAlerts = alertPush.getActiveAlerts()
    expect(allAlerts).toHaveLength(5)

    // L5 股票应为 critical
    const criticalAlerts = alertPush.getCriticalAlerts()
    expect(criticalAlerts).toHaveLength(4) // 茅台、五粮液、宁德、平安

    // 招商银行 L4 应为 warning
    const cmbAlert = alertPush.getAlerts('SH-600036')
    expect(cmbAlert).toHaveLength(1)
    expect(cmbAlert[0]!.level).toBe('warning')

    console.log('\n========== 全量预警结果 ==========')
    console.log(`预警总数: ${allAlerts.length}`)
    console.log(`严重(critical): ${criticalAlerts.length}`)
    console.log(`警告(warning): ${allAlerts.filter((a) => a.level === 'warning').length}`)
    console.log('\n预警详情:')
    for (const a of allAlerts) {
      const tag = a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟠' : 'ℹ️'
      console.log(`  ${tag} ${a.symbol} ${a.name} | L${a.energyLevel} | ${a.reason}`)
    }
  })

  // ============================================================
  // 4. 验证有效突破不触发预警
  // ============================================================
  test('对照验证：有效突破和主力净流入股票不触发预警', () => {
    // 将所有股票加入监控（包括对照股票）
    alertPush.addWatchSymbols(
      [...FAKE_BREAKOUT_STOCKS, ...NORMAL_STOCKS].map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    // 模拟对照股票行情
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: NORMAL_STOCKS.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })

    // 比亚迪：有效突破，不触发假突破预警
    const bydAlerts = alertPush.getAlerts('SZ-002594')
    expect(bydAlerts).toHaveLength(0)

    // 恒瑞医药：v4.7 降级（主力净流入），不触发假突破预警
    const hrAlerts = alertPush.getAlerts('SH-600276')
    expect(hrAlerts).toHaveLength(0)

    console.log('\n========== 对照验证结果 ==========')
    console.log('比亚迪 (有效突破): 无预警 ✅')
    console.log('恒瑞医药 (主力净流入降级): 无预警 ✅')
  })

  // ============================================================
  // 5. 验证移除监控后不再预警
  // ============================================================
  test('移除监控股票后不再触发预警', () => {
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    alertPush.start()

    // 移除贵州茅台
    alertPush.removeWatchSymbol('SH-600519')
    expect(alertPush.getWatchSymbols()).not.toContain('SH-600519')

    // 模拟贵州茅台行情
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      symbol: 'SH-600519',
      name: '贵州茅台',
      turnover: 0.158,
      volumeRatio: 1.0,
      mainForceNet: -2.8,
    })

    // 不应触发预警
    expect(alertPush.getAlerts('SH-600519')).toHaveLength(0)
    console.log('\n========== 移除监控验证 ==========')
    console.log('贵州茅台已从监控列表移除，不再触发预警 ✅')
  })

  // ============================================================
  // 6. 综合场景：模拟实时监控流程
  // ============================================================
  test('综合场景：模拟实时监控完整流程', () => {
    console.log('\n========== 实时监控模拟流程 ==========')

    // Step 1: 加入监控列表
    console.log('\nStep 1: 加入 5 只假突破股票到监控列表')
    alertPush.addWatchSymbols(
      FAKE_BREAKOUT_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
    )
    console.log(`  监控列表: ${alertPush.getWatchSymbols().length} 只股票`)

    // Step 2: 启动预警器
    console.log('\nStep 2: 启动假突破预警器')
    alertPush.start()
    console.log(`  预警器状态: ${alertPush.active ? '运行中' : '已停止'}`)

    // Step 3: 模拟盘中行情更新（分两批到达）
    console.log('\nStep 3: 模拟盘中行情更新')

    // 第一批：3 只 L5 股票
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: FAKE_BREAKOUT_STOCKS.slice(0, 3).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })
    console.log(`  第一批行情: 3 只 L5 股票 → 预警 ${alertPush.getAlertCount()} 条`)

    // 第二批：2 只股票（1 L5 + 1 L4）
    eventBus.emit(EVENT_NAMES.MARKET_QUOTE_UPDATE, {
      quotes: FAKE_BREAKOUT_STOCKS.slice(3).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        turnover: s.turnover,
        volumeRatio: s.volumeRatio,
        mainForceNet: s.mainForceNet,
      })),
    })
    console.log(`  第二批行情: 2 只股票 → 累计预警 ${alertPush.getAlertCount()} 条`)

    // Step 4: 验证预警结果
    console.log('\nStep 4: 验证预警结果')
    const allAlerts = alertPush.getActiveAlerts()
    const criticalCount = alertPush.getCriticalAlerts().length
    const warningCount = allAlerts.filter((a) => a.level === 'warning').length

    console.log(`  总预警: ${allAlerts.length}`)
    console.log(`  🔴 严重: ${criticalCount} (L5 假突破 + 主力净流出)`)
    console.log(`  🟠 警告: ${warningCount} (L4 假突破)`)
    console.log(`  ℹ️ 提示: ${allAlerts.filter((a) => a.level === 'info').length}`)

    expect(allAlerts).toHaveLength(5)
    expect(criticalCount).toBe(4)
    expect(warningCount).toBe(1)

    // Step 5: 逐只输出预警详情
    console.log('\nStep 5: 逐只预警详情')
    for (const stock of FAKE_BREAKOUT_STOCKS) {
      const stockAlerts = alertPush.getAlerts(stock.symbol)
      if (stockAlerts.length > 0) {
        const a = stockAlerts[0]!
        const tag = a.level === 'critical' ? '🔴' : '🟠'
        console.log(`  ${tag} ${a.symbol} ${a.name}`)
        console.log(`     换手: ${(a.turnover * 100).toFixed(1)}% | 量比: ${a.volumeRatio.toFixed(2)}`)
        console.log(`     能量: L${a.energyLevel} ${a.energyLabel}`)
        console.log(`     主力: ${a.mainForceNet ?? 'N/A'}亿`)
        console.log(`     原因: ${a.reason}`)
      }
    }

    // Step 6: 停止预警器
    console.log('\nStep 6: 停止预警器')
    alertPush.stop()
    console.log(`  预警器状态: ${alertPush.active ? '运行中' : '已停止'}`)
    expect(alertPush.active).toBe(false)
  })
})
