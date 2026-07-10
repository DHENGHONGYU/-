import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { Server, ToggleLeft, ToggleRight, Wrench, BookOpen, FileText, Play, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { useMCPServerStore } from '@/store/mcpServerStore'
import { mcpRegistry } from '@/mcp/core/registry'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

const PRIORITY_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
}

export default function MCPServerDashboardPage(): React.JSX.Element {
  const store = useMCPServerStore()
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [toolArgs, setToolArgs] = useState('{}')
  const [toolResult, setToolResult] = useState<string | null>(null)
  const [toolError, setToolError] = useState<string | null>(null)

  // 仅在挂载时拉取一次,使用 getState() 避免整个 store 引用变更触发死循环
  // (refreshServers 内 set() 产生新 state 引用 → [store] 依赖变更 → 重跑 → 无限循环)
  useEffect(() => {
    logger.info('[MCPServerDashboard] Mounted')
    void useMCPServerStore.getState().refreshServers()
    return () => {
      logger.info('[MCPServerDashboard] Unmounted')
    }
  }, [])

  const handleToggle = useCallback((name: string, enabled: boolean) => {
    store.toggleServer(name, enabled)
    logger.info('[MCPServerDashboard] Toggled server', { name, enabled })
  }, [store])

  const handleToolTest = useCallback(async (serverName: string, toolName: string) => {
    setToolResult(null)
    setToolError(null)
    try {
      const args = JSON.parse(toolArgs) as Record<string, unknown>
      // 走 mcpBridge.callTool → MCPClient 主拦截 + MCPServerBase 深度防御（双端校验）
      // 使用 system 角色：Dashboard 是管理工具，需要测试所有 Server 的所有 Tool
      const result = await mcpBridge.callTool(serverName, toolName, args, {
        caller: 'system',
        callerId: 'MCPServerDashboardPage',
      })
      setToolResult(JSON.stringify(result, null, 2))
    } catch (err) {
      setToolError(err instanceof Error ? err.message : String(err))
    }
  }, [toolArgs])

  const { servers, isLoading, error } = store

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/hub">总控舱</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>MCP Server 管理</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP Server 管理</h1>
          <p className="text-muted-foreground">管理所有已注册的 MCP Server，查看工具、资源和 Prompt</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => store.refreshServers()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>加载中...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && servers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Server className="h-12 w-12 mb-3 opacity-30" />
            <p>暂无已注册的 MCP Server</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {servers.map((server) => (
          <Card key={server.serverName}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {server.serverName}
                      <Badge variant="outline" className="text-xs">v{server.version}</Badge>
                      <Badge variant={PRIORITY_VARIANTS[server.priority] ?? 'secondary'}>
                        {server.priority}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{server.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />{server.toolCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />{server.resourceCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />{server.promptCount}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(server.serverName, !server.enabled)}
                  >
                    {server.enabled ? (
                      <ToggleRight className={`h-5 w-5 ${COLOR_TOKENS.success.tailwind}`} />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedServer(
                      expandedServer === server.serverName ? null : server.serverName,
                    )}
                  >
                    {expandedServer === server.serverName ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedServer === server.serverName && (
              <CardContent className="border-t pt-4">
                <div className="space-y-4">
                  {server.dependencies.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">依赖:</span>
                      {server.dependencies.map((dep) => (
                        <Badge key={dep} variant="outline" className="text-xs">{dep}</Badge>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium mb-2">Tools ({server.toolCount})</h4>
                    <div className="grid gap-2">
                      {mcpRegistry.getServer(server.serverName)?.server.listTools().map((tool) => (
                        <div key={tool.name} className="rounded border p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-medium">{tool.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTool(tool.name)
                                setToolArgs('{}')
                                setToolResult(null)
                                setToolError(null)
                              }}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              测试
                            </Button>
                          </div>
                          <p className="text-muted-foreground text-xs mt-1">{tool.description}</p>

                          {selectedTool === tool.name && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <textarea
                                className="w-full min-h-[60px] rounded border border-input bg-background px-2 py-1 text-xs font-mono"
                                value={toolArgs}
                                onChange={(e) => setToolArgs(e.target.value)}
                                placeholder="JSON arguments..."
                              />
                              <Button
                                size="sm"
                                onClick={() => handleToolTest(server.serverName, tool.name)}
                              >
                                <Play className="mr-1 h-3 w-3" />
                                执行
                              </Button>
                              {toolResult && (
                                <pre className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-auto">{toolResult}</pre>
                              )}
                              {toolError && (
                                <p className="text-xs text-destructive">{toolError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}