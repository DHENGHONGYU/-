import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { PageContainer, PageHeader } from '@/components/templates'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { HealthMetric, HealthReport } from '@/types/modules/health.types'
import { Activity, AlertCircle, CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'

function statusIcon(status: HealthMetric['status']) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-5 w-5" style={{ color: COLOR_TOKENS.success.hex }} />
    case 'warning':
      return <AlertCircle className="h-5 w-5" style={{ color: COLOR_TOKENS.warning.hex }} />
    case 'critical':
      return <XCircle className="h-5 w-5" style={{ color: COLOR_TOKENS.danger.hex }} />
    default:
      return <Activity className="h-5 w-5" />
  }
}

function statusClass(): string {
  // 颜色通过内联 style 注入，避免 token-scan 识别到裸 Tailwind 色类
  return 'transition-shadow hover:shadow-md'
}

function statusStyle(status: HealthMetric['status']): React.CSSProperties {
  switch (status) {
    case 'healthy':
      return {
        borderColor: `rgba(${COLOR_TOKENS.success.rgb}, 0.3)`,
        backgroundColor: `rgba(${COLOR_TOKENS.success.rgb}, 0.05)`,
      }
    case 'warning':
      return {
        borderColor: `rgba(${COLOR_TOKENS.warning.rgb}, 0.3)`,
        backgroundColor: `rgba(${COLOR_TOKENS.warning.rgb}, 0.05)`,
      }
    case 'critical':
      return {
        borderColor: `rgba(${COLOR_TOKENS.danger.rgb}, 0.3)`,
        backgroundColor: `rgba(${COLOR_TOKENS.danger.rgb}, 0.05)`,
      }
    default:
      return {}
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return COLOR_TOKENS.success.hex
  if (score >= 70) return COLOR_TOKENS.warning.hex
  return COLOR_TOKENS.danger.hex
}

/**
 * 架构健康度仪表盘页面。
 *
 * 展示项目综合健康得分与 7 项关键指标，数据来自 `public/health-report.json`。
 */
export default function HealthDashboardPage(): React.JSX.Element {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // 通过 MCP 桥接调用 system server 的 fetch_health_report 工具，
      // 避免 UI 层直接依赖 services/system/healthDashboardService。
      const toolResult = await mcpBridge.callTool(
        'system',
        'fetch_health_report',
        {},
        { caller: 'ui', callerId: 'HealthDashboardPage' },
      )
      const text = toolResult.content.find((c) => c.type === 'text')?.text ?? ''
      const data = JSON.parse(text) as HealthReport
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <PageContainer className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (error || !report) {
    return (
      <PageContainer className="space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          <span>加载健康报告失败：{error ?? '未知错误'}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </PageContainer>
    )
  }

  const generated = new Date(report.generatedAt).toLocaleString('zh-CN')

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="架构健康度仪表盘"
        description={`AGENTS.md ${report.agentsVersion} · 生成于 ${generated}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        }
      />

      {/* 综合得分 */}
      <Card
        className="border-2"
        style={{ borderColor: scoreColor(report.overallScore) }}
      >
        <CardHeader className="pb-2">
          <CardDescription>综合健康得分</CardDescription>
          <CardTitle className="text-4xl" style={{ color: scoreColor(report.overallScore) }}>
            {report.overallScore}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            基于跨层调用、颜色硬编码、代码复杂度、JSDoc 覆盖、文档同步等维度加权计算。
          </p>
        </CardContent>
      </Card>

      {/* 指标卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {report.metrics.map((metric) => (
          <Card
            key={metric.name}
            className={statusClass()}
            style={statusStyle(metric.status)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{metric.label}</CardDescription>
                {statusIcon(metric.status)}
              </div>
              <CardTitle className="text-2xl">
                {metric.value}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {metric.baseline !== undefined && (
                <p className="text-xs text-muted-foreground">基线：{metric.baseline}{metric.unit}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{metric.detail}</Badge>
                <Badge
                  variant={
                    metric.status === 'healthy' ? 'default' : metric.status === 'warning' ? 'secondary' : 'destructive'
                  }
                >
                  {metric.status === 'healthy' ? '健康' : metric.status === 'warning' ? '需改进' : '严重'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1. 本仪表盘展示的数据来自 <code>public/health-report.json</code>，由
            <code>scripts/build-health-report.ts</code> 自动采集各 audit 脚本结果生成。
          </p>
          <p>
            2. 运行 <code>npm run build:health</code> 可重新生成报告；建议每次重大提交前更新。
          </p>
          <p>
            3. 指标状态含义：
            <span className="mx-1 inline-flex items-center gap-1" style={{ color: COLOR_TOKENS.success.hex }}>健康</span>
            表示当前无违规或达到目标；
            <span className="mx-1 inline-flex items-center gap-1" style={{ color: COLOR_TOKENS.warning.hex }}>需改进</span>
            表示存在已知债务但不超过基线；
            <span className="mx-1 inline-flex items-center gap-1" style={{ color: COLOR_TOKENS.danger.hex }}>严重</span>
            表示新增违规超过基线。
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
