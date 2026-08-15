#!/usr/bin/env node
/**
 * llm-benchmark.mjs — 多模型 LLM 性能基准测试工具
 *
 * 功能:
 *   - 对比不同供应商/模型在相同负载下的延迟 (TTFB / 总耗时) 和吞吐量
 *   - 支持流式和非流式两种模式
 *   - 每个模型先进行预热，再执行多次测量取中位数
 *   - 无 API Key 的供应商自动跳过
 *   - 输出 JSON 结果和 Markdown 表格
 *
 * 用法:
 *   node scripts/llm-benchmark.mjs                                    # 测试所有可用模型
 *   node scripts/llm-benchmark.mjs --providers deepseek,kimi,qwen    # 指定供应商
 *   node scripts/llm-benchmark.mjs --iterations 5 --warmup 2          # 自定义参数
 *   node scripts/llm-benchmark.mjs --stream                           # 测试流式模式
 *   node scripts/llm-benchmark.mjs --output outputs/bench.json       # 保存 JSON 结果
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PRESETS = [
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
    models: ['kimi-k2.7-code', 'kimi-k3'],
    contextWindow: 262_144, inputPrice: '$0.74', outputPrice: '$3.50',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'qwen', region: 'domestic', name: '通义千问 Qwen',
    provider: 'Alibaba', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    defaultModel: 'qwen3.6-flash',
    models: ['qwen3.6-flash', 'qwen3.6-plus'],
    contextWindow: 1_000_000, inputPrice: '$0.50', outputPrice: '$3.00',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'tencent-hunyuan', region: 'domestic', name: '腾讯混元',
    provider: 'Tencent', baseURL: 'https://tokenhub.tencentmaas.com/v1',
    defaultModel: 'hy3',
    models: ['hy3', 'hy-mt2-pro'],
    contextWindow: 256_000, inputPrice: '$0.28', outputPrice: '$1.12',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'bytedance-doubao', region: 'domestic', name: 'TRAE 豆包',
    provider: 'ByteDance', baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    models: ['doubao-pro-32k', 'doubao-lite-32k'],
    contextWindow: 128_000, inputPrice: '$0.56', outputPrice: '$1.40',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'baidu-ernie', region: 'domestic', name: '百度文心一言',
    provider: 'Baidu', baseURL: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ERNIE-4.5-Turbo',
    models: ['ERNIE-4.5-Turbo', 'ERNIE-Speed-128K'],
    contextWindow: 128_000, inputPrice: '$0.11', outputPrice: '$0.28',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'zhipu-glm', region: 'domestic', name: '智谱 GLM',
    provider: 'Zhipu AI', baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5-turbo',
    models: ['glm-5-turbo', 'glm-4-flashx'],
    contextWindow: 128_000, inputPrice: '$0.70', outputPrice: '$2.10',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'siliconflow', region: 'domestic', name: '硅基流动',
    provider: 'SiliconFlow', baseURL: 'https://api.siliconflow.cn',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V4-Flash'],
    contextWindow: 128_000, inputPrice: '$0.42', outputPrice: '$0.42',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'openai', region: 'overseas', name: 'OpenAI GPT',
    provider: 'OpenAI', baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini'],
    contextWindow: 1_000_000, inputPrice: '$2.50', outputPrice: '$10.00',
    apiStyle: 'openai-compatible',
  },
  {
    id: 'xai-grok', region: 'overseas', name: 'xAI Grok',
    provider: 'xAI', baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    models: ['grok-4'],
    contextWindow: 256_000, inputPrice: '$2.00', outputPrice: '$6.00',
    apiStyle: 'openai-compatible',
  },
]

const BENCHMARK_MESSAGES = [
  '请用一句话介绍你自己。',
  '解释什么是量子计算，用通俗的语言。',
  '写一首关于春天的短诗，不超过4句。',
]

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--providers') args.providers = argv[++i]
    else if (arg === '--iterations') args.iterations = parseInt(argv[++i], 10)
    else if (arg === '--warmup') args.warmup = parseInt(argv[++i], 10)
    else if (arg === '--stream') args.stream = true
    else if (arg === '--timeout') args.timeout = parseInt(argv[++i], 10)
    else if (arg === '--output') args.output = argv[++i]
    else if (arg === '--message') args.message = argv[++i]
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg.startsWith('-')) {
      args._.push(arg)
    } else {
      args._.push(arg)
    }
  }
  return args
}

function getApiKey(providerId) {
  const envKey = `${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`
  return process.env[envKey] || process.env.LLM_API_KEY || null
}

function maskKey(key) {
  if (!key) return 'NOT_SET'
  if (key.length <= 10) return key.slice(0, 2) + '***'
  return key.slice(0, 6) + '***' + key.slice(-4)
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

function buildBody(preset, model, message, stream) {
  const body = {
    model,
    messages: [{ role: 'user', content: message }],
    temperature: 0.2,
  }
  if (stream) body.stream = true
  return body
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function showHelp() {
  console.log(`
llm-benchmark.mjs — 多模型 LLM 性能基准测试

用法:
  node scripts/llm-benchmark.mjs [选项]

选项:
  --providers <id1,id2,...>  指定要测试的供应商 (默认全部)
  --iterations <N>           测量迭代次数 (默认 3)
  --warmup <N>               预热调用次数 (默认 2)
  --stream                   测试流式模式 (默认非流式)
  --timeout <秒>             单次请求超时 (默认 60)
  --output <path>            保存 JSON 结果到文件
  --message <text>           自定义测试消息
  --help, -h                 显示此帮助

示例:
  # 测试所有可用模型
  node scripts/llm-benchmark.mjs

  # 指定供应商和迭代次数
  node scripts/llm-benchmark.mjs --providers deepseek,kimi --iterations 5

  # 流式测试 + 保存结果
  node scripts/llm-benchmark.mjs --stream --output outputs/bench.json
`)
}

async function runSingleCall(preset, model, message, opts) {
  const apiKey = getApiKey(preset.id)
  if (!apiKey) return { status: 'skipped', reason: 'NO_API_KEY' }

  const { endpoint, headers } = buildEndpointAndHeaders(preset.baseURL, apiKey, preset.apiStyle)
  const body = buildBody(preset, model, message, !!opts.stream)

  const controller = new AbortController()
  const timeoutMs = (opts.timeout ?? 60) * 1000
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

    if (!response.ok) {
      const text = await response.text()
      return {
        status: 'error',
        phase: 'http',
        statusCode: response.status,
        ttfbMs,
        error: text.slice(0, 200),
      }
    }

    if (opts.stream) {
      const reader = response.body?.getReader()
      if (!reader) {
        return { status: 'error', phase: 'stream', ttfbMs, error: 'NO_READER' }
      }

      const decoder = new TextDecoder()
      const streamStartTs = performance.now()
      let chunkCount = 0
      let tokenChars = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        tokenChars += text.length
        chunkCount++
      }

      const streamDrainMs = Math.round(performance.now() - streamStartTs)
      const totalMs = Math.round(performance.now() - requestStartTs)
      const throughput = streamDrainMs > 0 ? Math.round((chunkCount / streamDrainMs) * 1000) : 0

      return {
        status: 'ok',
        mode: 'stream',
        ttfbMs,
        streamDrainMs,
        totalMs,
        chunkCount,
        throughputChunksPerSec: throughput,
        tokenChars,
      }
    } else {
      const data = await response.json()
      const totalMs = Math.round(performance.now() - requestStartTs)
      const usage = data?.usage ?? {}
      const content = data?.choices?.[0]?.message?.content ?? ''

      return {
        status: 'ok',
        mode: 'non-stream',
        ttfbMs,
        totalMs,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        contentLength: content.length,
      }
    }
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - requestStartTs)
    return {
      status: 'error',
      phase: err.name === 'AbortError' ? 'timeout' : 'network',
      elapsedMs,
      error: err.message,
      errorName: err.name,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function benchmarkPreset(preset, opts) {
  const model = opts.model || preset.defaultModel
  const message = opts.message || BENCHMARK_MESSAGES[0]
  const warmupCount = opts.warmup ?? 2
  const iterCount = opts.iterations ?? 3

  const results = {
    presetId: preset.id,
    presetName: preset.name,
    provider: preset.provider,
    model,
    region: preset.region,
    apiStyle: preset.apiStyle || 'openai-compatible',
    mode: opts.stream ? 'stream' : 'non-stream',
    warmup: [],
    iterations: [],
    status: 'ok',
    skipReason: null,
  }

  const apiKey = getApiKey(preset.id)
  if (!apiKey) {
    results.status = 'skipped'
    results.skipReason = 'NO_API_KEY'
    return results
  }

  console.log(`\n  🌡 预热 ${preset.id} (${warmupCount} 次)...`)
  for (let i = 0; i < warmupCount; i++) {
    const r = await runSingleCall(preset, model, message, opts)
    results.warmup.push(r)
    if (r.status !== 'ok') {
      console.log(`    ⚠ 预热 ${i + 1} 失败: ${r.error || r.reason}`)
    }
  }

  console.log(`  📊 测量 ${preset.id} (${iterCount} 次)...`)
  for (let i = 0; i < iterCount; i++) {
    const r = await runSingleCall(preset, model, message, opts)
    results.iterations.push(r)
    const icon = r.status === 'ok' ? '✅' : '❌'
    const ttfb = r.ttfbMs ? `TTFB=${r.ttfbMs}ms` : ''
    const total = r.totalMs ? `Total=${r.totalMs}ms` : ''
    console.log(`    ${icon} 迭代 ${i + 1}: ${ttfb} ${total} ${r.error || ''}`)
  }

  const okIterations = results.iterations.filter(r => r.status === 'ok')
  if (okIterations.length === 0) {
    results.status = 'failed'
    results.skipReason = 'ALL_REQUESTS_FAILED'
    return results
  }

  if (okIterations.length < iterCount) {
    console.log(`    ⚠ 仅 ${okIterations.length}/${iterCount} 次成功`)
  }

  const ttfbValues = okIterations.map(r => r.ttfbMs).filter(v => v != null)
  const totalValues = okIterations.map(r => r.totalMs).filter(v => v != null)

  results.summary = {
    successCount: okIterations.length,
    totalCount: iterCount,
    ttfbMedianMs: ttfbValues.length ? Math.round(median(ttfbValues)) : null,
    ttfbMinMs: ttfbValues.length ? Math.min(...ttfbValues) : null,
    ttfbMaxMs: ttfbValues.length ? Math.max(...ttfbValues) : null,
    totalMedianMs: totalValues.length ? Math.round(median(totalValues)) : null,
    totalMinMs: totalValues.length ? Math.min(...totalValues) : null,
    totalMaxMs: totalValues.length ? Math.max(...totalValues) : null,
  }

  if (opts.stream) {
    const streamValues = okIterations.map(r => r.streamDrainMs).filter(v => v != null)
    const tpValues = okIterations.map(r => r.throughputChunksPerSec).filter(v => v != null)
    results.summary.streamDrainMedianMs = streamValues.length ? Math.round(median(streamValues)) : null
    results.summary.throughputMedianChunksPerSec = tpValues.length ? Math.round(median(tpValues)) : null
  } else {
    const tokenValues = okIterations.map(r => r.totalTokens).filter(v => v != null)
    results.summary.totalTokensMedian = tokenValues.length ? Math.round(median(tokenValues)) : null
  }

  return results
}

function generateMarkdownReport(allResults, opts) {
  const lines = []
  const timestamp = new Date().toISOString()
  const modeLabel = opts.stream ? '流式' : '非流式'

  lines.push(`# LLM 性能基准测试报告`)
  lines.push(`\n> **生成时间**: ${timestamp}`)
  lines.push(`> **测试模式**: ${modeLabel}`)
  lines.push(`> **迭代次数**: ${opts.iterations ?? 3} (预热 ${opts.warmup ?? 2} 次)`)
  lines.push(`> **测试消息**: ${opts.message || BENCHMARK_MESSAGES[0]}`)
  lines.push('')

  const okResults = allResults.filter(r => r.status === 'ok')
  const skippedResults = allResults.filter(r => r.status === 'skipped')
  const failedResults = allResults.filter(r => r.status === 'failed')

  lines.push('## 总览')
  lines.push('')
  lines.push(`| 指标 | 值 |`)
  lines.push(`|------|------|`)
  lines.push(`| 测试模型数 | ${allResults.length} |`)
  lines.push(`| 成功 | ${okResults.length} |`)
  lines.push(`| 跳过 (无 API Key) | ${skippedResults.length} |`)
  lines.push(`| 失败 | ${failedResults.length} |`)
  lines.push('')

  if (okResults.length > 0) {
    lines.push(`## ${modeLabel} 性能对比`)
    lines.push('')

    if (opts.stream) {
      lines.push('| 供应商 | 模型 | TTFB (中位数) | 流传输 (中位数) | 总耗时 (中位数) | chunk/s | 成功率 |')
      lines.push('|--------|------|--------------|----------------|----------------|---------|--------|')
    } else {
      lines.push('| 供应商 | 模型 | TTFB (中位数) | 总耗时 (中位数) | 输入 Token | 输出 Token | 成功率 |')
      lines.push('|--------|------|--------------|----------------|-----------|-----------|--------|')
    }

    for (const r of okResults) {
      const s = r.summary
      const successRate = `${s.successCount}/${s.totalCount}`
      if (opts.stream) {
        lines.push(`| ${r.provider} | ${r.model} | ${s.ttfbMedianMs}ms | ${s.streamDrainMedianMs}ms | ${s.totalMedianMs}ms | ${s.throughputMedianChunksPerSec} | ${successRate} |`)
      } else {
        lines.push(`| ${r.provider} | ${r.model} | ${s.ttfbMedianMs}ms | ${s.totalMedianMs}ms | ${s.totalTokensMedian ?? 'N/A'} | ${s.totalTokensMedian ?? 'N/A'} | ${successRate} |`)
      }
    }
    lines.push('')

    lines.push('### TTFB 排名（越短越好）')
    lines.push('')
    const ttfbRanking = [...okResults]
      .filter(r => r.summary?.ttfbMedianMs != null)
      .sort((a, b) => a.summary.ttfbMedianMs - b.summary.ttfbMedianMs)
    for (let i = 0; i < ttfbRanking.length; i++) {
      const r = ttfbRanking[i]
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`
      lines.push(`${medal} **${r.provider}** ${r.model}: ${r.summary.ttfbMedianMs}ms`)
    }
    lines.push('')

    if (!opts.stream) {
      lines.push('### 总耗时排名（越短越好）')
      lines.push('')
      const totalRanking = [...okResults]
        .filter(r => r.summary?.totalMedianMs != null)
        .sort((a, b) => a.summary.totalMedianMs - b.summary.totalMedianMs)
      for (let i = 0; i < totalRanking.length; i++) {
        const r = totalRanking[i]
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`
        lines.push(`${medal} **${r.provider}** ${r.model}: ${r.summary.totalMedianMs}ms`)
      }
      lines.push('')
    } else {
      lines.push('### 吞吐量排名（chunk/s，越高越好）')
      lines.push('')
      const tpRanking = [...okResults]
        .filter(r => r.summary?.throughputMedianChunksPerSec != null)
        .sort((a, b) => b.summary.throughputMedianChunksPerSec - a.summary.throughputMedianChunksPerSec)
      for (let i = 0; i < tpRanking.length; i++) {
        const r = tpRanking[i]
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`
        lines.push(`${medal} **${r.provider}** ${r.model}: ${r.summary.throughputMedianChunksPerSec} chunk/s`)
      }
      lines.push('')
    }
  }

  if (skippedResults.length > 0) {
    lines.push('## ⚠️ 跳过的模型（缺少 API Key）')
    lines.push('')
    for (const r of skippedResults) {
      const envKey = `${r.presetId.toUpperCase().replace(/-/g, '_')}_API_KEY`
      lines.push(`- **${r.provider}** ${r.model} — 设置环境变量 \`${envKey}\` 后可测试`)
    }
    lines.push('')
  }

  if (failedResults.length > 0) {
    lines.push('## ❌ 失败的模型')
    lines.push('')
    for (const r of failedResults) {
      lines.push(`- **${r.provider}** ${r.model} — 全部 ${r.iterations.length} 次请求失败`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`*报告由 llm-benchmark.mjs 自动生成*`)

  return lines.join('\n')
}

function writeLaunchJson() {
  const launchConfig = {
    version: '0.2.0',
    configurations: [
      {
        name: 'LLM CLI: 非流式测试',
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'node',
        runtimeArgs: ['--inspect-brk'],
        args: ['${workspaceFolder}/scripts/llm-cli.mjs', '-p', 'deepseek', '你好'],
        env: { DEEPSEEK_API_KEY: '${env:DEEPSEEK_API_KEY}', LOG_FORMAT: 'pretty' },
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        skipFiles: ['<node_internals>/**'],
      },
      {
        name: 'LLM CLI: 流式测试',
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'node',
        runtimeArgs: ['--inspect-brk'],
        args: ['${workspaceFolder}/scripts/llm-cli.mjs', '-p', 'deepseek', '--stream', '你好'],
        env: { DEEPSEEK_API_KEY: '${env:DEEPSEEK_API_KEY}', LOG_FORMAT: 'pretty' },
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        skipFiles: ['<node_internals>/**'],
      },
      {
        name: 'LLM CLI: JSON 日志模式',
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'node',
        runtimeArgs: ['--inspect-brk'],
        args: ['${workspaceFolder}/scripts/llm-cli.mjs', '-p', 'deepseek', '你好'],
        env: { DEEPSEEK_API_KEY: '${env:DEEPSEEK_API_KEY}', LOG_FORMAT: 'json' },
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        skipFiles: ['<node_internals>/**'],
      },
      {
        name: 'LLM Benchmark: 性能基准测试',
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'node',
        runtimeArgs: ['--inspect-brk'],
        args: ['${workspaceFolder}/scripts/llm-benchmark.mjs', '--providers', 'deepseek,kimi', '--iterations', '3'],
        env: { DEEPSEEK_API_KEY: '${env:DEEPSEEK_API_KEY}', KIMI_API_KEY: '${env:KIMI_API_KEY}' },
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        skipFiles: ['<node_internals>/**'],
      },
      {
        name: 'Vitest: LLM 单元测试',
        type: 'node',
        request: 'launch',
        runtimeExecutable: 'npx',
        args: ['vitest', 'run', 'src/services/llm/', '--reporter=verbose'],
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        skipFiles: ['<node_internals>/**'],
      },
    ],
  }

  const json = JSON.stringify(launchConfig, null, 2)
  const dir = join(process.cwd(), '.vscode')
  const file = join(dir, 'launch.json')

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(file, json, 'utf-8')
    console.log(`\n✅ .vscode/launch.json 已生成`)
  } catch {
    console.log('\n⚠️  无法写入 .vscode/ 目录 (可能受沙盒保护)')
    console.log('   请手动将以下内容保存到 .vscode/launch.json:\n')
    console.log(json)
    console.log('\n💡 或者在 VS Code 中按 F1 → "Preferences: Open Launch Configuration" → 粘贴上述内容')
  }
}

// ============================================================
// 主入口
// ============================================================

const args = parseArgs(process.argv)

if (args.help) {
  showHelp()
  process.exit(0)
}

if (args._.includes('--init-vscode') || args._.includes('--init')) {
  writeLaunchJson()
  process.exit(0)
}

const selectedProviders = args.providers
  ? args.providers.split(',').map(s => s.trim())
  : PRESETS.map(p => p.id)

const presetsToTest = PRESETS.filter(p => selectedProviders.includes(p.id))

if (presetsToTest.length === 0) {
  console.error(`错误: 未找到匹配的供应商。可选: ${PRESETS.map(p => p.id).join(', ')}`)
  process.exit(1)
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║          LLM 多模型性能基准测试                              ║')
console.log('╠══════════════════════════════════════════════════════════════╣')
console.log(`║  测试模型: ${presetsToTest.length} 个供应商`)
console.log(`║  迭代次数: ${args.iterations ?? 3} (预热 ${args.warmup ?? 2})`)
console.log(`║  测试模式: ${args.stream ? '流式' : '非流式'}`)
console.log(`║  超时: ${args.timeout ?? 60}s`)
console.log('╚══════════════════════════════════════════════════════════════╝')

const allResults = []
for (const preset of presetsToTest) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📌 ${preset.name} (${preset.id}) — ${preset.provider}`)
  console.log(`   默认模型: ${preset.defaultModel} | API: ${preset.apiStyle || 'openai-compatible'}`)

  const result = await benchmarkPreset(preset, args)
  allResults.push(result)

  if (result.status === 'skipped') {
    const envKey = `${preset.id.toUpperCase().replace(/-/g, '_')}_API_KEY`
    console.log(`  ⏭ 跳过 — 设置 ${envKey} 环境变量后可测试`)
  }
}

console.log(`\n${'═'.repeat(60)}`)
console.log('📊 基准测试完成 — 结果汇总')
console.log('═'.repeat(60))

const okCount = allResults.filter(r => r.status === 'ok').length
const skipCount = allResults.filter(r => r.status === 'skipped').length
const failCount = allResults.filter(r => r.status === 'failed').length
console.log(`  ✅ 成功: ${okCount}  |  ⏭ 跳过: ${skipCount}  |  ❌ 失败: ${failCount}`)

if (okCount > 0) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log('🏆 TTFB 排名 (越短越好):')
  const ranking = allResults
    .filter(r => r.summary?.ttfbMedianMs != null)
    .sort((a, b) => a.summary.ttfbMedianMs - b.summary.ttfbMedianMs)
  for (let i = 0; i < ranking.length; i++) {
    const r = ranking[i]
    const medal = ['🥇', '🥈', '🥉'][i] || '  '
    console.log(`  ${medal} ${r.provider.padEnd(14)} ${r.model.padEnd(24)} TTFB=${r.summary.ttfbMedianMs}ms  Total=${r.summary.totalMedianMs}ms`)
  }
}

if (args.output) {
  const output = {
    benchmarkTime: new Date().toISOString(),
    config: {
      providers: presetsToTest.map(p => p.id),
      iterations: args.iterations ?? 3,
      warmup: args.warmup ?? 2,
      stream: !!args.stream,
    },
    results: allResults,
  }
  writeFileSync(args.output, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n📁 JSON 结果已保存: ${args.output}`)

  const mdPath = args.output.replace(/\.json$/, '.md')
  const mdReport = generateMarkdownReport(allResults, args)
  writeFileSync(mdPath, mdReport, 'utf-8')
  console.log(`📝 Markdown 报告已保存: ${mdPath}`)
} else {
  const mdReport = generateMarkdownReport(allResults, args)
  console.log(`\n${'─'.repeat(60)}`)
  console.log('📝 Markdown 报告预览:')
  console.log('─'.repeat(60))
  console.log(mdReport)
}