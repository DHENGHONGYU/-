/**
 * @doc [V9-DOC-BACK-012]
 * LLM Mock 响应数据 — 用于单元测试和开发调试的 Mock 数据工厂
 *
 * 提供：
 * - 各模型预设的成功/失败响应模板
 * - Mock fetch 拦截器（返回标准 Response 对象，不含 vi 依赖）
 * - Mock 配置生成器
 *
 * 本文件不依赖 vitest，可在测试代码中配合 vi.fn() 使用：
 *   import { createMockFetchResponse, MOCK_PRESET_RESPONSES } from './llmMockResponses'
 *   global.fetch = vi.fn().mockImplementation(createMockFetchResponse('deepseek', 'success'))
 */

import type { LlmPreset } from '@/config/llmConfig'
import { LLM_DEFAULT_TIMEOUT } from '@/config/llmConfig'

/** 各预设的 Mock 成功响应内容 */
export const MOCK_PRESET_RESPONSES: Record<string, {
  content: string
  model: string
  promptTokens: number
  completionTokens: number
}> = {
  deepseek: {
    content: '你好！我是 DeepSeek 助手，很高兴为你服务。',
    model: 'deepseek-chat',
    promptTokens: 15,
    completionTokens: 20,
  },
  kimi: {
    content: 'Hi! This is Kimi K2. I can help you with code generation and analysis.',
    model: 'kimi-k2.7-code',
    promptTokens: 18,
    completionTokens: 25,
  },
  qwen: {
    content: '你好，我是通义千问。我可以帮你完成写作、编程、翻译等多种任务。',
    model: 'qwen3.6-flash',
    promptTokens: 20,
    completionTokens: 30,
  },
  'tencent-hunyuan': {
    content: '腾讯混元为您服务。我支持中文对话、文本生成和逻辑推理。',
    model: 'hy3',
    promptTokens: 16,
    completionTokens: 22,
  },
  'bytedance-doubao': {
    content: '您好，我是豆包。很高兴为您提供智能助手服务。',
    model: 'doubao-pro-32k',
    promptTokens: 22,
    completionTokens: 28,
  },
  'baidu-ernie': {
    content: '百度文心一言已就绪，可以开始为您服务。',
    model: 'ERNIE-4.5-Turbo',
    promptTokens: 14,
    completionTokens: 18,
  },
  'zhipu-glm': {
    content: '智谱 GLM 已准备就绪，我可以进行长文本分析和多轮对话。',
    model: 'glm-5-turbo',
    promptTokens: 19,
    completionTokens: 24,
  },
  siliconflow: {
    content: '硅基流动代理已连接，当前使用的是开源模型。',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    promptTokens: 30,
    completionTokens: 35,
  },
  openai: {
    content: 'Hello! I am GPT-4o. How can I assist you today?',
    model: 'gpt-4o',
    promptTokens: 12,
    completionTokens: 15,
  },
  anthropic: {
    content: 'Hi there! I am Claude 3.5 Sonnet. I am ready to help.',
    model: 'claude-3.5-sonnet',
    promptTokens: 25,
    completionTokens: 40,
  },
  'google-gemini': {
    content: 'Hey! Gemini 2.0 Flash online. What would you like to explore?',
    model: 'gemini-2.0-flash',
    promptTokens: 10,
    completionTokens: 12,
  },
  'xai-grok': {
    content: 'Grok 4 here. I am designed for real-time, factual answers.',
    model: 'grok-4',
    promptTokens: 8,
    completionTokens: 20,
  },
}

/** Mock 响应模式 */
export type MockResponseMode = 'success' | 'error-401' | 'error-429' | 'error-500' | 'timeout'

/** 错误响应模板 */
const ERROR_RESPONSES: Record<string, { status: number; message: string }> = {
  'error-401': { status: 401, message: 'Invalid API key' },
  'error-429': { status: 429, message: 'Rate limit exceeded' },
  'error-500': { status: 500, message: 'Internal server error' },
}

/**
 * 创建 Mock Response 对象的工厂函数（纯数据，无 vitest 依赖）
 * 返回一个符合 fetch Response 接口的对象
 */
function makeResponse(
  ok: boolean,
  status: number,
  statusText: string,
  body: Record<string, unknown>,
): Response {
  return {
    ok,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    // 以下为 Response 接口必需的属性（简化版）
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    clone: () => ({}) as Response,
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    getReader: () => null as unknown as ReadableStreamDefaultReader<Uint8Array>,
  } as unknown as Response
}

/**
 * 创建 Mock fetch 行为函数（不含 vitest 依赖，可直接传递给 global.fetch）
 *
 * @param presetId 对应的预设 ID，决定返回的模型名和内容
 * @param mode 响应模式
 * @param customContent 自定义响应内容（可选，覆盖默认内容）
 *
 * @example 在测试中配合 vi.fn 使用：
 *   global.fetch = vi.fn().mockImplementation(
 *     createMockFetchImpl('deepseek', 'success')
 *   )
 */
export function createMockFetchImpl(
  presetId: string,
  mode: MockResponseMode = 'success',
  customContent?: string,
): (url: string, init?: RequestInit) => Promise<Response> {
  const presetData = (MOCK_PRESET_RESPONSES[presetId] ?? MOCK_PRESET_RESPONSES.deepseek)!

  return (_url: string, options?: RequestInit) => {
    // 优先从请求体回显 model，支持同一 preset 下多模型测试（如 GLM5.3）
    let requestedModel = presetData.model
    try {
      const body = options?.body ? JSON.parse(options.body as string) : {}
      if (typeof body.model === 'string' && body.model.length > 0) {
        requestedModel = body.model
      }
    } catch {
      // 忽略非 JSON body，回退到 preset 默认模型
    }

    if (mode === 'timeout') {
      return new Promise<Response>((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
      })
    }

    if (mode.startsWith('error-')) {
      const err = (ERROR_RESPONSES[mode] ?? ERROR_RESPONSES['error-500'])!
      return Promise.resolve(
        makeResponse(false, err.status, err.message, { error: { message: err.message } }),
      )
    }

    return Promise.resolve(
      makeResponse(true, 200, 'OK', {
        id: `chatcmpl-mock-${presetId}`,
        object: 'chat.completion',
        created: Date.now(),
        model: requestedModel,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: customContent ?? presetData.content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: presetData.promptTokens,
          completion_tokens: presetData.completionTokens,
          total_tokens: presetData.promptTokens + presetData.completionTokens,
        },
      }),
    )
  }
}

/**
 * 生成指定预设的 Mock LLM 配置
 */
export function createMockConfig(preset: LlmPreset, apiKey: string = 'sk-mock-test-key') {
  return {
    baseURL: preset.baseURL,
    apiKey,
    model: preset.defaultModel,
    maxTokens: 1024,
    temperature: 0.7,
    timeout: LLM_DEFAULT_TIMEOUT,
  }
}

/** 所有预设 ID 列表（不含 custom） */
export const ALL_PRESET_IDS = Object.keys(MOCK_PRESET_RESPONSES)

/** 国内预设 ID 列表 */
export const DOMESTIC_PRESET_IDS = [
  'deepseek',
  'kimi',
  'qwen',
  'tencent-hunyuan',
  'bytedance-doubao',
  'baidu-ernie',
  'zhipu-glm',
  'siliconflow',
]

/** 境外预设 ID 列表 */
export const OVERSEAS_PRESET_IDS = [
  'openai',
  'anthropic',
  'google-gemini',
  'xai-grok',
]