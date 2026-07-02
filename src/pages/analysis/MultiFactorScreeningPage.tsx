/**
 * @module MultiFactorScreeningPage
 * @description 多因子选股筛选页面（DA-007 四步集成合约：第 4 步 UI）。
 * 组合 MultiFactorFilterPanel 与结果表格，处理 loading/empty/error 三态。
 */

import { useEffect } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { DataState } from '@/components/ui/DataState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MultiFactorFilterPanel } from '@/components/analysis/screening/MultiFactorFilterPanel'
import { useMultiFactorScreeningStore } from '@/store/multiFactorScreeningStore'
import { MULTI_FACTOR_SCREENING_FACTORS } from '@/config/multiFactorScreeningConfig'

function formatFactorValue(
  factor: (typeof MULTI_FACTOR_SCREENING_FACTORS)[number]['factor'],
  value: number | null,
): string {
  if (value === null) return '-'
  const meta = MULTI_FACTOR_SCREENING_FACTORS.find((f) => f.factor === factor)
  return `${value.toFixed(2)}${meta?.unit ?? ''}`
}

export default function MultiFactorScreeningPage(): React.JSX.Element {
  const results = useMultiFactorScreeningStore((state) => state.results)
  const loading = useMultiFactorScreeningStore((state) => state.loading)
  const error = useMultiFactorScreeningStore((state) => state.error)
  const loadSavedTemplates = useMultiFactorScreeningStore((state) => state.loadSavedTemplates)

  useEffect(() => {
    loadSavedTemplates()
  }, [loadSavedTemplates])

  const errorMessage = error ?? '筛选失败'

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/analysis">分析舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>多因子筛选</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            多因子选股筛选
          </h1>
          <p className="text-muted-foreground">支持 PE/PB/ROE/市值/营收增速/净利润增速 多条件组筛选与模板管理</p>
        </div>

        <MultiFactorFilterPanel />

        <Card>
          <CardHeader>
            <CardTitle>筛选结果</CardTitle>
          </CardHeader>
          <CardContent>
            <DataState
              isLoading={loading}
              isError={error !== null}
              isEmpty={results.length === 0}
              data={results}
              errorProps={{ error: errorMessage }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">代码</th>
                      <th className="px-3 py-2 text-left font-medium">名称</th>
                      <th className="px-3 py-2 text-left font-medium">行业</th>
                      <th className="px-3 py-2 text-right font-medium">PE</th>
                      <th className="px-3 py-2 text-right font-medium">PB</th>
                      <th className="px-3 py-2 text-right font-medium">ROE</th>
                      <th className="px-3 py-2 text-right font-medium">市值</th>
                      <th className="px-3 py-2 text-right font-medium">营收增速</th>
                      <th className="px-3 py-2 text-right font-medium">利润增速</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {results.map((item) => (
                      <tr key={item.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="px-3 py-2 font-mono">{item.symbol}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.sector ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('pe', item.pe)}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('pb', item.pb)}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('roe', item.roe)}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('marketCap', item.marketCap)}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('revenueGrowth', item.revenueGrowth)}</td>
                        <td className="px-3 py-2 text-right">{formatFactorValue('profitGrowth', item.profitGrowth)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataState>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}
