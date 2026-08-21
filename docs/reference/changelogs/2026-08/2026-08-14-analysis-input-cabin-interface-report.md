---
title: docs/reference/changelogs/2026-08/2026-08-14-analysis-input-cabin-interface-report.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 分析舱调用输入舱数据接口方案 — 实现报告 2026-08-14

> **生成时间**：2026-08-14
> **变更范围**：「分析舱」调用「输入舱」意向候选池数据的接口方案（契约 + 防腐层 + Store + 交接 + 批量评分）
> **最终状态**：接口全链路打通 + 真实数据浏览器实测通过，单元测试 49 例通过（store 41 + service 8），tsc 对改动文件 0 错误
> **关联文档**：`docs/reference/input-analysis-cabin-contract.md`（V9-DOC-BACK-047）

---

## 0. 变更摘要（TL;DR）

| 维度 | 数量 |
|------|------|
| 新增契约类型文件 | 1 个（`src/types/modules/analysis.types.ts`） |
| 新增防腐层服务 | 1 个（`src/services/input/intentionPoolService.ts`） |
| 服务单元测试 | 8 个（`V9-TEST-SV-INTPOOL`） |
| Store 扩展 | `analysisStore` 新增 candidates/scope/loadStocks('intention')/runBatchScore |
| Store 单元测试 | 41 例全通过（新增 7 例） |
| UI 集成 | V6ScoreCard 作用域切换 + 来源标签 + 批量评分按钮 |
| 输入舱交接 | 「送入分析舱」按钮 + InputFlowOverview 步骤带 `scope=intention` |
| URL 交接 | `/analysis?scope=intention` 自动加载意向候选池 |
| 种子脚本纳入版本库 | `seedRotationScores.ts`（commit 4f38078，上一轮已完成） |

---

## 1. 接口方案

### 1.1 契约类型（`src/types/modules/analysis.types.ts`）

- `AnalysisScope`：`'intention' | 'all'`
- `AnalysisCandidate`：symbol/name/screenSource/group/dataQuality/price/pe/pb/v6Score/ingestedAt
- `AnalysisCandidateQuery`：scope + screenSource + group 过滤

### 1.2 防腐层服务（`src/services/input/intentionPoolService.ts`）

- 经 DataBridge 信封协议按 `by-pool` 索引只读意向候选池（`pool === 'intention'`）
- join `v6Scores` 已有评分（Map 去重保留首条，失败降级不阻塞）
- 支持来源/分组过滤，按 `ingestedAt` 倒序

### 1.3 消费方与交接

- `analysisStore.loadStocks('intention')` → `listIntentionCandidates`；`runBatchScore` → `runV6ScoreBatch`（Worker 并行）
- V6ScoreCard：作用域 Badge、「加载全部标的/加载意向候选池」切换、「批量评分（N）」、「运行评分」
- 输入舱：`InputDashboardPoolTable`「送入分析舱」按钮 + `InputFlowOverview` 分析舱步骤路径带 `?scope=intention`
- AnalysisApp 读取 `searchParams.scope` 自动加载

---

## 2. 设计取舍

| 决策 | 说明 |
|------|------|
| 不重构 `intentionPoolStore.refresh()` | 保留其优化查询与测试覆盖，避免影响输入舱 UI 热路径 |
| 来源标签语义对齐 | V6ScoreCard 与 InputDashboardPoolTable 使用一致文案（热门板块/自定义检索） |
| 异常消息保留 Error 原文 | `loadStocks`/`runBatchScore` 的 catch 分支沿用 `err.message`，与既有 'all' 作用域行为一致 |

---

## 3. 验证结果

- `tsc -p tsconfig.json --noEmit`：改动文件 0 错误（仓库其余为既有测试文件债务，与本次无关）
- `vitest run src/store/analysisStore.test.ts`：41 / 41 通过
- `vitest run src/services/input/intentionPoolService.test.ts`：8 / 8 通过
- `vitest run src/apps/input/InputDashboard.addStock.test.tsx`：8 / 8 通过（输入舱回归）

### 3.1 真实数据浏览器实测（Vite Dev Server + IndexedDB 意向候选池）

| 步骤 | 操作 | 结果 |
|------|------|------|
| 1 | 输入舱录入看板「意向候选池清单」点击「送入分析舱」 | 跳转 `#/analysis?scope=intention` 成功 |
| 2 | 分析舱自动加载意向候选池 | 4 只候选（600584.SH/300750.SZ/000001.SZ/600519.SH），作用域 Badge「意向候选池」正确 |
| 3 | 候选卡片展示 | symbol + 名称 + 分组 + 来源标签 + V6 评分 Badge + 「运行评分」均渲染 |
| 4 | 点击「批量评分（4）」 | `runV6ScoreBatch`（Worker 并行）逐只落库 `SAVE_SCORES` → v6Scores |
| 5 | 评分后 UI 联动 | 4 只候选 Badge 更新为 V6: 2.29 / 2.10 / 2.41 / 2.10 |
| 6 | 再次交接（返回输入舱再送入） | 自动刷新评分列表（`loadScores 完成: 4 条评分`），已评分候选不再误显示「未评分」 |

### 3.2 交接评分联动修复

- 问题：交接只加载 candidates，不刷新 scores，导致已评分候选在重新进入时误显示「未评分」。
- 修复：`analysisStore.loadStocks('intention')` 成功加载候选后追加 `void get().loadScores()`，与 Store 契约注释「加载标的列表并刷新评分」一致。
- 测试锁定：`analysisStore.test.ts` 新增断言 `expect(listV6Scores).toHaveBeenCalled()`。

---

## 4. 后续待办

- `ai-index` 重建以纳入新文档引用
