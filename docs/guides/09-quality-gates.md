---
title: "09. 质量门禁"
domain: project
status: active
last_updated: 2026-08-22
code_version: 2.0.0-rc.2
version: v2.5.1
change_log:
  - version: v2.5.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v2.5.0) → R2 PATCH++(v2.5.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
covers_code:
  - src/config/dbConfig.ts
  - src/data/types.ts
  - src/config/llmConfig.ts
  - src/config/thresholds.ts


---
title: 09. 质量门禁
type: reference
domain: qa
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档定义 V9 的上线前质量门禁、CI 流水线、测试策略与扫描脚本。 目标读者：开发者、QA、发布负责人。"
tags: [qa, quality, reference]
version: v2.5.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-QA-065
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-QA-108]
change_log:
  - version: v2.5.0
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-07-17
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-17
---

# 09. 质量门禁

> **Status**: Current  
> **Version**: v2.5.0  
> **Last Updated**: 2026-07-05
>
> 本文档定义 V9 的上线前质量门禁、CI 流水线、测试策略与扫描脚本。  
> 目标读者：开发者、QA、发布负责人。

---

## 1. 质量门禁总览

质量门禁是 `main` 分支合并与版本发布的**硬性门槛**。任何一项未通过，禁止合并/发布。

| # | 门禁项 | 当前状态 | 目标 | 命令/脚本 |
|---|--------|----------|------|-----------|
| 1 | TypeScript 类型检查 | ? 通过 | 0 errors | `tsc --noEmit` |
| 2 | ESLint 代码规范 | ? 通过 | 0 warnings/errors | `npm run lint` |
| 3 | 单元测试 | ?? 部分通过 | 198/236 passed（38 failed） | `npm run test` |
| 4 | 生产构建 | ? 通过 | 产物生成成功 | `npm run build` |
| 5 | 跨层调用审计 | ? 已建立，当前 0 违规 / 0 警告 | 0 违规 | `npm run audit:layers` |
| 6 | 硬编码审计 | ?? 已建立，基线 749 处问题（Critical 398 / Major 351） | 0 硬编码阈值/颜色 | `npm run audit:hardcode` |
| 7 | 空壳文件/未使用导出审计 | ?? 已建立，基线 0 空壳 / 0 路由漂移 / 16 未注册页面提示 | 0 空壳 / 0 路由漂移 | `npm run audit:deadcode` |
| 8 | 测试覆盖率 | ?? 阈值已配置，当前实测覆盖率尚未达标 | core/data/lib ≥85%，services ≥70% | `npm run coverage` |
| 9 | E2E 冒烟测试 | ? 已建立 | 0 失败（5/5 passed） | `npm run test:e2e` |
| 10 | 路由一致性审计 | ?? 已建立，基线 0 处漂移 | 0 漂移 | `npm run audit:deadcode` |
| 11 | PWA 离线验证 | ?? 未建立 | service worker 注册成功 | 手动/Playwright（待建） |
| 12 | 数据蓝图一致性 | ? 已建立 | Store/类型/文档一致 | `npm run validate:blueprint && npx vitest run src/blueprints/__tests__/dataRelationship.test.ts` |
| 13 | 踩坑规则门禁 | ? 已建立 | 0 ERROR（规则 #11-#14） | `python scripts/pitfall_check.py` — 详见 [踩坑规则门禁指南](踩坑规则门禁指南.md) |

`.nvmrc` 已创建（Node 22），CI/团队成员可通过 `nvm use` 读取。

---

## 2. 类型门禁

### 2.1 `tsc --noEmit`

- 已配置为 `predev` 与 `prebuild` 钩子，开发/构建前自动执行。
- 目标：0 errors，warnings 视为 error。
- 禁止在核心目录使用 `any`，特殊情况须在代码注释中说明并评审。

### 2.2 目录级 strict 模式（v1.0.0）

计划为关键目录单独创建 `tsconfig.*.json` 并逐步开启 strict：

| 目录 | strict 状态 | 说明 |
|------|-------------|------|
| `src/config/` | 待开启 | 配置层必须类型最严格 |
| `src/core/` | 待开启 | DataBridge、Envelope、ACL 无容错空间 |
| `src/data/` | 待开启 | 数据层类型错误会导致持久化失败 |
| `src/services/scoring/` | 待开启 | 评分引擎必须可预测 |

---

## 3. 代码规范门禁

### 3.1 ESLint 配置

- 配置文件：`eslint.config.js`
- 规则集：ESLint 推荐 + TypeScript ESLint + React Hooks + React Refresh
- 目标：`npm run lint` 0 warnings/errors

### 3.2 禁止清单

| 规则 | 说明 | 触发位置 |
|------|------|----------|
| 禁止引擎层静默容错 | `?? []` / `|| 0` 等隐式兜底 | `src/services/`, `src/core/` |
| 禁止跨层调用 dataLayer | L5/L4 写操作必须走 DataBridge | `src/apps/`, `src/pages/`, `src/components/`, `src/portal/`, `src/cockpit/` |
| 禁止硬编码业务常量 | 阈值、权重、股票代码必须来自 config | 全项目 |
| 禁止硬编码颜色/类名 | UI 层使用 theme 令牌 | `src/components/`, `src/pages/` |
| 禁止全局可变状态 | 除 Zustand store 外，禁止模块级可变变量 | 全项目 |

---

## 4. 测试策略

### 4.1 单元测试

- 框架：Vitest + jsdom + fake-indexeddb
- 配置：`vite.config.ts` 的 `test` 字段
- setup 文件：`tests/setup.ts`

#### 当前测试覆盖

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/databridge.test.ts` | DataBridge 信封写入与 ACL 拒绝 |
| `tests/dataLayer.test.ts` | dataLayer CRUD 与错误处理 |
| `tests/intelligentScore.test.ts` | 智能评分加权计算与 LLM 缺失配置异常 |
| `tests/fetcherService.test.ts` | 基础数据采集适配、DataBridge 写入、错误处理 |
| `tests/fetcherKline.test.ts` | K线数据采集、`daily_quotes` 写入、`Stock.price` 更新 |
| `tests/poolTransitionEngine.test.ts` | 股票池流转规则与标签 |
| `tests/stockpoolService.test.ts` | 合法/非法流转、归档后重新激活 |

#### 覆盖率目标

> 覆盖率阈值已在 `vite.config.ts` 中配置（core/data/lib ≥85%，services ≥70%），当前实测覆盖率尚未达标，待补充测试收敛。

| 目录 | 目标覆盖率 | 当前状态 |
|------|-----------|----------|
| `src/core/` | ≥ 85% | ?? 待统计 |
| `src/data/` | ≥ 85% | ?? 待统计 |
| `src/lib/`（如存在） | ≥ 85% | ?? 待统计 |
| `src/services/` | ≥ 70% | ?? 待统计 |
| `src/pages/` | ≥ 40% | ?? 待建立 |
| `src/components/` | ≥ 40% | ?? 待建立 |

### 4.2 集成测试

- 覆盖「选股 → 评分 → 模拟交易」端到端链路。
- 使用 fake-indexeddb 模拟 IndexedDB，不依赖真实网络。

### 4.3 E2E 测试（v1.0.0）

- 框架：Playwright（已建立）
- 当前状态：5/5 通过
- 关键场景：
  1. 录入股票 → 触发评分 → 查看评分结果
  2. 股票池间流转
  3. 模拟买入 → 查看持仓
  4. 数据导出 → 数据重置 → 数据导入

---

## 5. 扫描脚本规划

### 5.1 跨层调用扫描

```bash
npm run audit:layers
# 或
npx tsx scripts/audit-layer-calls.ts
```

检查项：
- `src/apps/` / `src/pages/` / `src/components/` / `src/portal/` / `src/cockpit/` 是否直接 import `dataLayer` 并执行写操作。
- `src/config/` 是否 import 引擎层或映射层。
- `src/core/` 是否 import UI 层。

### 5.2 硬编码审计

```bash
npm run audit:hardcode
# 或
npx tsx scripts/audit-hardcode.ts
```

检查项：
- 引擎层文件是否出现数字常量（排除测试文件）。
- UI 层是否出现 HEX 颜色或具体 Tailwind 类名（如 `text-red-500`）。
- 业务字符串是否未走 i18n/常量配置。

### 5.3 死代码/空壳扫描

```bash
npm run audit:deadcode
# 或
npx tsx scripts/audit-dead-code.ts
```

检查项：
- `src/` 下空函数、空组件、未使用 export。
- 路由注册表中的路径是否存在对应文件。

### 5.4 数据蓝图一致性扫描

```bash
npm run validate:blueprint
# 或
npx tsx scripts/validate-data-blueprint.ts
```

检查项：
- `src/config/dbConfig.ts` 中 Store 数量是否与蓝图一致。
- `src/data/types.ts` 中是否包含所有核心实体接口。

```bash
npx vitest run src/blueprints/__tests__/dataRelationship.test.ts
```

检查项：
- Store 数量 = 20 且无重复。
- 核心实体均映射到 Store。
- 时间一致性规则（如 `calculatedAt >= updatedAt`）成立。

---

## 6. CI 流水线规划

### 6.1 GitHub Actions 工作流

文件：`.github/workflows/ci.yml`（待建立）

```yaml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'  # 已创建 `.nvmrc`（Node 22），CI/团队成员可通过 `nvm use` 读取
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - run: npm run coverage
      - run: npx tsx scripts/audit-layer-calls.ts
      - run: npx tsx scripts/audit-hardcode.ts
      - run: npm run validate:blueprint
      - run: npx vitest run src/blueprints/__tests__/dataRelationship.test.ts
```

### 6.2 合并规则

- PR 必须通过 CI 全部 job。
- 至少需要 1 名 reviewer 批准。
- 文档变更须同步更新 `docs/` 或 `CHANGELOG.md`。

---

## 7. 当前扫描基线（v0.9.0-docs-review）

> 以下数据随代码演进变化，每次发布前应重新运行 `npm run audit` 并更新本节。

### 7.1 跨层调用审计

| 违规类型 | 数量 | 说明 |
|----------|------|------|
| L5/L4 导入数据层 | 0 | 当前基线无违规 |
| L5/L4 直接写数据层 | 0 | 当前基线无违规 |
| L5/L4 读数据层警告 | 2 | `ScoreDocPage.tsx`、`StrategySnapshotPage.tsx` 直接读取 `dataLayer`，已记录待收敛 |

> 历史基线：L5/L4 导入数据层 9 处、直接写数据层 4 处，已修复。

### 7.2 硬编码审计

| 类别 | 数量 | 说明 |
|------|------|------|
| 静默回退 | 283 | 大量 `?? ''` / `?? 0` / `|| []` 分布于 UI 与引擎层，新增 fetcher 层错误兜底；需逐步收敛到显式错误处理 |
| 硬编码 Tailwind 颜色类 | 29 | `ScoreFactorDeltaPanel`, `ScoreUpdateAlert` 等使用 `text-emerald-700` 等 |
| 魔法数字 | 77 | 评分、风控、阈值配置中的数字常量 |
| **合计** | **389** | Fatal 已清零；Major/Critical 随重构持续收敛 |

### 7.3 死代码/路由审计

| 类别 | 数量 | 说明 |
|------|------|------|
| 条件返回 null | 6 | 多为正常空状态分支，非缺陷 |
| 未注册页面 | 5 | 4 个 `HubPage` 为 `PortalShell` 内部组件，不独立注册；1 个 `defaultPageBuilder` 为工具文件 |
| 路由-文件漂移 | 0 | 当前基线无漂移 |
| **合计** | **11** | 均为提示级，无阻断 |

---

## 8. 偏差收敛计划

| # | 偏差 | 当前数量 | 责任 Phase | 收敛方式 |
|---|------|----------|------------|----------|
| 1 | L5/L4 直接导入 dataLayer | 0 | Phase 2 | ? 已完成；所有 L5/L4 读操作经 Service |
| 2 | L5/L4 直接写数据层 | 0 | Phase 2 | ? 已完成；所有写操作经 DataBridge |
| 3 | config 依赖 services 类型 | 0 | Phase 2 | ? 已完成；类型已下沉到 `src/config/llmConfig.ts` |
| 4 | UI 层硬编码 Tailwind 颜色 | 8 | Phase 2/3 | 替换为 `theme.config.ts` 语义化 class/token |
| 5 | 引擎层静默回退 | 20+ | Phase 2/3 | 显式返回错误对象，由调用方决定兜底文案 |
| 6 | 魔法数字 | 4 | Phase 2 | 将阈值抽取到 `src/config/thresholds.ts` |
| 7 | ?? 已修复：`inputConfig.ts` 已创建 | 0 | Phase 2 | 持续补充高级筛选与批量规则 |
| 8 | 路由-文件一致性审计待增强 | 0 | Phase 2 | 增强 `audit-dead-code.ts` 路由-文件校验 |

---

## 9. 验收数据模板

每次版本发布须填写：

```markdown
## v0.9.0 验收数据

| 检查项 | 结果 |
|--------|------|
| tsc --noEmit | 0 errors |
| npm run lint | 0 warnings/errors |
| npm run test | 291/291 passed |
| npm run build | success |
| 产物大小 | xxx KB |
| 构建时间 | x.x s |
```

---

## 10. 当前偏差与下一步

| 偏差 | 影响 | 计划 |
|------|------|------|
| 跨层调用基线已清零 | ? 架构违规已收敛 | 持续运行 `audit:layers` 守护 |
| 硬编码基线 749 处未清零（新增主要来自 NewsPage V6 组件与 AI Center Mock 数据） | 阈值/颜色/错误兜底可能重新泄漏 | Phase 2/3 将阈值/颜色集中到 config/theme；错误兜底显式化；新增模块须先定义常量再写组件 |
| 覆盖率阈值已配置，当前未达标 | 无法量化测试质量 | 待补充测试收敛，目标 core/data/lib ≥85%、services ≥70% |
| E2E 已建立 | 核心链路回归风险已收敛 | 当前 5/5 通过，持续维护 |
| CI 未配置 | 门禁依赖本地执行 | Phase 3 建立 `.github/workflows/ci.yml` |
| PWA 离线验证缺失 | 离线目标未经验证 | Phase 3 配置 manifest + service worker 并测试 |

---

## 11. 版本比对

本文档当前版本为 `v0.9.0-doc-sync-plan`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `../archive/historical-2026-08-16/batch8/architecture-version-comparison.md（已归档）`

主要变化：

1. 单元测试基线更新为 291/291 通过；E2E 基线建立为 5/5 通过。
2. 跨层调用审计基线更新为 0 违规 / 0 警告，并保留历史基线说明。
3. 新增路由一致性审计项（门禁 #10）。
4. 死代码/路由审计补充路由-文件漂移列。
5. 偏差收敛计划新增输入舱配置缺失与路由一致性审计项。

---

## 🔗 SOP 交叉引用（阈值/定义 ↔ 操作步骤映射）

> 本文档是**质量门禁的唯一真相源**（所有阈值、门编号、Block/Warn 分级）。所有门禁的**实际操作步骤、Top 失败修复、证据归档**按 SDLC 阶段被以下 3 篇核心 P0 SOP 承载：

| 本文档章节 | 对应 SOP（操作层面） | 对齐方式 |
|----------|-------------------|---------|
| §2 Husky v2 pre-commit 22 步门禁（Block 阈值） | [S02 §2.C 速查表第一部分 22 步](sops/S02-dev-workflow.md#2c--husky-门禁速查表) | 编号完全一致（env-check→rag-gate）；S02 加「失败 Tip」列 |
| §3 pre-push 6 步速查（层 硬 僵 密 型 测） | [S02 §2.C 第二部分 pre-push 表](sops/S02-dev-workflow.md#pre-push-6-步速查push-必跑引用-agentsmd-husky-v2-scope-guard) | 6 步完全对齐；S02 加速记口诀 |
| §4 Gate:Quick 定义（集成场景） | [S04 §二 STEP 2 gate:quick 详解](sops/S04-pre-merge-integration.md#step-2--gatequick-快速门禁block--集成核心) | S04 增加 7 子门禁耗时目标 + 可信单元测试 99.2% 阈值 |
| §5 上线前综合体检 24 步（Block/P1 分级）+ §6 6 维度加权评分 | [S05 §2 24 步 Block 17 项 + §3.4 评分模板](sops/S05-pre-launch-checklist.md) | 分级、维度与权重（15+20+20+15+15+15=100%）完全一致；S05 补充命令参数示例 / 通过标准 / 失败修复 / 真数独立章节 |
| §1 总览「可信单元测试」定义 | [S04 §二 STEP 3 可信单元测试](sops/S04-pre-merge-integration.md#step-3--可信单元测试排除 quarantineblock) + [S07 §三 Gold/Silver 通过标准中的可信要求](sops/S07-ops-incident-response.md) | 定义完全引用 testing-strategy.md |

> **一致性承诺（重要）**：本文件调整门禁编号 / Block 阈值 / 评分权重时，上述 SOP 的对应段落必须在**同一次 PR 中同步修改**并通过 `audit:agents-consistency:strict` 验证；禁止「改了 quality-gates 阈值忘了 SOP」。
