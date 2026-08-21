---
title: docs/lessons/push-summary-2026-08-09.md
code_version: 2.0.0-rc.2
---

# 提交摘要报告 — 2026-08-09

> **推送范围**: `acae1425..1ba246fd`（main → origin/main）
> **推送时间**: 2026-08-09
> **CI 运行**: [Quality Check #31322802159](https://github.com/DHENGHONGYU/-/actions/runs/31322802159)
> **CI 结论**: typecheck ✅ | CockpitShell/BulkImportPanel test ✅ | IndustryChainWidget test ❌（预存）

---

## 一、推送的 6 个 Commit

| # | Commit | 类型 | 标题 | 文件数 |
|---|---|---|---|---|
| 1 | `e5b41e19` | fix(types) | resolve type errors in WidgetShell and fetcherTypes | — |
| 2 | `d5b2d87f` | docs(specs) | 重组文档目录 — specs + root + archive + assets | 16 |
| 3 | `01353b0f` | docs(meta) | finalize metadata governance and classification updates | — |
| 4 | `60b8d157` | docs(guides) | reorganize operational guides and how-to documentation | 33 |
| 5 | `ed202c1e` | docs(reports) | reorganize reports and changelogs | 35 |
| 6 | `1ba246fd` | fix(tests) | 修复 CockpitShell 和 BulkImportPanel 预存测试失败 | 2 |

---

## 二、核心修复

### 2.1 类型错误修复（`e5b41e19`）

**修复内容**: WidgetShell 和 fetcherTypes 中的 TypeScript 类型错误

**CI 验证**: typecheck job 从 `failure` → **`success`**

**涉及文件**:
- [src/services/scoring/v6-engine/calculators/l7_l8.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/calculators/l7_l8.ts) — 移除未使用的 `TurnoverVolumeSynergyResult` / `TVRLevel` 声明
- [src/services/scoring/v6-engine/types.ts](file:///d:/FinSightV9/src/services/scoring/v6-engine/types.ts) — 修复 `avgTurnover20d` possibly undefined 检查

### 2.2 测试修复（`1ba246fd`）

**修复内容**: CockpitShell 和 BulkImportPanel 预存测试失败

**CI 验证**: 两个测试文件从 10 failure → **0 failure**

#### CockpitShell.panel.test.tsx

| 修复项 | 详情 |
|---|---|
| **根因** | widgetRegistry mock 遗漏 `getTemplate` 方法 → `TypeError: widgetRegistry.getTemplate is not a function` |
| **修复 1** | 补全 `getTemplate` mock，使用真实 `WIDGET_CROSS_LAYOUT` 映射返回正确的 domain/perspective |
| **修复 2** | 更新 `buildAllInstances` 只含 `WIDGET_CROSS_LAYOUT` 中的 21 个 widgetId（4 domain：market 6/research 4/ai 5/portfolio 6） |
| **修复 3** | 更新断言匹配当前 4 domain 交叉布局（研究全景/市场背景/AI 决策/持仓观察），移除旧版 5 面板断言 |

#### BulkImportPanel.test.tsx

| 修复项 | 详情 |
|---|---|
| **根因** | `react-router` 的 `<Link>` 缺少 Router 上下文 → 组件渲染崩溃 → 空渲染 |
| **修复 1** | 补 `react-router` Link mock（`<a href={to}>{children}</a>`） |
| **修复 2** | 补 `sevenDimConfigStore` mock（`getState().getCollectionConfig()`） |
| **修复 3** | 补 `collectPoolSymbols` mock（采集服务） |

**本地验证**: 18/18 全绿（CockpitShell 8 + BulkImportPanel 10）

---

## 三、文档重组

### 3.1 specs 目录重组（`d5b2d87f`，16 files）

将规格文档统一归档到 `docs/specs/` 目录，清理根目录和分散的规格文件。

### 3.2 元数据治理（`01353b0f`）

完成元数据治理和分类更新，统一 frontmatter 规范。

### 3.3 操作指南重组（`60b8d157`，33 files）

将操作指南和 how-to 文档重组到统一目录结构。

### 3.4 报告和变更日志重组（`ed202c1e`，35 files）

将报告和变更日志统一归档整理。

---

## 四、CI 流水线状态

### 4.1 Quality Check（ID 31322802159）

| Job | 状态 | 说明 |
|---|---|---|
| **typecheck** | ✅ success | 类型修复生效（之前 failure） |
| **bootstrap-p0-gate** | ✅ success | P0 启动门禁 |
| **route-verify** | ✅ success | 路由验证 |
| **snapshot-test** | ✅ success | 快照测试 |
| **chart-industry-tests** | ✅ success | 行业图表测试 |
| **databridge-integrity** | ✅ success | DataBridge 完整性 |
| **test** | ❌ failure | 10 failure 全部是 IndustryChainWidget（预存），**CockpitShell/BulkImportPanel 零 failure** |
| **lint** | ❌ failure | 预存 ESLint 错误 |
| **audit** | ❌ failure | CI 配置问题（actions 版本） |
| **visual-regression** | ❌ failure | CI 配置问题（docker 版本） |
| **api-extraction** | ❌ failure | 预存类型错误 |
| **dependency-analysis** | ❌ failure | 预存债务 |
| **dark-mode-e2e** | ❌ failure | 预存 DOM 断言 |

### 4.2 本次修复的 CI 改善

| 指标 | 修复前 | 修复后 | 改善 |
|---|---|---|---|
| typecheck | ❌ failure | ✅ success | **+1 修复** |
| CockpitShell test | ❌ 4 failure | ✅ 0 failure | **+4 修复** |
| BulkImportPanel test | ❌ 6 failure | ✅ 0 failure | **+6 修复** |
| test job 总 failure | 10 | 10 | 持平（IndustryChainWidget 新暴露） |

> 注：修复前 test job 的 10 failure 是 CockpitShell(4) + BulkImportPanel(6)；修复后变为 IndustryChainWidget(10)。总 failure 数不变，但**本次修复的 2 个文件零 failure**。

---

## 五、剩余预存债务

| 债务项 | 优先级 | 说明 |
|---|---|---|
| IndustryChainWidget 测试 | P1 | "选择产业链层级" label 找不到，10 个 failure |
| lint 错误 | P2 | ChipDistributionChart/ConfigApp/cabinDispatcher 等 unsafe any |
| CI Actions 版本 | P2 | actions/setup-python、docker/setup-buildx-action commit hash 无法解析 |
| api-extraction | P2 | 依赖 typecheck（已修复），但仍有其他类型错误 |
| dark-mode-e2e | P2 | CockpitShell DOM 断言漂移（非本次范围） |

---

## 六、分支同步状态

```
本地 HEAD:  1ba246fd
远程 HEAD:  1ba246fd
behind/ahead: 0  0  （完全同步）
```
