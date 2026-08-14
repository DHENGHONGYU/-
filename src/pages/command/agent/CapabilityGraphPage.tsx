import React, { useState, useRef } from 'react'
import {
  Box as CubeTransparentIcon,
  Link as LinkIcon,
  Search as MagnifyingGlassIcon,
  Maximize2 as ArrowsPointingOutIcon,
} from 'lucide-react'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'

/**
 * 智能体节点接口
 */
interface AgentNode {
  id: string
  name: string
  type: 'analysis' | 'trading' | 'risk' | 'data' | 'custom'
  capabilities: string[]
  x: number
  y: number
}

/**
 * 能力边接口
 */
interface CapabilityEdge {
  source: string
  target: string
  capability: string
  strength: number // 0-1，表示依赖强度
}

/**
 * 能力图谱页面
 * 
 * @component
 * @remarks
 * 功能：
 * - 可视化智能体能力依赖关系
 * - 展示智能体节点和能力边
 * - 支持缩放、拖拽、搜索
 * - 显示能力详细信息
 */
const CapabilityGraphPage: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [agents] = useState<AgentNode[]>([
    { id: 'agent-001', name: '技术指标分析', type: 'analysis', capabilities: ['technical-analysis', 'indicator-calculation'], x: 100, y: 100 },
    { id: 'agent-002', name: '风险管理', type: 'risk', capabilities: ['risk-monitoring', 'alert-generation'], x: 300, y: 150 },
    { id: 'agent-003', name: '数据获取', type: 'data', capabilities: ['data-fetching', 'data-cleaning'], x: 200, y: 300 },
    { id: 'agent-004', name: '交易执行', type: 'trading', capabilities: ['trading-signal', 'order-execution'], x: 400, y: 250 },
    { id: 'agent-005', name: '报告生成', type: 'custom', capabilities: ['report-generation', 'visualization'], x: 150, y: 450 },
  ])

  const [edges] = useState<CapabilityEdge[]>([
    { source: 'agent-001', target: 'agent-004', capability: 'trading-signal', strength: 0.8 },
    { source: 'agent-003', target: 'agent-001', capability: 'data-fetching', strength: 0.9 },
    { source: 'agent-001', target: 'agent-002', capability: 'risk-monitoring', strength: 0.6 },
    { source: 'agent-004', target: 'agent-002', capability: 'risk-monitoring', strength: 0.7 },
    { source: 'agent-001', target: 'agent-005', capability: 'report-generation', strength: 0.5 },
    { source: 'agent-002', target: 'agent-005', capability: 'report-generation', strength: 0.6 },
  ])

  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<CapabilityEdge | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)

  /**
   * 获取智能体类型颜色（语义令牌类名，配合 SVG stroke="currentColor" / fill="currentColor" 使用）
   */
  const getTypeColor = (type: AgentNode['type']) => {
    switch (type) {
      case 'analysis': return 'text-info'
      case 'trading': return 'text-destructive'
      case 'risk': return 'text-destructive'
      case 'data': return 'text-warning'
      case 'custom': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  /**
   * 处理节点点击
   */
  const handleNodeClick = (agent: AgentNode) => {
    setSelectedNode(agent)
    setSelectedEdge(null)
  }

  /**
   * 处理边点击
   */
  const handleEdgeClick = (edge: CapabilityEdge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }

  /**
   * 缩放控制
   */
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  /**
   * 过滤智能体（搜索功能）
   */
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="智能体能力图谱"
        description="可视化智能体之间的能力依赖关系"
      />

      {/* 控制栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          {/* 搜索框 */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-tertiary" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索智能体或能力..."
              className="pl-10 pr-4 py-2 rounded-lg"
            />
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleZoomOut}
              className="p-2 rounded hover:opacity-90 transition-opacity"
              title="缩小"
            >
              -
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              variant="secondary"
              onClick={handleZoomIn}
              className="p-2 rounded hover:opacity-90 transition-opacity"
              title="放大"
            >
              +
            </Button>
            <Button
              variant="secondary"
              onClick={handleResetZoom}
              className="p-2 rounded hover:opacity-90 transition-opacity"
              title="重置"
            >
              <ArrowsPointingOutIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="text-sm text-tertiary">
          共 {agents.length} 个智能体，{edges.length} 条能力边
        </div>
      </div>

      <div className="flex gap-6">
        {/* 图谱可视化区域 */}
        <div className={`flex-1 ${'bg-card'} rounded-lg shadow-sm border ${'border-border'} p-6`}>
          <svg
            ref={svgRef}
            width="100%"
            height="600"
            className="border border-border rounded"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
          >
            {/* 绘制边 */}
            {edges.map((edge, index) => {
              const sourceAgent = agents.find(a => a.id === edge.source)
              const targetAgent = agents.find(a => a.id === edge.target)
              if (!sourceAgent || !targetAgent) return null

              const isHighlighted = selectedEdge?.source === edge.source && selectedEdge.target === edge.target

              return (
                <g key={index} onClick={() => handleEdgeClick(edge)} style={{ cursor: 'pointer' }}>
                  <line
                    x1={sourceAgent.x}
                    y1={sourceAgent.y}
                    x2={targetAgent.x}
                    y2={targetAgent.y}
                    className={isHighlighted ? 'text-destructive' : 'text-muted-foreground'}
                    stroke="currentColor"
                    strokeWidth={isHighlighted ? 3 : 2}
                    strokeOpacity={isHighlighted ? 1 : 0.5}
                  />
                  {/* 能力标签 */}
                  <text
                    x={(sourceAgent.x + targetAgent.x) / 2}
                    y={(sourceAgent.y + targetAgent.y) / 2 - 10}
                    textAnchor="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {edge.capability}
                  </text>
                </g>
              )
            })}

            {/* 绘制节点 */}
            {filteredAgents.map(agent => {
              const isSelected = selectedNode?.id === agent.id

              return (
                <g
                  key={agent.id}
                  onClick={() => handleNodeClick(agent)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* 节点圆圈 */}
                  <circle
                    cx={agent.x}
                    cy={agent.y}
                    r={isSelected ? 35 : 30}
                    className={getTypeColor(agent.type)}
                    fill="currentColor"
                    fillOpacity={isSelected ? 0.3 : 0.2}
                    stroke="currentColor"
                    strokeWidth={isSelected ? 3 : 2}
                  />

                  {/* 智能体图标 */}
                  <CubeTransparentIcon
                    x={agent.x - 12}
                    y={agent.y - 12}
                    width={24}
                    height={24}
                    className="text-foreground"
                  />

                  {/* 智能体名称 */}
                  <text
                    x={agent.x}
                    y={agent.y + 50}
                    textAnchor="middle"
                    className={`text-sm font-medium ${'text-foreground'}`}
                  >
                    {agent.name}
                  </text>

                  {/* 能力数量标记 */}
                  <text
                    x={agent.x + 20}
                    y={agent.y - 20}
                    textAnchor="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {agent.capabilities.length}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 详细信息面板 */}
        <div className={`w-80 ${'bg-card'} rounded-lg shadow-sm border ${'border-border'} p-6`}>
          <h3 className={`text-h3 font-semibold ${'text-foreground'} mb-4`}>
            详细信息
          </h3>

          {selectedNode ? (
            <div>
              <h4 className={`text-h3 font-medium ${'text-foreground'} mb-2`}>
                {selectedNode.name}
              </h4>
              <div className="space-y-3">
                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>类型</span>
                  <p className={'text-foreground'}>
                    {selectedNode.type === 'analysis' ? '分析' :
                     selectedNode.type === 'trading' ? '交易' :
                     selectedNode.type === 'risk' ? '风险' :
                     selectedNode.type === 'data' ? '数据' : '自定义'}
                  </p>
                </div>

                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>能力列表</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.capabilities.map(cap => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="text-xs"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>位置</span>
                  <p className={'text-foreground'}>
                    ({selectedNode.x}, {selectedNode.y})
                  </p>
                </div>

                {/* 关联边 */}
                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>关联能力边</span>
                  <div className="space-y-2 mt-1">
                    {edges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge, index) => {
                        const otherAgentId = edge.source === selectedNode.id ? edge.target : edge.source
                        const otherAgent = agents.find(a => a.id === otherAgentId)
                        return (
                          <div key={index} className={`p-2 ${'bg-muted'} rounded text-sm`}>
                            <div className="flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" />
                              <span>{otherAgent?.name ?? otherAgentId}</span>
                            </div>
                            <div className="text-xs text-tertiary mt-1">
                              能力: {edge.capability}, 强度: {Math.round(edge.strength * 100)}%
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          ) : selectedEdge ? (
            <div>
              <h4 className={`text-h3 font-medium ${'text-foreground'} mb-2`}>
                能力边详情
              </h4>
              <div className="space-y-3">
                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>源智能体</span>
                  <p className={'text-foreground'}>
                    {agents.find(a => a.id === selectedEdge.source)?.name ?? selectedEdge.source}
                  </p>
                </div>

                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>目标智能体</span>
                  <p className={'text-foreground'}>
                    {agents.find(a => a.id === selectedEdge.target)?.name ?? selectedEdge.target}
                  </p>
                </div>

                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>能力</span>
                  <p className={'text-foreground'}>{selectedEdge.capability}</p>
                </div>

                <div>
                  <span className={`text-sm ${'text-tertiary'}`}>依赖强度</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`${'bg-destructive'} h-2 rounded-full`}
                        style={{ width: `${selectedEdge.strength * 100}%` }}
                      />
                    </div>
                    <span className="text-sm">{Math.round(selectedEdge.strength * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-center ${'text-tertiary'} py-8`}>
              <CubeTransparentIcon className="w-12 h-12 mx-auto mb-4 text-tertiary" />
              <p>点击图谱中的节点或边查看详细信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 图例 */}
      <div className={`mt-6 ${'bg-card'} rounded-lg shadow-sm border ${'border-border'} p-4`}>
        <h4 className={`text-sm font-medium ${'text-foreground'} mb-2`}>图例</h4>
        <div className="flex gap-6">
          {[
            { type: 'analysis', label: '分析', color: 'bg-info' },
            { type: 'trading', label: '交易', color: 'bg-destructive' },
            { type: 'risk', label: '风险', color: 'bg-destructive' },
            { type: 'data', label: '数据', color: 'bg-warning' },
            { type: 'custom', label: '自定义', color: 'bg-primary' },
          ].map(item => (
            <div key={item.type} className="flex items-center gap-2">
              <span className={`inline-block w-4 h-4 rounded ${item.color}`} />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

export default CapabilityGraphPage
