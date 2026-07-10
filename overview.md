# 股票池看板迁移 + 采集进度汇报 + 既有债务治理完成

## 完成内容
- 将原「输入舱」中的股票池看板迁移到「分析舱」，新建独立路由 `/analysis/stock-pool`。
- 将 8 维度采集进度展示与采集情况汇报面板从分析舱股票池看板剥离，按「采集展示归采集任务」原则迁移至 `/input/collect-tasks`（输入舱 - 数据采集）。
- 在 `/input/collect-tasks` 新增「进度汇报」Tab，展示维度进度条与采集汇报卡片。
- 原输入舱左侧导航保留「股票池看板（已迁分析舱）」跳转入口，并新增「采集任务监控」入口；原看板卡片及状态已移除。
- 保留「评分分析」Tab，并将其中的硬编码 Tailwind 颜色类改为 `COLOR_TOKENS` 令牌（`style={{ color/borderLeftColor/backgroundColor: COLOR_TOKENS.*.hex }}`）。
- 统筹处理既有路由治理债务：
  - 删除 `ROUTE_REGISTRY` 中重复的 `/trading/risk`；
  - 从 `EXPECTED_PATHS` 中移除过期的 `/analysis/news-v6`、`/trading/hub`；
  - 补充 29 条真实孤儿路由到预期列表，使路由覆盖率达到 62/62（100%）。
- 同步更新 `scripts/verify-all-routes.ts`。

## 关键文件
- 新增页面：`src/pages/analysis/StockPoolBoardPage.tsx`
- 新增组件：`src/components/collection/CollectionProgressPanel.tsx`、`CollectionReportPanel.tsx`
- 新增 Hook：`src/hooks/useStockPoolBoard.ts`
- 新增服务：`src/services/data-collector/collectionReportService.ts`
- 新增测试：`src/services/data-collector/collectionReportService.test.ts`
- 路由：`src/config/routes.ts`、`src/apps/analysis/AnalysisApp.tsx`、`scripts/verify-all-routes.ts`
- 输入舱采集页：`src/pages/input/CollectTaskPage.tsx`
- 导航：`src/portal/PortalShell.tsx`
- 输入舱清理：`src/apps/input/InputDashboard.tsx`
- 文档：`docs/06-routing-specs.md`、`docs/04-ui-ux-specs.md`、`docs/08-implementation-plan.md`、`docs/proposals/stock-pool-board-migration-proposal.md`
- 回归报告：`regression-test-report.md`

## 验证结果
- `npm run build` ✅ 通过
- `npm run tsc:prod` ✅ 通过（exit 0，无报错）
- `audit:layers` ✅ 0 违规
- `audit:docs` ✅ 0 违规
- `audit:hardcode` ✅ 通过（仅既有 Warning）
- `audit:routes` ✅ 通过（62/62 覆盖，0 孤儿 / 0 重复 / 0 缺失）
- 令牌扫描 ✅ 通过（24 = 基线 24）
- 单元测试 ✅ `collectionReportService.test.ts` 8/8 通过

## 结论
迁移、职责拆分与既有债务治理均已完成，结论成立。所有关键质量门禁全部通过。

---

## 补充：原子组件体系重构（阶段 1 收尾验证）

在迁移/拆分基础上，将组件库重构为 Atomic Design 四层体系，并补齐最小元素单位核查。

### 完成内容
- 建立 `src/components/{atoms,molecules,organisms,templates}/` 四层目录，并各自提供 `index.ts` 桶导出。
- 新增分子组件：`FormField`（Label+Input+错误）、`MetricCard`（标题+数值+趋势）、`SearchBar`（Input+Icon+Button）、`FilterChip`（可关闭标签）。
- 新增模板：`DashboardLayout`、`SidebarLayout`、`CockpitLayout`。
- 新增 `componentRegistry.ts`，按原子层级登记组件，支持 `groupByLevel` 等查询。
- 将组织级组件归入 `organisms/`：`organisms/pool/`（PoolBoard/PoolCard/PoolColumn/PoolList）、`organisms/collection/`（CollectionProgressPanel/CollectionReportPanel）。
- 旧路径 `components/collection/*`、`components/pool/*` 重建为纯 re-export shim（`export * from '@/components/organisms/...'`），保持全量引用兼容、零改动成本。
- 修复 `FilterChip.tsx` 中 `hover:bg-black/10` 硬编码，改为令牌类。
- 更新 `CollectTaskPage`、`StockPoolBoardPage`、`useStockPoolBoard` 的导入指向 shim/原子层级路径。
- 同步文档：`docs/atomic-component-system.md`（新建，含层级定义/目录/映射/迁移路径/门禁）、`docs/04-ui-ux-specs.md`（4.5 组件库清单）、`docs/08-implementation-plan.md`。

### 验证结果（2026-07-10 收尾）
- `npm run build` ✅ 通过（20.75s，产物正常）
- `npm run tsc:prod` ✅ 通过（exit 0，无类型错误）
- `audit:layers` ✅ 0 违规（856 文件）
- `audit:routes` ✅ 62/62 覆盖，0 孤儿 / 0 重复 / 0 缺失
- `audit:tokens` ✅ 0 硬编码（892 文件）
- `lint:colors` ✅ 通过
- `audit:docs` ✅ 0 违规
- `audit:hardcode` ⚠️ 仅既有 28 处「静默回退」Warning（`marketDataStore.ts` 的 `|| ""`），与本次重构无关、退出码 0 不阻塞

### 结论
原子组件体系阶段 1（体系建立 + 本次组件落位 + shim 兼容）已完成，全部门禁通过，无回归。后续按文档阶段 2–5 推进 `ui/` 物理迁移与 shim 清理。
