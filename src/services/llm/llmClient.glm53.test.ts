/**
 * @test_id V9-TEST-ST-092
 * GLM5.3 回归测试套件（zhipu-glm preset）
 *
 * 目标：在「混元偏弱」背景下，所有 LLM 依赖型功能修改后必须用强模型 GLM5.3 回归。
 * 本套件覆盖：
 * - zhipu-glm preset 已登记 glm-5.3 模型
 * - chat() 在 glm-5.3 下请求体 model 正确、响应回显 model 正确
 * - 结构化输出（V6 评分补充）经 glm-5.3 返回可解析 JSON
 * - glm-5.3 下的错误/超时兜底（LlmApiError）
 *
 * 运行：npm run test:llm:glm53
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-PROJ-054, V9-DOC-PROJ-113]
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { chat, LlmApiError, safeParseJson } from '@/services/llm/llmClient'
import { getPresetById } from '@/config/llmConfig'
import { createMockFetchImpl } from '@/services/llm/llmMockResponses'
import { buildV6ScorePrompt } from '@/services/scoring/v6ScorePrompt'

const GLM53_MODEL = 'glm-5.3'

/** 取 zhipu-glm preset 的真实 baseURL，避免硬编码漂移 */
function glm53Config(overrides: Record<string, unknown> = {}) {
  const preset = getPresetById('zhipu-glm')!
  return {
    baseURL: preset.baseURL,
    apiKey: 'sk-mock-glm53',
    model: GLM53_MODEL,
    ...overrides,
  }
}

describe('GLM5.3 回归测试（zhipu-glm）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('zhipu-glm preset 必须登记 glm-5.3 模型', () => {
    const preset = getPresetById('zhipu-glm')
    expect(preset).toBeDefined()
    expect(preset!.models).toContain(GLM53_MODEL)
    expect(preset!.defaultModel).not.toBe(GLM53_MODEL) // 默认仍走 glm-5-turbo，glm-5.3 为可选强模型
  })

  test('chat() 在 glm-5.3 下请求体 model 与响应回显 model 一致', async () => {
    global.fetch = vi.fn().mockImplementation(createMockFetchImpl('zhipu-glm', 'success'))

    const result = await chat([{ role: 'user', content: '请对 600000 进行V6评分补充' }], glm53Config())

    // 响应 model 应回显为 glm-5.3
    expect(result.model).toBe(GLM53_MODEL)

    // 请求体确实携带 glm-5.3
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.model).toBe(GLM53_MODEL)
    expect(body.messages[0].content).toContain('600000')
  })

  test('GLM5.3 结构化输出（V6 评分补充）可解析为 JSON', async () => {
    const mockContent = JSON.stringify({
      supplements: [{ name: '成长', score: 4.2, rationale: '营收增速优于行业' }],
    })
    global.fetch = vi.fn().mockImplementation(
      createMockFetchImpl('zhipu-glm', 'success', mockContent),
    )

    const messages = buildV6ScorePrompt({
      symbol: '600000',
      stock: undefined,
      ruleFactors: { 质量: 3.8 },
      quoteStats: { hasHistory: false, historyDays: 0, latestClose: undefined, return20d: undefined, volatility20d: undefined, avgTurnover20d: undefined },
      missingFactors: ['成长'],
    })

    const result = await chat(messages, glm53Config(), { responseFormat: { type: 'json_object' } })

    expect(result.model).toBe(GLM53_MODEL)
    // 结构化内容被解析为对象
    expect(typeof result.parsed).toBe('object')
    const parsed = result.parsed as { supplements: Array<{ name: string; score: number }> }
    expect(parsed.supplements[0]!.name).toBe('成长')
    expect(parsed.supplements[0]!.score).toBeCloseTo(4.2, 1)
  })

  test('GLM5.3 下 HTTP 500 应抛出 LlmApiError', async () => {
    global.fetch = vi.fn().mockImplementation(createMockFetchImpl('zhipu-glm', 'error-500'))

    await expect(chat([{ role: 'user', content: 'test' }], glm53Config())).rejects.toThrow(LlmApiError)
  })

  test('GLM5.3 下超时（abort）应抛出 LlmApiError 超时', async () => {
    global.fetch = vi.fn().mockImplementation(createMockFetchImpl('zhipu-glm', 'timeout'))

    await expect(
      chat([{ role: 'user', content: 'test' }], glm53Config({ timeout: 50 })),
    ).rejects.toThrow(/超时|LLM 请求失败/)
  })

  test('弱模型（混元）返回 markdown 围栏包裹的 JSON 时仍能解析', async () => {
    const raw = '```json\n{"supplements":[{"name":"情绪","score":3.5,"rationale":"换手率偏高"}]}\n```'
    global.fetch = vi.fn().mockImplementation(
      createMockFetchImpl('tencent-hunyuan', 'success', raw),
    )

    const messages = buildV6ScorePrompt({
      symbol: '000001',
      stock: undefined,
      ruleFactors: {},
      quoteStats: { hasHistory: false, historyDays: 0, latestClose: undefined, return20d: undefined, volatility20d: undefined, avgTurnover20d: undefined },
      missingFactors: ['情绪'],
    })

    const result = await chat(messages, {
      baseURL: getPresetById('tencent-hunyuan')!.baseURL,
      apiKey: 'sk-mock-hunyuan',
      model: 'hy3',
    }, { responseFormat: { type: 'json_object' } })

    const parsed = result.parsed as { supplements: Array<{ name: string; score: number }> }
    expect(parsed.supplements[0]!.name).toBe('情绪')
    expect(parsed.supplements[0]!.score).toBeCloseTo(3.5, 1)
  })

  test('safeParseJson 对非法 JSON 返回 undefined 且不抛异常', () => {
    expect(safeParseJson('不是 JSON')).toBeUndefined()
    expect(safeParseJson('{"a":1')).toBeUndefined()
    expect(safeParseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(safeParseJson('{"b":2}')).toEqual({ b: 2 })
  })
})
