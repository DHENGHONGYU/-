import React from 'react'
import { Link } from 'react-router'
import { Activity, ArrowRight, Clock, Zap, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import type { AgentDetailComponentProps } from '@/agents/agentComponentRegistry'
import { COLOR_TOKENS, COLOR_SHADES, twBg, twText } from '@/constants/theme.tokens'

const V6_SCORE_ROUTE = '/analysis/stock-score'

const SCORE_LAYERS = [
  { name: 'L-0 行业评分', description: '行业景气度与板块轮动信号', weight: '15%' },
  { name: 'L-1 宏观扫描', description: '宏观经济与政策环境分析', weight: '10%' },
  { name: 'L-2 护城河', description: '竞争优势与商业模式评估', weight: '15%' },
  { name: 'L-3 竞品分析', description: '行业内竞争对手对比', weight: '10%' },
  { name: 'L-4 财务估值', description: '财务健康度与估值水平', weight: '20%' },
  { name: 'L-5 情景推演', description: '多情景下的收益风险分析', weight: '10%' },
  { name: 'L-6 T-M矩阵', description: '技术面与资金面矩阵', weight: '10%' },
  { name: 'L-7 Hype周期', description: '市场情绪与 hype 周期定位', weight: '5%' },
  { name: 'L-8 第二曲线', description: '成长空间与第二增长曲线', weight: '5%' },
]

/**
 * V6ScoringAgentDetail
 */
export default function V6ScoringAgentDetail({ agentId }: AgentDetailComponentProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/hub">总控舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/agents">智能体</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/command/agents/registry">注册表</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>V6 评分智能体</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">V6 评分智能体</h1>
            <p className="text-muted-foreground">
              执行 V6 九维评分计算，返回评分结果与因子明细
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">ID: {agentId}</Badge>
          <Badge>system</Badge>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${twBg('emerald', 500)}/10 ${twText('emerald', 500)}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">30s</p>
              <p className="text-sm text-muted-foreground">默认超时</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${COLOR_TOKENS.info.tailwind}`} style={{ backgroundColor: `${COLOR_SHADES.blue.hex[500]}1a` }}>
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground">最大并发</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${COLOR_TOKENS.purple.tailwind}`} style={{ backgroundColor: `${COLOR_SHADES.purple.hex[500]}1a` }}>
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">9 层</p>
              <p className="text-sm text-muted-foreground">评分维度</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">评分层级</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {SCORE_LAYERS.map((layer) => (
                <div
                  key={layer.name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{layer.name}</p>
                    <p className="text-sm text-muted-foreground">{layer.description}</p>
                  </div>
                  <Badge variant="outline">{layer.weight}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">关联功能</h2>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">V6 个股评分</CardTitle>
            <CardDescription>
              在分析舱中查看完整的 V6 九维评分界面
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
              <Link to={V6_SCORE_ROUTE}>
                前往评分页
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
