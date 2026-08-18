import { useDensity, type DensityLevel } from '@/components/cockpit/DensityContext'
import { cn } from '@/lib/utils'

const OPTIONS: { level: DensityLevel; label: string; title: string }[] = [
  { level: 'compact', label: '紧凑', title: '紧凑密度' },
  { level: 'normal', label: '标准', title: '标准密度' },
  { level: 'expanded', label: '宽松', title: '宽松密度' },
]

/**
 * DensityToggle
 * 三段式密度切换控件：紧凑 / 标准 / 宽松。
 * 通过 DensityContext 读取当前密度并调用 setDensity 切换。
 */
export function DensityToggle(): React.JSX.Element {
  const { density, setDensity } = useDensity()

  return (
    <div
      role="group"
      aria-label="数据密度切换"
      className="bg-muted rounded-lg p-0.5 inline-flex"
    >
      {OPTIONS.map((opt) => {
        const active = density === opt.level
        return (
          <button
            key={opt.level}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => setDensity(opt.level)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default DensityToggle
