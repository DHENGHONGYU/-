---
title: 下一阶段架构优化计划 — 高频变更模块治理
status: active
version: v1.0.1
last_updated: 2026-08-11
code_version: 2.0.0-rc.2
category: governance
tags: [governance, architecture, optimization-plan, high-frequency-modules]
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-11)：R1取真值(P4 frontmatter.version 裸值=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-11
---

# 下一阶段架构优化计划 — 高频变更模块治理

> **制定日期**: 2026-08-10
> **制定依据**: 2026-08-10 技术债治理经验 + git log 高频变更模块统计
> **治理周期**: 2026-08-11 ~ 2026-08-31（预计 3 周）
> **关联文档**: [技术债治理完整总结报告](../normal/reports/tech-debt-governance-summary-2026-08-10.md)

---

## 1. 计划背景

### 1.1 上一阶段成果

2026-08-10 完成的技术债治理（TD-016 ~ TD-019）解决了：
- P0 循环依赖（databridge.ts ↔ databridgeRouter.ts）
- P1 组件拆分（PoolBoardPage 679→204 行）
- P1 防腐层加固（2 个页面 Service → Hook）
- P2 类型导入收敛（5 处 type-only → @/types/modules）

### 1.2 高频变更模块扫描

通过 `git log --since="2026-07-01" --name-only` 统计，识别出以下高频变更模块：

| 排名 | 文件 | 变更次数 | 当前行数 | 风险等级 |
|------|------|----------|----------|----------|
| 1 | `src/services/scoring/v6-engine/config.ts` | 4 | 215 | 🟡 中 |
| 2 | `src/pages/output/TradeReviewPage.tsx` | 4 | **580** | 🔴 高 |
| 3 | `src/services/fetcher/directDataAPI.ts` | 4 | **986** | 🔴 高 |
| 4 | `src/components/widgets/WidgetShell.tsx` | 3 | 187 | 🟢 低 |
| 5 | `src/config/marketDataEndpoints.ts` | 3 | 99 | 🟢 低 |
| 6 | `src/components/componentRegistry.ts` | 3 | 231 | 🟡 中 |
| 7 | `src/services/fetcher/fetcherTypes.ts` | 3 | 209 | 🟢 低 |

### 1.3 待解决问题

| # | 问题 | 优先级 | 关联文件 |
|---|------|--------|----------|
| 1 | `TradeReviewPage.tsx` 580 行，仍含 type-only 从 @/services 导入 | P1 | TradeReviewPage.tsx |
| 2 | `directDataAPI.ts` 986 行，职责过重 | P1 | directDataAPI.ts |
| 3 | `componentRegistry.ts` 注册逻辑与类型定义耦合 | P2 | componentRegistry.ts |
| 4 | 缺少自动化门禁检测页面层 type-only 从 @/services 导入 | P2 | ESLint 规则 |
| 5 | `usePoolBoardData` / `usePoolBoardCollect` 缺少独立单元测试 | P2 | hooks/*.ts |

---

## 2. 治理路线图

### Phase 1 — TradeReviewPage 拆分（P1，预计 3 天）

> **目标**: 将 580 行的 TradeReviewPage 拆分为 ≤ 250 行容器 + 多个 Hook 和子组件

#### 2.1.1 拆分计划

| 提取模块 | 类型 | 职责 | 预计行数 |
|----------|------|------|----------|
| `useTradeReviewReport` | Hook | 复盘报告数据获取与状态管理 | ~80 |
| `useTradeReviewAI` | Hook | AI 分析结果获取与错误处理 | ~60 |
| `TradeReviewSummary` | 组件 | 复盘摘要卡片 | ~70 |
| `TradeReviewErrorList` | 组件 | 交易错误列表 | ~60 |
| `TradeReviewPsychProfile` | 组件 | 心理画像展示 | ~50 |
| `TradeReviewKlineChart` | 组件 | K 线图表区域 | ~70 |
| `TradeReviewPage` (主文件) | 容器 | 布局与组件组合 | ≤ 200 |

#### 2.1.2 type-only 导入修复

- `TradeReviewReport` 从 `@/services/trading/tradeReviewService` → `@/types/modules/tradeReviewAI.types`
- `HotSectorScore` 从 `@/services/analysis/hotSectorService` → `@/types/modules/score.types`
- `RotationSignal` 从 `@/services/analysis/rotationService` → `@/types/modules/analysisOrchestrator.types`

#### 2.1.3 验证标准

- [ ] `tsc --noEmit` 0 新增错误
- [ ] `audit:layers` 0 违规
- [ ] `vitest` 新增 ≥ 15 用例，全通过
- [ ] TradeReviewPage 主文件 ≤ 200 行
- [ ] 页面零运行时 Service 导入（Grep 验证）

---

### Phase 2 — directDataAPI 拆分（P1，预计 4 天）

> **目标**: 将 986 行的 directDataAPI 拆分为职责单一的模块

#### 2.2.1 当前职责分析

`directDataAPI.ts` (986 行) 当前承载以下职责：
1. 新浪实时行情获取
2. 腾讯 K 线数据获取
3. 批量行情获取
4. 行业板块数据获取
5. 错误分类与处理
6. 数据格式转换

#### 2.2.2 拆分计划

| 提取模块 | 职责 | 预计行数 |
|----------|------|----------|
| `sinaQuoteProvider.ts` | 新浪实时行情获取与解析 | ~200 |
| `tencentKlineProvider.ts` | 腾讯 K 线数据获取与解析 | ~200 |
| `batchQuoteProvider.ts` | 批量行情获取（分片+合并） | ~150 |
| `sectorDataProvider.ts` | 行业板块数据获取 | ~100 |
| `directDataAPIError.ts` | 错误分类与处理 | ~80 |
| `directDataAPI.ts` (主文件) | 统一入口 + 适配函数 | ≤ 200 |

#### 2.2.3 验证标准

- [ ] `tsc --noEmit` 0 新增错误
- [ ] `audit:layers` 0 违规
- [ ] `madge --circular` 0 循环依赖
- [ ] 每个提取模块 ≤ 250 行
- [ ] 现有 directDataAPI 测试全通过

---

### Phase 3 — 自动化门禁加固（P2，预计 2 天）

> **目标**: 将本次治理中手动执行的检查自动化为门禁规则

#### 2.3.1 新增 ESLint 规则

| 规则 | 检测内容 | 严重级别 |
|------|----------|----------|
| `no-services-runtime-import-in-pages` | `pages/**/*.tsx` 从 `@/services/*` 导入运行时方法 | error |
| `no-services-type-import-in-pages` | `pages/**/*.tsx` 从 `@/services/*` 导入 type-only | warn |

#### 2.3.2 新增审计脚本

| 脚本 | 功能 |
|------|------|
| `scripts/audit-type-import-paths.ts` | 扫描所有页面文件的 type-only 导入路径，检查是否从 `@/types/modules` 获取 |

#### 2.3.3 验证标准

- [ ] ESLint 规则在 2 个测试用例上正确触发
- [ ] `npm run audit:type-imports` 输出 0 违规
- [ ] 规则添加到 `gate:quick` 和 `gate:dev`

---

### Phase 4 — Hook 独立测试补充（P2，预计 2 天）

> **目标**: 为本次治理中提取的 4 个 Hook 补充独立单元测试

#### 2.4.1 测试计划

| Hook | 测试文件 | 预计用例数 | 覆盖维度 |
|------|----------|-----------|----------|
| `usePoolBoardData` | `usePoolBoardData.test.ts` | 8 | 数据获取、刷新、进度汇总、事件订阅 |
| `usePoolBoardCollect` | `usePoolBoardCollect.test.ts` | 10 | 批量采集、进度刷新、防断连、错误处理 |
| `useStrategyExport` | `useStrategyExport.test.ts` | 6 | 导出功能、错误处理、状态管理 |
| `useTradeReviewKline` | `useTradeReviewKline.test.ts` | 6 | K 线获取、标记生成、错误处理 |

#### 2.4.2 验证标准

- [ ] 4 个测试文件全通过
- [ ] Hook 覆盖率 ≥ 80%
- [ ] `npm run test` 全量回归无新增失败

---

### Phase 5 — componentRegistry 解耦（P2，预计 1 天）

> **目标**: 将 componentRegistry 的注册逻辑与类型定义分离

#### 2.5.1 拆分计划

| 提取模块 | 职责 |
|----------|------|
| `componentRegistry.types.ts` | 类型定义（WidgetConfig, WidgetComponent 等） |
| `componentRegistry.ts` (主文件) | 注册逻辑和运行时 API |

#### 2.5.2 验证标准

- [ ] `tsc --noEmit` 0 新增错误
- [ ] `audit:layers` 0 违规

---

## 3. 优先级与排期

| Phase | 任务 | 优先级 | 预计工时 | 依赖 |
|-------|------|--------|----------|------|
| 1 | TradeReviewPage 拆分 | P1 | 3 天 | 无 |
| 2 | directDataAPI 拆分 | P1 | 4 天 | 无 |
| 3 | 自动化门禁加固 | P2 | 2 天 | Phase 1 完成 |
| 4 | Hook 独立测试 | P2 | 2 天 | Phase 1 完成 |
| 5 | componentRegistry 解耦 | P2 | 1 天 | 无 |

**总预计工时**: 12 天（可并行后约 8 天）

---

## 4. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| TradeReviewPage 拆分引入回归 | 中 | 高 | 先编写功能验证测试，拆分后逐项验证 |
| directDataAPI 拆分导致 API 不兼容 | 低 | 高 | 保持导出接口不变，仅内部拆分 |
| ESLint 规则误报 | 中 | 低 | 先以 warn 级别运行 1 周，确认无误后升级为 error |
| Hook 测试 mock 复杂度过高 | 中 | 中 | 提取通用 Store mock 工具函数 |

---

## 5. 经验传承

### 5.1 从本次治理中提炼的可复用模式

1. **类型提取解耦模式**: 循环依赖 → 提取 `*.types.ts` → 双方从此导入
2. **Hook 封装防腐层模式**: 页面直接 import Service → 提取 `use*.ts` Hook → 页面只依赖 Hook
3. **Re-export 桥接模式**: `types/modules/*` 中 `export type { X } from '@/services/...'` → 页面从 types 导入
4. **测试 mock 模式**: `vi.mock` + `beforeEach` 中 `getState` mock → 解决 Zustand Store 测试问题

### 5.2 团队规范建议

1. **新页面开发**: 必须先创建 Hook 封装 Service 调用，页面组件只负责布局和组合
2. **类型定义**: 新增类型必须定义在 `@/types/modules/*`，禁止在页面组件中内联定义
3. **代码审查**: PR Review 时检查 `pages/**/*.tsx` 是否有 `@/services` 导入
4. **组件行数**: 页面组件 ≤ 250 行，超过时必须拆分 Hook 或子组件

---

## 6. 成功指标

| 指标 | 当前值 | 目标值 | 验证方式 |
|------|--------|--------|----------|
| 页面组件 > 500 行数 | 1 (TradeReviewPage) | 0 | `wc -l src/pages/**/*.tsx` |
| Service 文件 > 500 行数 | 1 (directDataAPI) | 0 | `wc -l src/services/**/*.ts` |
| 页面 type-only 从 @/services 导入 | 3 处 | 0 | Grep 扫描 |
| 自动化门禁覆盖 type-only 导入 | 0 | 1 脚本 + 2 ESLint 规则 | gate:quick 通过 |
| Hook 独立测试数 | 0 | 4 文件 30 用例 | vitest 全通过 |
