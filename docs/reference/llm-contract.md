---
title: llm-contract.md — 大模型服务接口契约
type: reference
domain: ai
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `llm` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。"
tags: [ai, contract, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-AI-017
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# llm-contract.md — 大模型服务接口契约

> **定位**：定义 `llm` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **统一 LLM HTTP 客户端**：封装 OpenAI-compatible `/v1/chat/completions` 接口，提供非流式 `chat()` 与流式 `streamingChat()` 两种调用模式，支持 AbortController 超时控制、SSE 逐行解析、空闲超时保护。
- **多模型供应商适配**：内置 DeepSeek、Kimi、通义千问、硅基流动 4 家供应商预设配置（`LLM_MODEL_PRESETS`），支持通过 `baseURL` 自动推断供应商，并管理 API Key 的加密存储与读取。
- **Gateway 防腐层**：`llmGateway` 将底层 `llmClient` 封装为带调用审计（traceId / 耗时 / Token 统计）、错误降级（`allowFallback`）、日志记录的网关，使 `scoring`/`analysis`/`trading` 等 L4 应用层不再直接依赖 L6 外部客户端。
- **Prompt 构建协作**：与 `scoring` 子域协作，为 V6 评分引擎提供 `buildV6ScorePrompt()` 所需的 LLM 消息格式输入（`LlmMessage[]`）。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（本服务不直接写库，输出文本给上层服务消费） |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）、`services/scoring/`（评分引擎）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `config/llmConfig` | 上游：配置注入 | `llmConfig` → `llmClient` / `llmGateway`（提供 baseURL、apiKey、model 等） |
| `lib/logger` | 上游：日志基础设施 | `logger` → `llmClient` / `llmGateway`（调用/错误/性能日志） |
| `lib/validation` | 上游：URL 校验 | `isValidLlmBaseURL` → `llmClient`（XSS-003 协议白名单校验） |
| `services/scoring` | 下游：消费输出 | `llm` → `v6ScorePrompt`（提供 `LlmMessage[]` 格式消息） |
| `services/analysis` | 下游：消费输出 | `llmGateway` → `analysisService`（文本分析结果） |
| `services/trading` | 下游：消费输出 | `llmGateway` → `tradingService`（交易决策增强） |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/llm/llmTypes.ts

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface LlmResponse {
  content: string
  model: string
  usage?: LlmUsage
}

export interface LlmStreamChunk {
  content: string
  isDone: boolean
  usage?: LlmUsage
}

export type LlmStreamCallback = (chunk: LlmStreamChunk) => void
```

```typescript
// 文件：src/services/llm/llmGateway.ts

export interface LlmGatewayOptions extends Partial<LlmConfig> {
  /** 业务调用方标识，用于审计日志 */
  caller?: string
  /** 是否允许失败时静默降级（返回空内容而非抛错） */
  allowFallback?: boolean
}

export interface LlmGatewayResult {
  /** 本次调用 traceId */
  traceId: string
  /** 调用结果 */
  response: LlmResponse
  /** 是否经过 LLM（false 表示降级） */
  usedLlm: boolean
}
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `chat()` | `(messages: LlmMessage[], override?: Partial<LlmConfig>) => Promise<LlmResponse>` | 非流式 LLM 聊天调用 | 配置缺失抛 `LlmConfigError`；API 异常抛 `LlmApiError`（含 HTTP statusCode） |
| `streamingChat()` | `(messages: LlmMessage[], callback: LlmStreamCallback, override?: Partial<LlmConfig>) => Promise<void>` | 流式 LLM 聊天调用（SSE 解析） | 总超时/空闲超时抛 `LlmApiError`；流解析异常记录 warn 日志 |
| `llmGateway.chat()` | `(messages: LlmMessage[], options?: LlmGatewayOptions) => Promise<LlmResponse>` | 带审计、降级、Token 统计的非流式网关 | 错误降级返回空内容；否则抛 `LlmApiError` |
| `llmGateway.streamingChat()` | `(messages: LlmMessage[], callback: LlmStreamCallback, options?: LlmGatewayOptions) => Promise<void>` | 带审计、降级的流式网关 | 降级时回调 `isDone: true` 空内容；否则抛 `LlmApiError` |

### 2.3 错误类型

| 类名 | 说明 | 字段 |
|------|------|------|
| `LlmConfigError` | 配置缺失/非法（baseURL、apiKey、model） | — |
| `LlmApiError` | API 调用失败（HTTP 错误、超时、空响应） | `statusCode?: number` |

### 2.4 事件接口

> 本子域**未直接使用 EventBus** 发布/订阅事件。调用结果通过 `Promise` 和 `LlmStreamCallback` 直接返回给调用方。上层服务（如 `scoring`/`analysis`）可选择自行通过 EventBus 转发结果。

---

## 3. 数据流

LLM 子域属于**外部依赖调用层（L6 客户端的封装）**，其数据流与其他持久化服务不同——不直接写入 IndexedDB，而是将 LLM 文本输出返回给上层 L4 应用服务：

```
[外部 LLM API: DeepSeek / Kimi / Qwen / SiliconFlow]
    ↑↓ HTTP/SSE
llmClient.chat() / streamingChat()
    ↓
llmGateway.chat() / streamingChat()  ← 审计/降级/Token统计
    ↓
services/scoring/（v6ScorePrompt → 评分因子 LLM 增强）
services/analysis/（文本分析、研报生成）
services/trading/（交易决策增强）
    ↓（由上层服务决定）
DataBridge.forward() → dataLayer → IndexedDB
    ↓（EventBus）
xxxStore (Zustand + withBroadcast)
    ↓
components/pages (仅经 Store 取数)
```

**说明**：
- `llmClient` 直接面向外部 HTTP API，是最底层调用点。
- `llmGateway` 作为防腐层，L4 应用层应优先通过 Gateway 调用，禁止直接依赖 `llmClient`。
- LLM 返回的文本内容本身**不持久化**；是否写入 Store/DB 由消费方（如 scoring、analysis）自行决定。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/ / data/ / config/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 调用日志、错误日志、性能日志 |
| validation | `@/lib/validation` | `isValidLlmBaseURL` 协议白名单校验（XSS-003） |
| safeCoerce | `@/lib/safeCoerce` | `getSafeString`，用于安全读取 API Key（间接，通过 `llmConfig`） |
| localStorageManager | `@/lib/localStorageManager` | 加密存储/读取 LLM API Key（间接，通过 `llmConfig`） |
| db (generateId) | `@/data/db` | `llmGateway` 生成 traceId |
| llmConfig | `@/config/llmConfig` | 默认配置、模型预设、透明度配置 |
| nanoid | `nanoid` | `llmGateway` 生成 traceId 后缀 |

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `VITE_LLM_BASE_URL` | `https://api.deepseek.com` | LLM API 基础地址 | `.env` / `src/config/llmConfig.ts` |
| `VITE_LLM_MODEL` | `deepseek-chat` | 默认模型名 | `.env` / `src/config/llmConfig.ts` |
| `apiKey` | `''`（从加密 localStorage 读取） | API 认证密钥 | `localStorageManager.setEncrypted` |
| `temperature` | `0.2` | 采样温度 | 调用时 `override` / `LlmConfig` |
| `maxTokens` | `undefined` | 最大输出 token 数 | 调用时 `override` / `LlmConfig` |
| `timeout` | `undefined` | 请求总超时（毫秒） | 调用时 `override` / `LlmConfig` |
| `STREAM_IDLE_TIMEOUT_MS` | `30000` | 流式空闲超时（内部常量） | `src/services/llm/llmClient.ts` |

### 4.3 模型预设清单

#### 国内模型

| preset id | 供应商 | 默认模型 | baseURL |
|-----------|--------|----------|---------|
| `deepseek` | DeepSeek | `deepseek-chat` | `https://api.deepseek.com` |
| `kimi` | Moonshot | `kimi-k2.7-code` | `https://api.moonshot.cn` |
| `qwen` | Alibaba | `qwen3.6-flash` | `https://dashscope.aliyuncs.com/compatible-mode` |
| `tencent-hunyuan` | Tencent | `hy3` | `https://tokenhub.tencentmaas.com/v1` |
| `bytedance-doubao` | ByteDance | `doubao-pro-32k` | `https://ark.cn-beijing.volces.com/api/v3` |
| `baidu-ernie` | Baidu | `ERNIE-4.5-Turbo` | `https://qianfan.baidubce.com/v2` |
| `zhipu-glm` | Zhipu AI | `glm-5-turbo` | `https://open.bigmodel.cn/api/paas/v4` |
| `siliconflow` | SiliconFlow | `Qwen/Qwen2.5-7B-Instruct` | `https://api.siliconflow.cn` |

#### 境外模型

| preset id | 供应商 | 默认模型 | baseURL |
|-----------|--------|----------|---------|
| `openai` | OpenAI | `gpt-4o` | `https://api.openai.com/v1` |
| `anthropic` | Anthropic | `claude-3.5-sonnet` | `https://api.anthropic.com/v1` |
| `google-gemini` | Google | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta` |
| `xai-grok` | xAI | `grok-4` | `https://api.x.ai/v1` |
| `custom` | 自定义 | `''` | `''` |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/llm/llmClient.test.ts` | `streamingChat` 流式解析：正常分片、空内容分片、HTTP 失败、body 为空、畸形 JSON、finish_reason stop、无 `[DONE]` 结尾 |
| 单元测试 | `src/services/llm/llmClient.multimodel.test.ts` | `chat()` 同步调用、超时/配置校验；多模型预设配置验证（DeepSeek/Kimi/Qwen/SiliconFlow/Custom）；`v6ScorePrompt` 构建器；多供应商 endpoint 兼容性 |
| Mock 策略 | 全局 `vi.fn()` mock `global.fetch` + `ReadableStreamDefaultReader` | 隔离外部 HTTP 依赖，无需真实 API Key |
| 已知失败 | `llmClient.multimodel.test.ts` 中多个 describe 标记为 `@status known-failing` | 通过 `vitest --exclude` 或 `.skip` 跳过，修复后移除 |

> 本目录**无 `__tests__/` 子目录**，测试文件与源码平级放置（`*.test.ts`）。

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿：基于 `llmClient.ts`、`llmGateway.ts`、`llmTypes.ts` 及测试文件生成 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 若新增 LLM 供应商预设，同步更新 `src/config/llmConfig.ts` 中的 `LLM_MODEL_PRESETS` 及本契约 §4.3。
> 2. 若新增流式/非流式 API 变体，同步更新 §2.2 主入口函数表。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
