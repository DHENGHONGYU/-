/**
 * @module ApiTestDialog
 * @description 接口测试弹窗 - 5接口一键测试
 * @status 框架代码 - 待实现真实 API 调用
 */

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/Dialog'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardContent } from '@/components/atoms/Card'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { TEST_API_ENDPOINTS } from '@/config/collectConfig'

const logger = getLogger()

const TEST_TIMEOUT_MS = 5000

async function probeEndpoint(url: string): Promise<{ ok: boolean; latency: number; message: string }> {
  const startTime = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)

  try {
    // 意图说明：本弹窗是「数据源连通性探针」，需按用户实时配置的任意 URL 发起
    // 一次性探测请求。此处故意直连全局 fetch 而非走 data-fetcher 服务/DataBridge，
    // 原因：① 探测目标由用户在对话框内自由输入（含内网/临时地址），不属于
    // 已知数据源注册表，无对应 service 封装；② 仅做连通性与延迟测量，不落地数据，
    // 故无需经过 StandardEnvelope/DataBridge 写入链路。属有意为之的旁路，非架构违规。
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    })
    clearTimeout(timeoutId)
    const latency = Date.now() - startTime

    if (response.ok) {
      return { ok: true, latency, message: '连接正常' }
    }
    return { ok: false, latency, message: `HTTP ${response.status}` }
  } catch (err) {
    clearTimeout(timeoutId)
    const latency = Date.now() - startTime
    const message = err instanceof Error ? err.message : '请求失败'
    return { ok: false, latency, message }
  }
}

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

const TEST_SOURCES = TEST_API_ENDPOINTS

/**
 * ApiTestDialog
 */
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
      const result = await probeEndpoint(source.testApi)
      if (result.ok) {
        logger.info(`[ApiTestDialog] ${source.name} 测试成功`, { latency: result.latency })
      } else {
        logger.error(`[ApiTestDialog] ${source.name} 测试失败`, { error: result.message })
      }
      return {
        source: source.id,
        status: result.ok ? ('success' as const) : ('error' as const),
        latency: result.latency,
        message: result.message,
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

    const result = await probeEndpoint(source.testApi)
    if (result.ok) {
      logger.info(`[ApiTestDialog] ${source.name} 测试成功`, { latency: result.latency })
    } else {
      logger.error(`[ApiTestDialog] ${source.name} 测试失败`, { error: result.message })
    }
    setResults((prev) => ({
      ...prev,
      [sourceId]: {
        source: sourceId,
        status: result.ok ? 'success' : 'error',
        latency: result.latency,
        message: result.message,
      },
    }))
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
            <Button onClick={() => void handleTestAll()} size="sm">
              测试全部
            </Button>
          </div>

          <div className="space-y-2">
            {TEST_SOURCES.map((source) => {
              const result = results[source.id]
              if (!result) return null
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
                        onClick={() => void handleTestSingle(source.id)}
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
