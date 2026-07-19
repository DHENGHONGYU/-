---
title: V6→V9 架构整改校正评估与可行性分析报告
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "## 一、背景与问题陈述 经 2026-07-04 全量代码审计发现，此前批次 A~E（行动清单..."
tags: [project, report, plan, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V6→V9 架构整改校正评估与可行性分析报告

## 一、背景与问题陈述

经 2026-07-04 全量代码审计发现，此前批次 A~E（行动清单 v1.1.0→v1.7.0）的整改记录与实际代码状态存在**系统性偏差**。核心矛盾为：文档标记"已完成"的多项整改，在代码中并未落地。

本报告分三个阶段完成：
1. **文档影响范围评估** — 哪些文档/日志需要修正
2. **工作量与可行性分析** — 每个偏差的修复成本、风险、依赖关系
3. **系统性调整方案**（待批准后执行） — 分批次执行计划

---

## 二、阶段1：文档影响范围评估

### 2.1 受影响文档清单

| # | 文档 | 当前版本 | 问题 | 需更新内容 |
|---|------|---------|------|-----------|
| 1 | `../../reports/changelogs/CHANGELOG.md` | v1.2.0 (2026-06-27) | **完全缺失**批次 A~E 的全部变更记录（6次版本迭代） | 新增 v1.3.0~v1.7.0 条目；后续需新增"校正审计"条目 |
| 2 | `../v6-v9-architecture-audit-action-list.md` | v1.7.0 (2026-07-02) | 声称 26/26 已修复，但 **5+ 项与实际代码不符** | 回退偏差项状态为"未修复"；新增校正审计记录 |
| 3 | `../../reference/03-architecture-standards.md` | v1.1.0 (2026-06-26) | 行动清单声称已更新到 v1.4.0，**实际仍为 v1.1.0** | 版本号升级；补充 Store 广播、usePageGuard 等架构说明 |
| 4 | `../../reference/06-routing-specs.md` | v1.2.0 | **三处版本号冲突**（v1.2.0/v0.9.0-migration/v1.4.0）；仍含 `/analysis/news-v6` 和 `/input/prototype` 条目 | 统一版本号；删除/更新死路由条目；补充 14 条缺失路由 |
| 5 | `../../reference/completeness-profile.md` | v6.0.0 (2026-06-27) | 批次命名与行动清单冲突；25 项待修复状态未同步 | 区分"完成度审计批次"与"架构整改批次"；同步修复状态 |
| 6 | `package.json` | 0.9.18 | 与所有文档版本**完全脱节** | 整改完成后递增版本号 |

### 2.2 文档间版本依赖关系图

```
package.json (0.9.18) ← 完全脱节
    ↑
CHANGELOG.md (v1.2.0) ← 断层，缺 6 次迭代
    ↑
action-list.md (v1.7.0) ← 最高版本，但含偏差
    ↑
03-architecture-standards.md (v1.1.0) ← 声称 v1.4.0 实际未更新
    ↑
06-routing-specs.md (v1.2.0/v0.9.0/v1.4.0) ← 三方冲突
    ↑
completeness-profile.md (v6.0.0) ← 独立版本体系
```

### 2.3 偏差条目明细

以下 action-list.md 条目标记为"已完成"但实际代码未落地：

| 条目 | 声称状态 | 实际代码状态 | 偏差严重度 |
|------|---------|-------------|-----------|
| B: P1-03 | "news-v6 已删除" | `src/pages/analysis/` 含 8 个文件仍存在 | **P0 严重** |
| B: P1-04 | "input/prototype 已删除" | `src/apps/input/` 含 6 个文件仍存在 | **P0 严重** |
| C: P1-08 | "newsStore.ts 已不存在" | `src/store/analysisNewsStore.ts`（225 行）仍存在 | **P0 严重** |
| D: D-2 | "DATA_ACTION_TO_ENVELOPE 映射表已创建" | 代码中搜索不到该映射 | **P0 严重** |
| E: P2-05 | "@legacy 标记已完成" | `v6MigrationService.ts` 无 @legacy 注释 | **P1 中等** |

此外，**P0-A（v6ScoreService 集成 v6-engine）和 P0-B（PortalShell 单轨化）**从未在任何批次中被实际执行，尽管行动清单声称已完成。

---

## 三、阶段2：工作量与可行性分析

### 3.1 偏差1：v6ScoreService 未集成 v6-engine

#### 当前状态精确定位

- **文件**: `src/services/scoring/v6ScoreService.ts`（214 行）
- **问题**: `runV6Score()` 函数（第 128-200 行）使用自研 9 因子逻辑，**零调用 v6-engine**
- **硬编码**: 10+ 处魔法数字（`FACTOR_NAMES`、`20`、`0.3`、`0.05`、`1e12` 等）
- **版本标识**: `algorithmVersion: 'v9-auto'`（第 186 行）
- **测试断言**: `v6ScoreService.test.ts` 第 167 行断言 `algorithmVersion` 为 `'v9-auto'`

#### 修复方案

| 步骤 | 文件 | 修改内容 | 复杂度 |
|------|------|---------|--------|
| 1 | `v6ScoreService.ts` | 重写 `runV6Score()`：导入 `createV6Engine`，通过 `stockToBasicData()`/`quotesToQuoteData()` 适配输入，调用 `engine.calculateAll()` | 高 |
| 2 | `v6ScoreService.ts` | 删除 `FACTOR_NAMES`、`calculateFactorFromQuotes()`、`calculateFactorFromBasicData()` 等旧函数 | 中 |
| 3 | `v6ScoreService.ts` | `algorithmVersion` 从引擎返回值获取 | 低 |
| 4 | `data/types.ts` | 评估 `V6Score` 类型是否需扩展以适配 `CompositeScore` 输出 | 中 |
| 5 | `v6ScoreService.test.ts` | 重写测试断言：版本改为 `'v6-engine-v1.0.0'`，增加层级得分断言 | 高 |
| 6 | `analysisStore.ts` | 验证调用方兼容性（`handleScore` → `runV6Score`） | 低 |
| 7 | `stockAnalysisStore.ts` | 验证调用方兼容性 | 低 |

#### 可行性评估

- **风险等级**: 高（核心评分算法变更，影响所有评分相关 UI）
- **预计工作量**: 4-6 小时
- **测试影响**: `v6ScoreService.test.ts`（208 行）需全面重写；`analysisStore.test.ts` 可能需适配
- **依赖**: v6-engine 已完整（11 层计算器 + 配置 + 类型），`types.ts` 已提供 `stockToBasicData()`/`quotesToQuoteData()` 适配函数
- **可行性**: ? **可行**，v6-engine 基础设施就绪，主要工作是桥接和测试重写

#### 关键决策点

> **决策1**: `V6Score` 类型是否需要扩展？
> - 方案A: 保持 `V6Score` 不变，在 `runV6Score` 中将 `CompositeScore` 映射回 `V6Score` 格式（向后兼容）
> - 方案B: 扩展 `V6Score` 增加层级得分字段（更完整但影响面更大）
> - **建议**: 方案A（最小影响面），后续迭代再考虑方案B

---

### 3.2 偏差2：PortalShell HUB_APPS 双映射

#### 当前状态精确定位

- **文件**: `src/portal/PortalShell.tsx`（336 行）
- **CABIN_APPS**: 第 41-47 行，5 个 `apps/*App` 映射
- **HUB_APPS**: 第 49-55 行，5 个 `pages/*HubPage` 映射
- **判断逻辑**: 第 219 行 `isHubView = location.pathname.endsWith('/hub')`
- **渲染分支**: 第 222-228 行，三元运算选择 CABIN_APPS 或 HUB_APPS
- **引用**: HUB_APPS 仅在 2 处使用（定义 + 渲染）

#### 修复方案

| 步骤 | 文件 | 修改内容 | 复杂度 |
|------|------|---------|--------|
| 1 | `PortalShell.tsx` | 删除 `HUB_APPS` 定义（第 49-55 行）和 5 个 HubPage lazy import | 低 |
| 2 | `PortalShell.tsx` | 简化渲染逻辑：移除 `isHubView` 判断，直接使用 `CABIN_APPS` | 低 |
| 3 | `PortalShell.tsx` | 删除 `PANEL_ITEMS` 中的 `*-hub` 入口（第 82/103/123/139/155 行） | 低 |
| 4 | 各 `*App.tsx` | 确认各 App 内部已默认渲染 HubPage 作为根路由 | 中 |
| 5 | `routes.ts` | 移除 `/input/hub`、`/analysis/hub` 等 Hub 路由 | 低 |
| 6 | 相关测试 | 更新 PortalShell 测试 | 中 |

#### 可行性评估

- **风险等级**: 中（路由行为变更，可能影响用户已有的 `/hub` 书签）
- **预计工作量**: 2-3 小时
- **测试影响**: PortalShell 测试、各 App 路由测试
- **前置条件**: 需确认各 `*App.tsx` 内部是否已将 HubPage 作为默认子路由
- **可行性**: ? **可行**，但需先验证各 App 内部路由结构

#### 关键决策点

> **决策2**: 是否保留 `/hub` 路由（重定向到父路径）？
> - 方案A: 直接删除 `/hub` 路由，不保留重定向（简洁但破坏书签）
> - 方案B: 保留 `/hub` 路由但重定向到父路径（兼容但增加复杂度）
> - **建议**: 方案B（向后兼容）

---

### 3.3 偏差3：news-v6/ 和 newsStore.ts 残留

#### 当前状态精确定位

- **`src/pages/analysis/`**: 8 个文件（NewsPage.tsx、types.ts、6 个组件）
- **`src/store/analysisNewsStore.ts`**: 225 行，与 news-v6 循环依赖（3 处 import）
- **`src/config/routes.ts`**: 第 277-281 行仍注册 `/analysis/news-v6` 路由
- **引用关系**: newsStore 仅被 news-v6 内部引用，无外部消费者
- **新版替代**: `/analysis/news` → `analysis/NewsPage` → `analysisNewsStore` 已完整运行

#### 修复方案

| 步骤 | 文件 | 修改内容 | 复杂度 |
|------|------|---------|--------|
| 1 | `routes.ts` | 移除第 277-281 行的 `/analysis/news-v6` 路由 | 低 |
| 2 | 删除 | `src/pages/analysis/` 整个目录（8 个文件） | 低 |
| 3 | 删除 | `src/store/analysisNewsStore.ts` | 低 |
| 4 | 删除 | `tests/news-v6/*.test.ts`（若存在） | 低 |
| 5 | 验证 | `grep -r "newsStore\|news-v6"` 确认无残留引用 | 低 |

#### 可行性评估

- **风险等级**: 低（死代码清理，无外部消费者）
- **预计工作量**: 0.5-1 小时
- **测试影响**: 可能需删除相关测试文件
- **可行性**: ? **完全可行**，零风险

---

### 3.4 偏差4：prototype/ 残留

#### 当前状态精确定位

- **`src/apps/input/`**: 6 个文件（BulkImportProto.tsx、DashboardProto.tsx、DataTestProto.tsx、HotSectorProto.tsx、InputPrototype.tsx、mockData.ts）
- **引用关系**: 仅内部互相引用，无外部消费者

#### 修复方案

| 步骤 | 文件 | 修改内容 | 复杂度 |
|------|------|---------|--------|
| 1 | 删除 | `src/apps/input/` 整个目录（6 个文件） | 低 |
| 2 | 验证 | `grep -r "prototype"` 确认无残留引用 | 低 |

#### 可行性评估

- **风险等级**: 低
- **预计工作量**: 0.5 小时
- **可行性**: ? **完全可行**

---

### 3.5 偏差5：文档版本校正

#### 修复方案

| 步骤 | 文件 | 修改内容 | 复杂度 |
|------|------|---------|--------|
| 1 | `../../reference/action-list.md` | 回退 5 项偏差的状态为"未修复"；新增校正审计记录 | 中 |
| 2 | `../../../CHANGELOG.md` | 新增"校正审计"条目，记录偏差发现和修正计划 | 中 |
| 3 | `06-routing-specs.md` | 统一版本号；删除 `/analysis/news-v6` 和 `/input/prototype` 条目；补充 14 条缺失路由 | 高 |
| 4 | `../03-architecture-standards.md` | 版本号升级；补充架构说明 | 中 |
| 5 | `../../reference/completeness-profile.md` | 区分批次命名；同步修复状态 | 中 |

#### 可行性评估

- **风险等级**: 低（纯文档修改）
- **预计工作量**: 2-3 小时
- **可行性**: ? **完全可行**

---

### 3.6 工作量汇总

| 偏差 | 复杂度 | 预计工时 | 风险 | 可行性 |
|------|--------|---------|------|--------|
| 偏差1: v6ScoreService 集成 | 高 | 4-6h | 高 | ? 可行 |
| 偏差2: PortalShell 单轨 | 中 | 2-3h | 中 | ? 可行 |
| 偏差3: news-v6 清理 | 低 | 0.5-1h | 低 | ? 完全可行 |
| 偏差4: prototype 清理 | 低 | 0.5h | 低 | ? 完全可行 |
| 偏差5: 文档版本校正 | 中 | 2-3h | 低 | ? 完全可行 |
| **合计** | — | **9-13.5h** | — | — |

---

## 四、阶段3：系统性调整方案（待批准）

### 4.1 执行批次规划

建议分为 **4 个批次**执行，按风险从低到高排列，每批次完成后等待确认再进入下一批次：

#### 批次 F1：低风险清理（偏差3 + 偏差4）

**目标**: 清除确认的死代码

**执行步骤**:
1. 删除 `src/pages/analysis/` 目录（8 个文件）
2. 删除 `src/store/analysisNewsStore.ts`
3. 移除 `routes.ts` 中 `/analysis/news-v6` 路由
4. 删除 `src/apps/input/` 目录（6 个文件）
5. 运行 `npx tsc --noEmit` + `npx vitest run` 验证
6. 更新文档

**预计工时**: 1-1.5 小时
**风险**: 低

---

#### 批次 F2：文档版本校正（偏差5）

**目标**: 使所有文档与实际代码状态一致

**执行步骤**:
1. 修正 `../../reference/action-list.md`：回退 5 项偏差状态
2. 更新 `../../../CHANGELOG.md`：新增校正审计条目
3. 修正 `06-routing-specs.md`：统一版本号，删除死路由，补充缺失路由
4. 升级 `../03-architecture-standards.md`：版本号和架构说明
5. 同步 `../../reference/completeness-profile.md`

**预计工时**: 2-3 小时
**风险**: 低

---

#### 批次 F3：PortalShell 单轨化（偏差2）

**目标**: 消除 CABIN_APPS/HUB_APPS 双映射

**执行步骤**:
1. 验证各 `*App.tsx` 内部路由结构
2. 删除 `HUB_APPS` 定义和 lazy import
3. 简化渲染逻辑
4. 删除 `PANEL_ITEMS` 中的 `*-hub` 入口
5. 处理 `/hub` 路由（建议重定向）
6. 更新测试
7. 运行全量回归验证

**预计工时**: 2-3 小时
**风险**: 中

---

#### 批次 F4：v6ScoreService 集成 v6-engine（偏差1）

**目标**: 统一评分主流程到 v6-engine

**执行步骤**:
1. 重写 `runV6Score()` 调用 `createV6Engine().calculateAll()`
2. 删除旧的 9 因子硬编码逻辑
3. 适配 `V6Score` 类型（建议方案A：向后兼容映射）
4. 重写 `v6ScoreService.test.ts`
5. 验证 `analysisStore`、`stockAnalysisStore` 调用方兼容性
6. 运行全量回归验证

**预计工时**: 4-6 小时
**风险**: 高

---

### 4.2 执行约束

1. **每批次完成后暂停**，运行 `tsc --noEmit` + `vitest run` 验证，等待用户确认
2. **批次 F1→F2→F3→F4 严格顺序执行**，不可跳过或并行
3. **文档更新与代码修改同步进行**，确保每批次结束时文档与代码一致
4. **以本次审计结果（而非历史整改记录）为基线**

### 4.3 验收标准

每个批次完成后需满足：
- `npx tsc --noEmit` → 0 错误
- `npx vitest run` → 所有测试通过（或仅存在与本次修改无关的历史遗留失败）
- `npx eslint` → 修改文件 0 错误
- 文档版本号与内容一致

---

## 五、审批请求

请确认以下事项：

1. **是否同意上述 4 批次（F1→F4）的执行顺序和方案？**
2. **偏差1（v6ScoreService 集成）的类型适配方案：方案A（向后兼容）还是方案B（扩展类型）？**
3. **偏差2（PortalShell）的 `/hub` 路由处理：方案A（直接删除）还是方案B（重定向）？**
4. **是否有其他需要优先处理的事项？**

---

*报告版本: v1.0.0 | 审计日期: 2026-07-04 | 状态: 待审批*
