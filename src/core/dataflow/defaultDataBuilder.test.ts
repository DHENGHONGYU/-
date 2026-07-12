import { vi, describe, it, expect } from 'vitest'
import { DefaultDataBuilder, defaultDataBuilder } from './defaultDataBuilder'
import type { DataChannel } from './dataflowTypes'

// ============================================================
// buildChannelMeta
// ============================================================

describe('DefaultDataBuilder', () => {
  const builder = new DefaultDataBuilder()

  // 1. buildChannelMeta('market:index')
  it('buildChannelMeta(market:index) → refreshInterval=5000, persist=true, priority=high', () => {
    const meta = builder.buildChannelMeta('market:index')
    expect(meta.channel).toBe('market:index')
    expect(meta.refreshInterval).toBe(5000)
    expect(meta.persist).toBe(true)
    expect(meta.priority).toBe('high')
    expect(meta.description).toBe('大盘指数')
  })

  // 2. buildChannelMeta('market:sector')
  it('buildChannelMeta(market:sector) → refreshInterval=10000', () => {
    const meta = builder.buildChannelMeta('market:sector')
    expect(meta.refreshInterval).toBe(10000)
    expect(meta.persist).toBe(true)
    expect(meta.priority).toBe('high')
    expect(meta.description).toBe('板块排行')
  })

  // 3. buildChannelMeta('market:fundflow')
  it('buildChannelMeta(market:fundflow) → priority=normal', () => {
    const meta = builder.buildChannelMeta('market:fundflow')
    expect(meta.priority).toBe('normal')
    expect(meta.refreshInterval).toBe(15000)
    expect(meta.persist).toBe(true)
    expect(meta.description).toBe('资金流向')
  })

  // 4. buildChannelMeta('market:emotion')
  it('buildChannelMeta(market:emotion) → persist=false, priority=low', () => {
    const meta = builder.buildChannelMeta('market:emotion')
    expect(meta.persist).toBe(false)
    expect(meta.priority).toBe('low')
    expect(meta.refreshInterval).toBe(30000)
    expect(meta.description).toBe('市场情绪')
  })

  // 5. buildChannelMeta('portfolio:summary')
  it('buildChannelMeta(portfolio:summary) → refreshInterval=10000', () => {
    const meta = builder.buildChannelMeta('portfolio:summary')
    expect(meta.refreshInterval).toBe(10000)
    expect(meta.persist).toBe(true)
    expect(meta.priority).toBe('high')
    expect(meta.description).toBe('持仓概览')
  })

  // 6. buildChannelMeta('strategy:signal')
  it('buildChannelMeta(strategy:signal) → refreshInterval=5000', () => {
    const meta = builder.buildChannelMeta('strategy:signal')
    expect(meta.refreshInterval).toBe(5000)
    expect(meta.persist).toBe(false)
    expect(meta.priority).toBe('high')
    expect(meta.description).toBe('买卖信号')
  })

  // 7. buildChannelMeta('strategy:score')
  it('buildChannelMeta(strategy:score) → refreshInterval=60000', () => {
    const meta = builder.buildChannelMeta('strategy:score')
    expect(meta.refreshInterval).toBe(60000)
    expect(meta.persist).toBe(true)
    expect(meta.priority).toBe('normal')
    expect(meta.description).toBe('股票评分')
  })

  // 8. buildChannelMeta('agent:status')
  it('buildChannelMeta(agent:status) → refreshInterval=10000', () => {
    const meta = builder.buildChannelMeta('agent:status')
    expect(meta.refreshInterval).toBe(10000)
    expect(meta.persist).toBe(false)
    expect(meta.priority).toBe('normal')
    expect(meta.description).toBe('Agent状态')
  })

  // 9. buildChannelMeta('system:health')
  it('buildChannelMeta(system:health) → refreshInterval=30000', () => {
    const meta = builder.buildChannelMeta('system:health')
    expect(meta.refreshInterval).toBe(30000)
    expect(meta.persist).toBe(false)
    expect(meta.priority).toBe('low')
    expect(meta.description).toBe('系统健康')
  })

  // 10. buildChannelMeta('unknown:channel')
  it('buildChannelMeta(unknown:channel) → 默认值（30000, false, normal）', () => {
    const meta = builder.buildChannelMeta('unknown:channel')
    expect(meta.channel).toBe('unknown:channel')
    expect(meta.refreshInterval).toBe(30000)
    expect(meta.persist).toBe(false)
    expect(meta.priority).toBe('normal')
    expect(meta.description).toBe('默认通道')
  })

  // ============================================================
  // buildEmptyPacket
  // ============================================================

  // 11. buildEmptyPacket: 返回正确结构
  it('buildEmptyPacket: 返回正确结构（channel, data=null, timestamp, seq=0）', () => {
    const packet = builder.buildEmptyPacket('market:index' as DataChannel)
    expect(packet).toMatchObject({
      channel: 'market:index',
      data: null,
      seq: 0,
    })
    expect(typeof packet.timestamp).toBe('number')
  })

  // 12. buildEmptyPacket: timestamp 为当前时间
  it('buildEmptyPacket: timestamp 为当前时间', () => {
    const now = 1234567890123
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const packet = builder.buildEmptyPacket('market:sector' as DataChannel)
    expect(packet.timestamp).toBe(now)
    vi.restoreAllMocks()
  })

  // ============================================================
  // buildFallbackData
  // ============================================================

  // 13. buildFallbackData('market:index')
  it('buildFallbackData(market:index) → 含 index/change/changePercent/volume', () => {
    const data = builder.buildFallbackData('market:index')
    expect(data).toEqual({
      index: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
    })
  })

  // 14. buildFallbackData('portfolio:summary')
  it('buildFallbackData(portfolio:summary) → 含 totalAssets/available/dailyPnL/totalPnL', () => {
    const data = builder.buildFallbackData('portfolio:summary')
    expect(data).toEqual({
      totalAssets: 0,
      available: 0,
      dailyPnL: 0,
      totalPnL: 0,
    })
  })

  // 15. buildFallbackData('strategy:signal')
  it('buildFallbackData(strategy:signal) → []', () => {
    const data = builder.buildFallbackData('strategy:signal')
    expect(data).toEqual([])
  })

  // 16. buildFallbackData('unknown:channel')
  it('buildFallbackData(unknown:channel) → null', () => {
    const data = builder.buildFallbackData('unknown:channel')
    expect(data).toBeNull()
  })

  // 17. buildFallbackData: 所有已知 channel 返回非 null
  it('buildFallbackData: 所有已知 channel 返回非 null', () => {
    const knownChannels = [
      'market:index',
      'market:sector',
      'portfolio:summary',
      'portfolio:holding',
      'strategy:signal',
      'strategy:score',
      'agent:status',
      'system:health',
    ]
    for (const channel of knownChannels) {
      const data = builder.buildFallbackData(channel)
      expect(data).not.toBeNull()
    }
  })

  // 额外验证具体已知通道的回退数据结构
  it('buildFallbackData(market:sector) → []', () => {
    expect(builder.buildFallbackData('market:sector')).toEqual([])
  })

  it('buildFallbackData(portfolio:holding) → []', () => {
    expect(builder.buildFallbackData('portfolio:holding')).toEqual([])
  })

  it('buildFallbackData(strategy:score) → 含 score/factors', () => {
    expect(builder.buildFallbackData('strategy:score')).toEqual({ score: 0, factors: {} })
  })

  it('buildFallbackData(agent:status) → []', () => {
    expect(builder.buildFallbackData('agent:status')).toEqual([])
  })

  it('buildFallbackData(system:health) → 含 cpu/memory/network', () => {
    expect(builder.buildFallbackData('system:health')).toEqual({ cpu: 0, memory: 0, network: 'normal' })
  })
})

// ============================================================
// 单例验证
// ============================================================

describe('defaultDataBuilder singleton', () => {
  it('defaultDataBuilder 是 DefaultDataBuilder 实例', () => {
    expect(defaultDataBuilder).toBeInstanceOf(DefaultDataBuilder)
  })

  it('单例方法可正常调用', () => {
    const meta = defaultDataBuilder.buildChannelMeta('market:index')
    expect(meta.priority).toBe('high')

    const packet = defaultDataBuilder.buildEmptyPacket('system:health' as DataChannel)
    expect(packet.seq).toBe(0)

    const fallback = defaultDataBuilder.buildFallbackData('market:index')
    expect(fallback).toEqual({ index: 0, change: 0, changePercent: 0, volume: 0 })
  })
})
