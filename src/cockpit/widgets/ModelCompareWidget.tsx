import React, { useState } from 'react'
import { Cpu, Scale } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, CompareDimension, ModelInfo } from '@/types/modules/widget.types'
import { LLM_MODEL_VERSIONS, SCORE_LEVELS } from '@/constants/cockpit.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

interface ModelCompareWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

/**
 * 根据评分从 SCORE_LEVELS 常量获取等级
 */
function getScoreLevel(score: number) {
  if (score >= SCORE_LEVELS.EXCELLENT.min) return SCORE_LEVELS.EXCELLENT
  if (score >= SCORE_LEVELS.GOOD.min) return SCORE_LEVELS.GOOD
  if (score >= SCORE_LEVELS.AVERAGE.min) return SCORE_LEVELS.AVERAGE
  if (score >= SCORE_LEVELS.POOR.min) return SCORE_LEVELS.POOR
  return SCORE_LEVELS.BAD
}

/**
 * AI 大模型（LLM）智能对比 Widget
 * @description 两套模型横向对比，包含指标卡、多维度量化对比块、风险提示与模型选择
 * @remarks 数据来自 MarketData.modelComparison；未来替换为真实多模型推理 API
 */
export default function ModelCompareWidget({ config, data }: ModelCompareWidgetProps): React.JSX.Element {
  const { data: marketData, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sourceData = data ?? marketData
  const comparison = sourceData.modelComparison

  const loading = !!loadingMap[config.instanceId]
  const error = errorMap[config.instanceId] ?? null
  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : comparison.dimensions.length === 0
        ? 'empty'
        : 'ready'

  const [leftModelId, setLeftModelId] = useState(comparison.leftModel.id || LLM_MODEL_VERSIONS.KAILLM_V2_1.id)
  const [rightModelId, setRightModelId] = useState(comparison.rightModel.id || LLM_MODEL_VERSIONS.BASELINE_V1_5.id)

  const modelOptions = Object.values(LLM_MODEL_VERSIONS)

  const renderModelCard = (model: ModelInfo, icon: React.ReactNode, bgStyle: React.CSSProperties) => {
    const level = getScoreLevel(model.score)
    return (
      <div className="rounded-lg border p-4" style={bgStyle}>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          {icon}
          <span className="text-xs">{model.name}</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold" style={{ color: level.color }}>
            {model.score}
          </span>
          <Badge variant="outline" className="text-xs" style={{ borderColor: level.color, color: level.color }}>
            {level.label}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">版本 {model.version}</div>
      </div>
    )
  }

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载模型对比…"
      emptyTitle="暂无模型对比数据"
      emptyDescription="当前未获取到 AI 大模型多维量化对比结果"
      skeleton={
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton variant="rect" className="h-28" />
            <Skeleton variant="rect" className="h-28" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="text" className="h-2 w-full" />
            ))}
          </div>
        </div>
      }
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto space-y-4">
        {/* 顶部模型指标卡 */}
        <div className="grid grid-cols-2 gap-4">
          {renderModelCard(comparison.leftModel, <Cpu className="h-4 w-4" />, { backgroundColor: `${COLOR_TOKENS.info.hex}80` })}
          {renderModelCard(comparison.rightModel, <Scale className="h-4 w-4" />, { backgroundColor: `${COLOR_TOKENS.warning.hex}80` })}
        </div>

        {/* 多维度量化对比 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">多维度量化对比</h4>
          <div className="space-y-3">
            {comparison.dimensions.map((dim: CompareDimension) => (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{dim.name}</span>
                  <span className="text-muted-foreground">权重 {(dim.weight * 100).toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{comparison.leftModel.name}</span>
                      <span>{dim.leftScore}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${COLOR_TOKENS.info.bgClass}`} style={{ width: `${dim.leftScore}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{comparison.rightModel.name}</span>
                      <span>{dim.rightScore}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${COLOR_TOKENS.warning.bgClass}`} style={{ width: `${dim.rightScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 风险提示 */}
        {comparison.riskHint && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <span className="font-semibold">风险提示：</span>
            {comparison.riskHint}
          </div>
        )}

        {/* 模型选择 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">选择模型 A</label>
            <Select value={leftModelId} onChange={(e) => setLeftModelId(e.target.value)}>
              {modelOptions.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">选择模型 B</label>
            <Select value={rightModelId} onChange={(e) => setRightModelId(e.target.value)}>
              {modelOptions.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </WidgetStateShell>
  )
}
