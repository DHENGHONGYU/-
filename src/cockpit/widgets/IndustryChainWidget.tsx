/**
 * IndustryChainWidget — 产业链图谱 Widget
 *
 * 轻量 SVG 关系图谱，基于 INDUSTRY_CHAIN 数据，
 * 展示行业上下游关系（只读可视化）。
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { INDUSTRY_CHAIN } from '@/services/analysis/industryChainData'
import {
  INDUSTRY_CHAIN_EDGE_COLORS,
  INDUSTRY_CHAIN_NODE_COLORS,
  INDUSTRY_CHAIN_LABEL_COLOR,
} from '@/config/chartColors'

// ============================================================
// 布局常量
// ============================================================

const SVG_W = 680
const SVG_H = 480
const NODE_RADIUS = 26

const COLUMN_X: Record<string, number> = {
  upstream: 80,
  midstream: 240,
  downstream: 420,
  horizontal: 580,
}

const EDGE_COLORS: Record<string, string> = {
  supply: INDUSTRY_CHAIN_EDGE_COLORS.supply,
  competition: INDUSTRY_CHAIN_EDGE_COLORS.competition,
  synergy: INDUSTRY_CHAIN_EDGE_COLORS.synergy,
  substitute: INDUSTRY_CHAIN_EDGE_COLORS.substitute,
}

const EDGE_LABELS: Record<string, string> = {
  supply: '供应',
  competition: '竞争',
  synergy: '协同',
  substitute: '替代',
}

const POSITION_LABELS: Record<string, string> = {
  upstream: '上游',
  midstream: '中游',
  downstream: '下游',
  horizontal: '横向',
}

// ============================================================
// 布局计算
// ============================================================

function computeLayout() {
  const counts: Record<string, number> = { upstream: 0, midstream: 0, downstream: 0, horizontal: 0 }

  const positioned = INDUSTRY_CHAIN.nodes.map((node) => {
    const pos = node.chainPosition
    counts[pos] = (counts[pos] ?? 0) + 1
    const idx = counts[pos] - 1
    const total = INDUSTRY_CHAIN.nodes.filter((n) => n.chainPosition === pos).length
    const spacing = Math.min(56, (SVG_H - 80) / Math.max(total, 1))
    const y = 40 + idx * spacing
    return { ...node, x: COLUMN_X[pos] ?? 200, y }
  })

  return { nodes: positioned, edges: INDUSTRY_CHAIN.edges }
}

// ============================================================
// Component
// ============================================================

/**
 * 产业链图谱可视化组件
 * @returns JSX 元素
/**
 * 产业链图谱可视化组件
 * @returns 产业链 SVG 关系图
 */
export function IndustryChainWidget(): React.JSX.Element {
  const layout = useMemo(() => computeLayout(), [])

  const nodeMap = useMemo(() => {
    const map = new Map<string, (typeof layout.nodes)[0]>()
    for (const n of layout.nodes) map.set(n.id, n)
    return map
  }, [layout])

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">产业链图谱</CardTitle>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            {Object.entries(EDGE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <span className="inline-block h-[2px] w-3" style={{ backgroundColor: EDGE_COLORS[key] }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ maxHeight: SVG_H }}>
          {/* 列标签 */}
          {Object.entries(POSITION_LABELS).map(([pos, label]) => (
            <text key={pos} x={COLUMN_X[pos] ?? 200} y={20} textAnchor="middle" fill={INDUSTRY_CHAIN_LABEL_COLOR} fontSize="12" fontFamily="sans-serif">
              {label}
            </text>
          ))}

          {/* 边 */}
          {layout.edges.map((edge, i) => {
            const source = nodeMap.get(edge.source)
            const target = nodeMap.get(edge.target)
            if (!source || !target) return null

            const dx = target.x - source.x
            const dy = target.y - source.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1

            return (
              <line
                key={`edge-${i}`}
                x1={source.x + dx * (NODE_RADIUS / dist)}
                y1={source.y + dy * (NODE_RADIUS / dist)}
                x2={target.x - dx * (NODE_RADIUS / dist)}
                y2={target.y - dy * (NODE_RADIUS / dist)}
                stroke={EDGE_COLORS[edge.relation] ?? INDUSTRY_CHAIN_EDGE_COLORS.fallback}
                strokeWidth={1}
                strokeDasharray={edge.relation === 'synergy' ? '4,3' : undefined}
                opacity={0.5}
              />
            )
          })}

          {/* 节点 */}
          {layout.nodes.map((node) => (
            <g key={node.id}>
              {/* SVG title 用于 tooltip */}
              <title>{node.name} — {node.keywords.join(', ')}</title>
              <circle cx={node.x} cy={node.y} r={NODE_RADIUS} fill={INDUSTRY_CHAIN_NODE_COLORS.fill} stroke={INDUSTRY_CHAIN_NODE_COLORS.stroke} strokeWidth={1.5} />
              <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fill={INDUSTRY_CHAIN_NODE_COLORS.text} fontSize="10" fontFamily="sans-serif" fontWeight="bold">
                {node.id}
              </text>
              <text x={node.x} y={node.y + NODE_RADIUS + 14} textAnchor="middle" fill={INDUSTRY_CHAIN_NODE_COLORS.name} fontSize="9" fontFamily="sans-serif">
                {node.name}
              </text>
            </g>
          ))}
        </svg>

        {/* 示例标的 */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">相关标的</span>
          {layout.nodes.filter((n) => n.exampleStocks.length > 0).slice(0, 6).map((n) => (
            <Badge key={n.id} variant="secondary" className="text-[10px]">
              {n.name}: {n.exampleStocks.map((s) => s.name).join(', ')}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default IndustryChainWidget
