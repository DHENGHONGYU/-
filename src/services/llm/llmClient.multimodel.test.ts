/**
 * LLM 客户端补充测试
 *
 * 覆盖：
 * - chat() 同步调用（成功/失败/超时/配置校验）
 * - 多模型预设配置（DeepSeek/Kimi/通义千问/硅基流动）
 * - temperature / maxTokens / timeout 参数透传
 * - v6ScorePrompt 构建器
 * - tradeReviewAI 异步 LLM 增强模式
 */

 
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { chat, LlmConfigError, LlmApiError } from '@/services/llm/llmClient'
import type { LlmConfig } from '@/config/llmConfig'
import {
  LLM_MODEL_PRESETS,
  getPresetById,
  inferPresetId,
  isLlmConfigured,
  getDefaultLlmConfig,
} from '@/config/llmConfig'
import { buildV6ScorePrompt, type V6ScorePromptInput } from '@/services/scoring/v6ScorePrompt'

// ============================================================
// chat() 同步调用测试
// ============================================================

/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 .skip 标记并从 test:clean 的 --exclude 列表中删除
 */
describe('llmClient chat()', () => {
  const mockMessages = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'What is 1+1?' },
  ]

  const validConfig: Partial<LlmConfig> = {
    baseURL: 'https://api.deepseek.com',
    apiKey: 'sk-test-key',
    model: 'deepseek-v4-flash',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should call /v1/chat/completions with correct parameters', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-v4-flash',
        choices: [{ index: 0, message: { role: 'assistant', content: '1+1=2' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      }),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await chat(mockMessages, validConfig)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(callArgs[0]).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].headers['Authorization']).toBe('Bearer sk-test-key')

    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.messages).toEqual(mockMessages)
    expect(body.temperature).toBe(0.2)

    expect(result.content).toBe('1+1=2')
    expect(result.model).toBe('deepseek-v4-flash')
    expect(result.usage?.totalTokens).toBe(25)
  })

  test('should pass maxTokens when configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        model: 'test',
      }),
    })

    await chat(mockMessages, { ...validConfig, maxTokens: 4096 })

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
    expect(body.max_tokens).toBe(4096)
  })

  test('should pass custom temperature when configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        model: 'test',
      }),
    })

    await chat(mockMessages, { ...validConfig, temperature: 0.7 })

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
    expect(body.temperature).toBe(0.7)
  })

  test('should respect timeout via AbortController', async () => {
    vi.useFakeTimers()

    // 模拟 fetch：当 signal 触发 abort 时 reject
    global.fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          if (options.signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
      })
    })

    const promise = chat(mockMessages, { ...validConfig, timeout: 1000 })

    // 快进时间触发 setTimeout → AbortController.abort()
    vi.advanceTimersByTime(1001)

    await expect(promise).rejects.toThrow('LLM 请求超时')

    vi.useRealTimers()
  })

  test('should throw LlmConfigError when baseURL is empty', async () => {
    await expect(
      chat(mockMessages, { baseURL: '', apiKey: 'key', model: 'model' }),
    ).rejects.toThrow(LlmConfigError)
    await expect(
      chat(mockMessages, { baseURL: '', apiKey: 'key', model: 'model' }),
    ).rejects.toThrow('baseURL')
  })

  test('should throw LlmConfigError when apiKey is empty', async () => {
    await expect(
      chat(mockMessages, { baseURL: 'https://api.test.com', apiKey: '', model: 'model' }),
    ).rejects.toThrow(LlmConfigError)
    await expect(
      chat(mockMessages, { baseURL: 'https://api.test.com', apiKey: '', model: 'model' }),
    ).rejects.toThrow('apiKey')
  })

  test('should throw LlmConfigError when model is empty', async () => {
    await expect(
      chat(mockMessages, { baseURL: 'https://api.test.com', apiKey: 'key', model: '' }),
    ).rejects.toThrow(LlmConfigError)
    await expect(
      chat(mockMessages, { baseURL: 'https://api.test.com', apiKey: 'key', model: '' }),
    ).rejects.toThrow('model')
  })

  test('should throw LlmApiError on HTTP error with API message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        error: { message: 'Invalid API key' },
      }),
    })

    await expect(chat(mockMessages, validConfig)).rejects.toThrow(LlmApiError)
    await expect(chat(mockMessages, validConfig)).rejects.toThrow('Invalid API key')
  })

  test('should throw LlmApiError on HTTP error without API message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ error: {} }),
    })

    await expect(chat(mockMessages, validConfig)).rejects.toThrow(LlmApiError)
    await expect(chat(mockMessages, validConfig)).rejects.toThrow('HTTP 429')
  })

  test('should throw LlmApiError when choices is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [],
        model: 'test',
      }),
    })

    await expect(chat(mockMessages, validConfig)).rejects.toThrow('空 choices')
  })

  test('should throw LlmApiError when content is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '' } }],
        model: 'test',
      }),
    })

    await expect(chat(mockMessages, validConfig)).rejects.toThrow('空内容')
  })

  test('should handle API error in response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        error: { message: 'Rate limit exceeded' },
      }),
    })

    await expect(chat(mockMessages, validConfig)).rejects.toThrow(LlmApiError)
    await expect(chat(mockMessages, validConfig)).rejects.toThrow('Rate limit exceeded')
  })

  test('should return usage as undefined when not provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
        model: 'test',
      }),
    })

    const result = await chat(mockMessages, validConfig)
    expect(result.usage).toBeUndefined()
  })

  test('should normalize baseURL by removing trailing slash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        model: 'test',
      }),
    })

    await chat(mockMessages, { ...validConfig, baseURL: 'https://api.deepseek.com/' })

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(url).not.toContain('//v1')
  })
})

// ============================================================
// 多模型预设配置测试
// ============================================================

/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('LLM model presets', () => {
  test('should have at least 4 non-custom presets', () => {
    const nonCustom = LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')
    expect(nonCustom.length).toBeGreaterThanOrEqual(4)
  })

  test('DeepSeek preset should have V4 models', () => {
    const deepseek = getPresetById('deepseek')
    expect(deepseek).toBeDefined()
    expect(deepseek!.defaultModel).toBe('deepseek-v4-flash')
    expect(deepseek!.models).toContain('deepseek-v4-flash')
    expect(deepseek!.models).toContain('deepseek-v4-pro')
    expect(deepseek!.contextWindow).toBe(1_000_000)
    expect(deepseek!.inputPrice).toBe('$0.14')
    expect(deepseek!.outputPrice).toBe('$0.28')
  })

  test('Kimi preset should have K2.7 Code models', () => {
    const kimi = getPresetById('kimi')
    expect(kimi).toBeDefined()
    expect(kimi!.defaultModel).toBe('kimi-k2.7-code')
    expect(kimi!.models).toContain('kimi-k2.7-code')
    expect(kimi!.models).toContain('kimi-k2.7-code-highspeed')
    expect(kimi!.baseURL).toBe('https://api.moonshot.cn')
  })

  test('Qwen preset should have Qwen3.6 models', () => {
    const qwen = getPresetById('qwen')
    expect(qwen).toBeDefined()
    expect(qwen!.defaultModel).toBe('qwen3.6-flash')
    expect(qwen!.models).toContain('qwen3.6-max-preview')
    expect(qwen!.models).toContain('qwen3.6-plus')
    expect(qwen!.models).toContain('qwen3.6-flash')
    expect(qwen!.baseURL).toContain('dashscope')
  })

  test('SiliconFlow preset should have aggregated models', () => {
    const sf = getPresetById('siliconflow')
    expect(sf).toBeDefined()
    expect(sf!.models).toContain('deepseek-ai/DeepSeek-V4-Flash')
    expect(sf!.models.some((m) => m.includes('Qwen'))).toBe(true)
    expect(sf!.models.some((m) => m.includes('GLM'))).toBe(true)
  })

  test('Custom preset should have empty models', () => {
    const custom = getPresetById('custom')
    expect(custom).toBeDefined()
    expect(custom!.models).toEqual([])
    expect(custom!.baseURL).toBe('')
  })

  test('getPresetById should return undefined for unknown id', () => {
    expect(getPresetById('nonexistent')).toBeUndefined()
  })

  test('inferPresetId should identify DeepSeek', () => {
    expect(inferPresetId('https://api.deepseek.com')).toBe('deepseek')
  })

  test('inferPresetId should identify Kimi', () => {
    expect(inferPresetId('https://api.moonshot.cn')).toBe('kimi')
  })

  test('inferPresetId should identify Qwen', () => {
    expect(inferPresetId('https://dashscope.aliyuncs.com/compatible-mode')).toBe('qwen')
  })

  test('inferPresetId should identify SiliconFlow', () => {
    expect(inferPresetId('https://api.siliconflow.cn')).toBe('siliconflow')
  })

  test('inferPresetId should return custom for unknown URL', () => {
    expect(inferPresetId('https://api.openai.com')).toBe('custom')
  })

  test('isLlmConfigured should return false when baseURL is empty', () => {
    expect(isLlmConfigured({ baseURL: '', apiKey: 'key', model: 'model' })).toBe(false)
  })

  test('isLlmConfigured should return false when apiKey is empty', () => {
    expect(isLlmConfigured({ baseURL: 'url', apiKey: '', model: 'model' })).toBe(false)
  })

  test('isLlmConfigured should return true when both are set', () => {
    expect(isLlmConfigured({ baseURL: 'url', apiKey: 'key', model: 'model' })).toBe(true)
  })

  test('isLlmConfigured should trim whitespace', () => {
    expect(isLlmConfigured({ baseURL: '  ', apiKey: 'key', model: 'model' })).toBe(false)
    expect(isLlmConfigured({ baseURL: 'url', apiKey: '  ', model: 'model' })).toBe(false)
  })

  test('getDefaultLlmConfig should return DeepSeek defaults when no env', () => {
    // 清除 .env.local 中 VITE_LLM_MODEL 的覆盖，模拟无环境变量场景
    vi.stubEnv('VITE_LLM_MODEL', undefined)
    vi.stubEnv('VITE_LLM_BASE_URL', undefined)
    const config = getDefaultLlmConfig()
    expect(config.baseURL).toBe('https://api.deepseek.com')
    expect(config.model).toBe('deepseek-v4-flash')
    vi.unstubAllEnvs()
  })
})

// ============================================================
// V6 评分 Prompt 构建器测试
// ============================================================

/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('buildV6ScorePrompt', () => {
  const baseInput: V6ScorePromptInput = {
    symbol: '600519',
    stock: {
      symbol: '600519',
      name: '贵州茅台',
      sector: '白酒',
      price: 1688.0,
      pe: 25.3,
      pb: 8.1,
      roe: 0.32,
      marketCap: 21200e8,
      dataVersion: 1,
      pool: 'research',
      researchStatus: 'candidate',
      source: 'manual',
    },
    ruleFactors: { '估值': 4.2, '盈利能力': 3.8 },
    quoteStats: {
      hasHistory: true,
      historyDays: 60,
      latestClose: 1688.0,
      return20d: 0.05,
      volatility20d: 0.18,
      avgTurnover20d: 0.003,
    },
    missingFactors: ['成长性', '行业地位', '市场情绪'],
  }

  test('should return system + user messages', () => {
    const messages = buildV6ScorePrompt(baseInput)
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
  })

  test('should include symbol in user prompt', () => {
    const messages = buildV6ScorePrompt(baseInput)
    expect(messages[1]!.content).toContain('600519')
  })

  test('should include rule factors', () => {
    const messages = buildV6ScorePrompt(baseInput)
    expect(messages[1]!.content).toContain('估值')
    expect(messages[1]!.content).toContain('4.2')
  })

  test('should include missing factors', () => {
    const messages = buildV6ScorePrompt(baseInput)
    expect(messages[1]!.content).toContain('成长性')
    expect(messages[1]!.content).toContain('行业地位')
    expect(messages[1]!.content).toContain('市场情绪')
  })

  test('should include quote stats when hasHistory', () => {
    const messages = buildV6ScorePrompt(baseInput)
    expect(messages[1]!.content).toContain('K线天数')
    expect(messages[1]!.content).toContain('20日收益率')
  })

  test('should handle missing stock gracefully', () => {
    const messages = buildV6ScorePrompt({ ...baseInput, stock: undefined })
    expect(messages[1]!.content).toContain('暂无基础数据')
  })

  test('should handle no quote history', () => {
    const messages = buildV6ScorePrompt({
      ...baseInput,
      quoteStats: {
        hasHistory: false,
        historyDays: 0,
        latestClose: undefined,
        return20d: undefined,
        volatility20d: undefined,
        avgTurnover20d: undefined,
      },
    })
    expect(messages[1]!.content).toContain('无K线数据')
  })
})

// ============================================================
// 多供应商 endpoint 兼容性测试
// ============================================================

/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('multi-provider endpoint compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockMessages = [
    { role: 'user' as const, content: 'test' },
  ]

  const mockSuccessResponse = {
    ok: true,
    json: () => Promise.resolve({
      choices: [{ message: { content: 'ok' } }],
      model: 'test-model',
      usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
    }),
  }

  function createFetchVerifier() {
    return vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'ok' } }],
          model: 'test-model',
          usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
        }),
      }),
    )
  }

  test('DeepSeek endpoint should be /v1/chat/completions', async () => {
    const mockFetch = createFetchVerifier()
    global.fetch = mockFetch

    await chat(mockMessages, {
      baseURL: 'https://api.deepseek.com',
      apiKey: 'sk-ds',
      model: 'deepseek-v4-flash',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBe('Bearer sk-ds')
  })

  test('Kimi endpoint should be /v1/chat/completions', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockSuccessResponse)
    global.fetch = mockFetch

    await chat(mockMessages, {
      baseURL: 'https://api.moonshot.cn',
      apiKey: 'sk-kimi',
      model: 'kimi-k2.7-code',
    })

    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.moonshot.cn/v1/chat/completions')
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBe('Bearer sk-kimi')
  })

  test('Qwen endpoint should be /v1/chat/completions', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockSuccessResponse)
    global.fetch = mockFetch

    await chat(mockMessages, {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
      apiKey: 'sk-qwen',
      model: 'qwen3.6-flash',
    })

    expect(mockFetch.mock.calls[0]![0]).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    )
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBe('Bearer sk-qwen')
  })

  test('SiliconFlow endpoint should be /v1/chat/completions', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockSuccessResponse)
    global.fetch = mockFetch

    await chat(mockMessages, {
      baseURL: 'https://api.siliconflow.cn',
      apiKey: 'sk-sf',
      model: 'deepseek-ai/DeepSeek-V4-Flash',
    })

    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.siliconflow.cn/v1/chat/completions')
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBe('Bearer sk-sf')
  })
})
