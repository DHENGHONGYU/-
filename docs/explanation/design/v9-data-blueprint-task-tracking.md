---
title: V9 数据关系蓝图任务跟踪计划
type: explanation
domain: data
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "Goal: 确保 `docs/blueprints/` 中的数据关系与时间关系蓝图与源码持续一致，并将其校验纳入日常开发流程�?"
tags: [data, plan, architecture]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-062
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 数据关系蓝图任务跟踪计划

> **Goal:** 确保 `docs/blueprints/` 中的数据关系与时间关系蓝图与源码持续一致，并将其校验纳入日常开发流程�?
---

## 任务总览

| 批次 | 优先�?| 任务 | 状�?| 负责�?| 验收标准 |
|------|--------|------|------|--------|----------|
| A | P0 | 修复蓝图自审发现的源�?gap | �?已完�?| V9 Team | `validate:blueprint` 无新增缺失；文档与源码一�?|
| B | P1 | 将蓝图校验纳�?CI / 质量门禁 | �?已完成（B-1 质量门禁已注册；B-2 �?CI 条件触发�?| V9 Team | `../../reference/09-quality-gates.md` 已新增「数据蓝图一致性」门禁；CI 工作流待 `.github/workflows/ci.yml` 启用 |
| C | P1 | 为数据管线添�?freshness 运行时校�?| �?已完�?| V9 Team | V6/策略/信号核心入口已接�?`dataFreshnessGuard`；蓝图时间线已记录校验状�?|
| D | P2 | 建立蓝图定期维护机制 | �?已完成（D-1 检查单落地；D-2 TRAE Schedule 已启用，每周一 09:00 北京时间自动执行�?| V9 Team | 每周扫描一�?Store/类型/文档一致�?|
| E | P1 | v15/v16 新增 Store 蓝图补全 | �?已完成（E-1 蓝图文档 / E-2 写入模块 / E-3 Freshness 校验全部闭环�?| V9 Team | 4 个新 Store 实体/索引/关系/时序全部登记�? �?Service + ACL + 10 �?Freshness 规则 + 67 测试用例 |

---

## 批次 A：修复源�?gap（P0�?
### A-1: 补齐 `NewsBookmark` TypeScript 接口

**问题�?* `STORE_NAME.newsBookmarks` 已存在，�?`src/data/types.ts` 中缺�?`NewsBookmark` 接口，导致蓝图接口映射不完整�?
**源码现状�?*
- `src/store/newsStore.ts:24` 已定义局�?`NewsBookmarkRecord { id: string; bookmarkedAt: number }`
- `src/data/db.ts:263` 定义 store keyPath �?`id`，索引字段为 `bookmarkedAt`

**执行步骤�?*
1. �?`src/data/types.ts` 新增 `NewsBookmark` 接口
2. �?`src/store/analysisNewsStore.ts` 中将 `NewsBookmarkRecord` 替换�?`import type { NewsBookmark }`
3. 更新 `src/blueprints/` �?`NewsBookmark` 加入 entityStoreMap
4. 运行测试：`npx vitest run src/blueprints/__tests__/dataRelationship.test.ts`
5. 运行校验：`npm run validate:blueprint`
6. 提交

**验收标准�?*
- `src/data/types.ts` 导出 `NewsBookmark`
- `newsStore.ts` 无局部重复类�?- 蓝图测试通过

### A-2: 同步 DB_VERSION 标注

**问题�?* 早期 `../../reference/v9-数据血缘追�?md` 标注 `DB_VERSION = 14`，�?`src/config/dbConfig.ts` 实际�?`14`（v15/v16 升级前）�?
**决策�?* 以源码为准，修正文档标注。仅在有 schema 变更时按规范递增 DB_VERSION；当前已�?v16（含 v15 execution_logs/missing_reports �?v16 executionPlans/portfolios）�?
**执行步骤�?*
1. 读取 `../../reference/v9-数据血缘追�?md` �?DB_VERSION 相关�?2. 将其修正�?16（与 `src/config/dbConfig.ts` 一致）
3. 运行校验：`npm run validate:blueprint`
4. 提交

**验收标准�?*
- 文档与源�?DB_VERSION 一�?- `validate:blueprint` 仍通过

---

## 批次 B：纳�?CI / 质量门禁（P1�?
### B-1: �?`../../reference/09-quality-gates.md` 中注册蓝图校�?
**执行步骤�?*
1. �?`../../reference/09-quality-gates.md` 的「质量门禁清单」中新增一行：
   - 校验项：数据蓝图一致�?   - 命令：`npm run validate:blueprint && npx vitest run src/blueprints/__tests__/dataRelationship.test.ts`
   - 阈值：0 失败
2. 提交

### B-2: 创建 GitHub Actions 工作流（若后续启�?CI�?
**执行步骤�?*
1. 创建 `.github/workflows/ci.yml`（如项目未来启用 GitHub CI�?2. 添加步骤�?   ```yaml
   - name: Validate data blueprint
     run: npm run validate:blueprint
   - name: Run blueprint tests
     run: npx vitest run src/blueprints/__tests__/dataRelationship.test.ts
   ```
3. 当前项目�?CI，本任务标记为「待条件触发�?
---

## 批次 C：Freshness 运行时校验（P1�?
### C-1: 新增 `dataFreshnessGuard.ts`

**目标�?* �?V6 评分、策略评分、信号生成等核心计算前检查输入数�?freshness�?
**接口设计�?*
```typescript
export interface FreshnessCheck {
  output: string
  input: string
  outputTime: number
  inputTime: number
  valid: boolean
}

export function checkFreshness(
  output: { name: string; timestamp: number },
  input: { name: string; timestamp: number },
): FreshnessCheck
```

**执行步骤�?*
1. 创建 `src/services/analysis/dataFreshnessGuard.ts`
2. 编写单元测试 `src/services/analysis/__tests__/dataFreshnessGuard.test.ts`
3. �?`v6ScoreService.ts`、`hotSectorAnalyzer.ts`、`valuePitAnalyzer.ts`、`signalGenerator.ts` 的入口调�?freshness 检�?4. 提交

### C-2: 在蓝图中记录运行时校验点

**执行步骤�?*
1. �?`../../reference/v9-data-timeline.md` �?3.2 节追加「运行时校验实现状态」列
2. 提交

---

## 批次 D：定期维护机制（P2�?
### D-1: 创建维护检查单

已在本文档末尾创建「每周维护检查单」（见第 8 章）�?
### D-2: 配置自动化提醒（可选）

**执行步骤�?*
1. 如使�?TRAE Schedule，可创建每周一�?9 点的任务�?   - 消息：运�?`npm run validate:blueprint` 与蓝图测试，检�?Store/接口/文档一致性，输出结果�?`docs/blueprints/weekly-check-YYYY-MM-DD.md`
2. 当前先手动执行，后续根据团队习惯配置

---

## 批次 E：v15/v16 新增 Store 蓝图补全（P1�?
> **背景**：`src/config/dbConfig.ts` 已升级到 DB_VERSION = 16，IndexedDB 已新�?4 �?Store
> （`execution_logs`, `missing_reports`, `executionPlans`, `portfolios`），�?ER/Timeline 蓝图尚未完整登记�?
### E-1: 蓝图文档补齐（已完成�?
**执行步骤�?*
1. `../v9-data-relationship-er.md` 已在 §1 Store 清单追加 4 行；§2 实体关系�?4 条；
   §3 ER 图新�?4 条边；DB_VERSION 14�?6
2. `../../reference/v9-data-timeline.md` 已在 §1 追加 P12/P13/P14/P15 四个管线阶段；�?.1 刷新频率表补 4 �?3. `scripts/other/validate-data-blueprint.ts` �?Store 数量预期�?20�?4

**验收标准�?*
- 4 个新 Store 实体/索引/关系/时序全部登记
- `npm run validate:blueprint` 通过
- `dataRelationship.test.ts` 通过

### E-2: 写入模块�?ACL 接入（已完成�?
**执行步骤（待人工实现后回填进度）�?*
1. 创建 `src/services/execution/executionPlanService.ts`、`executionLogService.ts`
2. 创建 `src/services/portfolio/portfolioService.ts`
3. �?`src/services/data-collector/missingReportDetector.ts` 实现缺失报告登记
4. �?`src/core/acl.ts`（或同等�?ACL 配置）补 4 �?Store 的读写权限条�?5. 提交对应单元测试

**验收标准�?*
- 4 个新 Store 都有对应�?Service 写入入口
- ACL 矩阵�?`execution` / `portfolio` / `data-collector` 三个模块被授�?- 新增 4 �?Store 的蓝图一致性测试通过

### E-3: 蓝图运行时校验补全（已完成）

**目标**：为 4 个新 Store 添加 `dataFreshnessGuard` 规则�?- 执行计划�?`executionPlans.createdAt >= signals.createdAt`
- 投资组合�?`portfolios.updatedAt >= max(orders.createdAt)`
- 执行日志�?`execution_logs.timestamp >= executionPlans.createdAt`
- 缺失报告�?`missing_reports.detectedAt` 应小于当前计算时�?
**验收标准**：在 `dataFreshnessGuard.ts` 中增�?4 �?`check*` 函数，调用方覆盖 Service 入口�?
---

## 执行状态看�?
```markdown
- [x] 创建蓝图文档（ER、Timeline、Sequence�?- [x] 创建可执行测试与校验脚本
- [x] 更新文档索引�?CHANGELOG
- [x] A-1 补齐 NewsBookmark 接口
- [x] A-2 同步 DB_VERSION 标注
- [x] B-1 注册到质量门�?- [x] B-2 配置 CI（条件触发）
- [x] C-1 实现运行�?freshness 校验
- [x] C-2 更新蓝图运行时状�?- [x] freshness-review `tradeReviewAI.generateReview` / `generateReviewAsync` 接入 `checkReviewFreshness`
- [x] freshness-news `newsService.saveNewsArticle` 接入 `checkSentimentCacheFreshness`
- [x] freshness-verify 运行相关测试与校验，更新 `../../reference/v9-data-timeline.md` �?`../../../CHANGELOG.md`
- [x] freshness-deep 深化 Freshness：新增阻�?非阻塞模�?+ checkSnapshotFreshness + checkPortfolioFreshness
- [x] test-fix 全量测试修复�?45/145 文件�?826/1826 测试通过
- [x] code-opt 代码优化：SentimentAnalysisResult 命名接口 + SyncReviewOptions 接口
- [x] D-1 制定每周维护检查单
- [x] D-2 配置自动化提醒（TRAE Schedule 已启用，每周一 09:00 北京时间，ID: f6152f1d�?- [x] E-1 蓝图文档补齐：ER/Timeline/validate:blueprint 同步 v15/v16
- [x] E-2 写入模块�?ACL 接入（executionPlanService/executionLogService/portfolioService/missingReportDetector�?- [x] E-3 4 个新 Store �?Freshness 运行时校�?```

---

## 风险与降�?
| 风险 | 应对 |
|------|------|
| 修改 `DB_VERSION` 导致用户 IndexedDB 迁移失败 | 不随意升级版本；仅在�?schema 变更时按规范递增 |
| 新增接口影响现有 newsStore | 保持字段与现�?`NewsBookmarkRecord` 完全一致，仅迁移类型位�?|
| CI 工作流与本地环境差异 | 先本地验证，再逐步启用 GitHub Actions |
| Freshness 校验过于严格影响性能 | 默认仅校验时间戳，不阻塞计算；提供开�?|

---

## 8. 每周维护检查单

> **用�?*：每次版本迭代或每周固定时间由值班人执行，确保蓝图与源码持续一致�? 
> **输出**：将结果记录�?`docs/blueprints/weekly-check-YYYY-MM-DD.md`（可直接复制本检查单作为模板）�?
### 8.1 执行前准�?
- [ ] 切换�?`main` 分支并拉取最新代�?- [ ] 确认 Node 版本�?`.nvmrc` 一致：`node -v`
- [ ] 安装依赖：`npm ci`（如�?package-lock 变更�?
### 8.2 一致性扫�?
- [ ] 运行蓝图校验脚本�?  ```bash
  npm run validate:blueprint
  ```
  - [ ] Store 数量 = 24
  - [ ] Interface 数量与预期一�?  - [ ] 无新增缺失映�?
- [ ] 运行蓝图单元测试�?  ```bash
  npx vitest run src/blueprints/__tests__/dataRelationship.test.ts
  ```
  - [ ] Store 数量 = 24 且无重复
  - [ ] 核心实体均映射到 Store
  - [ ] 时间一致性规则通过

### 8.3 源码变更检�?
- [ ] 检查本周新�?修改�?IndexedDB Store�?  - 文件：`src/config/dbConfig.ts`
  - 确认每个 Store �?`../v9-data-relationship-er.md` 中有定义
  - 确认每个 Store �?`src/blueprints/` �?`expectedStores` 列表�?
- [ ] 检查本周新�?修改�?TypeScript 接口�?  - 文件：`src/data/types.ts`
  - 确认核心实体接口已加�?`entityStoreMap`
  - 确认接口字段变更已同步到蓝图文档

- [ ] 检查时间戳字段变更�?  - 文件：`src/data/types.ts` 及相关计算输出类�?  - 确认新增/重命名的时间戳字段已�?`../../reference/v9-data-timeline.md` 3.2 节登�?  - 确认已在 `dataFreshnessGuard.ts` 添加对应校验函数（如适用�?
### 8.4 Freshness 运行时校验检�?
- [ ] 检查本周新增的核心计算入口是否接入 `dataFreshnessGuard`�?  - V6 评分入口：`src/services/scoring/v6ScoreService.ts`
  - 热门板块策略入口：`src/services/scoring/hotSectorAnalyzer.ts`
  - 价值洼地策略入口：`src/services/scoring/valuePitAnalyzer.ts`
  - 交易信号入口：`src/services/trading/signalGenerator.ts`

- [ ] 检�?`../../reference/v9-data-timeline.md` 3.2 节运行时校验状态表是否最�?
### 8.5 质量门禁状�?
- [ ] 确认 `../../reference/09-quality-gates.md` 中「数据蓝图一致性」门禁命令仍可运�?- [ ] 记录本周 `tsc --noEmit` / `npm run lint` / `npm run test` 基线（仅关注与蓝图相关错误）

### 8.6 收尾

- [ ] 填写检查结论（通过 / 发现 N 项偏差）
- [ ] 如有偏差，创建对应修复任务并分配优先�?- [ ] 更新本文档「执行状态看板」中相关项状�?- [ ] �?CHANGELOG 中追加维护记录（如发生偏差或规则更新�?