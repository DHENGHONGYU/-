/**
 * 资金管理双轨面板
 *
 * 展示 30% 耐心资本 / 70% 博收益的双轨配置可视化，
 * 包括分仓比例、KPI 考核指标、大跌应对纪律。
 *
 * 设计哲学：资金如兵力——不能平均分散，集中优势兵力在核心赛道。
 *
 * @doc 资金管理与交易纪律框架（见 docs/specs/02-functional-specs.md §2.4.18）
 */

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { DEFAULT_CAPITAL_ALLOCATION_CONFIG, type CapitalAllocationConfig } from '@/config/capitalAllocationConfig'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

export interface CapitalAllocationPanelProps {
  /** 资金配置，默认使用 DEFAULT_CAPITAL_ALLOCATION_CONFIG */
  config?: CapitalAllocationConfig
  /** 耐心资本当前实际占比（0-1），用于对比目标 */
  patientCapitalActualPct?: number
  /** 博收益当前实际占比（0-1） */
  betaYieldActualPct?: number
  /** KPI 指标当前值（可选，不传则只展示目标线） */
  kpiActual?: {
    annualReturn?: number
    quarterlyReturn?: number
    monthlyWinRate?: number
    disciplineRate?: number
  }
  className?: string
}

/** 格式化百分比 */
function fmtPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

/** 格式化带符号百分比 */
function fmtSignedPct(value: number, digits = 1): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(digits)}%`
}

/** KPI 达标状态 */
function getKpiStatus(actual: number | undefined, min: number, excellent: number): {
  status: 'none' | 'fail' | 'pass' | 'excellent'
  label: string
} {
  if (actual === undefined) return { status: 'none', label: '—' }
  if (actual >= excellent) return { status: 'excellent', label: '优秀' }
  if (actual >= min) return { status: 'pass', label: '合格' }
  return { status: 'fail', label: '未达标' }
}

const STATUS_COLOR: Record<string, string> = {
  none: 'text-muted-foreground',
  fail: COLOR_TOKENS.danger.tailwind,
  pass: COLOR_TOKENS.success.tailwind,
  excellent: COLOR_TOKENS.scoreHigh?.tailwind ?? COLOR_TOKENS.success.tailwind,
}

/**
 * 资金管理双轨面板
 */
export const CapitalAllocationPanel = memo(function CapitalAllocationPanel({
  config = DEFAULT_CAPITAL_ALLOCATION_CONFIG,
  patientCapitalActualPct,
  betaYieldActualPct,
  kpiActual,
  className,
}: CapitalAllocationPanelProps) {
  const { betaYieldKpi: kpi, drawdownDiscipline: dd } = config

  // KPI 达标状态计算
  const annualStatus = getKpiStatus(kpiActual?.annualReturn, kpi.annualReturnMin, kpi.annualReturnExcellent)
  const quarterlyStatus = getKpiStatus(kpiActual?.quarterlyReturn, kpi.quarterlyReturnMin, kpi.quarterlyReturnExcellent)
  const winRateStatus = getKpiStatus(kpiActual?.monthlyWinRate, kpi.monthlyWinRateMin, kpi.monthlyWinRateExcellent)
  const disciplineStatus = getKpiStatus(kpiActual?.disciplineRate, kpi.disciplineRateMin, kpi.disciplineRateExcellent)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>资金管理双轨配置</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          资金如兵力——集中优势兵力在核心赛道，30% 铆住 + 70% 博收益
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 分仓比例可视化 */}
        <div className="space-y-2">
          <div className="text-sm font-medium">分仓比例</div>
          <div className="flex h-8 w-full overflow-hidden rounded-md">
            <div
              className="flex items-center justify-center text-xs font-medium text-white"
              style={{
                width: `${config.patientCapitalPct * 100}%`,
                backgroundColor: getColorHexSafe('scoreHigh'),
              }}
            >
              耐心资本 {fmtPct(config.patientCapitalPct, 0)}
            </div>
            <div
              className="flex items-center justify-center text-xs font-medium text-white"
              style={{
                width: `${config.betaYieldPct * 100}%`,
                backgroundColor: getColorHexSafe('primary'),
              }}
            >
              博收益 {fmtPct(config.betaYieldPct, 0)}
            </div>
          </div>
          {/* 实际占比对比 */}
          {(patientCapitalActualPct !== undefined || betaYieldActualPct !== undefined) && (
            <div className="flex h-4 w-full overflow-hidden rounded-sm opacity-60">
              <div
                className="flex items-center justify-center text-[10px]"
                style={{ width: `${(patientCapitalActualPct ?? 0) * 100}%` }}
              >
                实际 {fmtPct(patientCapitalActualPct ?? 0, 0)}
              </div>
              <div
                className="flex items-center justify-center text-[10px]"
                style={{ width: `${(betaYieldActualPct ?? 0) * 100}%` }}
              >
                实际 {fmtPct(betaYieldActualPct ?? 0, 0)}
              </div>
            </div>
          )}
        </div>

        {/* 耐心资本信息 */}
        <div className="rounded-md border p-3 space-y-1">
          <div className="text-sm font-medium" style={{ color: getColorHexSafe('scoreHigh') }}>
            耐心资本（铆住不卖）
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>投资周期：{config.patientCapitalHorizonYears} 年</span>
            <span>目标收益：{(config.patientCapitalTargetReturnMin - 1) * 100}%-{(config.patientCapitalTargetReturnMax - 1) * 100}%</span>
            <span className="col-span-2">纪律：逢大跌加仓，不止损，2-3 年为周期持有</span>
          </div>
        </div>

        {/* 博收益 KPI 考核 */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="text-sm font-medium" style={{ color: getColorHexSafe('primary') }}>
            博收益 KPI 考核
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <KpiRow
              label="年化收益率"
              target={`≥ ${fmtPct(kpi.annualReturnMin)} / ${fmtPct(kpi.annualReturnExcellent)}`}
              actual={kpiActual?.annualReturn !== undefined ? fmtSignedPct(kpiActual.annualReturn) : undefined}
              status={annualStatus}
            />
            <KpiRow
              label="季度收益率"
              target={`≥ ${fmtPct(kpi.quarterlyReturnMin)} / ${fmtPct(kpi.quarterlyReturnExcellent)}`}
              actual={kpiActual?.quarterlyReturn !== undefined ? fmtSignedPct(kpiActual.quarterlyReturn) : undefined}
              status={quarterlyStatus}
            />
            <KpiRow
              label="月度胜率"
              target={`≥ ${fmtPct(kpi.monthlyWinRateMin)} / ${fmtPct(kpi.monthlyWinRateExcellent)}`}
              actual={kpiActual?.monthlyWinRate !== undefined ? fmtPct(kpiActual.monthlyWinRate) : undefined}
              status={winRateStatus}
            />
            <KpiRow
              label="纪律执行率"
              target={`≥ ${fmtPct(kpi.disciplineRateMin)} / ${fmtPct(kpi.disciplineRateExcellent)}`}
              actual={kpiActual?.disciplineRate !== undefined ? fmtPct(kpiActual.disciplineRate) : undefined}
              status={disciplineStatus}
            />
            <div className="col-span-2 flex gap-4 text-muted-foreground">
              <span>单笔止盈：+{fmtPct(kpi.singleTakeProfit, 0)}</span>
              <span>单笔止损：{fmtPct(kpi.singleStopLoss, 0)}</span>
            </div>
          </div>
        </div>

        {/* 大跌应对纪律 */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="text-sm font-medium">大跌应对纪律</div>
          <div className="space-y-1 text-xs">
            <DrawdownRow
              label="个股小跌"
              range={`>${fmtPct(dd.individualMildDrawdown, 0)}`}
              patientAction="继续持有"
              betaAction="止损卖出"
            />
            <DrawdownRow
              label="个股中跌"
              range={`${fmtPct(dd.individualModerateDrawdown, 0)} ~ ${fmtPct(dd.individualMildDrawdown, 0)}`}
              patientAction="分批加仓"
              betaAction="已离场观望"
            />
            <DrawdownRow
              label="个股大跌"
              range={`<${fmtPct(dd.individualSevereDrawdown, 0)}`}
              patientAction="继续加仓，铆住不卖"
              betaAction="等待企稳"
            />
            <DrawdownRow
              label="大盘大跌"
              range={`>${fmtPct(dd.marketSystemicDrawdown, 0)}`}
              patientAction="加仓核心稀缺"
              betaAction={`降仓至 ${fmtPct(dd.betaYieldReducePositionTo, 0)}`}
            />
            <DrawdownRow
              label="大盘暴跌"
              range={`>${fmtPct(dd.marketCrashDrawdown, 0)}`}
              patientAction="满仓核心稀缺"
              betaAction="清仓防守"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

/** KPI 行 */
function KpiRow({
  label,
  target,
  actual,
  status,
}: {
  label: string
  target: string
  actual?: string
  status: { status: string; label: string }
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${STATUS_COLOR[status.status] ?? ''}`}>
          {actual ?? '—'} {status.label !== '—' && `(${status.label})`}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground">目标：{target}</span>
    </div>
  )
}

/** 大跌应对行 */
function DrawdownRow({
  label,
  range,
  patientAction,
  betaAction,
}: {
  label: string
  range: string
  patientAction: string
  betaAction: string
}) {
  return (
    <div className="grid grid-cols-[80px_80px_1fr_1fr] items-center gap-1">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{range}</span>
      <span>
        <span className="text-muted-foreground">耐心：</span>
        <span style={{ color: getColorHexSafe('scoreHigh') }}>{patientAction}</span>
      </span>
      <span>
        <span className="text-muted-foreground">博收益：</span>
        <span style={{ color: getColorHexSafe('danger') }}>{betaAction}</span>
      </span>
    </div>
  )
}

/** 安全获取颜色 hex（避免 undefined 报错）
 * 注：COLOR_TOKENS 不含 `primary`（该语义色已迁至 SEMANTIC_COLOR_ROLES），
 * 故 'primary' 取不到时直接回退到 info 等价 hex，避免对已重构令牌的硬依赖。 */
function getColorHexSafe(key: string): string {
  const token = (COLOR_TOKENS as Record<string, { hex?: string }>)[key]
  return token?.hex ?? COLOR_TOKENS.info.hex
}
