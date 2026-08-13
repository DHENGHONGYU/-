import type { SignalDirection } from '@/fixtures/chipStrategyMockData'
import type { PositionLevel, EnergyLevel } from './types'

export function getPositionLabel(pos: PositionLevel): string {
  const map: Record<PositionLevel, string> = {
    low: '低位',
    mid: '中位',
    high: '高位',
    any: '不限',
  }
  return map[pos]
}

export function getEnergyLabel(level: EnergyLevel): string {
  const map: Record<EnergyLevel, string> = {
    1: 'L1 冷清',
    2: 'L2 温和',
    3: 'L3 活跃',
    4: 'L4 激进',
    5: 'L5 爆炸',
  }
  return map[level]
}

export function getActionBadgeVariant(action: SignalDirection): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'buy':
      return 'default'
    case 'sell':
    case 'escape':
      return 'destructive'
    case 'hold':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function getActionColor(action: SignalDirection): string {
  switch (action) {
    case 'buy':
      return 'text-destructive'
    case 'sell':
    case 'escape':
      return 'text-success'
    case 'hold':
      return 'text-info'
    default:
      return 'text-muted-foreground'
  }
}
