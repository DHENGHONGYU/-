---
title: "FinSightV9 下一阶段架构优化计划（v2，2026-08-10 更新）"
type: report
version: v1.0.0
last_updated: 2026-08-11
doc_id: V9-DOC-FM-DOCS-REPORTS-GOVERNANCE-NEXT-PHASE-ARCHI-003
tier: T2
maintainer: V9 Architecture Team
summary: "（自动补齐 frontmatter，待人工完善摘要）"
change_log:
  - version: v1.0.0
    changes: "补齐 frontmatter 元数据（baseline 2026-08-11，自动推断 type=report）"
    date: 2026-08-11
code_version: 2.0.0-rc.1
---
# FinSightV9 下一阶段架构优化计划（v2，2026-08-10 更新）

> 编制日期：2026-08-10
> 版本：v2（覆盖 v1 中 Phase 1/2 已完成项，新增 Phase 3 基于本轮治理经验的高频变更计划）
> 负责人：Architecture Governance
> 关联报告：`docs/reports/governance/tech-debt-governance-summary-phase-2-2026-08-10.md`

---

## 1. 背景与基线

### 1.1 已完成里程碑

| 阶段 | 内容 | 状态 | 完成日期 |
|------|------|------|----------|
| v1 Phase 1 | TradeReviewPage 拆分（580→147 行）+ Hook/组件 6 个 + 性能优化 + 测试 35 个 | ✅ 完成 | 2026-08-10 |
| v1 Phase 2 | directDataAPI 拆分（925→6 子模块，均 ≤200 行）+ 门禁修复 + 58 测试回归 | ✅ 完成 | 2026-08-10 |

### 1.2 当前架构基线

| 指标 | 当前值 | 目标值（下一阶段） | 差距 |
|------|--------|-------------------|------|
| 架构综合评分 | **83/100** | 88+ | +5 |
| >500 行文件数 | 2 | 0 | -2 |
| 200-500 行文件数 | 12 | 8 | -4 |
| 项目测试通过率 | 97.9% | 99%+ | +1.1pp |
| 剩余 Service 直接依赖页面数 | 7 | 0 | -7 |
| componentRegistry 注册一致性 | 85% | 98% | +13pp |
| 门禁脚本覆盖率 | 5/6 | 6/6 | +1 |

### 1.3 高频变更模块识别（基于近 30 天 git log 统计）

| 模块 | 变更次数 | 消费者数 | 平均 diff 行数 | 优先级 | 计划阶段 |
|------|----------|----------|----------------|--------|----------|
| `componentRegistry.ts` + 相关组件注册 | 21 次 | 45+ 组件 | +134/-89 | **P0** | Phase 3-1 |
| `Store/*Store.ts`（Zustand 各 Store） | 17 次 | 28 个页面 | +76/-41 | **P0** | Phase 3-2 |
| `ChipStrategyReviewPage.tsx` | 13 次 | 2 个 widget | +210/-150 | **P0** | Phase 3-3 |
| `sevenDimConfigStore.ts` + 采集链路 | 9 次 | 4 个 service | +95/-58 | P1 | Phase 4-1 |
| `docs/*` 文档与知识库 | 37 次 | — | 文档级 | P2 | 持续 |

---

## 2. 下一阶段（Phase 3）核心任务

### Phase 3-1：componentRegistry 解耦 + 注册一致性治理（P0，预计 2 天）

#### 问题
- 当前 componentRegistry 为单文件聚合注册，任意组件新增/修改均触发整个注册表 reload，HMR 效率 -40%。
- 4 类组件（atoms/organisms/templates/widgets）注册规范不统一，widget 额外携带 `widgetType` 导致已有测试 3 处 TS2353 错误（参见 v2.0 测试报告）。

#### 任务清单

| # | 任务 | 验收标准 | 预计行效 |
|---|------|----------|----------|
| 3-1-1 | 拆分 `componentRegistry.ts` → 按域 4 文件：`atomRegistry` / `organismRegistry` / `templateRegistry` / `widgetRegistry` | 每个 ≤200 行，主文件仅聚合 import | 主文件 -70% |
| 3-1-2 | 修复 `WidgetConfig` 类型缺失 `widgetType` 字段，同时同步 3 个测试用例（FundFlow/MarketIndices/ModelCompare） | tsc 0 新增错误，测试 100% 通过 | - |
| 3-1-3 | 新增 `scripts/audit/audit-component-registry.ts`：检查注册表中所有组件名是否与磁盘路径一致、是否存在死注册、是否缺少 `defaultProps` | 0 违规为通过 | 门禁 +1 项 |
| 3-1-4 | 构建 `registerComponent` 工厂函数，强制注入 componentId/displayName/defaultProps 三要素 | 新注册组件 100% 使用工厂函数 | 消灭"裸注册" |
| 3-1-5 | 新增单元测试 15 个，覆盖注册/注销/查找三流程 | 通过率 100% | - |

#### 预估收益
- 架构评分 +2pp
- HMR 重新构建时间从 3.2s → 1.1s（-66%）
- 组件注册一致性 85% → 99%

---

### Phase 3-2：7 个 Service 直接依赖页面迁移至 Store/Hook 防腐层（P0，预计 3 天）

#### 问题
剩余 7 个页面仍直接 `import xxx from '@/services/...'`，违反"页面 → Hook 防腐层 → Store/Service"的分层约束，导致这些页面无法被单独 HMR、无法被 Storybook 独立渲染。

#### 任务清单

| # | 页面文件 | Service 依赖 | 迁移目标 | 预估工作量 |
|---|----------|--------------|----------|------------|
| 3-2-1 | `pages/analysis/xxxPage.tsx` (x1) | `researchPoolService` | 新建 `useResearchPool` Hook + 复用 `researchPoolStore` | 0.5 天 |
| 3-2-2 | `pages/input/xxxPage.tsx` (x2) | `inputService` + `apiTestService` | 新建 `useInputSubmit` / `useApiTestDialog` Hook | 1 天 |
| 3-2-3 | `pages/cockpit/CockpitPage.tsx` + widget 容器 (x4) | `widgetService` + `kpiService` | 新建 `useCockpitWidgets` Hook，Widget 数据全部走 Store selector | 1.5 天 |

#### 每页面迁移流程（标准 SOP）
1. 读取页面文件，列出所有 `from '@/services/` 导入
2. 按职责分组（查询/写入/配置），每组创建一个 `useXxx` Hook
3. Hook 内所有 Store 订阅必须使用选择器，禁止 `useStore()` 裸订阅
4. Hook 内部如需直接调用 Service，必须用 `@ts-expect-error` 明确标记并添加 TODO 注释（后续迁移至 DataBridge）
5. 页面仅保留容器布局，业务逻辑调用替换为 Hook 返回值
6. 编写 Hook 级单元测试：Store selector 验证、useMemo 引用稳定性验证
7. 运行：`eslint --max-warnings=0` → `tsc --noEmit` → `audit:layers` → vitest，四步全绿

#### 预估收益
- Service 直接依赖页面数 7 → 0
- 跨层调用违规从当前 0（已修复）保持长期维持
- 可 Storybook 独立预览的页面比例 35% → 85%

---

### Phase 3-3：ChipStrategyReviewPage.tsx 拆分（P0，预计 1.5 天）

#### 问题
- 当前 1,345 行，是项目中第三大文件（仅次于 v2.0 前的 PoolBoard/directData）。
- 存在 3 处已知 tsc 错误：L372 `Argument of type 'string' is not assignable to parameter of type 'number'`，L935/942/949/956 `Cannot find name 'twBorder'`（合计 4 处）。
- 近 30 天变更 13 次，每次平均 diff +210/-150 行，合并冲突率最高。

#### 任务清单

| # | 子模块 | 预计行数 | 职责 |
|---|--------|----------|------|
| 3-3-1 | `hooks/useChipStrategyReview.ts` | ~180 | 策略评分加载 + 保存 + 导出 |
| 3-3-2 | `hooks/useChipStrategyChart.ts` | ~150 | 筹码分布图数据准备 + 事件处理 |
| 3-3-3 | `components/ChipSummaryCard.tsx` | ~100 | 筹码评分总览卡片 |
| 3-3-4 | `components/ChipDistributionChart.tsx` | ~180 | 筹码分布可视化（封装 `twBorder` 调用） |
| 3-3-5 | `components/ChipPeakAnalysisPanel.tsx` | ~120 | 峰位/峰宽/峰集中度分析 |
| 3-3-6 | `components/ChipBreakoutSignalPanel.tsx` | ~130 | 突破信号展示 |
| 3-3-7 | 主文件 `ChipStrategyReviewPage.tsx` | **≤200** | 纯容器，Hook + 组件拼装 |
| 3-3-8 | 修复 4 处 tsc 错误（twBorder 缺失 & 参数类型） | | 同拆分子模块时一并修复 |
| 3-3-9 | 新增测试用例 20 个（2 Hook × 8 + 5 组件 × 1 + 主流程 1） | | 100% 通过 |

#### 预估收益
- 主文件 1,345 → ≤200 行（-85%+）
- 4 处历史 tsc 错误清零
- 架构综合评分 +2pp（85 → 87）

---

## 3. Phase 4（P1，持续优化，预计 3-4 天）

### Phase 4-1：sevenDimConfigStore 拆分与采集链路一致性
- 将 `sevenDimConfigStore.ts` 的 9 个维度配置拆分为独立 `dimensionConfig/` 子目录（每维 1 文件）
- 新增 `scripts/audit/audit-collection-pipeline.ts`：检查采集链路七维配置 → 采集任务 → 存储 schema 三者字段名是否一致
- 预计修复 3-5 处字段名漂移

### Phase 4-2：Hook 独立测试补齐
- 针对 Phase 1/2 新产出的 4 个高变更 Hook 补充 Vitest：
  - `usePoolBoardCollect` 测试（进度模拟 + 断连模拟）
  - `useTradeReviewKline` 测试（K 线周期切换 + 买卖点 marker 生成）
  - `useStrategyExport` 测试（快照导出 + 分类映射）
  - `useChipStrategyChart` 测试（Phase 3-3 产物）
- 目标每个 Hook 至少 12 个用例，累计 +48 个

### Phase 4-3：自动化门禁加固
- 将 ESLint + tsc + audit-layer-calls + audit-component-registry（Phase 3-1 新增）4 项统一封装为 `npm run gate:phase3`
- 在 husky `pre-push` 钩子中默认执行（pre-commit 仅执行 ESLint+tsc，push 阶段执行全量审计）
- 新增 lint custom rule：`no-unselected-store-subscription`，禁止 `useStore()` 裸调用

---

## 4. 门禁与验收标准

### 4.1 每阶段必须通过的门禁（Checklist）

每完成一个 Phase，**必须**绿码通过：

```
□ ESLint（--max-warnings=0）对所有改动文件
□ TypeScript tsc --noEmit 0 新增错误
□ audit-layer-calls.ts 0 违规
□ 若涉及组件注册：audit-component-registry.ts 0 违规（Phase 3-1 后启用）
□ 所有新增测试 100% 通过
□ 所有旧有相关测试回归 100% 通过
□ 目标文件行数 ≤200（主文件）或 ≤250（Hook/复杂 Provider）
□ 相关文档（知识库条目 + 治理报告章节）同步更新
```

### 4.2 最终验收（Phase 4 结束后）

| 验收项 | 目标值 |
|--------|--------|
| 架构综合评分 | ≥88/100 |
| >500 行文件 | 0 个 |
| 200-500 行文件 | ≤8 个 |
| 测试通过率 | ≥99% |
| 剩余 Service 直接依赖页面数 | 0 |
| 门禁脚本覆盖率 | 7/7（新增 component-registry、collection-pipeline、no-unselected-store-subscription）|

---

## 5. 执行时间表（建议）

| 阶段 | 工作内容 | 预计天数 | 建议开始 | 前置条件 |
|------|----------|----------|----------|----------|
| Phase 3-1 | componentRegistry 解耦 + 注册一致性 | 2 天 | 2026-08-11 | — |
| Phase 3-2 | 7 个 Service 直接依赖页面迁移 | 3 天 | 2026-08-13 | 3-1 完成（组件注册规范确定） |
| Phase 3-3 | ChipStrategyReviewPage 拆分 | 1.5 天 | 2026-08-14 | 可与 3-2 并行 |
| Phase 4-1 | sevenDimConfigStore + 采集链路审计 | 1.5 天 | 2026-08-18 | Phase 3 完成 |
| Phase 4-2 | Hook 测试补齐（48 用例） | 2 天 | 2026-08-19 | 随 Phase 3 分块产出 |
| Phase 4-3 | 门禁加固 + 文档同步 | 1 天 | 2026-08-21 | 全阶段完成 |
| **合计** | | **11 天** | **2026-08-11 至 2026-08-21** | |

---

## 6. 风险缓解

| 风险项 | 可能性 | 影响 | 缓解措施 |
|--------|--------|------|----------|
| Phase 3-2（7 页面迁移）消费者引用漂移 | 中 | 高 | 迁移前先运行 `npx tsx scripts/audit/audit-component-usage.ts` 列出引用清单，并在 PR 中提供 import 替换对照表 |
| ChipStrategyReviewPage 拆分遗漏 twBorder 依赖 | 中 | 中 | 先修复 twBorder 错误（L935 等 4 处），再拆子组件；所有边框调用统一封装进 `ChipDistributionChart.tsx` |
| 门禁脚本新增导致 pre-push 阻塞过久 | 低 | 中 | 拆分 pre-commit（快速，ESLint+tsc）和 pre-push（全量，5 个脚本），push 脚本设 5 分钟超时 |
| 测试用例 48 个新增导致 CI 时长 >10min | 低 | 低 | Hook 测试启用 `vitest --shard`，或按 `--testNamePattern` 并行分组 |

---

## 7. 关联文档

| 文档 | 路径 |
|------|------|
| Phase 2 补充治理完整总结报告 | `docs/reports/governance/tech-debt-governance-summary-phase-2-2026-08-10.md` |
| 知识库同步条目 | `docs/knowledge-base/KB-TECH-DEBT-20260810-01-phase2-governance-sync.md` |
| 原 v1 架构优化计划 | `docs/reports/governance/next-phase-architecture-optimization-plan-2026-08-10.md` |
| v2.0 技术债治理报告 | `docs/reports/governance/tech-debt-governance-summary-2026-08-10.md` |
