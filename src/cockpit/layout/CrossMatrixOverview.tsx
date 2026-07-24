/**
 * @module cockpit/layout/CrossMatrixOverview
 * @description 域×视角 热力矩阵总览
 *
 * 首屏渲染 4×4 矩阵，每个单元格显示对应交叉点的 Widget 数量。
 * 点击单元格跳转到该交叉点的 Widget 网格视图。
 *
 * 参照模式：IndustryHeatmap 的密度矩阵渲染（`src/components/chart/industry/IndustryHeatmap.tsx`）
 * 但不直接引用 IndustryHeatmap（数据结构不同），仅借鉴其视觉模式。
 */

import { cn } from '@/lib/utils'
import { COCKPIT_LAYOUT, COCKPIT_CROSS_DOMAINS, COCKPIT_CROSS_PERSPECTIVES } from '@/constants/cockpit.constants'
import type { WidgetDomain, WidgetPerspective } from '@/types/modules/widget.types'

// ============================================================
// 常量
// ============================================================

// 业务域/视角展示元数据统一从 cockpit.constants.ts 导入（COCKPIT_CROSS_DOMAINS / COCKPIT_CROSS_PERSPECTIVES），
// 与 CockpitCrossLayout 共用单一真相源，避免双处定义漂移

// ============================================================
// Props
// ============================================================

export interface CrossMatrixOverviewProps {
  /** 域×视角的 Widget 计数，key 格式: "domain:perspective" */
  matrixCounts: Map<string, number>
  /** 当前选中的域 */
  activeDomain: WidgetDomain
  /** 当前选中的视角 */
  activePerspective: WidgetPerspective
  /** 单元格点击回调 */
  onCellClick: (domain: WidgetDomain, perspective: WidgetPerspective) => void
}

// ============================================================
// 辅助函数
// ============================================================

/** 根据数量返回单元格颜色深度 */
function getCellIntensity(count: number): string {
  if (count === 0) return 'bg-muted/30 text-muted-foreground/50'
  if (count === 1) return 'bg-primary/20 text-foreground hover:bg-primary/30'
  if (count === 2) return 'bg-primary/40 text-foreground hover:bg-primary/50'
  return 'bg-primary/60 text-primary-foreground hover:bg-primary/70'
}

// ============================================================
// 组件
// ============================================================

/**
 * CrossMatrixOverview
 *
 * 4×4 热力矩阵，行=业务域，列=视角，单元格显示 Widget 数量
 */
export function CrossMatrixOverview({
  matrixCounts,
  activeDomain,
  activePerspective,
  onCellClick,
}: CrossMatrixOverviewProps) {
  const totalWidgets = Array.from(matrixCounts.values()).reduce((a, b) => a + b, 0)
  const activeCells = Array.from(matrixCounts.values()).filter((c) => c > 0).length

  return (
    <div className="mx-auto max-w-4xl">
      {/* 标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">矩阵总览</h2>
          <p className="text-sm text-muted-foreground">
            {totalWidgets} 个 Widget 分布在 {activeCells} 个交叉点 — 点击任意单元格进入详情
          </p>
        </div>
      </div>

      {/* 矩阵网格 */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `120px repeat(${COCKPIT_CROSS_PERSPECTIVES.length}, 1fr)`,
          gap: COCKPIT_LAYOUT.MATRIX_CELL_GAP,
        }}
      >
        {/* 表头行 */}
        <div />
        {COCKPIT_CROSS_PERSPECTIVES.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center justify-center rounded-md py-2 text-xs font-medium',
              activePerspective === p.id
                ? 'bg-primary/10 text-primary'
                : 'bg-muted/50 text-muted-foreground',
            )}
          >
            {p.label}
          </div>
        ))}

        {/* 数据行 */}
        {COCKPIT_CROSS_DOMAINS.map((domain) => (
          <FragmentRow
            key={domain.id}
            domain={domain}
            matrixCounts={matrixCounts}
            isActiveRow={activeDomain === domain.id}
            activePerspective={activePerspective}
            onCellClick={onCellClick}
          />
        ))}
      </div>

      {/* 图例 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span>密度：</span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-muted/30" /> 空
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-primary/20" /> 1
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-primary/40" /> 2
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-primary/60" /> 3+
        </span>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：矩阵行
// ============================================================

interface FragmentRowProps {
  domain: { id: WidgetDomain; label: string; icon: string }
  matrixCounts: Map<string, number>
  isActiveRow: boolean
  activePerspective: WidgetPerspective
  onCellClick: (domain: WidgetDomain, perspective: WidgetPerspective) => void
}

function FragmentRow({
  domain,
  matrixCounts,
  isActiveRow,
  activePerspective,
  onCellClick,
}: FragmentRowProps) {
  return (
    <>
      {/* 行标题 */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-3 text-xs font-medium',
          isActiveRow ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground',
        )}
      >
        <span>{domain.icon}</span>
        {domain.label}
      </div>

      {/* 单元格 */}
      {COCKPIT_CROSS_PERSPECTIVES.map((p) => {
        const key = `${domain.id}:${p.id}`
        const count = matrixCounts.get(key) || 0
        const isActiveCell = isActiveRow && activePerspective === p.id

        return (
          <button
            key={p.id}
            type="button"
            disabled={count === 0}
            aria-label={`${domain.label} × ${p.label}：${count} 个 Widget`}
            onClick={() => onCellClick(domain.id, p.id)}
            className={cn(
              'flex flex-col items-center justify-center rounded-md py-4 transition-all',
              getCellIntensity(count),
              isActiveCell && 'ring-2 ring-primary ring-offset-1',
              count > 0 && 'cursor-pointer',
            )}
          >
            <span className="text-lg font-bold">{count}</span>
            <span className="text-[10px]">{count === 0 ? '—' : 'Widget'}</span>
          </button>
        )
      })}
    </>
  )
}
