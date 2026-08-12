import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Download } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import {
  useOutputStore,
  selectExportData,
  selectMessage,
  selectIsExporting,
} from '@/store/outputStore'
import { toSafeString } from '@/lib/safeCoerce'
import { getLogger } from '@/lib/logger'

// ---------- lazy page imports ----------

/**
 * 导出数据预览的最大显示长度（字符数）。
 * 超出此长度的数据将截断显示，避免大量 DOM 文本节点导致渲染卡顿。
 * 与项目 MAX_CONTENT_LENGTH 保持一致。
 */
const MAX_PREVIEW_LENGTH = 50000

const OutputHubPage = React.lazy(() => import('@/pages/output/OutputHubPage'))
const ResearchReportPage = React.lazy(() => import('@/pages/output/ResearchReportPage'))
const TradeReviewPage = React.lazy(() => import('@/pages/output/TradeReviewPage'))
const ReviewWizardPage = React.lazy(() => import('@/pages/output/ReviewWizardPage'))
const DashboardPage = React.lazy(() => import('@/pages/output/DashboardPage'))
const PredictionPage = React.lazy(() => import('@/pages/output/PredictionPage'))
const RetrospectivePage = React.lazy(() => import('@/pages/output/RetrospectivePage'))
const FactorDashboardPage = React.lazy(() => import('@/pages/output/FactorDashboardPage'))
const ChipStrategyReviewPage = React.lazy(() => import('@/pages/output/ChipStrategyReviewPage'))

interface OutputRoute {
  path: string
  branch: string
  componentName: string
  exact?: boolean
  component: React.ReactNode
  fallback: string
}

const OUTPUT_ROUTES: OutputRoute[] = [
  { path: '/output/export', branch: 'export', componentName: 'DataExportPanel', component: <DataExportPanel />, fallback: '加载中...' },
  { path: '/output/research', branch: 'research', componentName: 'ResearchReportPage', component: <ResearchReportPage />, fallback: '加载中...' },
  { path: '/output/dashboard', branch: 'dashboard', componentName: 'DashboardPage', component: <DashboardPage />, fallback: '加载中...' },
  { path: '/output/review', branch: 'review', componentName: 'TradeReviewPage', component: <TradeReviewPage />, fallback: '加载中...' },
  { path: '/output/wizard', branch: 'wizard', componentName: 'ReviewWizardPage', component: <ReviewWizardPage />, fallback: '加载中...' },
  { path: '/output/prediction', branch: 'prediction', componentName: 'PredictionPage', component: <PredictionPage />, fallback: '加载中...' },
  { path: '/output/retrospective', branch: 'retrospective', componentName: 'RetrospectivePage', component: <RetrospectivePage />, fallback: '加载中...' },
  { path: '/output/factor-dashboard', branch: 'factorDashboard', componentName: 'FactorDashboardPage', component: <FactorDashboardPage />, fallback: '加载中...' },
  { path: '/output/chip-strategy', branch: 'chipStrategy', componentName: 'ChipStrategyReviewPage', component: <ChipStrategyReviewPage />, fallback: '加载中...' },
  { path: '/output', branch: 'hub', componentName: 'OutputHubPage', component: <OutputHubPage />, fallback: '加载中...' },
  { path: '/output/hub', branch: 'hub', componentName: 'OutputHubPage', component: <OutputHubPage />, fallback: '加载中...' },
]

function matchOutputRoute(path: string): OutputRoute {
  for (const route of OUTPUT_ROUTES) {
    if (route.exact === false) {
      if (path === route.path || path.startsWith(route.path + '/')) return route
    } else if (path === route.path) {
      return route
    }
  }
  return { path: '', branch: 'default', componentName: 'null', component: null, fallback: '' }
}

const logger = getLogger()

// ---------- simple JSON -> CSV conversion ----------

/**
 * 防止 CSV 公式注入：当值以 = + - @ \t \r 开头时，添加前导单引号 '。
 * Excel/WPS 会将前导单引号视为文本标记而不显示，从而避免值被解释为公式。
 * 参考 OWASP CSV Injection 防护建议。
 */
const CSV_FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r'])

function sanitizeCsvValue(val: unknown): string {
  const str = String(val)
  if (str.length > 0 && CSV_FORMULA_PREFIXES.has(str.charAt(0))) {
    return `'${str}`
  }
  return str
}

function jsonToCsv(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr)
    // If it's an array of objects, flatten to CSV
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      const headers = Object.keys(parsed[0] as Record<string, unknown>)
      const rows = parsed.map((row: Record<string, unknown>) =>
        headers.map((h) => {
          let val = toSafeString(row[h])
          // 防止 CSV 公式注入
          val = sanitizeCsvValue(val)
          // Escape commas and quotes in values
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        }).join(','),
      )
      return [headers.join(','), ...rows].join('\n')
    }
    // Fallback: single-line string representation
    return jsonStr
  } catch (err) { console.warn('[OutputApp.tsx]', err);
    return jsonStr
  }
}

// ---------- Data Export Panel ----------

function DataExportPanel(): React.JSX.Element {
  const exportData = useOutputStore(selectExportData)
  const message = useOutputStore(selectMessage)
  const isExporting = useOutputStore(selectIsExporting)
  const handleExport = useOutputStore((state) => state.handleExport)

  const [format, setFormat] = useState<'json' | 'csv'>('json')

  const handleDownload = (): void => {
    if (!exportData) return
    const content = format === 'csv' ? jsonToCsv(exportData) : exportData
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `v9-export-${new Date().toISOString().slice(0, 10)}.${format}`
    // Firefox 需要 <a> 在 DOM 中才能触发下载；Chrome 也能正常工作
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 延迟 revoke：某些浏览器下载是异步的，立即 revoke 可能导致下载失败
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            输出舱 · 数据导出
            <Badge variant="secondary">JSON / CSV</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
              className="w-28"
            >
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                handleExport().catch((error) => {
                  logger.error('[OutputApp] handleExport 未捕获的 rejection', {
                    message: error instanceof Error ? error.message : String(error),
                  })
                })
              }}
              disabled={isExporting}
            >
              {isExporting ? '导出中...' : '导出全部数据'}
            </Button>
            {exportData && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                下载数据
              </Button>
            )}
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {exportData && (
            <div>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
                {exportData.length > MAX_PREVIEW_LENGTH
                  ? `${exportData.slice(0, MAX_PREVIEW_LENGTH)}\n\n... [数据已截断，共 ${exportData.length} 字符，仅显示前 ${MAX_PREVIEW_LENGTH} 字符，请点击"下载数据"查看完整内容]`
                  : exportData}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- App with sub-routes ----------

/**
 * 输出舱子路由分发
 *
 * @description
 * 使用 useLocation + 条件渲染替代嵌套 <Routes>。
 *
 * 根因：React Router v7 在 descendant <Routes> 场景下，绝对路径匹配行为
 * 与 v6 不一致。当 App.tsx 顶层已通过 <Route path="/output"> 匹配并渲染
 * PortalShell → OutputApp 时，OutputApp 内部的 <Routes path="/output">
 * 不会再次匹配当前 URL（证据：main 内容为空，OutputHubPage chunk 未请求）。
 *
 * 修复方案：直接读取 location.pathname 进行条件渲染，绕过 descendant
 * Routes 的路径匹配问题。新增子页面仅需在 OUTPUT_ROUTES 中追加条目。
 */
export default function OutputApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // 路由切换检测：仅在 pathname 变化时记录切换事件与渲染状态
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[OutputApp] 路由切换', { from: prevPath, to: path })
    }

    // 计算命中的分支与组件名（仅在路径变化时记录，避免 PortalShell 重渲染导致日志噪音）
    const { branch, componentName } = matchOutputRoute(path)

    if (branch === 'default') {
      logger.warn('[OutputApp] 未识别的输出舱子路径', { path })
    }

    logger.info('[OutputApp] 渲染输出舱', {
      path,
      branch,
      component: componentName,
      // DataExportPanel 是同步导入；null 表示无内容渲染；其余均为 React.lazy
      isLazy: componentName !== 'DataExportPanel' && componentName !== 'null',
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  const matched = matchOutputRoute(path)

  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-sm text-muted-foreground">
          输出舱加载失败，请刷新页面重试。若问题持续，请检查网络连接后联系管理员。
        </div>
      }
    >
      <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中...</div>}>
        {matched.component}
      </React.Suspense>
    </ErrorBoundary>
  )
}
