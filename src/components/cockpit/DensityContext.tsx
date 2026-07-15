import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createStorage } from '@/lib/localStorageManager'

export type DensityLevel = 'compact' | 'normal' | 'expanded'

export interface DensityConfig {
  level: DensityLevel
  rowHeight: number
  fontSize: string
  spacing: string
  padding: string
}

export const DENSITY_PRESETS: Record<DensityLevel, DensityConfig> = {
  compact: {
    level: 'compact',
    rowHeight: 36,
    fontSize: 'text-xs',
    spacing: 'gap-1',
    padding: 'p-2',
  },
  normal: {
    level: 'normal',
    rowHeight: 44,
    fontSize: 'text-sm',
    spacing: 'gap-2',
    padding: 'p-3',
  },
  expanded: {
    level: 'expanded',
    rowHeight: 56,
    fontSize: 'text-base',
    spacing: 'gap-3',
    padding: 'p-4',
  },
}

interface DensityContextType {
  density: DensityLevel
  config: DensityConfig
  setDensity: (level: DensityLevel) => void
  toggleDensity: () => void
}

const DensityContext = createContext<DensityContextType | null>(null)

const storage = createStorage('density')

export function DensityProvider({ children, defaultDensity = 'normal' }: { children: ReactNode; defaultDensity?: DensityLevel }): React.JSX.Element {
  const [density, setDensityState] = useState<DensityLevel>(() => {
    const saved = storage.get<DensityLevel>('user-preference')
    return saved ?? defaultDensity
  })

  const setDensity = useCallback((level: DensityLevel) => {
    setDensityState(level)
    void storage.set('user-preference', level)
  }, [])

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => {
      let nextLevel: DensityLevel
      switch (prev) {
        case 'compact':
          nextLevel = 'normal'
          break
        case 'normal':
          nextLevel = 'expanded'
          break
        case 'expanded':
          nextLevel = 'compact'
          break
        default:
          nextLevel = 'normal'
      }
      void storage.set('user-preference', nextLevel)
      return nextLevel
    })
  }, [])

  const config = DENSITY_PRESETS[density]

  return (
    <DensityContext.Provider value={{ density, config, setDensity, toggleDensity }}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity(): DensityContextType {
  const context = useContext(DensityContext)
  if (!context) {
    throw new Error('useDensity must be used within a DensityProvider')
  }
  return context
}

export function useDensityConfig(): DensityConfig {
  return useDensity().config
}

export function useDensityClass(): string {
  const { density } = useDensity()
  return `density-${density}`
}