/**
 * @module SystemArchitectureDiagram
 * @description 系统架构可视化组件。
 *   - 通过 ArchitectureService 获取架构快照（分层节点、连接关系、V6 引擎层、Agent 节点）
 *   - 展示分层卡片（可展开/折叠模块列表）、层间连接箭头、V6 评分引擎层网格与已注册 Agent 网格
 *   - 颜色引用 COLOR_TOKENS，避免硬编码色值
 */

import React, { useEffect, useState, memo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  getArchitectureService,
  type ArchitectureSnapshot,
  type ArchitectureNode,
  type EngineLayerNode,
} from '@/services/system/architectureService'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const logger = getLogger()

// ============================================================
// 常量（零硬编码锚点）
// ============================================================

/** 折叠状态下默认展示的模块数量 */
const VISIBLE_MODULES_DEFAULT = 3
/** V6 引擎层网格列数 */
const ENGINE_LAYER_GRID_COLS = 4
/** 分层卡片左侧色条宽度（px） */
const COLOR_BAR_WIDTH_PX = 6
/** 权重百分比换算因子 */
const WEIGHT_PERCENTAGE_MULTIPLIER = 100

/** V6 引擎层网格样式（基于常量动态生成，避免 Tailwind 动态类名失效） */
const ENGINE_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: `repeat(${ENGINE_LAYER_GRID_COLS}, minmax(0, 1fr))`,
}

/** 分层状态 → Badge 标签与样式映射 */
const STATUS_MAP: Record<
  ArchitectureNode['status'],
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  healthy: { label: '正常', variant: 'success' },
  warning: { label: '预警', variant: 'warning' },
  critical: { label: '异常', variant: 'destructive' },
  unknown: { label: '未知', variant: 'secondary' },
}

// ============================================================
// 纯函数工具
// ============================================================

/**
 * 在连接列表中查找 from→to 的连接标签。
 * @param connections 架构快照中的连接关系数组
 * @param fromId 起始分层 ID
 * @param toId 目标分层 ID
 * @returns 命中返回标签文本，未命中返回 undefined
 */
function findConnectionLabel(
  connections: ArchitectureSnapshot['connections'],
  fromId: string,
  toId: string,
): string | undefined {
  return connections.find((c) => c.from === fromId && c.to === toId)?.label
}

/**
 * 解析 V6 引擎层的语义颜色（确定性 → 绿，LLM 可增强 → 紫）。
 * @param layer 引擎层节点
 * @returns 包含 hex 与 bgClass 的颜色描述对象
 */
function resolveEngineLayerColor(layer: EngineLayerNode): {
  hex: string
  bgClass: string
} {
  if (layer.deterministic) {
    return { hex: COLOR_TOKENS.success.hex, bgClass: COLOR_TOKENS.success.bgClass }
  }
  return { hex: COLOR_TOKENS.purple.hex, bgClass: COLOR_TOKENS.purple.bgClass }
}

/**
 * 将 Agent 状态字符串映射为 Badge variant。
 * @param status Agent 状态（active / idle / error / warning / ...）
 * @returns Badge variant 值
 */
function getAgentStatusVariant(
  status: string,
): 'success' | 'secondary' | 'destructive' | 'warning' {
  switch (status) {
    case 'active':
    case 'healthy':
      return 'success'
    case 'idle':
      return 'secondary'
    case 'error':
    case 'critical':
      return 'destructive'
    case 'warning':
      return 'warning'
    default:
      return 'secondary'
  }
}

// ============================================================
// 子组件：层间连接箭头
// ============================================================

interface ConnectionArrowProps {
  connections: ArchitectureSnapshot['connections']
  fromId: string
  toId: string
}

const ConnectionArrow = memo(function ConnectionArrow({
  connections,
  fromId,
  toId,
}: ConnectionArrowProps): React.JSX.Element {
  const label = findConnectionLabel(connections, fromId, toId)
  return (
    <div className="flex items-center justify-center py-1">
      <span className="text-base text-muted-foreground">↓</span>
      {label != null ? (
        <span className="ml-2 text-xs text-muted-foreground">{label}</span>
      ) : null}
    </div>
  )
})

ConnectionArrow.displayName = 'ConnectionArrow'

// ============================================================
// 主组件
// ============================================================

function SystemArchitectureDiagram(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<ArchitectureSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)

  // 挂载时拉取架构快照，使用 mounted 标志防止卸载后更新状态
  useEffect(() => {
    let mounted = true

    logger.info('[SystemArchitectureDiagram] mounted, fetching architecture snapshot')

    const fetchSnapshot = (): void => {
      try {
        const result = getArchitectureService().getArchitectureSnapshot()
        if (mounted) {
          setSnapshot(result)
          setIsLoading(false)
          logger.info('[SystemArchitectureDiagram] snapshot loaded', {
            layerCount: result.layers.length,
            engineLayerCount: result.engineLayers.length,
            agentCount: result.agentNodes.length,
          })
        }
      } catch (err) {
        if (mounted) {
          setIsLoading(false)
          logger.error('[SystemArchitectureDiagram] failed to load snapshot', { error: err })
        }
      }
    }

    fetchSnapshot()

    return () => {
      mounted = false
      logger.info('[SystemArchitectureDiagram] unmounted, cleanup flag set')
    }
  }, [])

  /** 点击分层卡片：切换展开/折叠状态 */
  const handleLayerClick = (layerId: string): void => {
    setSelectedLayerId((prev) => (prev === layerId ? null : layerId))
  }

  // 加载态：正在加载且尚无快照数据
  if (isLoading && !snapshot) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">系统架构可视化</CardTitle>
          <Badge variant="secondary">加载中</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载架构数据...</p>
        </CardContent>
      </Card>
    )
  }

  // 空快照兜底（加载失败或无数据）
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">系统架构可视化</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无架构数据</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">系统架构可视化</CardTitle>
        <Badge variant="secondary">{snapshot.layers.length} 个分层</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ==================================================== */}
        {/* 架构分层 */}
        {/* ==================================================== */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">系统分层架构</p>
          <div className="space-y-1">
            {snapshot.layers.map((layer, index) => {
              const statusMeta = STATUS_MAP[layer.status]
              const isExpanded = selectedLayerId === layer.id
              const visibleModules = isExpanded
                ? layer.modules
                : layer.modules.slice(0, VISIBLE_MODULES_DEFAULT)
              const remainingCount = layer.modules.length - VISIBLE_MODULES_DEFAULT
              const showMoreHint = !isExpanded && remainingCount > 0
              const nextLayer = snapshot.layers[index + 1]

              return (
                <React.Fragment key={layer.id}>
                  <div
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent',
                      COLOR_TOKENS.border.tailwind,
                      isExpanded && 'bg-accent',
                    )}
                    onClick={() => handleLayerClick(layer.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleLayerClick(layer.id)
                      }
                    }}
                  >
                    {/* 左侧色条 */}
                    <div
                      className="flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: layer.color,
                        width: COLOR_BAR_WIDTH_PX,
                      }}
                    />

                    {/* 右侧内容 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{layer.name}</span>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                          <Badge variant="secondary">{layer.moduleCount} 个模块</Badge>
                        </div>
                        <span className="flex-shrink-0 text-xs text-muted-foreground">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{layer.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {visibleModules.map((mod) => (
                          <span
                            key={mod}
                            className="rounded bg-muted px-2 py-0.5 text-xs"
                          >
                            {mod}
                          </span>
                        ))}
                        {showMoreHint ? (
                          <span className="px-1 py-0.5 text-xs text-muted-foreground">
                            +{remainingCount} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* 层间连接箭头（最后一层不显示） */}
                  {nextLayer ? (
                    <ConnectionArrow
                      connections={snapshot.connections}
                      fromId={layer.id}
                      toId={nextLayer.id}
                    />
                  ) : null}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* V6 评分引擎层 */}
        {/* ==================================================== */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">V6 评分引擎层</p>
          <div className="grid gap-2" style={ENGINE_GRID_STYLE}>
            {snapshot.engineLayers.map((layer) => {
              const colorMeta = resolveEngineLayerColor(layer)
              return (
                <div
                  key={layer.id}
                  className="rounded-lg border p-2"
                  style={{ borderColor: colorMeta.hex }}
                >
                  <p className="truncate text-xs font-medium">{layer.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {Math.round(layer.weight * WEIGHT_PERCENTAGE_MULTIPLIER)}%
                    </Badge>
                    {layer.deterministic ? (
                      <Badge
                        variant="outline"
                        className={cn('border-transparent text-white', colorMeta.bgClass)}
                      >
                        确定性
                      </Badge>
                    ) : layer.llmEnhanceable ? (
                      <Badge
                        variant="outline"
                        className={cn('border-transparent text-white', colorMeta.bgClass)}
                      >
                        大模型增强
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 已注册智能体 */}
        {/* ==================================================== */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            已注册智能体（{snapshot.agentNodes.length}）
          </p>
          {snapshot.agentNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无已注册智能体</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {snapshot.agentNodes.map((agent) => (
                <div
                  key={agent.id}
                  className={cn('rounded-lg border p-2', COLOR_TOKENS.border.tailwind)}
                >
                  <p className="truncate text-xs font-medium">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{agent.id}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge variant={getAgentStatusVariant(agent.status)}>
                      {agent.status}
                    </Badge>
                    <Badge variant="outline">{agent.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

SystemArchitectureDiagram.displayName = 'SystemArchitectureDiagram'

export default memo(SystemArchitectureDiagram)
