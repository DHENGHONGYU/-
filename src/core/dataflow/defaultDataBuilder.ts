import type { ChannelMeta, DataPacket, DataChannel } from './dataflowTypes'

/**
 * DefaultDataBuilder
 */
export class DefaultDataBuilder {
  buildChannelMeta(channel: string): ChannelMeta {
    const defaults: Record<string, Partial<ChannelMeta>> = {
      'market:index': { refreshInterval: 5000, persist: true, priority: 'high', description: '大盘指数' },
      'market:sector': { refreshInterval: 10000, persist: true, priority: 'high', description: '板块排行' },
      'market:fundflow': { refreshInterval: 15000, persist: true, priority: 'normal', description: '资金流向' },
      'market:emotion': { refreshInterval: 30000, persist: false, priority: 'low', description: '市场情绪' },
      'portfolio:summary': { refreshInterval: 10000, persist: true, priority: 'high', description: '持仓概览' },
      'portfolio:holding': { refreshInterval: 30000, persist: true, priority: 'normal', description: '持仓明细' },
      'strategy:signal': { refreshInterval: 5000, persist: false, priority: 'high', description: '买卖信号' },
      'strategy:score': { refreshInterval: 60000, persist: true, priority: 'normal', description: '股票评分' },
      'agent:status': { refreshInterval: 10000, persist: false, priority: 'normal', description: 'Agent状态' },
      'system:health': { refreshInterval: 30000, persist: false, priority: 'low', description: '系统健康' },
    }
    const def = defaults[channel] ?? { refreshInterval: 30000, persist: false, priority: 'normal', description: '默认通道' }
    return {
      channel: channel as DataChannel,
      description: def.description!,
      refreshInterval: def.refreshInterval!,
      persist: def.persist!,
      priority: def.priority!,
    }
  }

  buildEmptyPacket(channel: DataChannel): DataPacket {
    return {
      channel,
      data: null,
      timestamp: Date.now(),
      seq: 0,
    }
  }

  buildFallbackData(channel: string): unknown {
    const fallbacks: Record<string, unknown> = {
      'market:index': { index: 0, change: 0, changePercent: 0, volume: 0 },
      'market:sector': [],
      'portfolio:summary': { totalAssets: 0, available: 0, dailyPnL: 0, totalPnL: 0 },
      'portfolio:holding': [],
      'strategy:signal': [],
      'strategy:score': { score: 0, factors: {} },
      'agent:status': [],
      'system:health': { cpu: 0, memory: 0, network: 'normal' },
    }
    return fallbacks[channel] ?? null
  }
}

/**
 * defaultDataBuilder
 */
export const defaultDataBuilder = new DefaultDataBuilder()