# SevenDimConfigPage 高级配置补全方案

## 一、缺失功能清单

根据 V6 设计规范（`data-collection-route-ui-audit.md` 第3节），需要补全：

1. **采集方案整合面板**
   - 四层数据源架构图（腾讯→AKShare→Kimi→Mock）
   - 维度接口映射表
   - 8维度频率配置表
   - 限流配置展示

2. **接口测试弹窗**
   - 5接口一键测试（AKShare/iFinD/Yahoo/天眼查/学术）
   - 多源对比展示
   - 降级测试结果

---

## 二、采集方案整合面板实现方案

### 2.1 新增组件：CollectionPlanPanel

**文件路径**：`src/components/input/CollectionPlanPanel.tsx`

```typescript
/**
 * @module CollectionPlanPanel
 * @description 采集方案整合面板 - 展示四层数据源架构和维度接口映射
 */

import { memo, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/Separator'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import {
  DEFAULT_DIMENSIONS,
  FREQUENCY_LABELS,
  DATA_SOURCE_LABELS,
  GLOBAL_LIMITS,
} from '@/config/collectConfig'

// 四层数据源架构
const DATA_SOURCE_LAYERS = [
  {
    layer: 'L1',
    name: '腾讯财经',
    description: '实时行情主源',
    status: 'available',
    latency: '~50ms',
    color: COLOR_TOKENS.success,
  },
  {
    layer: 'L2',
    name: 'AKShare',
    description: 'A股数据备用源',
    status: 'available',
    latency: '~200ms',
    color: COLOR_TOKENS.info,
  },
  {
    layer: 'L3',
    name: 'Kimi Work',
    description: 'AI增强数据源',
    status: 'premium',
    latency: '~500ms',
    color: COLOR_TOKENS.warning,
  },
  {
    layer: 'L4',
    name: 'MockProvider',
    description: '离线模拟数据',
    status: 'fallback',
    latency: '~10ms',
    color: COLOR_TOKENS.muted,
  },
]

// 维度接口映射表
const DIMENSION_API_MAPPING = [
  { code: '01', name: '基本信息', api: '/api/stock/basic', method: 'GET', cache: '43200s' },
  { code: '02', name: 'K线数据', api: '/api/stock/kline', method: 'GET', cache: '1440s' },
  { code: '03', name: '筹码分布', api: '/api/stock/chip', method: 'GET', cache: '4320s' },
  { code: '04', name: '重大事项', api: '/api/stock/news', method: 'GET', cache: '1440s' },
  { code: '05', name: '热点新闻', api: '/api/news/hot', method: 'GET', cache: '720s' },
  { code: '06', name: '行业竞品', api: '/api/industry/competitors', method: 'GET', cache: '10080s' },
  { code: '07', name: '关联指数', api: '/api/index/correlation', method: 'GET', cache: '10080s' },
  { code: '08', name: '研报中心', api: '/api/research/reports', method: 'GET', cache: '1440s' },
]

export const CollectionPlanPanel = memo(() => {
  const dimensions = useSevenDimConfigStore((s) => s.dimensions)
  const enabledCount = dimensions.filter((d) => d.enabled).length

  // 计算每个维度的预估调用次数
  const dimensionEstimates = useMemo(() => {
    return dimensions
      .filter((d) => d.enabled)
      .map((dim) => {
        const frequencyLabel = FREQUENCY_LABELS[dim.frequency]
        const sources = dim.sources.map((s) => DATA_SOURCE_LABELS[s]).join(' → ')
        return {
          code: dim.code,
          name: dim.name,
          frequency: frequencyLabel,
          sources,
          batchSize: dim.batchSize,
          cacheTtl: dim.cacheTtl,
        }
      })
  }, [dimensions])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>采集方案整合</CardTitle>
          <Badge variant="secondary">
            {enabledCount} / {DEFAULT_DIMENSIONS.length} 维度启用
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 四层数据源架构图 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">四层数据源架构</h3>
          <div className="space-y-2">
            {DATA_SOURCE_LAYERS.map((layer) => (
              <div
                key={layer.layer}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge className={layer.color.bgClass}>{layer.layer}</Badge>
                  <div>
                    <p className="text-sm font-medium">{layer.name}</p>
                    <p className="text-xs text-muted-foreground">{layer.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">延迟</p>
                  <p className="text-sm font-medium">{layer.latency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 维度接口映射表 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">维度接口映射</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">维度</th>
                  <th className="px-2 py-2 text-left font-medium">接口</th>
                  <th className="px-2 py-2 text-left font-medium">方法</th>
                  <th className="px-2 py-2 text-left font-medium">缓存</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSION_API_MAPPING.map((mapping) => {
                  const dim = dimensions.find((d) => d.code === mapping.code)
                  const isEnabled = dim?.enabled ?? false
                  return (
                    <tr
                      key={mapping.code}
                      className={`border-b ${!isEnabled ? 'opacity-50' : ''}`}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mapping.code}</span>
                          <span className="text-muted-foreground">{mapping.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{mapping.api}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{mapping.method}</Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{mapping.cache}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* 8维度频率配置表 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">维度频率配置</h3>
          <div className="space-y-2">
            {dimensionEstimates.map((est) => (
              <div
                key={est.code}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{est.code}</Badge>
                  <span className="text-sm font-medium">{est.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">频率：</span>
                    <span>{est.frequency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">批次：</span>
                    <span>{est.batchSize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">数据源：</span>
                    <span>{est.sources}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 限流配置展示 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">限流配置</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">分钟限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerMinute}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">小时限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerHour}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">日限流</p>
              <p className="text-lg font-bold">{GLOBAL_LIMITS.rateLimitPerDay}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

CollectionPlanPanel.displayName = 'CollectionPlanPanel'
```

### 2.2 新增组件：ApiTestDialog

**文件路径**：`src/components/input/ApiTestDialog.tsx`

```typescript
/**
 * @module ApiTestDialog
 * @description 接口测试弹窗 - 5接口一键测试
 */

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface TestResult {
  source: string
  status: 'idle' | 'testing' | 'success' | 'error'
  latency?: number
  message?: string
}

interface ApiTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TEST_SOURCES = [
  { id: 'akshare', name: 'AKShare', testApi: '/api/test/akshare' },
  { id: 'ifind', name: 'iFinD', testApi: '/api/test/ifind' },
  { id: 'yahoo', name: 'Yahoo', testApi: '/api/test/yahoo' },
  { id: 'tianyancha', name: '天眼查', testApi: '/api/test/tianyancha' },
  { id: 'scholar', name: '学术', testApi: '/api/test/scholar' },
]

export const ApiTestDialog = memo(({ open, onOpenChange }: ApiTestDialogProps) => {
  const [results, setResults] = useState<Record<string, TestResult>>(
    TEST_SOURCES.reduce((acc, source) => {
      acc[source.id] = { source: source.id, status: 'idle' }
      return acc
    }, {} as Record<string, TestResult>)
  )

  const handleTestAll = async () => {
    logger.info('[ApiTestDialog] 开始测试所有数据源')

    // 重置所有状态
    const initialResults = TEST_SOURCES.reduce((acc, source) => {
      acc[source.id] = { source: source.id, status: 'testing' }
      return acc
    }, {} as Record<string, TestResult>)
    setResults(initialResults)

    // 并行测试所有数据源
    const testPromises = TEST_SOURCES.map(async (source) => {
      const startTime = Date.now()
      try {
        // TODO: 调用真实的测试 API
        // const response = await fetch(source.testApi)
        // if (!response.ok) throw new Error('Test failed')
        
        // 模拟测试延迟
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))
        
        const latency = Date.now() - startTime
        logger.info(`[ApiTestDialog] ${source.name} 测试成功`, { latency })
        
        return {
          source: source.id,
          status: 'success' as const,
          latency,
          message: '连接正常',
        }
      } catch (err) {
        const latency = Date.now() - startTime
        const message = err instanceof Error ? err.message : '测试失败'
        logger.error(`[ApiTestDialog] ${source.name} 测试失败`, { error: message })
        
        return {
          source: source.id,
          status: 'error' as const,
          latency,
          message,
        }
      }
    })

    const testResults = await Promise.all(testPromises)
    
    // 更新结果
    const finalResults = testResults.reduce((acc, result) => {
      acc[result.source] = result
      return acc
    }, {} as Record<string, TestResult>)
    setResults(finalResults)

    logger.info('[ApiTestDialog] 所有数据源测试完成', { results: finalResults })
  }

  const handleTestSingle = async (sourceId: string) => {
    const source = TEST_SOURCES.find((s) => s.id === sourceId)
    if (!source) return

    logger.info(`[ApiTestDialog] 开始测试 ${source.name}`)
    setResults((prev) => ({
      ...prev,
      [sourceId]: { source: sourceId, status: 'testing' },
    }))

    const startTime = Date.now()
    try {
      // TODO: 调用真实的测试 API
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))
      
      const latency = Date.now() - startTime
      setResults((prev) => ({
        ...prev,
        [sourceId]: {
          source: sourceId,
          status: 'success',
          latency,
          message: '连接正常',
        },
      }))
    } catch (err) {
      const latency = Date.now() - startTime
      const message = err instanceof Error ? err.message : '测试失败'
      setResults((prev) => ({
        ...prev,
        [sourceId]: {
          source: sourceId,
          status: 'error',
          latency,
          message,
        },
      }))
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'idle':
        return <Badge variant="outline">待测试</Badge>
      case 'testing':
        return <Badge className={COLOR_TOKENS.info.bgClass}>测试中...</Badge>
      case 'success':
        return <Badge className={COLOR_TOKENS.success.bgClass}>正常</Badge>
      case 'error':
        return <Badge className={COLOR_TOKENS.danger.bgClass}>异常</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>接口测试</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              测试 5 个数据源的连接状态和响应延迟
            </p>
            <Button onClick={handleTestAll} size="sm">
              测试全部
            </Button>
          </div>

          <div className="space-y-2">
            {TEST_SOURCES.map((source) => {
              const result = results[source.id]
              return (
                <Card key={source.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{source.name}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <div className="flex items-center gap-3">
                      {result.latency && (
                        <span className="text-sm text-muted-foreground">
                          {result.latency}ms
                        </span>
                      )}
                      {result.message && (
                        <span
                          className={`text-xs ${
                            result.status === 'error'
                              ? COLOR_TOKENS.danger.tailwind
                              : COLOR_TOKENS.success.tailwind
                          }`}
                        >
                          {result.message}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestSingle(source.id)}
                        disabled={result.status === 'testing'}
                      >
                        测试
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})

ApiTestDialog.displayName = 'ApiTestDialog'
```

### 2.3 修改 SevenDimConfigPage 集成新组件

**修改文件**：`src/pages/input/SevenDimConfigPage.tsx`

在页面底部添加两个新面板：

```typescript
// 在 import 部分添加
import { CollectionPlanPanel } from '@/components/input/CollectionPlanPanel'
import { ApiTestDialog } from '@/components/input/ApiTestDialog'

// 在组件状态中添加
const [showApiTest, setShowApiTest] = useState(false)

// 在操作按钮区域添加"接口测试"按钮
<Button
  variant="outline"
  className="w-full"
  onClick={() => setShowApiTest(true)}
>
  接口测试
</Button>

// 在页面底部添加采集方案整合面板
<CollectionPlanPanel />

// 在 ErrorBoundary 内添加接口测试弹窗
<ApiTestDialog open={showApiTest} onOpenChange={setShowApiTest} />
```

---

## 三、实施步骤

### Phase 1：创建组件文件（P2 - 中期）

1. 创建 `src/components/input/CollectionPlanPanel.tsx`
2. 创建 `src/components/input/ApiTestDialog.tsx`
3. 修改 `src/pages/input/SevenDimConfigPage.tsx` 集成新组件

### Phase 2：实现真实 API 调用（P1 - 高）

1. 修改 `sevenDimConfigStore.saveConfig()` 调用 DataBridge 持久化
2. 修改 `sevenDimConfigStore.runCollection()` 调用 fetcherService
3. 修改 `ApiTestDialog` 调用真实的测试 API

### Phase 3：测试验证（P1 - 高）

1. 为 `CollectionPlanPanel` 添加单元测试
2. 为 `ApiTestDialog` 添加单元测试
3. 为 `saveConfig` 和 `runCollection` 添加集成测试

---

## 四、依赖关系

```
SevenDimConfigPage
├── CollectionPlanPanel（新增）
│   ├── useSevenDimConfigStore
│   └── collectConfig 常量
└── ApiTestDialog（新增）
    └── 测试 API（待实现）
```

---

## 五、风险评估

| 风险 | 等级 | 应对策略 |
|------|------|---------|
| 真实 API 未实现 | 高 | 先使用模拟数据，后续迭代 |
| DataBridge 契约未定义 | 中 | 需要先定义 `collectConfig.save` 契约 |
| fetcherService 接口不匹配 | 中 | 需要先确认 fetcherService 的调用方式 |

---

**文档版本**：v1.0  
**创建日期**：2026-07-09  
**状态**：待评审
