import { create } from 'zustand'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type CabinType = 'input' | 'analysis' | 'trading' | 'output' | 'command'

interface WorkflowState {
  activeCabin: CabinType
  setActiveCabin: (cabin: CabinType) => void
}

/**
 * 根据 URL hash 路径推导初始舱室，避免直接访问 /trading/* 时
 * PortalShell 首屏误渲染 InputApp 导致「交易舱未显示」假象。
 *
 * HashRouter 路径存储在 location.hash（如 '#/trading/holdings'），
 * 取第一个路径段匹配 CABIN_PREFIXES。无法识别时回退到 'input'。
 */
function inferInitialCabin(): CabinType {
  if (typeof window === 'undefined') return 'input'
  const hash = window.location.hash
  // 形如 '#/trading/holdings' → 取 '/trading'
  const match = hash.match(/^#?(\/[a-z]+)/i)
  if (!match) return 'input'
  const prefix = match[1]
  switch (prefix) {
    case '/input':
      return 'input'
    case '/analysis':
      return 'analysis'
    case '/trading':
      return 'trading'
    case '/output':
      return 'output'
    case '/command':
      return 'command'
    default:
      return 'input'
  }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  activeCabin: inferInitialCabin(),
  setActiveCabin: (cabin) => {
    const prev = get().activeCabin
    if (prev !== cabin) {
      logger.info('[WorkflowStore] activeCabin 切换', { from: prev, to: cabin })
    }
    set({ activeCabin: cabin })
  },
}))

const CABIN_ORDER: CabinType[] = ['input', 'analysis', 'trading', 'output', 'command']

export function canSwitchCabin(from: CabinType, to: CabinType): boolean {
  const fromIndex = CABIN_ORDER.indexOf(from)
  const toIndex = CABIN_ORDER.indexOf(to)
  return toIndex <= fromIndex + 1
}
