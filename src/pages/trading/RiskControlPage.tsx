import { memo, useEffect } from 'react'
import { Link } from 'react-router'
import { useRiskStore } from '@/store/riskStore'
import {
  useIsExecutable,
  useRiskLevelText,
  useIsCircuitOpen,
  usePendingBlocks,
  blockedCount,
  warningCount,
  normalCount,
  blockedRate,
  verdictsCount,
} from '@/store/riskStore.derived'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

const RiskControlPage = memo(() => {
  const triState = useRiskStore((s) => s.triState)
  const circuitState = useRiskStore((s) => s.circuitState)
  const verdicts = useRiskStore((s) => s.verdicts)
  const loading = useRiskStore((s) => s.loading)
  const error = useRiskStore((s) => s.error)
  const loadRiskVerdicts = useRiskStore((s) => s.loadRiskVerdicts)

  const isExecutable = useIsExecutable()
  const levelText = useRiskLevelText()
  const isCircuitOpen = useIsCircuitOpen()
  const blocks = usePendingBlocks()

  useEffect(() => {
    loadRiskVerdicts()
  }, [loadRiskVerdicts])

  useEffect(() => {
    logger.info('[RiskControlPage] 组件挂载', {
      triState,
      circuitState,
      verdictsCount: verdicts.length,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const triStateColor =
    triState === 'blocked'
      ? COLOR_TOKENS.danger
      : triState === 'warning'
        ? COLOR_TOKENS.warning
        : COLOR_TOKENS.success

  const circuitColor =
    circuitState === 'open'
      ? COLOR_TOKENS.danger
      : circuitState === 'half-open'
        ? COLOR_TOKENS.warning
        : COLOR_TOKENS.success

  const circuitText =
    circuitState === 'closed' ? '闭合' : circuitState === 'open' ? '开启' : '半开'

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/trading">交易舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>风险控制</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader title="风险控制" description="熔断状态 · 风险等级 · 预警监控" />

        {/* 风控状态概览 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>风控三态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${triStateColor.tailwind}`}>
                  {levelText}
                </span>
                <Badge className={triStateColor.bgClass}>
                  {isExecutable ? '可执行' : '禁止执行'}
                </Badge>
              </div>
              {blocks.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">阻断原因：</p>
                  {blocks.map((block, i) => (
                    <p key={i} className={`text-xs ${COLOR_TOKENS.danger.tailwind}`}>
                      {block}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>熔断回路</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${circuitColor.tailwind}`}>
                  {circuitText}
                </span>
                <Badge className={circuitColor.bgClass}>
                  {isCircuitOpen ? '需人工干预' : circuitState === 'half-open' ? '探测中' : '正常'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>裁决统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">总数：</span>
                  <span className="font-medium">{verdictsCount()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">阻断率：</span>
                  <span className={`font-medium ${COLOR_TOKENS.danger.tailwind}`}>
                    {(blockedRate() * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">阻断：</span>
                  <span className={`font-medium ${COLOR_TOKENS.danger.tailwind}`}>
                    {blockedCount()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">警告：</span>
                  <span className={`font-medium ${COLOR_TOKENS.warning.tailwind}`}>
                    {warningCount()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">正常：</span>
                  <span className={`font-medium ${COLOR_TOKENS.success.tailwind}`}>
                    {normalCount()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 加载/错误状态 */}
        {loading && (
          <p className="text-sm text-muted-foreground">加载风控数据中...</p>
        )}
        {error && (
          <p className={`text-sm ${COLOR_TOKENS.danger.tailwind}`}>错误：{error}</p>
        )}

        {/* 裁决记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle>裁决记录</CardTitle>
          </CardHeader>
          <CardContent>
            {verdicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无风控裁决记录</p>
            ) : (
              <div className="space-y-2">
                {verdicts.slice(0, 20).map((verdict) => (
                  <div
                    key={verdict.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{verdict.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {verdict.direction}
                        </Badge>
                        <Badge
                          className={
                            verdict.triState === 'blocked'
                              ? COLOR_TOKENS.danger.bgClass
                              : verdict.triState === 'warning'
                                ? COLOR_TOKENS.warning.bgClass
                                : COLOR_TOKENS.success.bgClass
                          }
                        >
                          {verdict.triState === 'blocked'
                            ? '阻塞'
                            : verdict.triState === 'warning'
                              ? '警告'
                              : '正常'}
                        </Badge>
                      </div>
                      {verdict.result.blocks.length > 0 && (
                        <p className={`mt-1 text-xs ${COLOR_TOKENS.danger.tailwind}`}>
                          阻断：{verdict.result.blocks.join('；')}
                        </p>
                      )}
                      {verdict.result.warnings.length > 0 && (
                        <p className={`mt-1 text-xs ${COLOR_TOKENS.warning.tailwind}`}>
                          警告：{verdict.result.warnings.join('；')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(verdict.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </ErrorBoundary>
  )
})

RiskControlPage.displayName = 'RiskControlPage'
export default RiskControlPage