import { Minimize2, Maximize2, Square } from 'lucide-react'
import { Tooltip } from '@/components/atoms/Tooltip'
import { useDensity, type DensityLevel } from './DensityContext'

const DENSITY_ICONS = {
  compact: <Minimize2 className="h-3.5 w-3.5" />,
  normal: <Square className="h-3.5 w-3.5" />,
  expanded: <Maximize2 className="h-3.5 w-3.5" />,
}

const DENSITY_LABELS: Record<DensityLevel, string> = {
  compact: '紧凑',
  normal: '标准',
  expanded: '宽松',
}

/**
 * DensityToggle
 */
export function DensityToggle(): React.JSX.Element {
  const { density, setDensity } = useDensity()

  return (
    <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
      {(Object.keys(DENSITY_ICONS) as DensityLevel[]).map((level) => (
        <Tooltip key={level} content={DENSITY_LABELS[level]} side="bottom">
          <button
            onClick={() => setDensity(level)}
            className={`p-1.5 rounded transition-colors ${density === level ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            aria-label={DENSITY_LABELS[level]}
            title={DENSITY_LABELS[level]}
          >
            {DENSITY_ICONS[level]}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}