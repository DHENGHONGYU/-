---
title: Jira 任务卡片内容
type: reports
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "**Date**: 2026-07-09 **Source**: P0 优先级待办任务清单"
tags: [project, spec, report]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Jira 任务卡片内容

> **Date**: 2026-07-09  
> **Source**: P0 优先级待办任务清单

---

## 任务 1: 为 executionStoreSubscriptions.ts 添加完整 JSDoc 注释

### 基本信息
- **标题**: [V9] 为 executionStoreSubscriptions.ts 添加完整 JSDoc 注释
- **项目**: 智能投研复盘系统 V9
- **组件**: store/execution
- **优先级**: P0 - 立即处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: `executionStoreSubscriptions.ts` 负责订阅 DataBridge 上的 signals 和 orders 事件，实现执行计划的自动化更新。该文件是核心交易流程的事件驱动核心，但缺少模块级注释。

**需求**: 为该文件添加完整的 JSDoc 注释，包括：
1. 模块级注释，说明事件驱动架构
2. 核心设计原则说明（自循环保护、防抖机制、幂等初始化、完整清理）
3. 为所有函数添加函数级注释

**验收标准**:
- [x] 文件开头有完整的 `@module` 注释
- [x] 包含事件驱动架构图（ASCII 图）
- [x] 包含核心设计原则说明
- [x] 所有导出函数有完整的 JSDoc 注释
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 代码文件: `src/store/executionStoreSubscriptions.ts`

---

## 任务 2: 为 l3/helpers.ts 添加完整 JSDoc 注释

### 基本信息
- **标题**: [V9] 为 V6 评分引擎 L3 层辅助函数添加完整 JSDoc 注释
- **项目**: 智能投研复盘系统 V9
- **组件**: services/scoring/v6-engine
- **优先级**: P0 - 立即处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: `l3/helpers.ts` 包含 V6 评分引擎的核心辅助函数（`scoreMoat()` 护城河评分、`scoreCompetition()` 竞争格局评分），是评分引擎的关键逻辑组件，但注释不完整。

**需求**: 为该文件添加完整的 JSDoc 注释，包括：
1. 模块级注释，说明 L3 层的确定性计算特性
2. 为 `scoreMoat()` 添加完整注释（评分规则表、加分规则、封顶规则、示例代码）
3. 为 `scoreCompetition()` 添加完整注释（趋势推断规则、评分规则表、示例代码）

**验收标准**:
- [x] 文件开头有完整的 `@module` 注释
- [x] `scoreMoat()` 包含评分规则表（ASCII 表格）
- [x] `scoreCompetition()` 包含评分规则表（ASCII 表格）
- [x] 所有函数有完整的 `@param`、`@returns`、`@example` 标签
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 代码文件: `src/services/scoring/v6-engine/calculators/l3/helpers.ts`

---

## 任务 3: 为 riskStore.derived.ts 添加完整 JSDoc 注释

### 基本信息
- **标题**: [V9] 为 riskStore.derived.ts 添加完整 JSDoc 注释
- **项目**: 智能投研复盘系统 V9
- **组件**: store/risk
- **优先级**: P0 - 立即处理
- **状态**: ? Done
- **完成日期**: 2026-07-09

### 描述

**背景**: `riskStore.derived.ts` 包含风控模块的派生查询函数集合，负责执行决策判断、熔断状态管理、风控统计和趋势分析。该文件影响交易执行安全性，但注释不完整。

**需求**: 为该文件添加完整的 JSDoc 注释，包括：
1. 模块级注释，说明风控三态规则和熔断状态机
2. 为所有类型定义添加详细 JSDoc 注释
3. 为所有派生查询函数添加详细 JSDoc 注释（含 @param、@returns、@description）
4. 为 React Hook 形式派生添加详细 JSDoc 注释
5. 添加业务规则说明（风控三态、熔断状态机、趋势判定阈值）

**验收标准**:
- [x] 文件开头有完整的 `@module` 注释
- [x] 包含风控三态规则表（ASCII 表格）
- [x] 包含熔断状态机说明
- [x] 所有 22 个函数有完整的 JSDoc 注释
- [x] 所有类型定义有完整的 `@typedef`/`@interface` 注释
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 代码文件: `src/store/riskStore.derived.ts`

---

## 任务 4: 更新 data-dictionary-index.md 添加模块索引

### 基本信息
- **标题**: [V9] 更新 data-dictionary-index.md 添加模块索引
- **项目**: 智能投研复盘系统 V9
- **组件**: docs
- **优先级**: P1 - 本周处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: 15 个新文档化文件需要在 data-dictionary-index.md 中添加索引条目，以便团队快速查找。

**需求**: 在 data-dictionary-index.md 中添加以下模块的索引条目：
1. Store 派生计算（4 个 .derived.ts 文件）
2. Store 事件订阅（executionStoreSubscriptions.ts）
3. 全局错误处理（installGlobalErrorHandler.ts）
4. UI 基础组件（PageContainer/PageHeader）
5. 派生缓存工具（derivedCache.ts）
6. 本地存储加密（localStorageCrypto.ts）
7. 错误总线（errorBus.ts）
8. 韧性工具（resilience.ts）
9. 确认对话框 Hook（useConfirmDialog.tsx）
10. 板块常量（sectorConstants.ts）
11. V6 评分引擎 L3 辅助函数（l3/helpers.ts）

**验收标准**:
- [x] 所有 15 个文件在 data-dictionary-index.md 中有索引条目
- [x] 索引条目格式统一
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 文档文件: `../reference/data-dictionary-index.md`

---

## 任务 5: 更新架构文档补充模块说明

### 基本信息
- **标题**: [V9] 更新架构文档补充模块说明
- **项目**: 智能投研复盘系统 V9
- **组件**: docs
- **优先级**: P1 - 本周处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: 需要在架构文档中补充 Store 派生计算与事件订阅的说明，以及 V6 评分引擎 L3 层辅助函数的说明。

**需求**: 在 03-architecture-standards.md 中新增章节：
1. §3.1.10 Store 派生计算与事件订阅（含设计原则、缓存策略、导出模式、文件清单）
2. §3.5.1 V6 评分引擎 L3 层辅助函数（含评分规则说明）

**验收标准**:
- [x] 新增 §3.1.10 章节，说明 Store 派生计算模式
- [x] 新增 §3.5.1 章节，说明 V6 评分引擎 L3 层
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 文档文件: `../reference/03-architecture-standards.md`

---

## 任务 6: 修复 audit-doc-sync.ts 逻辑缺陷

### 基本信息
- **标题**: [V9] 修复 audit-doc-sync.ts 逻辑缺陷
- **项目**: 智能投研复盘系统 V9
- **组件**: scripts
- **优先级**: P0 - 立即处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: `audit-doc-sync.ts` 脚本存在逻辑缺陷：噪音词检查在完整路径检查之前，导致文件名是噪音词（如 `helpers`）的文件即使在文档中有完整路径引用，也会被误判为未文档化。

**需求**: 将完整路径检查移到噪音词检查之前，完整路径引用优先于噪音词过滤。

**验收标准**:
- [x] 完整路径检查在噪音词检查之前
- [x] 文件名是噪音词的文件不再被误判
- [x] 通过 `npm run audit:docs` 验证（0 违规）

### 关联链接
- 脚本文件: `scripts/audit-doc-sync.ts`

---

## 任务 7: 新增 RISK_DERIVED_data-definition.md 详细文档

### 基本信息
- **标题**: [V9] 新增 riskStore.derived.ts 详细文档
- **项目**: 智能投研复盘系统 V9
- **组件**: docs
- **优先级**: P0 - 立即处理
- **状态**: ? Done
- **完成日期**: 2026-07-08

### 描述

**背景**: `riskStore.derived.ts` 是风控模块的核心派生计算文件，需要详细文档说明评分等级划分和风控阈值的业务规则。

**需求**: 创建 RISK_DERIVED_data-definition.md 文档，包含：
1. 核心类型定义详解（RiskTriState、CircuitState、SymbolRiskStats、VerdictTimelineEntry）
2. 风控三态判定规则（判定流程、阈值表格）
3. 熔断状态机（状态转换图、状态说明、默认阈值配置）
4. 风险趋势分析（趋势方向判定算法、趋势阈值）
5. 22 个派生查询函数详解
6. React Hook 形式派生（4 个 Hook）
7. 缓存策略说明
8. 业务规则汇总（交易执行条件、熔断触发条件、趋势判定条件）
9. UI 层交互场景说明

**验收标准**:
- [x] 文档包含所有核心类型定义的详细说明
- [x] 文档包含风控三态规则表
- [x] 文档包含熔断状态机说明
- [x] 文档包含所有派生查询函数的说明
- [x] 通过 `npm run audit:docs` 验证

### 关联链接
- 文档文件: `docs/RISK_DERIVED_data-definition.md`

---

> **任务卡片结束**  
> **Date**: 2026-07-09  
> **任务数量**: 7 个