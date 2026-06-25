import { create } from 'zustand'

export type CabinType = 'input' | 'analysis' | 'trading' | 'output' | 'command'

interface WorkflowState {
  activeCabin: CabinType
  setActiveCabin: (cabin: CabinType) => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  activeCabin: 'input',
  setActiveCabin: (cabin) => set({ activeCabin: cabin }),
}))

const CABIN_ORDER: CabinType[] = ['input', 'analysis', 'trading', 'output', 'command']

export function canSwitchCabin(from: CabinType, to: CabinType): boolean {
  const fromIndex = CABIN_ORDER.indexOf(from)
  const toIndex = CABIN_ORDER.indexOf(to)
  return toIndex <= fromIndex + 1
}
