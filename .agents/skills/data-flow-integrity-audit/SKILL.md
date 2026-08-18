---
name: "data-flow-integrity-audit"
description: "对 V9 数据流的『存储底层兜底』做全链路审计：按 采集→分析→筛选→复盘→报告 五段，逐一核对过程产物是否已被持久化（IndexedDB Store / 派生视图 / 资产化），识别『已注册未接线 / 已设计未激活 / 文档漂移』三类隐性风险，并运行 mandatory 门禁（tsc:prod / audit:layers / audit:acl-consistency / validate-data-consistency / validate:blueprint）确认兜底闭环。Invoke when user asks to audit storage coverage, verify data-flow persistence, check whether a pipeline stage is backed by storage, or review the five-stage (collection/analysis/screening/review/report) storage bottom-layer."
version: v1.0.0
last_updated: 2026-08-18
change_log:
  - version: v1.0.0
    changes: "初始版本：固化五段链路存储兜底审计方法论（含 mandatory 门禁、派生存储判定、跨层注入去违规等踩坑）"
    date: 2026-08-18
mandatory: true
triggers:
  keywords: []
  files: []
  events: []
gates: []
covers_docs: []
related_skills:
  - "db-reference-audit"
  - "v9-collection-pipeline-testing"
---

# 全链路存储兜底审计 — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-08-18 | **校验基准**: V9 v2.1.0 / DB_VERSION 34
> **任务性质**: 审计与验证，允许补充/修正校验脚本与持久化接线，禁止无评审直接改 `DB_VERSION` 或删 Store
> **输出格式**: 五段链路兜底矩阵 + 三类隐性风险清单 + 门禁结论 + 决策记录

---

## 一、触发条件（Invoke When）

- 用户质疑「某数据流过程是否真的落库了」「开发策略是否兜底了某环节」
- 新增一条数据处理链路（采集/分析/筛选/复盘/报告任一阶段）后需要确认产物持久化
- 怀疑存在「已注册 Store 但未接线」「已设计能力但未激活」「文档描述与磁盘代码漂移」
- 重构/新增 Store 后需要回归 mandatory 门禁

---

## 二、前置事实（审计基线，勿被过时报告误导）

- **存储基座**: IndexedDB（`V6ProDB`），`STORE_NAME`（权威 Store 清单，当前 52 个）位于 `src/config/dbConfig.ts`。
- **写入协议**: `DataBridge.forward(envelope)` → `ACTION_TO_STORE_MAP` → handler → ACL 校验；读走 `dataLayerHelpers`（queryGet/queryList/queryByIndex/sendWriteEnvelope）。
- **门禁脚本**: `scripts/other/validate-data-consistency.ts`（类型↔schema）、`scripts/other/validate-data-blueprint.ts`（Store 数量↔核心 Interface 存在性）。
- **mandatory 门禁**: `tsc:prod` / `audit:layers` / `audit:acl-consistency` / `validate:dataConsistency` / `validate:blueprint`，目标全 0。

---

## 三、五段链路兜底审计 SOP

对每段回答三个问题：**(1) 过程产物是什么？(2) 是否已持久化？(3) 若无，是否为可接受态（派生视图 / 交互态）？**

| 阶段 | 核心产物 | 持久化落点（已验证） | 兜底判定 |
|------|---------|---------------------|---------|
| ① 数据采集 | 行情/K线/研报/新闻/因子 | `DeduplicationService` 统计守卫激活（不跳过写库，覆盖写语义）+ 各业务 Store | ✅ 已兜底 |
| ② 数据分析 | V6 评分/因子/行业 | 基本落库（`v6Scores` 等），分析中间态多为派生 | ✅ 基本 |
| ③ 数据筛选 | 筛选结果集 | `screening_results`（v34 新增，keyPath runId，by-symbol/by-createdAt） | ✅ 已兜底 |
| ④ 股票复盘 | 复盘记录/评分 | `trade_reviews` + `strategy_snapshots`(by-version 版本化)；真实评分：`RealTradeReviewScoreCalculator`（默认激活）+ 独立字段 `realDisciplineScore` | ✅ 已落地 |
| ⑤ 报告输出 | 生成报告/模板 | `generated_reports` + `report_templates`（v33 资产化，keyPath reportId/templateId） | ✅ 已兜底 |

**三类隐性风险（必查，本次已闭环）**:
1. **已注册未接线**: Store 在 `STORE_NAME` 但无 `ACTION_TO_STORE_MAP`/handler/ACL → 写被拒或落空。
2. **已设计未激活**: 能力已写但默认走 Mock/未接线（如 `RealTradeReviewScoreCalculator` 曾被 `getTradeReviewScoreCalculator()` 默认返回 Mock 而变死代码）→ 需把真实实现设为默认激活。
3. **文档漂移**: 文档声称的 Store 数/路径与磁盘不一致（如 `validate-data-blueprint` 硬编码 expected=53 而权威 `STORE_NAME`=52）→ 以 `STORE_NAME` 为准对齐，勿强行改历史快照。

---

## 四、Mandatory 门禁运行（审计结束必跑）

```powershell
# 类型（排除增量缓存伪影，用 --incremental false）
node node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit --incremental false

# 架构跨层违规
npm run audit:layers
npm run audit:acl-consistency

# 数据一致性 + 蓝图
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-consistency.ts
node node_modules/tsx/dist/cli.mjs scripts/other/validate-data-blueprint.ts
```

> **tsc 伪影经验**: 并发 Agent 在途修改未提交文件时，`tsc --noEmit` 错误集会跨次浮动（如 15→10→1），且常含与本次无关的并发产物。判定「本次代码是否干净」只看**自己改动文件**是否出现在错误清单；他人未提交代码按项目约定**不擅改**，仅记录为已知残差。

---

## 五、关键决策规则（避免假修复）

- **派生视图不必单独建 Store**: 持仓（holdings）由 `useOrderStore` 订单聚合派生，订单已持久化 → 持仓属「派生视图」，无需独立 Store（非兜底阻断项）。
- **交互态内存可接受**: 用户筛选条件选择（conditionGroups）属瞬态 UI 状态，内存态可接受，不必强制落库。
- **Mock 占位≠落地**: 真实逻辑写好但默认返回 Mock = 未落地。落地 = 真实实现设为默认激活 + 生产接线 + 注入数据源。
- **语义不同字段禁止盲替**: 现有 `disciplineScore`（违规扣分=纪律遵守度）与 `RealTradeReviewScoreCalculator`（胜率+执行+仓位=交易表现分）语义不同；落地用**新增独立字段** `realDisciplineScore` 而非覆盖。

---

## 六、本次审计踩坑（反模式教训）

### 教训 1：校验脚本误映射导致业务代码假修复
**现象**: `validate-data-consistency.ts` 的 `STORE_TO_TYPE_MAP` 把 `proofread_reports` 映射到错误类型，报告误判需改业务接口。
**真相**: 业务接口 `FileImportProofreadReport` 嵌套 `meta` 正确，仅校验脚本缺映射 + 嵌套 keyPath 未解析。
**对策**: 业务代码正确则只修校验脚本；扩大扫描前先定点注入，勿扫 `modules/` 引发同名类型碰撞。

### 教训 2：DeduplicationService 跳过写库会丢兜底
**现象**: 早期实现命中即跳过写库（去重语义），但本系统为覆盖写，跳过会丢失最新数据。
**对策**: 改用「统计守卫」——仍调用写库，仅统计命中/跳过计数供运维，不阻断写入。

### 教训 3：引擎层直连 store 层触发 audit:layers 违规
**现象**: `tradeReviewScoring` 直接 `import useOrderStore`，audit:layers 报跨层违规。
**对策**: 引擎层禁止依赖 store 层；由 store 层（`disciplineStore`）反向注入 `setOrderDataSource(() => useOrderStore.getState().orders)`。

### 教训 4：同名 Interface 跨文件，改错定义
**现象**: `TradeReviewRecord` 在 `types/modules/tradeReviewAI.types.ts` 与 `data/types/types.tradeReview.ts` 两处定义；只改一处 → tsc 报「缺字段」。
**对策**: `grep` 全量定位所有同名定义，保持同步；以 `disciplineStore` 实际 import 的来源为准。

### 教训 5：颜色令牌重构引发的失效访问
**现象**: `COLOR_TOKENS` 重构后 `primary` 迁至 `SEMANTIC_COLOR_ROLES`，组件仍 `COLOR_TOKENS.info?.hex` 访问（TS 误报 property 'primary'）。
**对策**: 组件内回退改为硬编码等价 hex（如 `#007aff`），解耦对已重构令牌的硬依赖；属并发治理在途断裂，仅做安全回退不碰令牌定义。

---

## 七、变更后审查清单

- [ ] 五段链路兜底矩阵已更新（新增/修改 Store 后）
- [ ] `tsc:prod`（--incremental false）0 errors（仅记录非本次并发残差）
- [ ] `audit:layers` / `audit:acl-consistency` 0 violations
- [ ] `validate-data-consistency` / `validate:blueprint` 通过（expected 以 `STORE_NAME` 为准）
- [ ] 三类隐性风险已逐项核对并闭环
- [ ] 派生视图 / 交互态决策已记录（非阻断项不强行落库）
- [ ] 审计报告保存到 `deliverables/`
