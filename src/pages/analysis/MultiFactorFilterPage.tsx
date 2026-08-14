/**
 * @module MultiFactorFilterPage
 * @description 多因子筛选页面：自动加载股票池数据 + 预置筛选结果展示
 */

import { useEffect } from 'react'
import { Link } from 'react-router'
import { Play, BarChart3 } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { MultiFactorFilterPanel } from '@/components/organisms/analysis/screening/MultiFactorFilterPanel'
import { useMultiFactorScreeningStore } from '@/store/multiFactorScreeningStore'

export default function MultiFactorFilterPage(): React.JSX.Element {
  const results = useMultiFactorScreeningStore((s) => s.results)
  const loading = useMultiFactorScreeningStore((s) => s.loading)
  const runScreening = useMultiFactorScreeningStore((s) => s.runScreening)
  const conditionGroups = useMultiFactorScreeningStore((s) => s.conditionGroups)

  useEffect(() => {
    if (results.length === 0 && !loading) {
      void runScreening()
    }
  }, [results.length, loading, runScreening])

  return (
    <ErrorBoundary>
      <PageContainer>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/analysis">分析舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>多因子筛选</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="多因子筛选"
          description="按条件组增删 / 因子编辑 / 模板持久化 · 自动筛选"
          actions={
            <Button variant="outline" size="sm" onClick={() => void runScreening()} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              {loading ? '筛选中...' : '重新筛选'}
            </Button>
          }
        />

        <MultiFactorFilterPanel />

        {results.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">筛选结果（{results.length} 只股票）</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">代码</th>
                      <th className="px-3 py-2 font-medium">名称</th>
                      <th className="px-3 py-2 font-medium">行业</th>
                      <th className="px-3 py-2 font-medium">PE</th>
                      <th className="px-3 py-2 font-medium">PB</th>
                      <th className="px-3 py-2 font-medium">ROE(%)</th>
                      <th className="px-3 py-2 font-medium">市值(亿)</th>
                      <th className="px-3 py-2 font-medium">匹配条件组</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 20).map((item) => (
                      <tr key={item.symbol} className="border-b hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono">{item.symbol}</td>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.sector ?? '-'}</td>
                        <td className="px-3 py-2">{item.pe?.toFixed(1) ?? '-'}</td>
                        <td className="px-3 py-2">{item.pb?.toFixed(2) ?? '-'}</td>
                        <td className="px-3 py-2">{item.roe?.toFixed(1) ?? '-'}</td>
                        <td className="px-3 py-2">{item.marketCap?.toFixed(0) ?? '-'}</td>
                        <td className="px-3 py-2 text-xs text-primary">
                          {item.matchedGroups.length}/{conditionGroups.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.length > 20 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  共 {results.length} 条结果，仅展示前 20 条。可调整筛选条件缩小范围。
                </p>
              )}
              {results.length === 0 && !loading && (
                <div className="py-8 text-center text-muted-foreground">
                  暂无符合条件的股票，请调整筛选条件
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </ErrorBoundary>
  )
}