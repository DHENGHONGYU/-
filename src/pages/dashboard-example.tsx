/**
 * @fileoverview Dashboard 组件组合示例页面
 * @module pages/dashboard-example
 */

import {
  Bell,
  ChevronDown,
  Download,
  LogOut,
  RefreshCw,
  Settings,
  ArrowUpDown,
  User,
} from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules'

// ============================================================
// 示例数据
// ============================================================

const kpiData = [
  { name: '总资产', value: '¥2,847,520.00', change: '+5.2%', trend: 'up' },
  { name: '持仓收益', value: '¥142,376.00', change: '+3.8%', trend: 'up' },
  { name: '今日盈亏', value: '-¥8,240.00', change: '-1.8%', trend: 'down' },
  { name: '风险评分', value: '72 / 100', change: '-2.1%', trend: 'down' },
] as const

const stockRows = [
  { code: '600519', name: '贵州茅台', price: '1,688.00', change: '+1.25%', cap: '2.12万亿', status: '上涨' },
  { code: '000858', name: '五粮液', price: '158.60', change: '-0.82%', cap: '6,154亿', status: '下跌' },
  { code: '002594', name: '比亚迪', price: '268.50', change: '+2.14%', cap: '7,810亿', status: '上涨' },
  { code: '300750', name: '宁德时代', price: '198.20', change: '+0.56%', cap: '8,720亿', status: '上涨' },
  { code: '000333', name: '美的集团', price: '62.35', change: '-0.24%', cap: '4,350亿', status: '下跌' },
  { code: '600036', name: '招商银行', price: '33.80', change: '0.00%', cap: '8,520亿', status: '停牌' },
  { code: '601318', name: '中国平安', price: '44.92', change: '+0.78%', cap: '8,210亿', status: '上涨' },
  { code: '600276', name: '恒瑞医药', price: '47.65', change: '-1.12%', cap: '3,040亿', status: '下跌' },
  { code: '002415', name: '海康威视', price: '32.18', change: '+0.35%', cap: '2,990亿', status: '上涨' },
  { code: '000001', name: '平安银行', price: '11.45', change: '0.00%', cap: '2,220亿', status: '停牌' },
]

// ============================================================
// 子组件
// ============================================================

function Sparkline({ trend }: { trend: 'up' | 'down' }) {
  const bars = [40, 55, 45, 65, 50, 70, 60, 75, 68, 80]
  const colorClass = trend === 'up' ? 'bg-success' : 'bg-destructive'

  return (
    <div className="flex items-end gap-0.5 h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-1 ${colorClass} rounded-sm opacity-70`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === '上涨') {
    return <Badge variant="success">上涨</Badge>
  }
  if (status === '下跌') {
    return <Badge variant="destructive">下跌</Badge>
  }
  return <Badge variant="warning">停牌</Badge>
}

function StockTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[90px]">
              <div className="flex items-center gap-1">
                股票代码
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="text-right">现价</TableHead>
            <TableHead className="text-right">涨跌幅</TableHead>
            <TableHead className="text-right">市值</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockRows.map((row) => (
            <TableRow key={row.code}>
              <TableCell className="font-medium">{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{row.price}</TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    row.change.startsWith('+')
                      ? 'text-success'
                      : row.change.startsWith('-')
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }
                >
                  {row.change}
                </span>
              </TableCell>
              <TableCell className="text-right">{row.cap}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline">
                  详情
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// 页面主体
// ============================================================

export default function DashboardExamplePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面标题 */}
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          V9 Dashboard 组件组合示例
        </h1>

        {/* 1. 顶部 Header 区 */}
        <header className="flex items-center justify-between gap-4 mb-6 p-4 rounded-xl border border-border bg-card text-card-foreground shadow-elevation-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              V9
            </div>
            <span className="text-lg font-semibold">FinSight V9</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="通知">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-3">
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="hidden sm:inline"> Alex Chen</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  个人设置
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span className="mr-2 h-4 w-4 flex items-center justify-center text-xs">◐</span>
                  主题切换
                  <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 2. KPI 卡片区（4 列） */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpiData.map((kpi) => (
            <Card key={kpi.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
                    <div className="mt-1">
                      <Badge variant={kpi.trend === 'up' ? 'success' : 'destructive'}>
                        {kpi.change}
                      </Badge>
                    </div>
                  </div>
                  <Sparkline trend={kpi.trend as 'up' | 'down'} />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* 3. Tab 切换区 + 4. 数据表格区 */}
        <section className="mb-6">
          <Tabs defaultValue="holdings" variant="underline">
            <TabsList className="mb-4 w-full justify-start gap-4">
              <TabsTrigger value="holdings">持仓股票</TabsTrigger>
              <TabsTrigger value="watchlist">自选股</TabsTrigger>
              <TabsTrigger value="recent">近期交易</TabsTrigger>
            </TabsList>

            <TabsContent value="holdings">
              <StockTable />
            </TabsContent>

            <TabsContent value="watchlist">
              <StockTable />
            </TabsContent>

            <TabsContent value="recent">
              <StockTable />
            </TabsContent>
          </Tabs>
        </section>

        {/* 5. 分页区 */}
        <section className="mb-6">
          <Pagination
            page={3}
            totalPages={13}
            pageSize={10}
            totalItems={128}
            onPageChange={() => {}}
          />
        </section>

        {/* 6. 底部辅助区 */}
        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-border text-sm text-muted-foreground">
          <span>更新时间：2026-08-20 14:32:18</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-4 w-4" />
              导出
            </Button>
          </div>
        </footer>
      </main>
    </div>
  )
}
