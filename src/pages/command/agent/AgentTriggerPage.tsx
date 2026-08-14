import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { Play, RefreshCw, AlertCircle, CheckCircle2, Bot } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Select } from '@/components/atoms/Select'
import { Textarea } from '@/components/atoms/Textarea'
import { Label } from '@/components/atoms/Label'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useAgentStore } from '@/store/agentStore'
import { agentRuntime } from '@/agents/agentRuntime'
import { getAllAgentComponents } from '@/components/organisms/agent/agentComponentRegistry'
import { mcpRegistry } from '@/mcp/core/registry'
import { getLogger } from '@/lib/logger'
import type { AgentTriggerPayload } from '@/types/modules/agent.types'
import { PageContainer, PageHeader } from '@/components/templates'

const logger = getLogger()

/**
 * AgentTriggerPage
 */
export default function AgentTriggerPage(): React.JSX.Element {
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedServerName, setSelectedServerName] = useState('')
  const [selectedToolName, setSelectedToolName] = useState('')
  const [payloadJson, setPayloadJson] = useState('{}')
  const [timeout, setTimeout_] = useState(30000)
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payloadError, setPayloadError] = useState<string | null>(null)

  const agents = getAllAgentComponents()
  const servers = mcpRegistry.listServers()
  const selectedServer = servers.find((s) => s.server.info.name === selectedServerName)
  const tools = selectedServer?.server.listTools() ?? []
  const store = useAgentStore()

  useEffect(() => {
    logger.info('[AgentTriggerPage] Mounted')
    return () => {
      logger.info('[AgentTriggerPage] Unmounted')
    }
  }, [])

  const handleAgentChange = useCallback((agentId: string) => {
    setSelectedAgentId(agentId)
    const entry = getAllAgentComponents().find((a) => a.agentId === agentId)
    if (entry?.mcpServerName) {
      setSelectedServerName(entry.mcpServerName)
      if (entry.defaultToolName) {
        setSelectedToolName(entry.defaultToolName)
      }
    }
  }, [])

  const handleExecute = useCallback(async () => {
    setResult(null)
    setError(null)
    setIsExecuting(true)

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(payloadJson) as Record<string, unknown>
      setPayloadError(null)
    } catch {
      setPayloadError('JSON 格式无效')
      setIsExecuting(false)
      return
    }

    const payload: AgentTriggerPayload = {
      agentId: selectedAgentId,
      toolName: selectedToolName,
      serverName: selectedServerName,
      args: parsedPayload,
      timeout,
    }

    store.setTriggerPayload(payload)
    logger.info('[AgentTriggerPage] Executing trigger', {
      agentId: payload.agentId,
      toolName: payload.toolName,
      serverName: payload.serverName,
    })

    try {
      const task = await agentRuntime.execute(selectedAgentId, selectedToolName, parsedPayload, timeout)
      setResult(JSON.stringify(task, null, 2))
      logger.info('[AgentTriggerPage] Task completed', { taskId: task.id })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setError(errorMsg)
      logger.error('[AgentTriggerPage] Task failed', { error: errorMsg })
    } finally {
      setIsExecuting(false)
    }
  }, [selectedAgentId, selectedServerName, selectedToolName, payloadJson, timeout, store])

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/hub">总控舱</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/agents">智能体</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>任务触发</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="任务触发"
        description="手动选择智能体并触发任务执行"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>触发配置</CardTitle>
            <CardDescription>选择智能体、MCP Server 和 Tool 并配置参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">智能体</Label>
              <Select
                className="rounded-md"
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
              >
                <option value="">选择智能体...</option>
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.displayName} ({a.agentId})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">MCP Server</Label>
              <Select
                className="rounded-md"
                value={selectedServerName}
                onChange={(e) => {
                  setSelectedServerName(e.target.value)
                  setSelectedToolName('')
                }}
              >
                <option value="">选择 Server...</option>
                {servers.map((s) => (
                  <option key={s.server.info.name} value={s.server.info.name}>
                    {s.server.info.name} v{s.server.info.version}
                  </option>
                ))}
              </Select>
            </div>

            {selectedServerName && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tool</Label>
                <Select
                  className="rounded-md"
                  value={selectedToolName}
                  onChange={(e) => setSelectedToolName(e.target.value)}
                >
                  <option value="">选择 Tool...</option>
                  {tools.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} — {t.description}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">超时 (ms)</Label>
              <Input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout_(Number(e.target.value) || 30000)}
                min={1000}
                max={120000}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Payload (JSON)</Label>
              <Textarea
                className="min-h-[120px] font-mono"
                value={payloadJson}
                onChange={(e) => {
                  setPayloadJson(e.target.value)
                  setPayloadError(null)
                }}
              />
              {payloadError && (
                <p className="text-sm text-destructive">{payloadError}</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => void handleExecute()}
              disabled={isExecuting || !selectedAgentId || !selectedToolName}
            >
              {isExecuting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isExecuting ? '执行中...' : '执行任务'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>执行结果</CardTitle>
            <CardDescription>任务执行结果和错误信息</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  执行失败
                </div>
                <pre className="mt-2 text-sm font-mono text-destructive whitespace-pre-wrap">{error}</pre>
              </div>
            )}
            {result && (
              <div className="rounded-md border border-success/50 bg-success/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  执行成功
                </div>
                <pre className="mt-2 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">{result}</pre>
              </div>
            )}
            {!result && !error && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mb-3 opacity-30" />
                <p>配置触发参数后点击执行</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}