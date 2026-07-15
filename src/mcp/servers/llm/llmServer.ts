/**
 * @module mcp/servers/llm
 * @description LLM 调用 MCP Server — 暴露模型选择、对话补全、分析增强等工具
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { chat } from '@/services/llm/llmGateway'
import { getDefaultLlmConfig } from '@/config/llmConfig'
import type { LlmMessage } from '@/services/llm/llmTypes'

const logger = getLogger()

export class LLMServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'llm',
    version: '1.0.0',
    description: 'LLM 调用 — 模型选择、对话补全、分析增强',
    dependencies: [],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'chat_completion',
        description: '执行 LLM 对话补全',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: '用户提示词' },
            model: { type: 'string', description: '模型名称，默认从配置读取' },
            temperature: { type: 'number', description: '生成温度 0-1，默认 0.7', default: 0.7 },
          },
          required: ['prompt'],
        },
        handler: async (args) => {
          logger.info('[LLMServer] chat_completion called', { model: args.model as string | undefined })
          const messages: LlmMessage[] = [
            { role: 'user', content: args.prompt as string },
          ]
          const result = await chat(messages, {
            model: args.model as string | undefined,
            temperature: args.temperature as number | undefined,
          })
          return {
            content: [{ type: 'text', text: result.content }],
          }
        },
      },
      {
        name: 'analyze_with_context',
        description: '带上下文的 LLM 分析',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: '用户提示词' },
            context: { type: 'string', description: '上下文数据（JSON 字符串）' },
          },
          required: ['prompt', 'context'],
        },
        handler: async (args) => {
          logger.info('[LLMServer] analyze_with_context called')
          const contextStr = args.context as string
          const systemPrompt = `你是一个专业的投资分析助手。请基于以下上下文数据进行分析：\n${contextStr}`
          const messages: LlmMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: args.prompt as string },
          ]
          const result = await chat(messages)
          return {
            content: [{ type: 'text', text: result.content }],
          }
        },
      },
      {
        name: 'list_models',
        description: '获取当前 LLM 配置信息',
        inputSchema: { type: 'object', properties: {} },
        handler: () => {
          logger.info('[LLMServer] list_models called')
          const config = getDefaultLlmConfig()
          const models = {
            currentModel: config.model,
            baseURL: config.baseURL,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            availableModels: [config.model],
          }
          return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(models) }] })
        },
      },
      {
        name: 'get_model_config',
        description: '获取当前 LLM 模型配置',
        inputSchema: { type: 'object', properties: {} },
        handler: () => {
          logger.info('[LLMServer] get_model_config called')
          const config = getDefaultLlmConfig()
          return Promise.resolve({
            content: [{
              type: 'text',
              text: JSON.stringify({
                model: config.model,
                baseURL: config.baseURL,
                maxTokens: config.maxTokens,
                temperature: config.temperature,
                timeout: config.timeout,
              }),
            }],
          })
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'llm://models',
        name: '模型配置',
        description: '当前 LLM 模型配置信息',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const config = getDefaultLlmConfig()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              currentModel: config.model,
              baseURL: config.baseURL,
              maxTokens: config.maxTokens,
              temperature: config.temperature,
            }),
          }
        },
      },
      {
        uriTemplate: 'llm://config',
        name: 'LLM 配置',
        description: '完整 LLM 配置参数',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const config = getDefaultLlmConfig()
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(config),
          }
        },
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'stock_analysis',
        description: '通用个股分析 Prompt',
        arguments: [{ name: 'symbol', description: '股票代码', required: true }],
        generator: async (args) => {
          return [{
            role: 'user',
            content: {
              type: 'text',
              text: `请对股票 ${args.symbol} 进行全面的投资分析，包含：行业地位、商业模式、财务健康度、估值水平、成长性评估、风险因素。`,
            },
          }]
        },
      },
      {
        name: 'market_overview',
        description: '市场概览 Prompt',
        arguments: [],
        generator: async () => {
          return [{
            role: 'user',
            content: {
              type: 'text',
              text: '请提供当前市场概览：主要指数表现、板块轮动特征、资金流向、市场情绪评估。',
            },
          }]
        },
      },
    ]
  }
}