#!/usr/bin/env tsx
/**
 * create-mcp-server.ts
 * MCP Server 脚手架生成器
 *
 * 用法: npm run create:mcp-server -- <domain> [description]
 * 示例: npm run create:mcp-server -- news "新闻资讯 MCP Server"
 *
 * 生成文件:
 *   src/mcp/servers/{domain}/
 *   ├── {domain}Server.ts        # Server 主文件
 *   ├── tools/                    # Tool 定义目录
 *   │   └── .gitkeep
 *   ├── resources/                # Resource 模板目录
 *   │   └── .gitkeep
 *   └── prompts/                  # Prompt 模板目录
 *       └── .gitkeep
 *
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SERVERS_DIR = path.join(ROOT, 'src', 'mcp', 'servers')

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

function main(): void {
  const args = process.argv.slice(2)
  const domain = args[0]
  const description = args[1] ?? `${domain} MCP Server`

  if (!domain) {
    console.log('用法: npm run create:mcp-server -- <domain> [description]')
    console.log('示例: npm run create:mcp-server -- news "新闻资讯 MCP Server"')
    process.exit(1)
  }

  const pascalName = toPascalCase(domain)
  const serverDir = path.join(SERVERS_DIR, domain)
  const toolsDir = path.join(serverDir, 'tools')
  const resourcesDir = path.join(serverDir, 'resources')
  const promptsDir = path.join(serverDir, 'prompts')

  // 检查是否已存在
  if (fs.existsSync(serverDir)) {
    console.log(`⚠️  Server 目录已存在: ${serverDir}`)
    console.log('   仅创建缺失的子目录和文件...')
  }

  // 创建目录
  fs.mkdirSync(serverDir, { recursive: true })
  fs.mkdirSync(toolsDir, { recursive: true })
  fs.mkdirSync(resourcesDir, { recursive: true })
  fs.mkdirSync(promptsDir, { recursive: true })

  // 生成 Server 主文件
  const serverTemplate = `/**
 * ${pascalName}Server
 *
 * @description
 * ${description}
 *
 * @module mcp/servers/${domain}/${domain}Server
 * @created ${new Date().toISOString().split('T')[0]} - MCP Server 脚手架生成
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'

export class ${pascalName}Server extends MCPServerBase {
  readonly info: ServerInfo = {
    name: '${domain}',
    version: '1.0.0',
    description: '${description}',
    dependencies: [],
  }

  // ============================================================
  // Tool 定义
  // ============================================================

  protected getTools(): ToolDescriptor[] {
    return [
      // TODO: 在此添加 Tool 定义
      // {
      //   name: 'example_tool',
      //   description: '示例工具',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       param: { type: 'string', description: '示例参数' },
      //     },
      //     required: ['param'],
      //   },
      //   handler: async (args) => {
      //     return {
      //       content: [{ type: 'text', text: JSON.stringify(args) }],
      //     }
      //   },
      // },
    ]
  }

  // ============================================================
  // Resource 模板
  // ============================================================

  protected getResources(): ResourceTemplate[] {
    return [
      // TODO: 在此添加 Resource 模板
      // {
      //   uriTemplate: '${domain}://{id}/data',
      //   name: 'example_resource',
      //   description: '示例资源',
      //   mimeType: 'application/json',
      //   resolver: async (uri) => {
      //     return { uri, mimeType: 'application/json', text: '{}' }
      //   },
      // },
    ]
  }

  // ============================================================
  // Prompt 模板
  // ============================================================

  protected getPrompts(): PromptTemplate[] {
    return [
      // TODO: 在此添加 Prompt 模板
      // {
      //   name: 'example_prompt',
      //   description: '示例 Prompt',
      //   arguments: [
      //     { name: 'context', description: '上下文信息', required: true },
      //   ],
      //   generator: async (args) => {
      //     return [
      //       {
      //         role: 'user',
      //         content: { type: 'text', text: \`请分析: \${args.context}\` },
      //       },
      //     ]
      //   },
      // },
    ]
  }
}
`

  const serverFilePath = path.join(serverDir, `${domain}Server.ts`)

  if (!fs.existsSync(serverFilePath)) {
    fs.writeFileSync(serverFilePath, serverTemplate, 'utf-8')
    console.log(`✅ 已创建: ${path.relative(ROOT, serverFilePath)}`)
  } else {
    console.log(`⏭️  已跳过（已存在）: ${path.relative(ROOT, serverFilePath)}`)
  }

  // 创建 .gitkeep
  for (const dir of [toolsDir, resourcesDir, promptsDir]) {
    const gitkeep = path.join(dir, '.gitkeep')
    if (!fs.existsSync(gitkeep)) {
      fs.writeFileSync(gitkeep, '', 'utf-8')
    }
  }

  console.log('')
  console.log('📁 生成的目录结构:')
  console.log(`   src/mcp/servers/${domain}/`)
  console.log(`   ├── ${domain}Server.ts`)
  console.log(`   ├── tools/`)
  console.log(`   ├── resources/`)
  console.log(`   └── prompts/`)
  console.log('')
  console.log('📝 下一步:')
  console.log(`   1. 在 ${domain}Server.ts 中实现 getTools() / getResources() / getPrompts()`)
  console.log(`   2. 在调用处注册 Server: mcpRegistry.register(new ${pascalName}Server(), { priority: 'high' })`)
  console.log('')
}

main()