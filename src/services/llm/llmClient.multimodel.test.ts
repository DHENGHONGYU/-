/**
 * @test_id V9-TEST-ST-085
 * LLM 客户端补充测试
 *
 * 覆盖：
 * - chat() 同步调用（成功/失败/超时/配置校验）
 * - 多模型预设配置（DeepSeek/Kimi/通义千问/硅基流动）
 * - temperature / maxTokens / timeout 参数透传
 * - v6ScorePrompt 构建器
 * - tradeReviewAI 异步 LLM 增强模式
  * @covers_docs [V9-DOC-PROJ-054, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-ARCH-008, V9-DOC-FRONT-012]
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
import {
  createMockFetchImpl,
  createMockConfig,
  ALL_PRESET_IDS,
  DOMESTIC_PRESET_IDS,
  OVERSEAS_PRESET_IDS,
  MOCK_PRESET_RESPONSES,
} from '@/services/llm/llmMockResponses'
import { buildV6ScorePrompt, type V6ScorePromptInput } from '@/services/scoring/v6ScorePrompt'

// ============================================================
// chat() 同步调用测试
// ============================================================

describe('llmClient chat()', () => {
  const mockMessages = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'What is 1+1?' },
  ]

  const validConfig: Partial<LlmConfig> = {
    baseURL: 'https://api.deepseek.com',
    apiKey: 'sk-test-key',
    model: 'deepseek-chat',
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
        model: 'deepseek-chat',
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
    expect(body.model).toBe('deepseek-chat')
    expect(body.messages).toEqual(mockMessages)
    expect(body.temperature).toBe(0.2)

    expect(result.content).toBe('1+1=2')
    expect(result.model).toBe('deepseek-chat')
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

describe('LLM model presets', () => {
  test('should have at least 12 non-custom presets', () => {
    const nonCustom = LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')
    expect(nonCustom.length).toBeGreaterThanOrEqual(12)
  })

  test('DeepSeek preset should have chat models', () => {
    const deepseek = getPresetById('deepseek')
    expect(deepseek).toBeDefined()
    expect(deepseek!.defaultModel).toBe('deepseek-chat')
    expect(deepseek!.models).toContain('deepseek-chat')
    expect(deepseek!.models).toContain('deepseek-reasoner')
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

  test('inferPresetId should identify OpenAI preset', () => {
    expect(inferPresetId('https://api.openai.com/v1')).toBe('openai')
  })

  test('inferPresetId should return custom for unknown URL', () => {
    expect(inferPresetId('https://api.unknown-provider.com')).toBe('custom')
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
    expect(config.model).toBe('deepseek-chat')
    vi.unstubAllEnvs()
  })
})

// ============================================================
// V6 评分 Prompt 构建器测试
// ============================================================

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
      model: 'deepseek-chat',
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

// ============================================================
// 全模型预设覆盖测试
// ============================================================

describe('all model presets', () => {
  test('LLM_MODEL_PRESETS should contain 13 presets (12 providers + custom)', () => {
    expect(LLM_MODEL_PRESETS).toHaveLength(13)
  })

  test('should include 8 domestic presets', () => {
    const domestic = LLM_MODEL_PRESETS.filter(
      (p) => DOMESTIC_PRESET_IDS.includes(p.id),
    )
    expect(domestic).toHaveLength(8)
  })

  test('should include 4 overseas presets', () => {
    const overseas = LLM_MODEL_PRESETS.filter(
      (p) => OVERSEAS_PRESET_IDS.includes(p.id),
    )
    expect(overseas).toHaveLength(4)
  })

  test('ALL_PRESET_IDS should match MOCK_PRESET_RESPONSES keys', () => {
    expect(ALL_PRESET_IDS).toEqual(Object.keys(MOCK_PRESET_RESPONSES))
    expect(ALL_PRESET_IDS).toHaveLength(12)
  })

  // —— 国内模型预设逐一验证 ——

  test('腾讯混元 preset should have correct fields', () => {
    const preset = getPresetById('tencent-hunyuan')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('Tencent')
    expect(preset!.defaultModel).toBe('hy3')
    expect(preset!.baseURL).toBe('https://tokenhub.tencentmaas.com/v1')
    expect(preset!.models).toContain('hy3')
    expect(preset!.models).toContain('hy-mt2-pro')
    expect(preset!.contextWindow).toBe(256_000)
    expect(preset!.inputPrice).toBe('$0.28')
    expect(preset!.outputPrice).toBe('$1.12')
  })

  test('TRAE 豆包 preset should have correct fields', () => {
    const preset = getPresetById('bytedance-doubao')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('ByteDance')
    expect(preset!.defaultModel).toBe('doubao-pro-32k')
    expect(preset!.baseURL).toBe('https://ark.cn-beijing.volces.com/api/v3')
    expect(preset!.models).toContain('doubao-pro-4k')
    expect(preset!.models).toContain('doubao-ultra')
    expect(preset!.contextWindow).toBe(128_000)
    expect(preset!.inputPrice).toBe('$0.56')
    expect(preset!.outputPrice).toBe('$1.40')
  })

  test('百度文心一言 preset should have correct fields', () => {
    const preset = getPresetById('baidu-ernie')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('Baidu')
    expect(preset!.defaultModel).toBe('ERNIE-4.5-Turbo')
    expect(preset!.baseURL).toBe('https://qianfan.baidubce.com/v2')
    expect(preset!.models).toContain('ERNIE-4.5-Turbo')
    expect(preset!.models).toContain('ERNIE-Speed-128K')
    expect(preset!.contextWindow).toBe(128_000)
    expect(preset!.inputPrice).toBe('$0.11')
    expect(preset!.outputPrice).toBe('$0.28')
  })

  test('智谱 GLM preset should have correct fields', () => {
    const preset = getPresetById('zhipu-glm')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('Zhipu AI')
    expect(preset!.defaultModel).toBe('glm-5-turbo')
    expect(preset!.baseURL).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(preset!.models).toContain('glm-5')
    expect(preset!.models).toContain('glm-5-turbo')
    expect(preset!.contextWindow).toBe(128_000)
    expect(preset!.inputPrice).toBe('$0.70')
    expect(preset!.outputPrice).toBe('$2.10')
  })

  test('智谱 GLM preset should include glm-5.3 for strong-model testing', () => {
    const preset = getPresetById('zhipu-glm')
    expect(preset).toBeDefined()
    expect(preset!.models).toContain('glm-5.3')
  })

  // —— 境外模型预设逐一验证 ——

  test('OpenAI GPT preset should have correct fields', () => {
    const preset = getPresetById('openai')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('OpenAI')
    expect(preset!.defaultModel).toBe('gpt-4o')
    expect(preset!.baseURL).toBe('https://api.openai.com/v1')
    expect(preset!.models).toContain('gpt-4o')
    expect(preset!.models).toContain('gpt-4o-mini')
    expect(preset!.contextWindow).toBe(1_000_000)
    expect(preset!.inputPrice).toBe('$2.50')
    expect(preset!.outputPrice).toBe('$10.00')
  })

  test('Anthropic Claude preset should have correct fields', () => {
    const preset = getPresetById('anthropic')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('Anthropic')
    expect(preset!.defaultModel).toBe('claude-3.5-sonnet')
    expect(preset!.baseURL).toBe('https://api.anthropic.com')
    expect(preset!.models).toContain('claude-3.5-sonnet')
    expect(preset!.models).toContain('claude-opus-4.8')
    expect(preset!.contextWindow).toBe(200_000)
    expect(preset!.inputPrice).toBe('$3.00')
    expect(preset!.outputPrice).toBe('$15.00')
    expect(preset!.apiStyle).toBe('anthropic')
    expect(preset!.notes).toContain('x-api-key')
  })

  test('Google Gemini preset should have correct fields', () => {
    const preset = getPresetById('google-gemini')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('Google')
    expect(preset!.defaultModel).toBe('gemini-2.0-flash')
    expect(preset!.baseURL).toBe('https://generativelanguage.googleapis.com')
    expect(preset!.models).toContain('gemini-2.0-flash')
    expect(preset!.models).toContain('gemini-3.5-flash')
    expect(preset!.contextWindow).toBe(1_000_000)
    expect(preset!.inputPrice).toBe('$2.00')
    expect(preset!.outputPrice).toBe('$12.00')
    expect(preset!.apiStyle).toBe('gemini')
    expect(preset!.notes).toBeDefined()
  })

  test('xAI Grok preset should have correct fields', () => {
    const preset = getPresetById('xai-grok')
    expect(preset).toBeDefined()
    expect(preset!.provider).toBe('xAI')
    expect(preset!.defaultModel).toBe('grok-4')
    expect(preset!.baseURL).toBe('https://api.x.ai/v1')
    expect(preset!.models).toContain('grok-4')
    expect(preset!.models).toContain('grok-4.5')
    expect(preset!.contextWindow).toBe(256_000)
    expect(preset!.inputPrice).toBe('$2.00')
    expect(preset!.outputPrice).toBe('$6.00')
  })
})

// ============================================================
// inferPresetId 全模型识别测试
// ============================================================

describe('inferPresetId for all presets', () => {
  test.each([
    ['https://api.deepseek.com', 'deepseek'],
    ['https://api.moonshot.cn', 'kimi'],
    ['https://dashscope.aliyuncs.com/compatible-mode', 'qwen'],
    ['https://tokenhub.tencentmaas.com/v1', 'tencent-hunyuan'],
    ['https://ark.cn-beijing.volces.com/api/v3', 'bytedance-doubao'],
    ['https://qianfan.baidubce.com/v2', 'baidu-ernie'],
    ['https://open.bigmodel.cn/api/paas/v4', 'zhipu-glm'],
    ['https://api.siliconflow.cn', 'siliconflow'],
    ['https://api.openai.com/v1', 'openai'],
    ['https://api.anthropic.com', 'anthropic'],
    ['https://generativelanguage.googleapis.com', 'google-gemini'],
    ['https://api.x.ai/v1', 'xai-grok'],
  ])('inferPresetId(%s) should return %s', (url, expected) => {
    expect(inferPresetId(url)).toBe(expected)
  })

  test('inferPresetId should return custom for empty URL', () => {
    expect(inferPresetId('')).toBe('custom')
  })

  test('inferPresetId should return custom for unknown URL', () => {
    expect(inferPresetId('https://some-random-api.com/v1')).toBe('custom')
  })
})

// ============================================================
// 全模型端点构建 Mock 集成测试
// ============================================================

describe('all presets endpoint construction with mock', () => {
  const mockMessages = [
    { role: 'user' as const, content: 'Hello, test' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    { id: 'deepseek', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'kimi', baseURL: 'https://api.moonshot.cn', model: 'kimi-k2.7-code', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'qwen', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen3.6-flash', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'tencent-hunyuan', baseURL: 'https://tokenhub.tencentmaas.com/v1', model: 'hy3', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'bytedance-doubao', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'baidu-ernie', baseURL: 'https://qianfan.baidubce.com/v2', model: 'ERNIE-4.5-Turbo', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'zhipu-glm', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5-turbo', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'siliconflow', baseURL: 'https://api.siliconflow.cn', model: 'Qwen/Qwen2.5-7B-Instruct', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
    { id: 'anthropic', baseURL: 'https://api.anthropic.com', model: 'claude-3.5-sonnet', path: '/v1/messages', authHeader: 'x-api-key', authValue: 'sk-mock-test-key' },
    { id: 'google-gemini', baseURL: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash', path: '/v1beta/models', authHeader: 'Content-Type', authValue: 'application/json' },
    { id: 'xai-grok', baseURL: 'https://api.x.ai/v1', model: 'grok-4', path: '/v1/chat/completions', authHeader: 'Authorization', authValue: 'Bearer sk-mock-test-key' },
  ])('$id should construct correct endpoint', async ({ id, baseURL, model, path, authHeader, authValue }) => {
    const mockFetch = vi.fn().mockImplementation(createMockFetchImpl(id, 'success'))
    global.fetch = mockFetch

    const preset = getPresetById(id)!
    const result = await chat(mockMessages, createMockConfig(preset))

    const expectedURL = `${baseURL}${path}`
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toBe(expectedURL)
    expect(mockFetch.mock.calls[0]![1].headers[authHeader]).toBe(authValue)

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body)
    expect(body.model).toBe(model)

    expect(result.model).toBe(model)
    expect(result.content).toBeTruthy()
    expect(result.usage?.totalTokens).toBeGreaterThan(0)
  })

  test('zhipu-glm endpoint should support glm-5.3 model and echo it in response', async () => {
    const mockFetch = vi.fn().mockImplementation(createMockFetchImpl('zhipu-glm', 'success'))
    global.fetch = mockFetch

    const result = await chat(mockMessages, {
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: 'sk-glm53-test',
      model: 'glm-5.3',
    })

    expect(mockFetch.mock.calls[0]![0]).toBe('https://open.bigmodel.cn/api/paas/v4/v1/chat/completions')
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body)
    expect(body.model).toBe('glm-5.3')
    expect(result.model).toBe('glm-5.3')
    expect(result.content).toBeTruthy()
  })

  test('all presets should normalize baseURL with trailing slash', async () => {
    for (const presetId of ALL_PRESET_IDS) {
      const preset = getPresetById(presetId)!
      const mockFetch = vi.fn().mockImplementation(createMockFetchImpl(presetId, 'success'))
      global.fetch = mockFetch

      const result = await chat(mockMessages, {
        baseURL: `${preset.baseURL}/`,
        apiKey: 'sk-trail-test',
        model: preset.defaultModel,
      })

      const callURL = mockFetch.mock.calls[0]![0] as string
      expect(callURL).not.toMatch(/\/\/v1/)
      expect(result.model).toBe(preset.defaultModel)
    }
  })
})

// ============================================================
// Mock 数据工厂本身的完整性测试
// ============================================================

describe('llmMockResponses factory', () => {
  test('ALL_PRESET_IDS should have 12 entries', () => {
    expect(ALL_PRESET_IDS).toHaveLength(12)
  })

  test('DOMESTIC_PRESET_IDS should have 8 entries', () => {
    expect(DOMESTIC_PRESET_IDS).toHaveLength(8)
    for (const id of DOMESTIC_PRESET_IDS) {
      expect(MOCK_PRESET_RESPONSES[id]).toBeDefined()
    }
  })

  test('OVERSEAS_PRESET_IDS should have 4 entries', () => {
    expect(OVERSEAS_PRESET_IDS).toHaveLength(4)
    for (const id of OVERSEAS_PRESET_IDS) {
      expect(MOCK_PRESET_RESPONSES[id]).toBeDefined()
    }
  })

  test('each mock response should have content, model, promptTokens, completionTokens', () => {
    for (const id of ALL_PRESET_IDS) {
      const resp = MOCK_PRESET_RESPONSES[id]!
      expect(resp.content.length).toBeGreaterThan(0)
      expect(resp.model.length).toBeGreaterThan(0)
      expect(resp.promptTokens).toBeGreaterThan(0)
      expect(resp.completionTokens).toBeGreaterThan(0)
    }
  })

  test('createMockConfig should generate valid config for any preset', () => {
    for (const id of ALL_PRESET_IDS) {
      const preset = getPresetById(id)
      expect(preset).toBeDefined()
      const config = createMockConfig(preset!)
      expect(config.baseURL).toBe(preset!.baseURL)
      expect(config.model).toBe(preset!.defaultModel)
      expect(config.apiKey).toBe('sk-mock-test-key')
      expect(config.maxTokens).toBe(1024)
      expect(config.temperature).toBe(0.7)
      expect(config.timeout).toBe(10000)
    }
  })

  test('createMockFetchImpl should return different content per preset', async () => {
    for (const id of ALL_PRESET_IDS) {
      const impl = createMockFetchImpl(id, 'success')
      const response = await impl('https://test')
      const body = await response.json()
      expect(body.model).toBe(MOCK_PRESET_RESPONSES[id]!.model)
      expect(body.choices[0]!.message.content).toBe(MOCK_PRESET_RESPONSES[id]!.content)
    }
  })

  test('createMockFetchImpl error-401 should return 401', async () => {
    const impl = createMockFetchImpl('deepseek', 'error-401')
    const response = await impl('https://test')
    expect(response.ok).toBe(false)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.message).toBe('Invalid API key')
  })

  test('createMockFetchImpl error-429 should return 429', async () => {
    const impl = createMockFetchImpl('deepseek', 'error-429')
    const response = await impl('https://test')
    expect(response.ok).toBe(false)
    expect(response.status).toBe(429)
  })

  test('createMockFetchImpl error-500 should return 500', async () => {
    const impl = createMockFetchImpl('deepseek', 'error-500')
    const response = await impl('https://test')
    expect(response.ok).toBe(false)
    expect(response.status).toBe(500)
  })

  test('createMockFetchImpl should fallback to deepseek for unknown preset', async () => {
    const impl = createMockFetchImpl('nonexistent-preset', 'success')
    const response = await impl('https://test')
    const body = await response.json()
    expect(body.model).toBe('deepseek-chat')
    expect(body.choices[0]!.message.content).toBe(MOCK_PRESET_RESPONSES.deepseek!.content)
  })
})
