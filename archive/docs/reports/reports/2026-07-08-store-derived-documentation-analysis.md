# src/store 派生计算文件文档化必要性分析

> **分析对象**: src/store 下 5 个派生计算文件  
> **分析时间**: 2026-07-08  
> **目的**: 解释为什么这些文件需要在文档中被引用和说明

---

## 一、派生计算文件概述

### 1.1 什么是派生计算？

派生计算（Derived Computations）是基于 Store 原始状态计算得出的派生状态或查询结果。它们是纯函数，不修改状态，只读取状态并返回计算结果。

**设计模式**：
```
原始状态 → 派生计算 → 派生状态/查询结果
    ↓
组件订阅派生状态，自动响应原始状态变化
```

### 1.2 5 个派生计算文件清单

| 文件 | 关联 Store | 函数数量 | 类型定义 | 用途 |
|------|-----------|---------|---------|------|
| `analysisStore.derived.ts` | analysisStore | 22 | 2 | 分析模块派生查询 |
| `chatStore.derived.ts` | chatStore | 23 | 2 | 聊天模块派生查询 |
| `riskStore.derived.ts` | riskStore | 22 | 4 | 风控模块派生查询 |
| `signalQualityStore.derived.ts` | signalQualityStore | 30 | 5 | 信号质量模块派生查询 |
| `executionStoreSubscriptions.ts` | executionStore | 3 | 0 | 执行模块事件订阅 |

---

## 二、为什么派生计算需要文档化？

### 2.1 复杂性分析

这些派生计算文件**不是简单的状态访问**，而是包含复杂的业务逻辑：

| 文件 | 复杂逻辑类型 | 具体示例 |
|------|-------------|---------|
| analysisStore.derived.ts | 评分等级分布、趋势分析 | `scoreLevelDistribution` 按 5 个区间分类统计 |
| chatStore.derived.ts | 消息统计、上下文管理、token 估算 | `estimatedTokenCount()`、`messagesToTruncate()` |
| riskStore.derived.ts | 风控裁决、熔断状态、趋势分析 | `riskTrendDirection()` 基于滑动窗口计算 |
| signalQualityStore.derived.ts | 信号质量分级、盈亏分析、趋势分析 | `signalQualityGrade()` 基于准确率分级 |
| executionStoreSubscriptions.ts | DataBridge 事件订阅、防抖逻辑 | `_debouncedRefresh()` 100ms 防抖 |

### 2.2 团队协作价值

**新成员上手**：派生计算是 UI 层与 Store 层之间的桥梁，新成员需要知道：
- 有哪些可用的派生函数
- 每个函数的输入输出
- 性能特征（是否有缓存）
- 使用场景

**避免重复开发**：如果没有文档，不同开发者可能会重复实现相同的派生逻辑。

**代码审查**：派生计算包含业务规则（如评分等级划分、风控阈值），需要团队共识和审查。

### 2.3 性能优化价值

这些文件都使用了 `memoizeByRef` 进行缓存优化，文档化可以：
- 说明缓存策略
- 提醒使用者注意缓存失效条件
- 记录性能指标（如 O(1) 查找 vs O(n) 遍历）

### 2.4 架构一致性价值

派生计算体现了 V9 的架构原则：
- **纯函数**：无副作用，可测试
- **单一职责**：每个派生函数只做一件事
- **性能优先**：使用缓存避免重复计算

文档化这些原则有助于团队保持架构一致性。

---

## 三、各文件详细分析

### 3.1 analysisStore.derived.ts — 分析模块派生查询

**核心职责**：为分析页面提供基于标的和评分数据的派生查询。

**关键功能**：

| 功能分类 | 函数 | 用途 |
|---------|------|------|
| 基础聚合 | `isLoadingAny()`、`errorUnion()`、`stocksCount()` | 综合状态判断 |
| 评分分布 | `scoreLevelDistribution()`、`getScoreLevelDistribution()` | 5 级评分统计 |
| 查找优化 | `scoreBySymbol()`、`stockBySymbol()`、`stocksBySector()` | 按字段快速查找 |
| 排序筛选 | `stocksByScoreRange()`、`topStocks()` | 高级筛选 |
| 趋势分析 | `trendDirection()`、`trendChangeRate()`、`trendPeak()` | 趋势计算 |
| React Hooks | `useScoreLevelDistribution()`、`useIsLoadingAny()` | 组件订阅 |

**文档化必要性**：
- ✅ 评分等级划分规则（≥80=excellent, 60-79=good 等）是业务规则，需要文档
- ✅ 趋势分析的阈值逻辑（1% 变化阈值）需要文档
- ✅ `topStocks()` 的排序逻辑需要文档
- ✅ 缓存策略（`memoizeByRef`）需要文档

---

### 3.2 chatStore.derived.ts — 聊天模块派生查询

**核心职责**：为 AI 聊天界面提供消息管理和上下文控制。

**关键功能**：

| 功能分类 | 函数 | 用途 |
|---------|------|------|
| 基础状态 | `messageCount()`、`hasMessages()`、`isLoading()` | 状态判断 |
| 消息访问 | `lastMessage()`、`lastUserMessage()`、`lastAssistantMessage()` | 获取特定消息 |
| 发送控制 | `canSend()`、`streamingProgress()` | UI 交互控制 |
| 统计分析 | `getMessageStats()`、`conversationTurns()` | 消息统计 |
| 上下文管理 | `estimatedTokenCount()`、`isOverContextLimit()`、`messagesToTruncate()` | Token 管理 |
| 消息搜索 | `searchMessages()`、`messagesByDate()` | 消息检索 |

**文档化必要性**：
- ✅ Token 估算规则（字符数/4）需要文档说明
- ✅ 上下文截断策略（保留最近消息）需要文档
- ✅ `canSend()` 的禁用条件（!isStreaming && !error）是 UI 逻辑的核心
- ✅ `streamingProgress()` 的估算方法需要文档

---

### 3.3 riskStore.derived.ts — 风控模块派生查询

**核心职责**：为交易执行提供风控裁决和熔断状态管理。

**关键功能**：

| 功能分类 | 函数 | 用途 |
|---------|------|------|
| 执行决策 | `isExecutable()`、`riskLevelText()`、`pendingBlocks()` | 交易控制 |
| 熔断状态 | `isCircuitOpen()`、`needsManualIntervention()`、`circuitStateText()` | 熔断管理 |
| 风控统计 | `blockedCount()`、`warningCount()`、`blockedRate()` | 统计分析 |
| 趋势分析 | `riskTrend()`、`riskTrendDirection()`、`verdictsTimeline()` | 趋势判断 |
| 聚合分析 | `symbolRiskStats()` | 按标的聚合 |

**文档化必要性**：
- ✅ 风控三态（normal/warning/blocked）的判定规则是核心业务逻辑
- ✅ 熔断状态机（closed → open → half-open）需要详细文档
- ✅ `riskTrendDirection()` 的恶化/改善判定阈值（10%）需要文档
- ✅ `pendingBlocks()` 和 `pendingWarnings()` 影响交易执行，必须文档化

---

### 3.4 signalQualityStore.derived.ts — 信号质量模块派生查询

**核心职责**：为信号复盘和质量评估提供统计分析。

**关键功能**：

| 功能分类 | 函数 | 用途 |
|---------|------|------|
| 基础状态 | `hasMetrics()`、`reviewsCount()`、`isLoading()` | 状态判断 |
| 按标的查询 | `accuracyBySymbol()`、`winRateBySymbol()`、`avgReturnBySymbol()` | 单标的指标 |
| 质量分级 | `signalQualityGrade()`、`isLowQuality()` | 质量判定 |
| 筛选查询 | `reviewsByDirection()`、`reviewsByType()`、`recentReviews()` | 高级筛选 |
| 盈亏分析 | `averageReturn()`、`averageWin()`、`averageLoss()`、`bestReview()`、`worstReview()` | 盈亏统计 |
| 方向统计 | `getDirectionStats()`、`topSignalTypes()` | 多维度统计 |
| 趋势分析 | `accuracyTrend()`、`winRateTrend()` | 趋势分析 |

**文档化必要性**：
- ✅ 信号质量分级规则（≥0.7=high, 0.5-0.7=medium, <0.5=low）需要文档
- ✅ 准确率和胜率的计算逻辑需要文档
- ✅ 滑动窗口分析的窗口大小（默认 20）需要文档
- ✅ 方向统计的聚合逻辑（单次遍历完成所有计算）需要文档说明

---

### 3.5 executionStoreSubscriptions.ts — 执行模块事件订阅

**核心职责**：订阅 DataBridge 事件，实现执行计划的自动更新。

**关键功能**：

| 功能分类 | 函数 | 用途 |
|---------|------|------|
| 订阅初始化 | `initExecutionStoreSubscriptions()` | 注册事件订阅 |
| 信号处理 | `_handleSignalEnvelope()` | 处理信号事件，自动创建执行计划 |
| 订单处理 | `_handleOrderEnvelope()` | 处理订单事件，触发计划刷新 |
| 防抖刷新 | `_debouncedRefresh()` | 100ms 防抖避免频繁刷新 |

**文档化必要性**：
- ✅ 事件订阅的触发条件（哪些 action 会触发刷新）需要文档
- ✅ 自动创建执行计划的规则（signal.direction === 'buy' || 'sell'）需要文档
- ✅ 防抖机制（100ms）需要文档
- ✅ 订阅的生命周期管理（初始化和销毁）需要文档

---

## 四、文档化价值总结

### 4.1 对开发效率的提升

| 场景 | 无文档 | 有文档 |
|------|--------|--------|
| 查找派生函数 | 需阅读源码 | 直接查阅文档 |
| 理解业务规则 | 需分析代码逻辑 | 直接阅读规则说明 |
| 判断性能特征 | 需分析实现 | 直接阅读性能说明 |
| 避免重复开发 | 可能重复实现 | 知道已有实现 |

### 4.2 对代码质量的保障

| 方面 | 无文档 | 有文档 |
|------|--------|--------|
| 业务规则一致性 | 容易出现理解偏差 | 明确的规则定义 |
| 缓存策略理解 | 容易误用导致性能问题 | 明确的缓存说明 |
| 测试覆盖 | 难以确定测试范围 | 明确的功能边界 |
| 代码审查 | 难以判断逻辑正确性 | 有文档作为参考 |

### 4.3 对团队协作的促进

| 角色 | 受益点 |
|------|--------|
| 新成员 | 快速了解可用的派生函数和使用场景 |
| 前端开发者 | 知道如何正确订阅派生状态 |
| 后端开发者 | 理解前端如何使用数据 |
| 测试工程师 | 知道需要测试哪些派生逻辑 |
| 架构师 | 确保派生计算符合架构原则 |

---

## 五、文档化建议方案

### 5.1 数据字典索引

在 `DATA_DICTIONARY_INDEX.md` 中添加派生计算模块索引：

```markdown
| Store 派生计算 | `src/store/*.derived.ts` | analysisStore.derived、chatStore.derived、riskStore.derived、signalQualityStore.derived | 派生查询函数、类型定义、缓存策略、React Hooks |
```

### 5.2 架构文档补充

在 `03-architecture-standards.md` 中添加派生计算模式说明：
- 设计原则（纯函数、性能优化、空状态安全）
- 缓存策略（memoizeByRef、memoizeByKey、buildIndex）
- 导出模式（函数 + React Hook）

### 5.3 变更日志记录

在 `CHANGELOG.md` 中记录派生计算文件的创建和修改。

---

## 六、结论

**src/store 下的 5 个派生计算文件必须文档化**，原因如下：

1. **包含核心业务规则**：评分等级划分、风控阈值、信号质量分级等
2. **包含复杂逻辑**：趋势分析、缓存优化、事件订阅等
3. **是 UI 层与 Store 层的桥梁**：新成员必须了解这些函数才能正确开发
4. **影响系统性能**：缓存策略的误用会导致严重性能问题
5. **影响业务正确性**：派生计算的逻辑错误会导致 UI 显示错误的信息

**建议优先级**：
- P0：`riskStore.derived.ts`（影响交易执行安全性）
- P0：`executionStoreSubscriptions.ts`（影响交易流程）
- P1：`analysisStore.derived.ts`（影响分析页面）
- P1：`signalQualityStore.derived.ts`（影响信号质量评估）
- P2：`chatStore.derived.ts`（影响聊天体验）

---

> **分析结束**  
> **生成时间**: 2026-07-08  
> **分析对象**: src/store 下 5 个派生计算文件