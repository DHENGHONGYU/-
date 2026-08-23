---
title: 采集管线卫生整改报告（评价整改 P0/P1/P2 批次）
type: deliverable
domain: data
doc_id: V9-DOC-DELIV-2026-0823-HYGIENE
code_version: "2.0.0-rc.2"
version: v1.0.0
last_updated: 2026-08-23
status: active
tags: [data-collector, hygiene, testing, refactor]
change_log:
  - version: v1.0.0
    changes: "初版：采集质量评价（86/100）整改批次一落地报告"
    date: 2026-08-23
covers_code:
  - src/services/data-collector/dataSourceOrchestrator.ts
  - src/services/data-collector/dataSourceOrchestrator.test.ts
  - src/services/data-collector/adaptiveSourceOrchestrator.ts
  - src/services/data-collector/adaptiveSourceOrchestrator.test.ts
  - src/services/data-collector/collectionPipeline.ts
  - src/config/collectConfig.ts
  - src/store/sevenDimConfigStore.ts
---

# 采集管线卫生整改报告 — 2026-08-23

> 依据：数据采集管线质量评价报告（综合 86/100，测试覆盖 78 分为最短板）。
> 执行纪律：**禁止代码先行** — 先加载 `collection-pipeline-testing`（MAND）与
> `doc-freshness-governance`（MAND）SKILL，按 SOP 保存基线 → 修改 → 文档同频 → 门禁验证。

## 一、本批次完成项

| # | 优先级 | 事项 | 落地方式 |
|---|--------|------|----------|
| 1 | P0 | dataSourceOrchestrator 无独立单测 | 新增 `dataSourceOrchestrator.test.ts` 12 例（降级链/单源重试/熔断跳过/akshare 占位/mock 门禁/K 线双契约）+ `adaptiveSourceOrchestrator.test.ts` 7 例（退避公式/封顶/退化策略） |
| 2 | P2 | 两套退避实现漂移风险 | 删除本地 `backoffDelayMs`；新增 `computePolicyBackoffMs(policy, attempt)` 作为 RetryPolicy 退避**唯一入口**（指数退避 + 全抖动 + maxDelayMs 封顶），行情/K 线两处重试循环改道 |
| 3 | P2 | 死代码 `_unused_upgradeDimensionsLocally_` | 删除（-27 行），保留注释指向 lib 层 canonical 实现 |
| 4 | P1 | "七维"过时注释 | `collectConfig.ts` / `sevenDimConfigStore.ts` 注释对齐至 16 维（历史命名保留，不破坏 UI） |
| 5 | P1 | AKShare 无效声明 | 核实注册表已 `enabled: false` 且不在默认链；编排器占位函数文档化（可观测降级 + sidecar 接线路标），不改行为 |

## 二、门禁结果

| 门禁 | 命令 | 结果 |
|------|------|------|
| 基线快照 | `git status --short > outputs/collection-hygiene-before.txt` | PASS（151 项快照；全量 tsc 22 个历史残差全在 IndustryHeatmap.tsx，与本次无关） |
| Phase 1 | `npm run tsc:prod` | **PASS（exit 0）** |
| Phase 2 | `npm run audit:layers` | **PASS（0 违规 / 0 警告 / 1505 文件）** |
| Phase 3 | `vitest run src/services/data-collector` | **PASS（18 文件 / 209 passed / 1 skipped=live E2E 设计跳过）** |
| 文档同频 | `data-collector-contract.md` v1.0.3 / `collection-contract.md` v1.0.2 | PASS（PATCH++ + change_log 闭环 + covers_code 登记） |

> Phase 4/5（MCP 穿透 E2E 与真实取数）不涉及本批次变更面（未触碰 MCP 适配器/CLI 桥），
> 按 SKILL 触发条件不强制；`e2eWestockMcpChain.test.ts` 已在 Phase 3 随套件全绿（4 passed）。

## 三、遗留待办（下批次）

| # | 优先级 | 事项 | 预估 |
|---|--------|------|------|
| 1 | P2 | 维度 11–14 从 local_docs 迁移专用存储（需新增 STORE_NAME/ENVELOPE_ACTION 四位置同步） | ~8h |
| 2 | P3 | collectionPipeline.ts（1540 行）拆分至 `collectionPipeline/` 子目录 | ~3h |
| 3 | P1 | 全仓"七维"UI 文案与路由描述统一（约 25 处，涉页面标题，需产品确认） | ~2h |
| 4 | P1 | `IndustryHeatmap.tsx` 22 个历史 tsc 残差修复（与采集域无关，独立立项） | ~1h |
