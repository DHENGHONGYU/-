---
title: README
code_version: 2.0.0

tier: important
---

---
title: docs/prompts/README.md
code_version: 2.0.0
tier: reference
---

# AI Engineering Governance — V9 智能投研复盘系统

> **版本**: v1.0.0 | **日期**: 2026-07-10
> **适用范围**: 所有 LLM 调用、Agent 调度、提示词工程与 AI 增强评分
> **治理原则**: 透明可控、分层隔离、安全降级、成本可控

---

## 一、AI 架构总览

V9 的 AI 体系采用**三层调用栈 + 双引擎评分**架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI 架构分层                                │
├─────────────────────────────────────────────────────────────────┤
│  L4 应用层                                                        │
│  ├─ IntelligentScoreService（智能评分）                         │
│  ├─ Scoring V6 Engine（9 层评分引擎）                           │
│  └─ AgentRuntime（任务调度）                                     │
│                          │                                      │
│  L3 服务层 ───────────────┤                                      │
│  ├─ LLM Gateway（调用审计 + 错误降级 + Token 统计）             │
│  └─ MCP ACL（权限控制）                                          │
│                          │                                      │
│  L6 外部层 ───────────────┤                                      │
│  ├─ LLM Client（HTTP / SSE 流式）                               │
│  └─ 外部 LLM API（OpenAI 兼容格式）                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 核心设计原则

| 原则 | 实现 | 说明 |
|------|------|------|
| **调用透明** | `LlmTransparencyConfig` | 每个因子是否使用 LLM 对用户可见 |
| **用户可控** | 总开关 + 因子级覆盖 | 用户可独立启用/禁用任意因子的 LLM 增强 |
| **安全降级** | `allowFallback` | LLM 失败时返回空内容而非抛错，不影响主流程 |
| **成本可控** | Token 统计 + 消耗审计 | 每次调用记录 prompt/completion tokens |
| **输出消毒** | `sanitizeLlmOutput` / `sanitizeScore` | 防止 XSS 和异常值污染评分结果 |
| **提示词工程** | `prompts/` 模板化 | 5 类场景模板，统一 AI 生成风格 |

---

## 二、LLM 服务层（L3）

### 2.1 调用栈

```
业务代码（如 intelligentScoreService）
    │
    ▼
LLM Gateway（llmGateway.ts）
    ├─ 配置校验（baseURL / apiKey / model）
    ├─ 调用审计（traceId + duration + tokens）
    ├─ 错误降级（allowFallback → 空内容）
    └─ Token 统计（prompt + completion + total）
    │
    ▼
LLM Client（llmClient.ts）
    ├─ 非流式：chat() → fetch /v1/chat/completions
    └─ 流式：streamingChat() → SSE 逐行解析
    │
    ▼
外部 LLM API（OpenAI 兼容格式）
```

### 2.2 LLM Client（底层实现）

文件: `src/services/llm/llmClient.ts`

| 特性 | 实现 |
|------|------|
| 协议 | OpenAI 兼容 `/v1/chat/completions` |
| 非流式 | `chat(messages, config?)` → `LlmResponse` |
| 流式 | `streamingChat(messages, callback, config?)` → SSE 逐 chunk 回调 |
| 超时 | `AbortController` + 总超时（config.timeout）+ 空闲超时（30s） |
| 协议白名单 | `isValidLlmBaseURL()` 校验，仅允许 `http://` / `https://`（防 XSS-003） |
| 错误处理 | `LlmConfigError`（配置错误）/ `LlmApiError`（API 错误，含 statusCode） |
| 响应解析 | 自动解析 JSON + 提取 `choices[0].message.content` + usage 统计 |
| 流式解析 | SSE `data:` 行逐行解析，支持 `[DONE]` 终止 + 错误内联 |

### 2.3 LLM Gateway（中间层封装）

文件: `src/services/llm/llmGateway.ts`

| 职责 | 实现 |
|------|------|
| 调用追踪 | `traceId = llm-${nanoid(8)}-${generateId(8)}` |
| 性能监控 | 记录 `durationMs` + `model` + `totalTokens` |
| 错误降级 | `options.allowFallback` → 返回空内容（`{ content: '', model: 'fallback' }`） |
| 日志分级 | `info`（成功）/ `error`（失败）+ 结构化 context |
| 异常透传 | 底层 `LlmApiError` 直接抛出，不吞没 |

> **分层规则**: L4 应用层**禁止**直接调用 `llmClient.ts`，必须通过 `llmGateway.ts` 路由。这是 AGENTS.md §六 的强制性约束。

---

## 三、LLM 配置与模型管理

### 3.1 内置模型预设

文件: `src/config/llmConfig.ts`

| 预设 ID | 名称 | 提供商 | 默认模型 | 上下文窗口 | 输入价 | 输出价 |
|---------|------|--------|---------|-----------|--------|--------|
| `deepseek` | DeepSeek | DeepSeek | `deepseek-v4-flash` | 1,000,000 | $0.14 | $0.28 |
| `kimi` | Kimi K2 | Moonshot | `kimi-k2.7-code` | 128,000 | $0.60 | $1.80 |
| `qwen` | 通义千问 | Alibaba | `qwen3.6-flash` | 128,000 | $0.40 | $1.20 |
| `siliconflow` | 硅基流动 | SiliconFlow | `Qwen/Qwen2.5-7B-Instruct` | 32,000 | $0.42 | $0.42 |
| `custom` | 自定义 | — | — | — | — | — |

### 3.2 配置存储安全

| 配置项 | 存储方式 | 加密 | 读取方式 |
|-------|---------|------|---------|
| API Key | `localStorageManager.setEncrypted()` | ✅ AES-GCM | `getLlmApiKeyAsync()`（异步解密） |
| Base URL | 运行时 `import.meta.env` + 用户 UI 配置 | ❌ | 明文 |
| Model | 同上 | ❌ | 明文 |
| 温度/最大Token | 同上 | ❌ | 明文 |

> **安全修复 P0-01**: API Key 不再从 `VITE_LLM_API_KEY` 环境变量读取（防止打包泄露），改为从加密 localStorage 异步读取。

### 3.3 LLM 透明度配置

```typescript
interface LlmTransparencyConfig extends LlmConfig {
  enableLlm: boolean              // 总开关（默认关闭）
  showTransparencyPanel: boolean // 是否显示透明度面板（默认关闭）
  factorOverrides: LlmFactorOverride[]  // 因子级覆盖
}

interface LlmFactorOverride {
  factorId: string   // 与 scoreFactors.ts 中的因子名称对齐
  useLlm: boolean    // 该因子是否允许调用 LLM
}
```

**默认 LLM 启用层级**（V6 评分引擎）：

| 层级 | 名称 | 类型 | 默认使用 LLM | 权重 |
|------|------|------|-------------|------|
| L0 | 宏观政策 | LLM 可增强 | ✅ | — |
| L1 | 行业景气 | LLM 可增强 | ✅ | — |
| L2 | 护城河与竞争 | LLM 可增强 | ✅ | — |
| L3 | 盈利质量 | 确定性 | ❌ | — |
| L4 | 估值水平 | 确定性 | ❌ | — |
| L5 | 管理层 | LLM 可增强 | ✅ | — |
| L6 | 资本配置 | LLM 可增强 | ✅ | — |
| L7 | 第二曲线 | LLM 可增强 | — | 15% |
| L8 | 技术筹码 | 确定性 | ❌ | 4% |

> **默认配置**: `DEFAULT_LLM_ENABLED_LAYER_INDICES = new Set([0, 1, 2, 5, 6])`（L0/L1/L2/L5/L6）。L3/L4/L7/L8 由规则引擎自动计算，不调用 LLM。

---

## 四、评分引擎 AI 增强（V6 Engine）

### 4.1 九层评分模型

文件: `src/services/scoring/v6-engine/`

V6 评分引擎将股票评分拆分为 9 个独立维度（L0-L8），每个维度独立计算后加权汇总：

```
L0 宏观政策 ─────┐
L1 行业景气 ─────┤ LLM 可增强层（语义分析）
L2 护城河竞争 ───┤
L3 盈利质量 ─────┤
L4 估值水平 ─────┤ 确定性层（规则计算）
L5 管理层 ───────┤ LLM 可增强层（主观评估）
L6 资本配置 ─────┤
L7 第二曲线 ─────┤ 混合层（规则 + 可选 LLM）
L8 技术筹码 ─────┘ 确定性层（K线量价计算）
```

### 4.2 智能评分服务（Intelligent Score）

文件: `src/services/scoring/intelligentScoreService.ts`

`runIntelligentScore()` 执行 6 步评分流程：

```
1. fetchBasicData      → 读取股票基础数据（pe/pb/roe/marketCap）
2. readSupplementaryFiles → 读取用户上传的补充文件（研报/财报）
3. prepareReportText   → 整理行业报告资料
4. llmAnalysis         → 调用 LLM 生成多维度评分（JSON 格式）
5. parseScore          → 解析 LLM 输出 + 因子级透明度标记
6. saveResult          → 保存到 intelligent_scores 存储表
```

**LLM 提示词构建**: `buildIntelligentScorePrompt()` 将股票数据 + 补充文件 + 报告文本组装为结构化 prompt，要求 LLM 返回标准 JSON 格式：

```json
{
  "dimensions": [
    { "name": "盈利质量", "score": 4.5, "rationale": "...", "evidence": ["..."] }
  ],
  "summary": "...",
  "basis": "...",
  "missingFields": ["roe"]
}
```

### 4.3 输出消毒与校验

| 消毒点 | 实现 | 说明 |
|--------|------|------|
| JSON 提取 | `extractJsonFromMarkdown()` | 从 Markdown 代码块中提取 JSON |
| JSON 解析 | `parseRawScoreOutput()` | 失败时抛 `LlmApiError` |
| 分数归一化 | `normalizeDimensionScore()` | `Math.max(1, Math.min(5, score))` |
| 评分总校验 | `sanitizeScore()` | `Number.isFinite()` + `[0, 100]` clamp |
| 类型过滤 | `filter()` + `typeof` | 确保 `evidence` 为字符串数组 |

---

## 五、Agent 系统

### 5.1 Agent 运行时

文件: `src/agents/agentRuntime.ts`

`AgentRuntime` 是基于 MCP 的轻量级任务调度器：

```typescript
class AgentRuntime {
  register(config: AgentConfig)     // 注册 Agent（name/timeout/maxConcurrent/mcpServer）
  execute(agentId, type, payload)   // 执行单任务（含超时控制）
  executeParallel(tasks[])          // 并行执行多任务
  cancelTask(id)                    // 取消运行中任务
  getTask(id) / listTasks(status)   // 任务查询
}
```

**任务生命周期**: `pending → running → completed/failed/timeout`

**事件驱动**: 通过 `eventBus` 发射状态变更事件，`AgentStore` 订阅同步：
- `AGENT_REGISTERED` / `AGENT_TASK_STARTED` / `AGENT_TASK_COMPLETED`
- `AGENT_TASK_FAILED` / `AGENT_TASK_TIMEOUT` / `AGENT_TASK_CANCELLED`

### 5.2 Agent Store

文件: `src/store/agentStore.ts`

Zustand Store 管理 Agent 状态：

| 状态 | 说明 |
|------|------|
| `registeredAgents` | 已注册 Agent ID 列表 |
| `tasks` | `Map<string, AgentTask>` 任务集合 |
| `stats` | 运行统计（pending/running/completed/failed） |
| `triggerPayload` | 任务触发参数 |
| `mcpCallHistory` | MCP 调用历史（最大保留 `MCP_CALL_HISTORY_MAX_SIZE` 条） |

### 5.3 自定义智能体（v26）

DB_VERSION 26 引入 `custom_agents` 存储表，支持用户在「自定义智能体」页面创建和管理 Agent：

- 配置 Agent 的 `mcpServerName` / `defaultToolName` / `timeout` / `maxConcurrent`
- 通过 `AgentRuntime.register()` 注册到运行时
- 任务执行通过 `mcpBridge.callTool()` 调用对应 MCP Server

---

## 六、提示词工程

### 6.1 模板目录

文件: `../README.md`

| 模板 | 用途 | 关键约束 |
|------|------|---------|
| `../system-prompt-template.md` | 通用系统提示词 | 项目架构、分层规则、颜色令牌、日志规范 |
| `../component-prompt-template.md` | UI 组件生成 | 设计体系、组件层级、Widget 三处注册 |
| `../service-prompt-template.md` | Service 生成 | DataBridge 使用、事件规范、日志规范 |
| `../store-prompt-template.md` | Store 生成 | `withBroadcast` 跨 Tab 广播 |
| `../types-prompt-template.md` | 类型定义生成 | 零依赖原则 |

### 6.2 使用方式

1. **系统提示词**: 将 `../system-prompt-template.md` 粘贴到 Cursor / Trae / WorkBuddy 的系统提示词
2. **`.cursorrules`**: 项目根目录已配置自动加载
3. **任务级加载**: 复杂任务前手动追加对应模板

### 6.3 维护规范

- `../../AGENTS.md` 变更 → 同步更新 `../../prompts/../../prompts/../../prompts/../../prompts/system-prompt-template.md`
- 设计令牌体系变更 → 同步更新所有模板中的颜色引用
- 新增分层规则 → 同步更新 `../../prompts/../../prompts/../../prompts/../../prompts/system-prompt-template.md` 依赖方向

---

## 七、AI 安全与合规

### 7.1 输出消毒

| 场景 | 消毒函数 | 位置 |
|------|---------|------|
| 评分值域 | `sanitizeScore(score, layerId, context)` | `src/services/scoring/v6-engine/engine.ts` |
| LLM 文本渲染 | `sanitizeLlmOutput()` | AGENTS.md §六 规范（渲染层实现） |
| JSON 解析 | `parseRawScoreOutput()` + `extractJsonFromMarkdown()` | `intelligentScoreService.ts` |
| baseURL 协议 | `isValidLlmBaseURL()` | `src/lib/validation.ts` |

### 7.2 调用透明度

AGENTS.md §九 要求：

1. **模型选择展示**: LLM 调用前向用户展示模型选择面板
2. **因子使用标注**: 评分结果清晰标注哪些因子使用 LLM 增强 vs 自动计算
3. **用户开关**: 每个 LLM 可增强层都有独立的启用/禁用开关
4. **Token 消耗**: 每次调用记录并展示 prompt/completion tokens

实现位置: `src/pages/command/agent/LlmManagementPage.tsx` + `IntelligentScoreExplanation.tsx`

### 7.3 Token 消耗控制

AGENTS.md §七.1 强制规则：

| 规则 | 实现 |
|------|------|
| 知识图谱优先 | 理解代码先查 `docs/00-meta/ai-index/.ai-index/code-graph.json`，禁止重复 grep/search |
| 增量解析 | `extract-code-graph.ts` 基于 mtime 增量更新 |
| 缓存查询 | `scripts/quick-query.sh` 模板化常用查询 |
| 单次预算 | 单次 AI 会话 ≤ 50,000 tokens |

验证命令: `npm run audit:token`

---

## 八、AI 治理检查清单

### 8.1 新增 LLM 调用场景

```typescript
// ✅ AI 调用自查清单
[ ] 是否通过 LLM Gateway 而非直接调用 llmClient？
[ ] 是否设置了 `caller` 标识用于审计？
[ ] 是否配置了 `allowFallback` 降级策略？
[ ] 是否将调用纳入 `LlmTransparencyConfig` 因子覆盖？
[ ] 输出是否经过 sanitize（JSON 解析/值域校验）？
[ ] 是否更新 LLM 透明度面板展示？
[ ] 是否记录 Token 消耗到日志？
[ ] 是否处理超时和 AbortError？
```

### 8.2 新增 Agent

```typescript
// ✅ Agent 自查清单
[ ] 是否在 `AgentRuntime.register()` 中注册？
[ ] 是否配置了合理的 `timeout` 和 `maxConcurrent`？
[ ] 是否指定了 `mcpServerName` 和 `defaultToolName`？
[ ] MCP 调用是否传入正确的 `caller` context？
[ ] 是否通过 `eventBus` 发射状态变更事件？
[ ] 是否支持任务取消（AbortController）？
[ ] 自定义 Agent 是否持久化到 `custom_agents` 表？
```

### 8.3 提示词模板变更

```typescript
// ✅ 提示词维护清单
[ ] 变更是否同步到所有 5 个模板文件？
[ ] 是否更新了 `.cursorrules` 引用？
[ ] 是否运行 `npm run audit:docs` 确认文档同步？
[ ] 是否测试了 AI 生成代码的合规性（audit:layers/hardcode）？
```

---

## 九、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| LLM 配置 | `src/config/llmConfig.ts` | 预设模型 / 透明度配置 / 加密存储 |
| LLM 类型 | `src/services/llm/llmTypes.ts` | LlmMessage / LlmResponse / LlmUsage / LlmStreamChunk |
| LLM 客户端 | `src/services/llm/llmClient.ts` | chat / streamingChat / SSE 解析 |
| LLM 网关 | `src/services/llm/llmGateway.ts` | 调用审计 / 错误降级 / Token 统计 |
| Agent 运行时 | `src/agents/agentRuntime.ts` | 注册 / 执行 / 并行 / 取消 |
| Agent Store | `src/store/agentStore.ts` | Zustand 状态 + EventBus 订阅 |
| 智能评分服务 | `src/services/scoring/intelligentScoreService.ts` | 6 步评分流程 |
| 评分引擎 | `src/services/scoring/v6-engine/` | 9 层计算器 + 配置 + 类型 |
| 评分因子 | `src/config/scoreFactors.ts` | L0-L8 因子定义与权重 |
| 提示词模板 | `../` | 5 类场景模板 |
| 数据校验 | `src/lib/validation.ts` | `isValidLlmBaseURL` |
| ../../AGENTS.md LLM 约束 | `../../AGENTS.md` §六/九 | 引擎架构 / 调用透明度 |

---

> **⚠️ 待确认项（请补充）**：
> 1. 是否接入模型路由（如按任务类型自动选择 cheapest/best 模型）？
> 2. 是否需要 Prompt 版本管理（如 A/B 测试不同提示词效果）？
> 3. 是否需要 LLM 响应缓存（相同输入避免重复调用）？
> 4. 是否需要多轮对话历史管理（上下文窗口管理）？
> 5. 是否需要 RAG / 知识库增强（接入本地研报向量检索）？
> 
> 三份文档已全部生成完毕。如需补充或调整，请告知具体需求。
