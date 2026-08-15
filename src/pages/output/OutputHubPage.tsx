import { memo } from 'react'
import { Link } from 'react-router'
import { FileText, BarChart3, Database, Wand2, ArrowRight, TrendingUp, RefreshCw, LayoutDashboard, Layers, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { EmptyState } from '@/components/molecules/EmptyState'
import { PageContainer, PageHeader } from '@/components/templates'

// ---------- type definitions ----------

interface HubModule {
  title: string
  description: string
  path: string
  icon: React.ElementType
  badge?: string
  formats?: string[]
  isCore?: boolean
}

interface RecentOutput {
  title: string
  time: string
  format: string
}

// ---------- route validation ----------

/** 输出舱所有已注册的有效子路由路径集合 */
const VALID_OUTPUT_PATHS = new Set([
  '/output/export',
  '/output/research',
  '/output/dashboard',
  '/output/review',
  '/output/wizard',
  '/output/factor-analysis',
  '/output/prediction',
  '/output/retrospective',
  '/output/factor-dashboard',
  '/output/chip-strategy',
])

function isModuleAvailable(path: string): boolean {
  return VALID_OUTPUT_PATHS.has(path)
}

// ---------- modules config ----------

const OUTPUT_MODULES: HubModule[] = [
  {
    title: '研究报告',
    description: '生成和导出研究报告',
    path: '/output/research',
    icon: FileText,
    formats: ['PDF', 'Word', 'MD'],
    isCore: true,
  },
  {
    title: '交易复盘',
    description: '交易记录回顾与复盘报告',
    path: '/output/review',
    icon: BarChart3,
    formats: ['PDF', 'MD'],
    isCore: true,
  },
  {
    title: '数据导出',
    description: '全量数据 JSON/CSV 导出',
    path: '/output/export',
    icon: Database,
    formats: ['JSON', 'CSV'],
  },
  {
    title: '复盘向导',
    description: '四步渐进式复盘并导出成品卡',
    path: '/output/wizard',
    icon: Wand2,
    formats: ['PDF', 'MD'],
    badge: '新增',
  },
  {
    title: '预测校验',
    description: '因子预测记录与准确性校验',
    path: '/output/prediction',
    icon: TrendingUp,
    badge: '新增',
    formats: ['PDF', 'MD'],
  },
  {
    title: '周期复盘',
    description: '月度周期复盘与因子权重校准',
    path: '/output/retrospective',
    icon: RefreshCw,
    badge: '新增',
    formats: ['PDF', 'MD'],
  },
  {
    title: '因子画板',
    description: '因子监控画板与失效预警',
    path: '/output/factor-dashboard',
    icon: LayoutDashboard,
    badge: '新增',
    formats: ['PNG', 'CSV'],
  },
  {
    title: '筹码策略复盘',
    description: '主力筹码变动信号矩阵与交易策略复盘',
    path: '/output/chip-strategy',
    icon: Layers,
    badge: '新增',
    formats: ['PDF', 'MD'],
  },
]

// ---------- recent outputs placeholder ----------

const RECENT_OUTPUTS: RecentOutput[] = [
  { title: '贵州茅台深度研报', time: '2026-08-14 15:30', format: 'PDF' },
  { title: '半导体行业周报', time: '2026-08-13 10:15', format: 'MD' },
  { title: '2026Q2 交易复盘', time: '2026-08-12 17:00', format: 'Docx' },
  { title: '因子失效预警日报', time: '2026-08-11 09:45', format: 'CSV' },
]

export default memo(function OutputHubPage(): React.JSX.Element {
  const hasRecentOutputs = RECENT_OUTPUTS.length > 0

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>输出舱</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="输出舱"
          description="报告导出与数据输出管理"
          actions={<Badge variant="secondary">V3.0 模块五</Badge>}
        />

        {/* ======== 最近输出 ======== */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">最近输出</h2>
          {hasRecentOutputs ? (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {RECENT_OUTPUTS.map((item) => (
                <Card key={item.title} className="transition-shadow hover:shadow-elevation-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm leading-snug line-clamp-2">{item.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">{item.format}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="ghost" size="sm" className="w-full justify-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无导出记录"
              description="生成研究报告或交易复盘后，最近输出将在此显示"
            />
          )}
        </section>

        {/* ======== 功能模块 ======== */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">功能模块</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {OUTPUT_MODULES.map((module) => {
              const Icon = module.icon
              const available = isModuleAvailable(module.path)
              const hasNewBadge = !!module.badge && module.badge === '新增'
              const displayBadge = available ? module.badge : '即将上线'

              return (
                <Card
                  key={module.title}
                  className={[
                    'transition-shadow',
                    available
                      ? (module.isCore ? 'border-l-4 border-l-primary hover:shadow-elevation-2' : 'hover:shadow-elevation-2')
                      : 'opacity-60 cursor-not-allowed',
                  ].join(' ')}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            available ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base">{module.title}</CardTitle>
                      </div>
                      {displayBadge && (
                        <Badge variant={available && hasNewBadge ? 'default' : 'outline'}>
                          {displayBadge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {module.formats && module.formats.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {module.formats.map((fmt) => (
                          <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
                        ))}
                      </div>
                    )}
                    {available ? (
                      <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                        <Link to={module.path}>
                          进入
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full justify-between" disabled>
                        进入
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      </PageContainer>
    </ErrorBoundary>
  )
})
