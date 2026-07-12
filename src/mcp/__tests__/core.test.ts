/**
 * MCP 核心模块单元测试
 *
 * 测试范围：
 * 1. MCPServerBase 基类 — Tool/Resource/Prompt 注册与调用
 * 2. MCPRegistry 注册中心 — 注册/查找/启停/统计
 * 3. MCPClientImpl 客户端 — 跨 Server 工具发现与调用
 * 4. InProcessTransport 传输层 — 方法路由
 *
 * @module mcp/__tests__/core.test.ts
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MCPServerBase } from '../core/server'
import { MCPRegistry } from '../core/registry'
import { MCPClientImpl } from '../core/client'
import { InProcessTransport } from '../core/transport'
import type { ToolDescriptor, ResourceTemplate, PromptTemplate } from '../core/types'

// ============================================================
// 测试用 Mock Server
// ============================================================

class TestServer extends MCPServerBase {
  readonly info = {
    name: 'test:mock',
    version: '1.0.0',
    description: '测试用 Mock Server',
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'echo',
        description: '回显工具',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: '要回显的消息' },
          },
          required: ['message'],
        },
        handler: async (args) => ({
          content: [{ type: 'text', text: `Echo: ${args.message}` }],
        }),
      },
      {
        name: 'error_tool',
        description: '会抛出错误的工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('模拟错误')
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'test://{id}/data',
        name: 'test_data',
        description: '测试数据资源',
        mimeType: 'application/json',
        resolver: async (uri) => ({
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ id: uri.split('/')[2], name: 'test' }),
        }),
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'greeting',
        description: '问候 Prompt',
        arguments: [
          { name: 'name', description: '用户名称', required: true },
        ],
        generator: async (args) => [
          {
            role: 'user',
            content: { type: 'text', text: `你好，${args.name}！` },
          },
        ],
      },
    ]
  }
}

class EmptyServer extends MCPServerBase {
  readonly info = {
    name: 'empty',
    version: '0.0.1',
    description: '空 Server（无 Tool/Resource/Prompt）',
  }
}

// ============================================================
// 测试套件
// ============================================================

describe('MCPServerBase', () => {
  let server: TestServer
  let empty: EmptyServer

  beforeEach(() => {
    server = new TestServer()
    empty = new EmptyServer()
  })

  describe('listTools', () => {
    it('应返回所有注册的工具', () => {
      const tools = server.listTools()
      expect(tools).toHaveLength(2)
      expect(tools[0]!.name).toBe('echo')
      expect(tools[1]!.name).toBe('error_tool')
    })

    it('空 Server 应返回空数组', () => {
      const tools = empty.listTools()
      expect(tools).toHaveLength(0)
    })
  })

  describe('callTool', () => {
    it('应正确调用工具并返回结果', async () => {
      const result = await server.callTool('echo', { message: 'hello' })
      expect(result.isError).toBeFalsy()
      expect(result.content[0]!.text).toBe('Echo: hello')
    })

    it('工具不存在时应返回错误', async () => {
      const result = await server.callTool('nonexistent', {})
      expect(result.isError).toBe(true)
      expect(result.content[0]!.text).toContain('Tool not found')
    })

    it('工具执行异常时应返回错误', async () => {
      const result = await server.callTool('error_tool', {})
      expect(result.isError).toBe(true)
      expect(result.content[0]!.text).toContain('Tool execution error')
    })
  })

  describe('listResources', () => {
    it('应返回所有注册的资源', () => {
      const resources = server.listResources()
      expect(resources).toHaveLength(1)
      expect(resources[0]!.name).toBe('test_data')
    })
  })

  describe('readResource', () => {
    it('应正确读取资源', async () => {
      const content = await server.readResource('test://123/data')
      expect(content.mimeType).toBe('application/json')
      const parsed = JSON.parse(content.text ?? '{}')
      expect(parsed.id).toBe('123')
    })

    it('不匹配的 URI 应返回错误', async () => {
      const content = await server.readResource('unknown://uri')
      expect(content.text).toContain('Resource not found')
    })
  })

  describe('listPrompts', () => {
    it('应返回所有注册的 Prompt', () => {
      const prompts = server.listPrompts()
      expect(prompts).toHaveLength(1)
      expect(prompts[0]!.name).toBe('greeting')
    })
  })

  describe('getPrompt', () => {
    it('应正确生成 Prompt 消息', async () => {
      const messages = await server.getPrompt('greeting', { name: '世界' })
      expect(messages).toHaveLength(1)
      expect(messages[0]!.content.text).toBe('你好，世界！')
    })

    it('不存在的 Prompt 应返回错误消息', async () => {
      const messages = await server.getPrompt('nonexistent', {})
      expect(messages[0]!.content.text).toContain('Prompt not found')
    })
  })
})

describe('MCPRegistry', () => {
  let registry: MCPRegistry
  let server: TestServer

  beforeEach(() => {
    registry = new MCPRegistry()
    server = new TestServer()
  })

  describe('register', () => {
    it('应成功注册 Server', () => {
      registry.register(server, { priority: 'high' })
      const entry = registry.getServer('test:mock')
      expect(entry).toBeDefined()
      expect(entry?.options.priority).toBe('high')
    })

    it('重复注册应覆盖', () => {
      registry.register(server, { priority: 'high' })
      registry.register(server, { priority: 'low' })
      const entry = registry.getServer('test:mock')
      expect(entry?.options.priority).toBe('low')
    })
  })

  describe('unregister', () => {
    it('应成功注销 Server', () => {
      registry.register(server, { priority: 'high' })
      expect(registry.unregister('test:mock')).toBe(true)
      expect(registry.getServer('test:mock')).toBeUndefined()
    })

    it('注销不存在的 Server 应返回 false', () => {
      expect(registry.unregister('nonexistent')).toBe(false)
    })
  })

  describe('listServers', () => {
    it('应按优先级排序', () => {
      const empty = new EmptyServer()
      registry.register(empty, { priority: 'low' })
      registry.register(server, { priority: 'high' })

      const servers = registry.listServers()
      expect(servers[0]!.server.info.name).toBe('test:mock')
      expect(servers[1]!.server.info.name).toBe('empty')
    })
  })

  describe('setEnabled', () => {
    it('应支持启用/禁用', () => {
      registry.register(server, { priority: 'high' })
      registry.setEnabled('test:mock', false)

      const stats = registry.getStats()
      expect(stats.enabledServers).toBe(0)
    })
  })

  describe('getStats', () => {
    it('应返回正确的统计信息', () => {
      registry.register(server, { priority: 'high' })
      const stats = registry.getStats()

      expect(stats.totalServers).toBe(1)
      expect(stats.enabledServers).toBe(1)
      expect(stats.totalTools).toBe(2)
      expect(stats.totalResources).toBe(1)
      expect(stats.totalPrompts).toBe(1)
    })
  })
})

describe('MCPClientImpl', () => {
  let registry: MCPRegistry
  let client: MCPClientImpl
  let server: TestServer

  beforeEach(() => {
    registry = new MCPRegistry()
    client = new MCPClientImpl(registry)
    server = new TestServer()
    registry.register(server, { priority: 'high' })
  })

  describe('listAllTools', () => {
    it('应列出所有 Server 的工具', () => {
      const tools = client.listAllTools()
      expect(tools).toHaveLength(2)
      expect(tools[0]!.serverName).toBe('test:mock')
    })
  })

  describe('callTool', () => {
    it('应通过 Server 名称调用工具', async () => {
      const result = await client.callTool('test:mock', 'echo', { message: 'hello' })
      expect(result.isError).toBeFalsy()
      expect(result.content[0]!.text).toBe('Echo: hello')
    })

    it('Server 不存在时应返回错误', async () => {
      const result = await client.callTool('nonexistent', 'echo', {})
      expect(result.isError).toBe(true)
    })
  })

  describe('listAllResources', () => {
    it('应列出所有 Server 的资源', () => {
      const resources = client.listAllResources()
      expect(resources).toHaveLength(1)
      expect(resources[0]!.serverName).toBe('test:mock')
    })
  })

  describe('readResource', () => {
    it('应通过 URI 读取资源', async () => {
      const content = await client.readResource('test://123/data')
      const parsed = JSON.parse(content.text ?? '{}')
      expect(parsed.id).toBe('123')
    })
  })

  describe('listAllPrompts', () => {
    it('应列出所有 Server 的 Prompt', () => {
      const prompts = client.listAllPrompts()
      expect(prompts).toHaveLength(1)
      expect(prompts[0]!.serverName).toBe('test:mock')
    })
  })

  describe('getPrompt', () => {
    it('应通过 Server 名称获取 Prompt', async () => {
      const messages = await client.getPrompt('test:mock', 'greeting', { name: '世界' })
      expect(messages[0]!.content.text).toBe('你好，世界！')
    })
  })
})

describe('InProcessTransport', () => {
  let server: TestServer
  let transport: InProcessTransport

  beforeEach(() => {
    server = new TestServer()
    transport = new InProcessTransport(server)
  })

  it('tools/list 应返回工具列表', async () => {
    const result = (await transport.sendRequest('tools/list')) as { tools: ToolDescriptor[] }
    expect(result.tools).toHaveLength(2)
  })

  it('tools/call 应调用工具', async () => {
    const result = await transport.sendRequest('tools/call', {
      name: 'echo',
      arguments: { message: 'transport test' },
    })
    expect(result).toHaveProperty('content')
  })

  it('resources/list 应返回资源列表', async () => {
    const result = (await transport.sendRequest('resources/list')) as { resources: ResourceTemplate[] }
    expect(result.resources).toHaveLength(1)
  })

  it('resources/read 应读取资源', async () => {
    const result = await transport.sendRequest('resources/read', { uri: 'test://abc/data' })
    expect(result).toHaveProperty('uri')
  })

  it('prompts/list 应返回 Prompt 列表', async () => {
    const result = (await transport.sendRequest('prompts/list')) as { prompts: PromptTemplate[] }
    expect(result.prompts).toHaveLength(1)
  })

  it('prompts/get 应生成 Prompt', async () => {
    const result = (await transport.sendRequest('prompts/get', {
      name: 'greeting',
      arguments: { name: '传输层' },
    }))
    expect(result).toHaveProperty('messages')
  })

  it('close 后应拒绝请求', async () => {
    transport.close()
    await expect(transport.sendRequest('tools/list')).rejects.toThrow('Transport is closed')
  })
})