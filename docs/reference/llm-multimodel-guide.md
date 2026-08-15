---
title: llm-multimodel-guide.md — 多模型 LLM 配置与测试实战指南
type: reference
domain: ai
phase: operation
tier: practical
status: active
maintainer: V9 AI Team
summary: "覆盖 12 家国内外 LLM 供应商的配置切换、CLI 测试工具使用、单元测试运行、日志调优与故障排查全流程。"
tags: [ai, llm, multi-model, testing, cli]
version: v1.0.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-AI-034
referenced_by: []
change_log:
  - version: v1.0.0
    changes: Initial version — 12 模型预设、CLI 工具、测试指南
date: 2026-08-15
---

# 多模型 LLM 配置与测试实战指南

> **定位**：面向开发者的操作手册，涵盖多模型预设管理、CLI 测试工具、单元测试、日志调优、故障排查。  
> **关联**：[llm-contract.md](llm-contract.md)（接口契约）、[llmConfig.ts](../../src/config/llmConfig.ts)（预设数据源）、[llmClient.ts](../../src/services/llm/llmClient.ts)（客户端实现）

---

## 1. 模型预设一览

### 1.1 国内供应商（8 家）

| ID | 名称 | 默认模型 | Base URL | 上下文窗口 | 输入/输出价格 |
|----|------|----------|----------|------------|--------------|
| `deepseek` | DeepSeek | `deepseek-chat` | `https://api.deepseek.com` | 1000K | $0.14 / $0.28 |
| `kimi` | Kimi K2 | `kimi-k2.7-code` | `https://api.moonshot.cn` | 262K | $0.74 / $3.50 |
| `qwen` | 通义千问 | `qwen3.6-flash` | `https://dashscope.aliyuncs.com/compatible-mode` | 1000K | $0.50 / $3.00 |
| `tencent-hunyuan` | 腾讯混元 | `hy3` | `https://tokenhub.tencentmaas.com/v1` | 256K | $0.28 / $1.12 |
| `bytedance-doubao` | TRAE 豆包 | `doubao-pro-32k` | `https://ark.cn-beijing.volces.com/api/v3` | 128K | $0.56 / $1.40 |
| `baidu-ernie` | 百度文心一言 | `ERNIE-4.5-Turbo` | `https://qianfan.baidubce.com/v2` | 128K | $0.11 / $0.28 |
| `zhipu-glm` | 智谱 GLM | `glm-5-turbo` | `https://open.bigmodel.cn/api/paas/v4` | 128K | $0.70 / $2.10 |
| `siliconflow` | 硅基流动 | `Qwen/Qwen2.5-7B-Instruct` | `https://api.siliconflow.cn` | 128K | $0.42 / $0.42 |

### 1.2 境外供应商（4 家）

| ID | 名称 | 默认模型 | Base URL | API 风格 | 上下文窗口 | 输入/输出价格 |
|----|------|----------|----------|----------|------------|--------------|
| `openai` | OpenAI GPT | `gpt-4o` | `https://api.openai.com/v1` | openai-compatible | 1000K | $2.50 / $10.00 |
| `anthropic` | Anthropic Claude | `claude-3.5-sonnet` | `https://api.anthropic.com` | **anthropic** | 200K | $3.00 / $15.00 |
| `google-gemini` | Google Gemini | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com` | **gemini** | 1000K | $2.00 / $12.00 |
| `xai-grok` | xAI Grok | `grok-4` | `https://api.x.ai/v1` | openai-compatible | 256K | $2.00 / $6.00 |

### 1.3 API 协议风格

| 风格 | 端点路径 | 认证方式 | 适用供应商 |
|------|----------|----------|------------|
| `openai-compatible` | `/v1/chat/completions` | `Authorization: Bearer <key>` | 绝大多数供应商 |
| `anthropic` | `/v1/messages` | `x-api-key: <key>` + `anthropic-version` | Anthropic Claude |
| `gemini` | `/v1beta/models` | API Key 查询参数 | Google Gemini |

> ⚠️ Anthropic 和 Gemini 使用非标准协议，建议通过代理服务（OneAPI、AI Studio 等）转为 OpenAI 兼容接口后再接入。

---

## 2. CLI 测试工具

### 2.1 工具位置

```
scripts/llm-cli.mjs    ← 通用 CLI 工具（支持国内外 12 家模型）
scripts/test-deepseek-live.mjs  ← DeepSeek 专用最小测试脚本
```

### 2.2 查看所有模型预设

```bash
# 列出全部 12 家供应商
node scripts/llm-cli.mjs --list

# 仅看国内模型
node scripts/llm-cli.mjs --list --region domestic

# 仅看境外模型
node scripts/llm-cli.mjs --list --region overseas
```

### 2.3 非流式调用

```bash
# 使用默认模型
node scripts/llm-cli.mjs -p deepseek "你好"

# 指定模型
node scripts/llm-cli.mjs -p deepseek -m deepseek-reasoner "解释量子计算"

# 详细调试模式（显示请求/响应头和 Body）
node scripts/llm-cli.mjs -p qwen -v "介绍一下杭州"

# 输出原始 JSON
node scripts/llm-cli.mjs -p kimi --raw "写一首诗"
```

### 2.4 流式调用

```bash
# 流式模式
node scripts/llm-cli.mjs -p deepseek --stream "AI 的未来"

# 流式 + 限制 token
node scripts/llm-cli.mjs -p kimi -s --max-tokens 100 "写一首短诗"
```

### 2.5 全部 CLI 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--provider` | `-p` | 模型预设 ID（必填，除非 `--list`/`--help`） |
| `--model` | `-m` | 覆盖预设中的默认模型名 |
| `--stream` | `-s` | 使用流式响应模式 |
| `--list` | `-l` | 列出所有可用预设 |
| `--region` | — | 配合 `--list` 按地区筛选（`domestic`/`overseas`） |
| `--api-key` | — | 显式指定 API Key（优先级最高） |
| `--temperature` | — | 采样温度，默认 0.2 |
| `--max-tokens` | — | 最大输出 token 数 |
| `--timeout` | — | 请求超时秒数，默认 60 |
| `--verbose` | `-v` | 显示详细请求/响应调试信息 |
| `--raw` | — | 输出完整原始 JSON 响应 |
| `--help` | `-h` | 显示帮助信息 |

### 2.6 API Key 配置

CLI 工具按以下优先级查找 API Key：

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1 | `--api-key` 参数 | `--api-key sk-xxx` |
| 2 | `LLM_API_KEY` 环境变量 | 通用兜底 |
| 3 | `{PROVIDER}_API_KEY` 环境变量 | `DEEPSEEK_API_KEY`、`KIMI_API_KEY` 等 |
| 4 | `DEEPSEEK_API_KEY` 环境变量 | 最终兜底 |

**Windows PowerShell 示例**：
```powershell
$env:DEEPSEEK_API_KEY = 'sk-your-key-here'
node scripts/llm-cli.mjs -p deepseek "你好"
```

**bash/zsh 示例**：
```bash
DEEPSEEK_API_KEY=sk-your-key-here node scripts/llm-cli.mjs -p deepseek "你好"
```

> 🔒 **安全约束**：CLI 工具绝不打印 API Key 明文，仅以 `sk-xxxx***yyyy` 格式展示掩码。

---

## 3. 单元测试

### 3.1 运行测试

```bash
# 运行全部 LLM 测试
npm run test:service

# 仅运行多模型测试
npx vitest run src/services/llm/llmClient.multimodel.test.ts

# 仅运行基础客户端测试
npx vitest run src/services/llm/llmClient.test.ts

# Watch 模式（开发调试）
npx vitest run src/services/llm/ --watch
```

### 3.2 测试覆盖范围（103 个用例）

| 测试文件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `llmClient.multimodel.test.ts` | 92 | 12 预设字段验证、`inferPresetId` 识别、端点构建、API 风格适配、Mock 数据工厂 |
| `llmClient.test.ts` | 7 | `chat()`/`streamingChat()` 基础调用、错误处理、流解析 |
| `llmMockResponses.test.ts` | 4 | Mock 响应数据完整性、工厂函数 |

### 3.3 测试关键断言

每个模型预设至少验证以下字段：

```typescript
test('DeepSeek preset should have correct fields', () => {
  const preset = getPresetById('deepseek')
  expect(preset).toBeDefined()
  expect(preset!.provider).toBe('DeepSeek')
  expect(preset!.defaultModel).toBe('deepseek-chat')
  expect(preset!.baseURL).toBe('https://api.deepseek.com')
  expect(preset!.apiStyle).toBe('openai-compatible')
  // ... models, contextWindow, price 等
})
```

### 3.4 Mock 数据

Mock 数据定义在 `src/services/llm/llmMockResponses.ts`：

```typescript
import { createMockFetchImpl, createMockConfig, MOCK_PRESET_RESPONSES } from '@/services/llm/llmMockResponses'

// 创建指定预设的 Mock fetch
const mockFetch = createMockFetchImpl('deepseek', 'success')
global.fetch = mockFetch

// 创建指定预设的 Mock 配置
const config = createMockConfig(getPresetById('deepseek')!)

// Mock 模式: 'success' | 'error' | 'timeout'
const errorFetch = createMockFetchImpl('deepseek', 'error')
const timeoutFetch = createMockFetchImpl('deepseek', 'timeout')
```

---

## 4. 日志与调优

### 4.1 日志级别

`llmClient.ts` 使用 `getLogger()` 输出结构化日志，默认级别为 `debug`：

| 日志级别 | 输出方法 | 用途 |
|----------|----------|------|
| `DEBUG` | `logger.debug()` | 请求/响应详情、TTFB、Token 统计 |
| `INFO` | `logger.info()` | 流程关键节点（已降级为 DEBUG） |
| `WARN` | `logger.warn()` | JSON 解析失败、Schema 校验失败 |
| `ERROR` | `logger.error()` | HTTP 错误响应、请求异常 |

### 4.2 关键日志节点

| 节点 | 位置 | 记录内容 |
|------|------|----------|
| 配置解析 | `chat()`/`streamingChat()` | preset ID、API 风格、端点、API Key 掩码 |
| 请求发送 | `chat()`/`streamingChat()` | TTFB 起点、请求体前 500 字 |
| 响应接收 | `chat()`/`streamingChat()` | 状态码、TTFB、Content-Type |
| 解析成功 | `chat()` | Token 用量、响应内容前 300 字 |
| 流传输完成 | `streamingChat()` | TTFB + 流传输耗时 + 总耗时分段计时 |
| HTTP 错误 | 错误路径 | 状态码、错误消息 |
| 请求异常 | catch 路径 | 错误类型、超时标识、状态码 |

### 4.3 分段延迟统计

`streamingChat()` 采用三段式延迟统计：

```
requestStartTs      streamStartTs        完成时间
    │                    │                  │
    ├── TTFB ────────────┤                  │
    │  (Time To First Byte)                │
    │                    ├── streamDrainMs ─┤
    │                    │  (流传输耗时)      │
    ├── totalMs ────────────────────────────┤
         (总耗时 = TTFB + 流传输 + JSON 解析)
```

`chat()` 采用两段式延迟统计：

```
requestStartTs                    完成时间
    │                                │
    ├── ttfbMs ─────────────────────┤
    │  (Time To First Byte)         │
    │                                │
    ├── totalMs ────────────────────┤
         (总耗时 = TTFB + JSON 解析)
```

### 4.4 调整日志级别

```typescript
import { setLogLevel } from '@/lib/logger'

setLogLevel('debug')   // 输出全部日志（开发模式推荐）
setLogLevel('info')    // 仅输出 info/warn/error
setLogLevel('warn')    // 仅输出 warn/error（生产模式推荐）
setLogLevel('error')   // 仅输出 error
```

---

## 5. 新增模型预设

### 5.1 步骤

1. **编辑** `src/config/llmConfig.ts`，在 `LLM_MODEL_PRESETS` 数组中添加新条目：

```typescript
{
  id: 'new-provider',
  name: '新供应商',
  provider: 'NewProvider',
  baseURL: 'https://api.newprovider.com',
  defaultModel: 'model-v1',
  models: ['model-v1', 'model-v2'],
  contextWindow: 128_000,
  inputPrice: '$1.00',
  outputPrice: '$3.00',
  apiStyle: 'openai-compatible',  // 或 'anthropic' / 'gemini'
  notes: '使用说明（可选）',
},
```

2. **同步更新** `scripts/llm-cli.mjs` 中的 `PRESETS` 数组

3. **添加单元测试**（在 `llmClient.multimodel.test.ts` 中）：
```typescript
test('新供应商 preset should have correct fields', () => {
  const preset = getPresetById('new-provider')
  expect(preset).toBeDefined()
  expect(preset!.baseURL).toBe('https://api.newprovider.com')
  expect(preset!.apiStyle).toBe('openai-compatible')
  // ...
})
```

4. **运行测试**：`npx vitest run src/services/llm/`

### 5.2 API 风格适配

若新供应商使用非标准协议，需在 `llmClient.ts` 的 `buildRequestComponents()` 中添加适配：

```typescript
case 'new-style':
  return {
    endpoint: `${normalizedURL}/custom/path`,
    headers: { 'X-Custom-Auth': `Bearer ${apiKey}` },
    extraBody: { custom_field: 'value' },
  }
```

---

## 6. 故障排查

### 6.1 常见错误

| 现象 | 可能原因 | 排查方法 |
|------|----------|----------|
| `401 Unauthorized` | API Key 无效或过期 | 检查 `--api-key` 参数或环境变量 |
| `403 Forbidden` | API Key 权限不足 | 确认 Key 是否有调用权限 |
| `404 Not Found` | Base URL 或模型名错误 | 检查预设中的 `baseURL` 和 `model` |
| `429 Too Many Requests` | 触发速率限制 | 降低调用频率或升级套餐 |
| `500 Internal Server Error` | 服务端异常 | 查看错误响应体的 `error.message` |
| `AbortError` | 请求超时 | 增大 `--timeout` 或检查网络 |
| `TypeError: fetch is not a function` | Node.js 版本过低 | 要求 Node.js ≥ 18 |

### 6.2 调试技巧

```bash
# 1. 开启 verbose 模式查看完整请求/响应
node scripts/llm-cli.mjs -p deepseek --raw -v "测试"

# 2. 测试不同供应商对比
node scripts/llm-cli.mjs -p deepseek "同一问题"
node scripts/llm-cli.mjs -p kimi "同一问题"
node scripts/llm-cli.mjs -p qwen "同一问题"

# 3. 使用 --list 确认预设 ID
node scripts/llm-cli.mjs --list

# 4. 检查 API Key 是否生效
node scripts/llm-cli.mjs -p deepseek "ping" --verbose

# 5. 单元测试快速定位
npx vitest run src/services/llm/ --no-color
```

### 6.3 环境检查清单

- [ ] Node.js 版本 ≥ 18（推荐 20+）
- [ ] API Key 已设置且有效
- [ ] 网络可访问目标供应商 API 端点
- [ ] 代理/VPN 配置正确（部分境外供应商需翻墙）
- [ ] 项目依赖已安装（`npm install`）
- [ ] TypeScript 类型检查通过（`tsc -p tsconfig.prod.json --noEmit`）

---

## 7. 文件索引

| 文件 | 用途 |
|------|------|
| `src/config/llmConfig.ts` | 模型预设定义、`getPresetById()`、`inferPresetId()` |
| `src/services/llm/llmClient.ts` | 核心客户端：`chat()`、`streamingChat()`、`buildRequestComponents()` |
| `src/services/llm/llmMockResponses.ts` | Mock 数据工厂：`createMockFetchImpl()`、`createMockConfig()` |
| `src/services/llm/llmClient.multimodel.test.ts` | 多模型单元测试（92 用例） |
| `src/services/llm/llmClient.test.ts` | 基础客户端测试（7 用例） |
| `scripts/llm-cli.mjs` | 通用 CLI 测试工具 |
| `scripts/test-deepseek-live.mjs` | DeepSeek 专用最小测试脚本 |
| `src/lib/logger.ts` | 日志基础设施：`getLogger()`、`setLogLevel()` |