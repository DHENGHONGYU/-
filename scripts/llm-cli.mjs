#!/usr/bin/env node
/**
 * llm-cli.mjs — 多模型 LLM 通用 CLI 测试工具
 *
 * 用法:
 *   node scripts/llm-cli.mjs --list                          # 列出所有模型预设
 *   node scripts/llm-cli.mjs -p deepseek -m deepseek-chat    # 使用指定 provider
 *   node scripts/llm-cli.mjs -p kimi --stream                # 流式调用 Kimi
 *   node scripts/llm-cli.mjs -p qwen --msg "你好"           # 自定义消息
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/llm-cli.mjs -p deepseek
 *
 * 安全约束: 绝不打印 API Key 明文；仅掩码展示；禁止写入日志文件。
 */

// ============================================================
// 模型预设数据（与 src/config/llmConfig.ts 保持同步）
// ============================================================

const PRESETS = [
  // —— 国内模型 ——
  {
    id: 'deepseek', region: 'domestic', name: 'DeepSeek',
    provider: 'DeepSeek', baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    contextWindow: 1_000_000, inputPrice: '$0.14', outputPrice: '$0.28',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'kimi', region: 'domestic', name: 'Kimi K2',
    provider: 'Moonshot', baseURL: 'https://api.moonshot.cn',
    defaultModel: 'kimi-k2.7-code',
    models: ['kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k3'],
    contextWindow: 262_144, inputPrice: '$0.74', outputPrice: '$3.50',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'qwen', region: 'domestic', name: '通义千问 Qwen',
    provider: 'Alibaba', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    defaultModel: 'qwen3.6-flash',
    models: ['qwen3.6-flash', 'qwen3.6-plus', 'qwen3.6-max-preview'],
    contextWindow: 1_000_000, inputPrice: '$0.50', outputPrice: '$3.00',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'tencent-hunyuan', region: 'domestic', name: '腾讯混元',
    provider: 'Tencent', baseURL: 'https://tokenhub.tencentmaas.com/v1',
    defaultModel: 'hy3',
    models: ['hy3', 'hy-mt2-pro', 'hy-mt2-plus', 'hunyuan-role-latest'],
    contextWindow: 256_000, inputPrice: '$0.28', outputPrice: '$1.12',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'bytedance-doubao', region: 'domestic', name: 'TRAE 豆包',
    provider: 'ByteDance', baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-ultra', 'doubao-lite-32k'],
    contextWindow: 128_000, inputPrice: '$0.56', outputPrice: '$1.40',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'baidu-ernie', region: 'domestic', name: '百度文心一言',
    provider: 'Baidu', baseURL: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ERNIE-4.5-Turbo',
    models: ['ERNIE-4.5-Turbo', 'ERNIE-Speed-8K', 'ERNIE-Speed-128K'],
    contextWindow: 128_000, inputPrice: '$0.11', outputPrice: '$0.28',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'zhipu-glm', region: 'domestic', name: '智谱 GLM',
    provider: 'Zhipu AI', baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5-turbo',
    models: ['glm-5', 'glm-5-turbo', 'glm-4-flashx', 'glm-4-flash'],
    contextWindow: 128_000, inputPrice: '$0.70', outputPrice: '$2.10',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'siliconflow', region: 'domestic', name: '硅基流动',
    provider: 'SiliconFlow', baseURL: 'https://api.siliconflow.cn',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V4-Flash', 'THUDM/GLM-4-9B-Chat', 'meta-llama/Llama-3.3-70B-Instruct'],
    contextWindow: 128_000, inputPrice: '$0.42', outputPrice: '$0.42',
    apiStyle: 'openai-compatible',
  },
  // —— 境外模型 ——
  {
    id: 'openai', region: 'overseas', name: 'OpenAI GPT',
    provider: 'OpenAI', baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    contextWindow: 1_000_000, inputPrice: '$2.50', outputPrice: '$10.00',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'anthropic', region: 'overseas', name: 'Anthropic Claude',
    provider: 'Anthropic', baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3.5-sonnet',
    models: ['claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-opus-4.8'],
    contextWindow: 200_000, inputPrice: '$3.00', outputPrice: '$15.00',
    apiStyle: 'anthropic',
    notes: '使用 /v1/messages 端点和 x-api-key 认证',
  },
  {
    id: 'google-gemini', region: 'overseas', name: 'Google Gemini',
    provider: 'Google', baseURL: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-3-pro-preview', 'gemini-3.5-flash'],
    contextWindow: 1_000_000, inputPrice: '$2.00', outputPrice: '$12.00',
    apiStyle: 'gemini',
    notes: '使用 ?key= 查询参数认证',
  },
  {
    id: 'xai-grok', region: 'overseas', name: 'xAI Grok',
    provider: 'xAI', baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    models: ['grok-4', 'grok-4.5', 'grok-3-mini'],
    contextWindow: 256_000, inputPrice: '$2.00', outputPrice: '$6.00',
    apiStyle: 'openai-compatible',
  },
]

// ============================================================
// 工具函数
// ============================================================

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--list' || arg === '-l') args.list = true
    else if (arg === '--stream' || arg === '-s') args.stream = true
    else if (arg === '--verbose' || arg === '-v') args.verbose = true
    else if (arg === '--raw') args.raw = true
    else if (arg === '--region') args.region = argv[++i]
    else if (arg === '--provider' || arg === '-p') args.provider = argv[++i]
    else if (arg === '--model' || arg === '-m') args.model = argv[++i]
    else if (arg === '--message' || arg === '--msg') args.message = argv[++i]
    else if (arg === '--api-key') args.apiKey = argv[++i]
    else if (arg === '--temperature') args.temperature = parseFloat(argv[++i])
    else if (arg === '--max-tokens') args.maxTokens = parseInt(argv[++i], 10)
    else if (arg === '--timeout') args.timeout = parseInt(argv[++i], 10)
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg.startsWith('-')) {
      console.error(`未知参数: ${arg}`)
      args._.push(arg)
    } else {
      args._.push(arg)
    }
  }
  return args
}

function maskKey(key) {
  if (!key) return 'NOT_SET'
  if (key.length <= 10) return key.slice(0, 2) + '***'
  return key.slice(0, 6) + '***' + key.slice(-4)
}

function getApiKey(providerId, explicitKey) {
  if (explicitKey) return explicitKey
  if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY
  if (process.env[`${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`]) {
    return process.env[`${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`]
  }
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  return null
}

function buildEndpointAndHeaders(baseURL, apiKey, apiStyle) {
  const normalizedURL = baseURL.replace(/\/+$/, '')
  switch (apiStyle) {
    case 'anthropic':
      return {
        endpoint: `${normalizedURL}/v1/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    case 'gemini':
      return {
        endpoint: `${normalizedURL}/v1beta/models`,
        headers: { 'Content-Type': 'application/json' },
      }
    case 'openai-compatible':
    default:
      return {
        endpoint: `${normalizedURL}/v1/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
  }
}

function buildBody(preset, model, message, temperature, maxTokens, stream) {
  if (preset.apiStyle === 'anthropic') {
    const body = {
      model,
      messages: [{ role: 'user', content: message }],
      max_tokens: maxTokens ?? 1024,
      stream,
    }
    return body
  }
  if (preset.apiStyle === 'gemini') {
    const body = {
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { temperature: temperature ?? 0.2, maxOutputTokens: maxTokens ?? 256 },
    }
    return body
  }
  const body = {
    model,
    messages: [{ role: 'user', content: message }],
    temperature: temperature ?? 0.2,
  }
  if (maxTokens !== undefined) body.max_tokens = maxTokens
  if (stream) body.stream = true
  return body
}

// ============================================================
// 命令实现
// ============================================================

function listPresets(region) {
  const filtered = region ? PRESETS.filter(p => p.region === region) : PRESETS
  console.log('')
  console.log('可用模型预设列表')
  console.log('='.repeat(80))
  console.log('  ID               名称               供应商          地区      上下文窗口    价格(输入/输出)')
  console.log('-'.repeat(80))
  for (const p of filtered) {
    const id = p.id.padEnd(17)
    const name = p.name.padEnd(16)
    const provider = p.provider.padEnd(14)
    const regionLabel = p.region === 'domestic' ? '🇨🇳 国内' : '🌍 境外'
    const window = (p.contextWindow ? `${(p.contextWindow / 1000).toFixed(0)}K` : 'N/A').padEnd(10)
    const price = `${p.inputPrice ?? '?'} / ${p.outputPrice ?? '?'}`
    console.log(`  ${id}${name}${provider}${regionLabel}${window}${price}`)
    if (p.apiStyle && p.apiStyle !== 'openai-compatible') {
      console.log(`    API风格: ${p.apiStyle}${p.notes ? ` | ${p.notes}` : ''}`)
    }
    console.log(`    默认模型: ${p.defaultModel} | 可选: ${p.models.join(', ')}`)
    console.log('')
  }
  console.log('='.repeat(80))
  console.log('\n提示: 使用 --provider <ID> 选择模型，或 --help 查看所有选项')
  console.log('')
}

async function callApi(preset, opts) {
  const apiKey = getApiKey(preset.id, opts.apiKey)
  if (!apiKey) {
    console.error(`\n[FAIL] 未找到 API Key。请通过以下方式之一设置：`)
    console.error(`  1. --api-key <key>`)
    console.error(`  2. 环境变量 ${preset.id.toUpperCase().replace(/-/g, '_')}_API_KEY`)
    console.error(`  3. 环境变量 LLM_API_KEY`)
    console.error(`  4. 环境变量 DEEPSEEK_API_KEY`)
    process.exit(1)
  }

  const model = opts.model || preset.defaultModel
  const message = opts.message || opts._[0] || '你好，请用一句话介绍你自己。'
  const temperature = opts.temperature
  const maxTokens = opts.maxTokens
  const isStream = !!opts.stream
  const timeoutMs = (opts.timeout ?? 60) * 1000
  const verbose = !!opts.verbose

  const { endpoint, headers } = buildEndpointAndHeaders(preset.baseURL, apiKey, preset.apiStyle)
  const body = buildBody(preset, model, message, temperature, maxTokens, isStream)

  console.log('')
  console.log('API 调用测试')
  console.log('='.repeat(60))
  console.log(`  模型预设 : ${preset.id} (${preset.name})`)
  console.log(`  API 风格 : ${preset.apiStyle || 'openai-compatible'}`)
  console.log(`  API Key  : ${maskKey(apiKey)}`)
  console.log(`  端点     : ${endpoint}`)
  console.log(`  模型     : ${model}`)
  console.log(`  模式     : ${isStream ? '流式' : '非流式'}`)
  console.log(`  消息     : ${message.length > 50 ? message.slice(0, 50) + '...' : message}`)
  console.log('='.repeat(60))

  if (verbose) {
    console.log(`\n[DEBUG] 请求 Headers:`)
    for (const [k, v] of Object.entries(headers)) {
      if (k === 'Authorization' || k === 'x-api-key') {
        console.log(`  ${k}: ************`)
      } else {
        console.log(`  ${k}: ${v}`)
      }
    }
    console.log(`\n[DEBUG] 请求 Body:\n${JSON.stringify(body, null, 2)}`)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const requestStartTs = performance.now()

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const ttfbMs = Math.round(performance.now() - requestStartTs)

    console.log(`\n[DEBUG] 响应接收 | Status: ${response.status} ${response.ok ? 'OK' : 'NOT OK'} | TTFB: ${ttfbMs}ms`)
    console.log(`[DEBUG] Content-Type: ${response.headers.get('content-type') ?? 'N/A'}`)

    if (!response.ok) {
      const text = await response.text()
      console.error(`\n[FAIL] HTTP ${response.status} 错误`)
      console.error(`[DEBUG] 错误响应: ${text.slice(0, 500)}`)
      process.exit(1)
    }

    if (isStream) {
      await handleStreaming(response, preset, model, requestStartTs, ttfbMs, opts.raw)
    } else {
      await handleNonStreaming(response, preset, model, requestStartTs, ttfbMs, opts.raw)
    }
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - requestStartTs)
    console.error(`\n[FAIL] 请求异常 | 耗时: ${elapsedMs}ms`)
    console.error(`  错误类型: ${err.constructor.name}`)
    console.error(`  错误消息: ${err.message}`)
    if (err.cause) console.error(`  Cause: ${err.cause}`)
    process.exit(1)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleNonStreaming(response, preset, model, requestStartTs, ttfbMs, raw) {
  const data = await response.json()
  const totalMs = Math.round(performance.now() - requestStartTs)

  if (raw) {
    console.log(`\n[DEBUG] 完整响应体:\n${JSON.stringify(data, null, 2)}`)
  }

  const content = data?.choices?.[0]?.message?.content ?? '(无内容)'
  const usage = data?.usage ?? {}

  console.log('')
  console.log('响应结果')
  console.log('='.repeat(60))
  console.log(`  模型        : ${data?.model ?? model}`)
  console.log(`  TTFB        : ${ttfbMs}ms`)
  console.log(`  总耗时      : ${totalMs}ms`)
  console.log(`  PromptTokens  : ${usage.prompt_tokens ?? 'N/A'}`)
  console.log(`  CompletionTokens: ${usage.completion_tokens ?? 'N/A'}`)
  console.log(`  TotalTokens    : ${usage.total_tokens ?? 'N/A'}`)
  console.log('-'.repeat(60))
  console.log(`  响应内容:\n${content}`)
  console.log('='.repeat(60))
  console.log('')
}

async function handleStreaming(response, preset, model, requestStartTs, ttfbMs, raw) {
  const reader = response.body?.getReader()
  if (!reader) {
    console.error('[FAIL] 流式响应 body 为空')
    process.exit(1)
  }

  const decoder = new TextDecoder()
  const streamStartTs = performance.now()
  let buffer = ''
  let chunkCount = 0
  let fullContent = ''
  let lastUsage = null

  console.log('\n[STREAM] 开始接收流数据...')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const dataStr = trimmed.slice(5).trim()
      if (dataStr === '[DONE]') {
        console.log('[STREAM] 收到 [DONE] 标记')
        continue
      }

      try {
        const parsed = JSON.parse(dataStr)
        chunkCount++

        if (parsed.choices?.[0]?.delta?.content) {
          const chunk = parsed.choices[0].delta.content
          fullContent += chunk
          process.stdout.write(chunk)
        }

        if (parsed.choices?.[0]?.finish_reason) {
          console.log(`\n[STREAM] finish_reason: ${parsed.choices[0].finish_reason}`)
        }

        if (parsed.usage) {
          lastUsage = parsed.usage
        }
      } catch {
        // 忽略解析错误的 chunk
      }
    }
  }

  const streamDrainMs = Math.round(performance.now() - streamStartTs)
  const totalMs = Math.round(performance.now() - requestStartTs)

  console.log('')
  console.log('='.repeat(60))
  console.log('流传输完成')
  console.log('='.repeat(60))
  console.log(`  TTFB        : ${ttfbMs}ms`)
  console.log(`  流传输耗时   : ${streamDrainMs}ms`)
  console.log(`  总耗时      : ${totalMs}ms`)
  console.log(`  接收 chunk   : ${chunkCount}`)
  if (lastUsage) {
    console.log(`  PromptTokens  : ${lastUsage.prompt_tokens ?? 'N/A'}`)
    console.log(`  CompletionTokens: ${lastUsage.completion_tokens ?? 'N/A'}`)
    console.log(`  TotalTokens    : ${lastUsage.total_tokens ?? 'N/A'}`)
  }
  console.log(`  完整内容:\n${fullContent}`)
  console.log('='.repeat(60))
  console.log('')
}

function showHelp() {
  console.log(`
llm-cli.mjs — 多模型 LLM 通用 CLI 测试工具

用法:
  node scripts/llm-cli.mjs [选项] [消息]

选项:
  --provider, -p <ID>       选择模型预设 (如 deepseek, kimi, qwen, ...)
  --model, -m <模型名>       覆盖默认模型名
  --stream, -s              使用流式响应模式
  --list, -l                列出所有可用模型预设
  --region <国内|境外>      配合 --list 按地区筛选
  --api-key <key>           API Key (默认从环境变量读取)
  --temperature <0-2>       采样温度 (默认 0.2)
  --max-tokens <N>          最大输出 token 数
  --timeout <秒>            请求超时 (默认 60s)
  --verbose, -v            显示详细请求/响应调试信息
  --raw                     输出完整原始 JSON 响应
  --help, -h                显示此帮助信息

环境变量:
  DEEPSEEK_API_KEY          DeepSeek API Key
  KIMI_API_KEY              Kimi API Key
  QWEN_API_KEY              千问 API Key
  TENCENT_HUNYUAN_API_KEY   腾讯混元 API Key
  BYTANCE_DOUBAO_API_KEY    豆包 API Key
  BAIDU_ERNIE_API_KEY       文心一言 API Key
  ZHIPU_GLM_API_KEY         智谱 API Key
  SILICONFLOW_API_KEY       硅基流动 API Key
  OPENAI_API_KEY            OpenAI API Key
  ANTHROPIC_API_KEY         Anthropic API Key
  GOOGLE_GEMINI_API_KEY     Gemini API Key
  XAI_GROK_API_KEY          xAI API Key
  LLM_API_KEY               通用兜底 API Key

示例:
  # 列出所有国内模型
  node scripts/llm-cli.mjs --list --region domestic

  # 使用 DeepSeek 进行非流式调用
  node scripts/llm-cli.mjs -p deepseek "你好"

  # 流式调用 Kimi
  KIMI_API_KEY=sk-xxx node scripts/llm-cli.mjs -p kimi -s "写一首诗"

  # 切换不同模型
  node scripts/llm-cli.mjs -p deepseek -m deepseek-reasoner

  # 详细调试
  node scripts/llm-cli.mjs -p qwen -v "介绍一下杭州"
`)
}

// ============================================================
// 主入口
// ============================================================

const args = parseArgs(process.argv)

if (args.help) {
  showHelp()
  process.exit(0)
}

if (args.list) {
  listPresets(args.region)
  process.exit(0)
}

if (!args.provider) {
  console.error('错误: 请使用 --provider <ID> 选择模型预设')
  console.error('使用 --list 查看所有可用预设')
  console.error('使用 --help 查看完整帮助')
  process.exit(1)
}

const preset = PRESETS.find(p => p.id === args.provider)
if (!preset) {
  console.error(`错误: 未知的模型预设 "${args.provider}"`)
  console.error('使用 --list 查看所有可用预设')
  process.exit(1)
}

await callApi(preset, args)