---
title: V9 智能体（Agent/LLM/AI）全面检视报告
version: v1.0.0
date: 2026-06-27
maintainer: Architecture Audit
status: active
---

# V9 智能体检视报告

> 生成日期：2026-06-27
> 审计范围：`src/agents/`、`src/services/llm/`、`src/services/scoring/`、`src/services/trading/`、`src/cockpit/`、`src/engine/`、`src/constants/ai-center.constants.ts`、`.agents/skills/`
> 审计结论：**Agent 运行时框架已搭建，但与业务服务层存在严重断层；LLM 评分链路已打通但未接入 Agent 调度；策略引擎完全独立于 Agent 系统。**

---

## 一、智能体清单与分类

### 1.1 已注册 Agent（5个）

| # | Agent ID | 名称 | 类型标签 | 超时(ms) | 最大并发 | 状态 |
|---|----------|------|----------|----------|----------|------|
| 1 | `v6-scoring-agent` | V6 自动评分 Agent | STRATEGY | 30000 | 5 | 已注册 |
| 2 | `v4-industrial-agent` | V4 行业评分 Agent | STRATEGY | 45000 | 3 | 已注册 |
| 3 | `llm-intelligent-agent` | LLM 智能评分 Agent | LLM | 60000 | 2 | 已注册 |
| 4 | `fetcher-agent` | 数据采集 Agent | TOOL | 15000 | 10 | 已注册 |
| 5 | `news-analyzer-agent` | 新闻分析 Agent | TOOL | 20000 | 5 | 已注册 |

**注册来源**: `src/agents/index.ts:72-78` — `DEFAULT_AGENTS` 数组

### 1.2 LLM Skill 文件（2个，独立于 Agent 运行时）

| # | Skill 路径 | 对应页面 | LLM 调用方式 |
|---|-----------|----------|-------------|
| 1 | `.agents/skills/intelligent-score/SKILL.md` | `/analysis/intelligent-score` | 直接调用 `llmClient.chat()` |
| 2 | `.agents/skills/industry-score/SKILL.md` | `/analysis/industry-score` | 直接调用 `llmClient.chat()` |

### 1.3 AI Center UI 层定义的 Agent 类型（4种，仅UI展示用）

| 类型 key | 名称 | 来源 |
|----------|------|------|
| `agentAssistant` | Agent 助手 | `src/constants/ai-center.constants.ts:130` |
| `stockStrategy` | 股票策略 | `src/constants/ai-center.constants.ts:135` |
| `llmIntegration` | 大模型集成 | `src/constants/ai-center.constants.ts:140` |
| `knowledgeRetrieval` | 知识库检索 | `src/constants/ai-center.constants.ts:145` |

> **注意**: 这4种类型仅用于 AI Center 页面的展示分类，与 `src/agents/` 运行时的5个 Agent **无映射关系**。

---

## 二、架构分层视图

```
┌─────────────────────────────────────────────────────────────────┐
│  UI 层                                                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │IntelligentScore│  │IndustryScorePage│  │AITradeReviewWidget│  │
│  │    Page.tsx    │  │     .tsx         │  │     .tsx          │  │
│  └──────┬────────┘  └──────┬──────────┘  └──────┬───────────┘  │
└─────────┼─────────────────┼────────────────────┼──────────────┘
          │                 │                    │
┌─────────┼─────────────────┼────────────────────┼──────────────┐
│  Hooks/Service 层（直接调用 LLM）                                     │
│  ┌──────▼──────────────────────────────────────────────────┐     │
│  │ useIntelligentScorePage ──► runIntelligentScore() ──────►│     │
│  │ useIndustryScorePage   ──► runIndustryScore()  ──────►│     │
│  │ MarketDataProvider     ──► streamingChat()     ──────►│     │
│  └────────────────────────────────┬──────────────────────┘     │
└───────────────────────────────────┼────────────────────────────┘
                                    │
┌───────────────────────────────────┼────────────────────────────┐
│  LLM 客户端层                                                     │
│  ┌────────────────────────────────▼──────────────────────────┐  │
│  │  llmClient.ts  chat() / streamingChat()                   │  │
│  │  ──► OpenAI 兼容 /chat/completions 接口                     │  │
│  │  ──► DeepSeek / Kimi / 硅基流动 等国内模型                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  Agent 运行时层（孤岛）                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  agentRuntime.ts     ── 注册/执行/超时（runAgent 为占位符） │ │
│  │  agentRegistry.ts    ── 注册表管理                         │ │
│  │  agentHealthMonitor.ts ── 健康监控（30s 周期）               │ │
│  │  agentConfigManager.ts ── 配置管理/覆盖/校验               │ │
│  │  index.ts            ── 初始化 5 个 Agent + 自动启动          │ │
│  └───────────────────────────────────────────────────────────┘ │
│       ↕ eventBus 事件通信                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  agentStore.ts (Zustand) ── UI 状态同步                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  Engine 层（编排 AgentRuntime + DataFlowEngine）                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  src/engine/index.ts  ── 但未在 App.tsx 中显式调用           │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  策略引擎层（完全独立，不引用 Agent）                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  strategyEngine.ts     ── 四分类选股（纯规则引擎）           │ │
│  │  dualStrategyEngine.ts ── 双策略评分（纯规则引擎）           │ │
│  │  portfolioBuilder.ts  ── 组合构建（消费 strategyEngine）     │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 三、API 调用方式与配置

### 3.1 LLM API 配置

| 配置项 | 环境变量 | 默认值 | 配置文件 |
|--------|----------|--------|----------|
| Base URL | `VITE_LLM_BASE_URL` | `''` (空) | `src/config/llmConfig.ts:9` |
| API Key | `VITE_LLM_API_KEY` | `''` (空) | `src/config/llmConfig.ts:10` |
| Model | `VITE_LLM_MODEL` | `deepseek-chat` | `src/config/llmConfig.ts:11` |

**配置入口**:
- `.env.example` 中预设了 DeepSeek 接口
- 页面内可覆盖（`IntelligentScorePage.tsx:48`、`IndustryScorePage.tsx:51` 提供 baseURL/apiKey/model 输入框）

### 3.2 LLM 调用方式

| 调用函数 | 文件 | 端点 | 模式 |
|----------|------|------|------|
| `chat()` | `src/services/llm/llmClient.ts:109` | `/chat/completions` | 同步请求 |
| `streamingChat()` | `src/services/llm/llmClient.ts:189` | `/chat/completions` | SSE 流式 |

**协议**: OpenAI 兼容格式，`Authorization: Bearer <apiKey>`，temperature=0.2。

### 3.3 Token 使用解析

`llmClient.ts:68-85` 解析 `prompt_tokens`、`completion_tokens`、`total_tokens`，类型导出为 `LlmUsage`。

---

## 四、链路完整性审计（核心发现）

### 4.1 Agent 运行时 ↔ LLM 评分服务 — 断裂 ❌

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `src/services/scoring/intelligentScoreService.ts` 是否 import Agent | **否** | 直接调用 `chat()` |
| `src/services/scoring/industryScoreService.ts` 是否 import Agent | **否** | 直接调用 `chat()` |
| `src/hooks/cabin/useIntelligentScorePage.ts` 是否通过 Agent 调度 | **否** | 直接调用 `runIntelligentScore()` |
| `src/hooks/cabin/useIndustryScorePage.ts` 是否通过 Agent 调度 | **否** | 直接调用 `runIndustryScore()` |

**结论**: LLM 评分功能已完整实现并可用，但**完全绕过了 Agent 运行时**。`llm-intelligent-agent` 和 `v6-scoring-agent` 虽已注册，但从未被业务代码调用。

### 4.2 Agent 运行时 ↔ 策略引擎 — 断裂 ❌

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `strategyEngine.ts` 是否 import Agent | **否** | 纯规则引擎，无 AI/LLM 依赖 |
| `dualStrategyEngine.ts` 是否 import Agent | **否** | 纯规则引擎 |
| `portfolioBuilder.ts` 是否 import Agent | **否** | 仅 import `runStrategy` |
| 策略引擎是否使用 LLM 辅助决策 | **否** | 完全基于规则阈值分类 |

**结论**: 策略引擎是纯规则系统，不涉及任何 Agent/LLM 调用，与 Agent 运行时零集成。

### 4.3 Agent 运行时 ↔ 数据采集 — 断裂 ❌

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `fetcher-agent` 是否有真实 handler | **否** | `runAgent()` 为占位符，1s 延迟后返回 `{ success: true, data: {} }` |
| `news-analyzer-agent` 是否有真实 handler | **否** | 同上 |

### 4.4 Agent 运行时 ↔ 驾驶舱 — 断裂 ❌

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `MarketDataProvider.tsx` 是否通过 Agent 调用 LLM | **否** | 直接 import `streamingChat` |
| `AITradeReviewWidget.tsx` 是否引用 Agent | **否** | 未检查到引用 |

### 4.5 Agent 系统 ↔ Engine 层 — 孤岛 ⚠️

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `src/engine/index.ts` 是否 import AgentRuntime | **是** | 创建了独立实例 `new AgentRuntime()` |
| Engine 的 AgentRuntime 与 agents/index.ts 的 agentRuntime 是否同一实例 | **否** | Engine 创建了自己的新实例，与 `agents/index.ts` 导出的单例是两个不同对象 |
| Engine 是否在 App.tsx 中被调用 | **否** | `bootstrapService.ts` 未引用 Engine，App.tsx 未调用 `createEngine()` |

### 4.6 Agent 运行时 ↔ bootstrapService — 断裂 ❌

`bootstrapService.ts` 中不包含任何 `agent` 或 `Agent` 引用。Agent 系统的初始化通过 `src/agents/index.ts:178-184` 的模块导入副作用自动执行，**不在应用启动流程的控制链中**。

---

## 五、问题汇总与严重度

### 🔴 严重（P0）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| P0-1 | **Agent 运行时与业务完全脱节**：5个已注册 Agent 的 `runAgent()` 均为占位符（1s 延迟+空结果），无真实业务逻辑 | `agentRuntime.ts:121-133` | Agent 系统形同虚设，所有 AI 功能绕过它直接运行 |
| P0-2 | **Engine 创建了独立 AgentRuntime 实例**，与 `agents/index.ts` 的全局单例不是同一对象 | `engine/index.ts:33` | 两个 AgentRuntime 实例共存，注册信息和任务互相不可见 |
| P0-3 | **并发控制未生效**：`maxConcurrent` 字段已定义但 `execute()` 中无并发限制逻辑 | `agentRuntime.ts:49-119` | Agent 可能被无限并发执行，导致资源耗尽 |

### 🟡 中等（P1）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| P1-1 | **stockAnalysisEngine.ts L0-L8 全部为占位符**，注释"后续接入 LLM" | `stockAnalysisEngine.ts:376-701` | V6 九层分析引擎未接入 LLM，与 `llm-intelligent-agent` 无关联 |
| P1-2 | **AI Center 常量定义的 4 种 Agent 类型** 与运行时 5 个 Agent 无映射 | `ai-center.constants.ts:122-150` | UI 展示的分类与实际运行时 Agent 无法对应 |
| P1-3 | **Agent 初始化不在 bootstrap 流程中**，通过模块副作用自动执行 | `agents/index.ts:178-184` | 初始化时机不可控，可能在依赖未就绪时执行 |
| P1-4 | **HealthMonitor 未接收实际任务数据**：AgentRuntime.execute() 完成后未调用 `healthMonitor.recordTask()` | `agentRuntime.ts:94-117` | 健康监控永远无数据，报告始终为空 |

### 🟢 低（P2）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| P2-1 | **agentStore.ts:89** 在模块末尾直接调用 `initAgentSubscriptions()`，与 `agents/index.ts:122` 重复初始化 | `agentStore.ts:89` | 可能导致重复订阅 eventBus |
| P2-2 | **AgentConfig 缺少 handler/capabilities/priority 字段**，与 spec 文档 `agent-runtime-spec.md` 定义不一致 | `agentRuntime.ts:6-12` | 扩展性受限 |
| P2-3 | **无 embedding/RAG 实现**：文档中提到 `knowledgeRetrieval` 类型但无实际代码 | - | 知识库检索能力为空 |

---

## 六、已完整实现的链路

以下链路已打通且功能可用：

### ✅ LLM 评分链路（完整）

```
用户选择标的 → useIntelligentScorePage → runIntelligentScore()
  → buildIntelligentScorePrompt() → chat() → parseRawScoreOutput()
  → normalizeScoreOutput() → calculateOverallScore() → dataLayer.intelligentScores.save()
```

### ✅ LLM 行业评分链路（完整）

```
用户选择行业 → useIndustryScorePage → runIndustryScore()
  → buildIndustryScorePrompt() → chat() → parseRawScoreOutput()
  → normalizeScoreOutput() → calculateOverallScore() → dataLayer.industryScores.save()
```

### ✅ LLM 流式对话（驾驶舱，完整）

```
MarketDataProvider → streamingChat() → SSE 流式响应 → UI 实时渲染
```

### ✅ 策略选股引擎（纯规则，完整）

```
Stock[] → runStrategy() → classify() → 20进13筛选 → StrategyResult
```

---

## 七、修复建议（按优先级）

### Phase A：修复 Agent 框架层（P0）

**A1. 消除双实例问题**
- 文件: `src/engine/index.ts:33`
- 操作: 将 `new AgentRuntime()` 改为 import 共享单例 `agentRuntime` from `@/agents/agentRuntime`

**A2. 接入 HealthMonitor**
- 文件: `src/agents/agentRuntime.ts:94-117`
- 操作: 在任务完成/失败时调用 `getAgentHealthMonitor().recordTask(task)`

**A3. 实现并发控制**
- 文件: `src/agents/agentRuntime.ts`
- 操作: 在 `execute()` 中增加运行中任务数检查，超过 `maxConcurrent` 时排队或拒绝

### Phase B：桥接 Agent 与业务服务（P0）

**B1. LLM 评分服务接入 Agent 调度**
- 文件: `src/hooks/cabin/useIntelligentScorePage.ts`、`useIndustryScorePage.ts`
- 操作: 将 `runIntelligentScore()` / `runIndustryScore()` 包装为 Agent handler，通过 `agentRuntime.execute('llm-intelligent-agent', ...)` 调度

**B2. 为每个 Agent 注册真实 handler**
- 文件: `src/agents/agentRuntime.ts` — `AgentConfig` 增加 `handler` 字段
- 操作: `llm-intelligent-agent` handler → `runIntelligentScore()`；`v4-industrial-agent` handler → `runIndustryScore()`；`fetcher-agent` handler → `dataLayer` 采集逻辑

### Phase C：完善集成链路（P1）

**C1. 将 Agent 初始化纳入 bootstrap 流程**
- 文件: `src/services/system/bootstrapService.ts`
- 操作: 在 `initializeApp()` 中调用 `initAgentSystem()`

**C2. 对齐 AI Center 类型与运行时 Agent**
- 文件: `src/constants/ai-center.constants.ts`
- 操作: 为运行时 5 个 Agent 分配对应的 `type` 字段

**C3. Engine 在 App.tsx 中启动**
- 文件: `src/App.tsx`
- 操作: 在 `useEffect` 中调用 `createEngine().start()`

### Phase D：增强 AI 能力（P2）

**D1. stockAnalysisEngine 接入 LLM**
- 文件: `src/services/analysis/stockAnalysisEngine.ts`
- 操作: 将占位符替换为 `chat()` 调用，包装为 Agent handler

**D2. 补充 knowledgeRetrieval Agent**
- 新增本地文档嵌入和向量检索能力

---

## 九、补充分析：V6 方法论 SKILL vs 代码实现差距（2026-06-27 追加）

> 基于 8 个上传 SKILL 文件（v6-stock-analysis-model v4.3 / sector-analysis-framework / valuation-financial-analysis / portfolio-allocation-strategy / industry-score-mapping / pharma-sector-analysis / v6-docx-output / md-to-docx）与 `stockAnalysisEngine.ts` 的对比。

### 9.1 SKILL 文件同步状态

| SKILL 名称 | 版本 | 项目目录 | 状态 |
|------------|------|----------|------|
| v6-stock-analysis-model | v4.3 | `.agents/skills/v6-stock-analysis-model/SKILL.md` | ✅ 已同步 |
| sector-analysis-framework | v1.0 | `.agents/skills/sector-analysis-framework/SKILL.md` | ✅ 已同步 |
| valuation-financial-analysis | v1.1 | `.agents/skills/valuation-financial-analysis/SKILL.md` | ✅ 已同步 |
| industry-score-mapping | v1.0 | `.agents/skills/industry-score-mapping/SKILL.md` | ✅ 已同步 |
| v6-docx-output | v1.0 | `.agents/skills/v6-docx-output/SKILL.md` | ✅ 已同步 |
| portfolio-allocation-strategy | v1.0 | `.agents/skills/portfolio-allocation-strategy/` | ⚠️ 目录已建，SKILL 待补充 |
| pharma-sector-analysis | v1.0 | `.agents/skills/pharma-sector-analysis/` | ⚠️ 目录已建，SKILL 待补充 |
| md-to-docx | v1.1 | - | ❌ 未上传 |

### 9.2 stockAnalysisEngine.ts 代码 vs SKILL 方法论差距矩阵

| 分析层 | SKILL 方法论定义 | 代码实现状态 | 差距描述 |
|--------|-----------------|-------------|---------|
| **L-1 行业评分估值** | SKILL-C/SKILL-N 七行业映射 + 关联度系数 | ❌ 完全缺失 | 代码中无 L-1 层，无行业评分映射逻辑 |
| **L0 STEEP 宏观** | 13项子维度评分指引 + 主题框架可插拔 | ⚠️ 占位符 | 仅有简化评分，无 STEEP 子维度、无主题框架 |
| **L1 护城河** | 5类护城河×4条量化标准 + 另类因子 ALT-02/04/05/08 | ⚠️ 占位符 | 有基础框架但无量化标准，无另类因子 |
| **L2 竞品** | 技术代差/市场份额/客户认证三维量化 + ALT-03 | ⚠️ 占位符 | 无竞品对比维度，无客户认证阶段 |
| **L3 财务** | 5维财务Rubric + 红黄风险预警(9条) + **IPC临界点判断**(OCR/MCE/TIMS) | ⚠️ 占位符 | 仅基础财务加权，**完全缺失 IPC/OCR/MCE/TIMS**，无风险预警 |
| **L3 估值** | 8行业PE/PEG/PB基准库 + DCF | ⚠️ 占位符 | 无行业基准库 |
| **L4 情景** | 三情景概率加权 + 目标价推导公式 + 收益比 | ⚠️ 占位符 | 无情景构建逻辑，无目标价推导 |
| **L5 T-M** | 技术成熟度/市场成熟度双轴 + 象限策略 | ⚠️ 占位符 | 无 T-M 矩阵实现 |
| **L6 Hype** | Gartner五阶段 + 评分Rubric | ⚠️ 占位符 | 无 Hype Cycle 定位 |
| **L7 第二曲线** | 生命阶段诊断 + 催化剂强度 + 主题框架 | ⚠️ 占位符 | 无第二曲线识别逻辑 |
| **L8 筹码** | **8级筹码变化度**(SCD/PCH/AII/博弈矩阵/RSI/CCS/DIV/CSR) + 量价因子 | ⚠️ 占位符 | **完全缺失筹码变化度体系**，仅有简单筹码集中度 |

### 9.3 缺失的关键业务模块（7个全部缺失）

| # | 模块 | SKILL 来源 | 代码状态 | 实现难度 |
|---|------|-----------|---------|---------|
| 1 | **L-1 行业评分估值映射** | industry-score-mapping SKILL | ❌ 无代码 | 中 — 需7行业报告数据 + 匹配算法 |
| 2 | **L3 IPC 业绩兑现临界点** | v6-stock-analysis-model v4.3 | ❌ 无代码 | 高 — 需 OCR/MCE/TIMS 三维框架 + 跨层推理 |
| 3 | **L3 财务风险红黄预警** | v6-stock-analysis-model | ❌ 无代码 | 低 — 纯规则判断 |
| 4 | **L8 筹码变化度 8 级指标** | v6-stock-analysis-model v4.1 | ❌ 无代码 | 中 — 需股东人数数据源 + 衍生计算 |
| 5 | **ESS 置信度考核体系** | v6-stock-analysis-model v4.2 | ❌ 无代码 | 高 — 需全链路数据溯源 + 折损模型 |
| 6 | **ALT-01~ALT-10 另类因子** | v6-stock-analysis-model | ❌ 无代码 | 低 — 评分调整项 |
| 7 | **核心跟踪指标 + 告警** | v6-stock-analysis-model | ❌ 无代码 | 中 — 需事件驱动架构 |

### 9.4 权重表对比

| 层 | SKILL v4.3 权重 | 代码权重 | 偏差 |
|----|:---:|:---:|:---:|
| L-1 | 10% | 0%（缺失） | -10% |
| L0 | 10% | 10% | 0% |
| L1 | 15% | 15% | 0% |
| L2 | 10% | 10% | 0% |
| L3 财务 | 10% | 15%（合并） | +5% |
| L3 估值 | 10% | —（与财务合并） | -10% |
| L4 | 10% | 15%（情景） | +5% |
| L5 | 5% | 10%（T+0策略） | +5% |
| L6 | 7% | 8%（Hype） | +1% |
| L7 | 15% | 7%（第二曲线） | -8% |
| L8 | 8% | 7%（技术筹码） | -1% |

**关键偏差**：代码 L3 合并了财务+估值（应为独立两层），L5/L6/L7 层命名和权重与 SKILL 方法论不一致。

### 9.5 建议实施路径

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| **S1** | 修复权重表 + 层命名对齐 SKILL v4.3（L3 拆分财务/估值，L5 改 T-M，L6 改 Hype，L7 改第二曲线） | 0.5天 |
| **S2** | 实现 L3 财务风险红黄预警 + 行业基准库 | 1天 |
| **S3** | 实现 L-1 行业评分映射（7行业 + 16只标的匹配表） | 1天 |
| **S4** | 实现 L8 筹码变化度 8 级指标（SCD→PCH→AII→矩阵→RSI→CCS→DIV→CSR） | 2天 |
| **S5** | 实现 L3 IPC 临界点判断（OCR/MCE/TIMS → IPC 跨层推理） | 2天 |
| **S6** | 实现 ESS 置信度考核体系 + 数据溯源 | 3天 |
| **S7** | 实现 ALT 另类因子 + 核心跟踪指标告警 | 1天 |

---

## 十、已完成的修复清单（截至 2026-06-27）

> 以下修复已在本次会话中完成，编译验证通过。

| 阶段 | 修复项 | 文件 |
|------|--------|------|
| P0-基础 | 多模型预设（DeepSeek/Kimi/硅基流动） | `src/config/llmConfig.ts` |
| P0-基础 | 统一 `/v1/chat/completions` + 超时 + maxTokens | `src/services/llm/llmClient.ts` |
| P0-基础 | V6 评分 LLM Prompt 模板 | `src/services/scoring/v6ScorePrompt.ts`（新建） |
| P0-业务 | V6 评分 LLM 增强模式（规则+LLM混合） | `src/services/scoring/v6ScoreService.ts` |
| P0-业务 | AI 复盘异步 LLM 洞察增强 | `src/services/trading/tradeReviewAI.ts` |
| P1-UI | 可复用 LLM 配置 Widget（预设下拉） | `src/components/organisms/shared/LLMConfigWidget.tsx`（新建） |
| Phase-A | Engine 消除双实例 | `src/engine/index.ts` |
| Phase-A | HealthMonitor 接入 | `src/agents/agentRuntime.ts` |
| Phase-A | 并发控制 | `src/agents/agentRuntime.ts` |
| Phase-B | Agent handler 桥接（V6/V4 评分） | `src/agents/index.ts` |
| Phase-C | Agent 初始化纳入 bootstrap | `src/services/system/bootstrapService.ts` |
| Phase-C | AI Center 类型映射对齐 | `src/constants/ai-center.constants.ts` |
| Phase-C | Engine 在 App.tsx 启动 | `src/App.tsx` |
| Phase-D | stockAnalysisEngine LLM 增强 | `src/services/analysis/stockAnalysisEngine.ts` |
| SKILL | 5 个 SKILL 文件同步到项目 | `.agents/skills/` |

---

## 八、文件清单索引

### Agent 运行时核心
| 文件 | 行数 | 职责 |
|------|------|------|
| `src/agents/index.ts` | 185 | Agent 系统入口，定义5个默认Agent，初始化/关闭 |
| `src/agents/agentRuntime.ts` | 206 | Agent 注册、任务调度、超时、取消 |
| `src/agents/agentRegistry.ts` | 131 | Agent 注册表管理（标签、查询） |
| `src/agents/agentHealthMonitor.ts` | 185 | 健康监控（失败率、连续失败、心跳） |
| `src/agents/agentConfigManager.ts` | 150 | 配置管理（默认、覆盖、合并、校验） |

### LLM 服务
| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/llm/llmClient.ts` | 268 | LLM HTTP/SSE 客户端 |
| `src/config/llmConfig.ts` | 13 | LLM 配置（baseURL/apiKey/model） |
| `src/services/llm/llmTypes.ts` | - | LlmMessage/LlmResponse 类型 |

### LLM 评分业务
| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/scoring/intelligentScoreService.ts` | 231 | 个股九维智能评分编排 |
| `src/services/scoring/intelligentScorePrompt.ts` | - | 个股评分 Prompt 构建 |
| `src/services/scoring/industryScoreService.ts` | 225 | 行业七维智能评分编排 |
| `src/services/scoring/industryScorePrompt.ts` | - | 行业评分 Prompt 构建 |

### 策略引擎
| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/trading/strategyEngine.ts` | 300 | 四分类选股引擎 |
| `src/services/trading/dualStrategyEngine.ts` | - | 双策略评分引擎 |

### UI/Store/配置
| 文件 | 职责 |
|------|------|
| `src/store/agentStore.ts` | Zustand Store，Agent 状态同步 |
| `src/constants/ai-center.constants.ts` | AI Center 展示常量 |
| `src/engine/index.ts` | Engine 编排层 |
| `.agents/skills/intelligent-score/SKILL.md` | 个股评分 Skill 规范 |
| `.agents/skills/industry-score/SKILL.md` | 行业评分 Skill 规范 |

### 占位符
| 文件 | 说明 |
|------|------|
| `src/services/analysis/stockAnalysisEngine.ts` | V6 L0-L8 九层分析（全部占位符） |
