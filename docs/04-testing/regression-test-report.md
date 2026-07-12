# 股票池看板迁移回归测试报告

## 测试范围
- 代码审查与校对：迁移涉及的全部新增/修改文件。
- 构建验证：生产构建是否通过。
- 静态门禁：跨层调用、文档同步、硬编码、令牌合规、路由校验、ESLint、TypeScript。
- 单元测试：新增聚合服务单测与既有 store 单测。
- 依赖图与运行时行为：确认输入舱/分析舱职责边界清晰。
- 既有债务治理：`CollectTaskPage` 颜色令牌化、路由注册表一致性清理。

## 发现与修复

### 🔴 已修复问题

| # | 问题 | 位置 | 修复方式 |
|---|---|---|---|
| 1 | 分组筛选未生效：`selectedGroup` 只设置状态，未参与 `filteredStocks` 计算 | `src/hooks/useStockPoolBoard.ts` | 在 `filteredStocks` 中先按 `selectedGroup` 过滤，再按质量状态过滤 |
| 2 | `useMemo` 不必要依赖警告 + 依赖 `getAllGroups()` 内部读取 store | `src/hooks/useStockPoolBoard.ts` | 改为从 `stocks` 直接聚合分组，导入 `DEFAULT_POOL_GROUP` |
| 3 | `navigate(...)` 浮游 Promise 警告 | `src/hooks/useStockPoolBoard.ts` | 改为 `void navigate(...)` |
| 4 | 条件渲染中可空字符串隐式转换警告 | `src/pages/analysis/StockPoolBoardPage.tsx` | `Boolean(board.message \|\| board.error)` |
| 5 | Promise 回调传给期望 void 的属性 | `src/pages/analysis/StockPoolBoardPage.tsx` | `onTransition={(s, st) => void board.handleTransition(s, st)}` 等 |
| 6 | `t.progress ?? 0` 不必要条件 | `src/services/data-collector/collectionReportService.ts` | 改为 `t.progress`（类型为 `number`） |
| 7 | 可空数字三元表达式建议改用 `??` | `src/services/data-collector/collectionReportService.ts` | `s.completedAt ?? s.startedAt` |
| 8 | 可空字符串数组过滤条件 | `src/services/data-collector/collectionReportService.ts` | `s.error != null` |
| 9 | 时间格式化函数可空数字隐式转换 | `src/services/data-collector/collectionReportService.ts` | `timestamp == null` 等显式判断 |
| 10 | 输入舱看板残留 `allGroups` 未使用 | `src/apps/input/InputDashboard.tsx` | 移除 `getAllGroups` 相关代码 |
| 11 | 路由校验脚本缺失 `/input/collect-tasks` | `scripts/verify-all-routes.ts` | 在 input 预期路径中补录 |
| 12 | `CollectTaskPage`「评分分析」Tab 使用硬编码 Tailwind 颜色类 | `src/pages/input/CollectTaskPage.tsx` | 保留 Tab；将 `border-l-primary`、`text-primary`、`bg-primary`、`border-l-emerald-500`、`border-l-amber-500`、`border-l-rose-500` 改为 `COLOR_TOKENS.*.hex` 内联样式 |
| 13 | `/trading/risk` 在 `ROUTE_REGISTRY` 中重复注册 | `src/config/routes.ts` | 删除早期重复条目，保留「风险控制管理」 |
| 14 | 路由预期列表与实际注册表不一致 | `scripts/verify-all-routes.ts` | 移除过期的 `/analysis/news-v6`、`/trading/hub`；补充 29 条真实孤儿路由到预期列表 |

### 🟡 非本次迁移引入的既有问题

| 位置 | 问题 | 说明 |
|---|---|---|
| `src/services/hybrid-proofread/reportGenerator.ts` | 24 处 HEX 颜色硬编码 | 令牌扫描基线已记录，当前 24 处等于基线 24 处；迁移文件无新增。 |
| `src/portal/PortalShell.tsx` | 8 条 ESLint 警告 | 数字魔数、浮游 Promise 等，均非本次新增导航条目引入。 |

## 验证结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| 生产构建 | `npm run build` | ✅ 通过 |
| TypeScript 类型检查 | `npm run tsc:prod` | ✅ 通过（exit 0，无报错） |
| 跨层调用审计 | `npm run audit:layers` | ✅ 0 违规 |
| 文档同步审计 | `npm run audit:docs` | ✅ 0 违规 |
| 硬编码审计 | `npm run audit:hardcode` | ✅ 通过（仅既有 Warning，无新增） |
| 路由一致性审计 | `npm run audit:routes` | ✅ 通过（62/62 覆盖，0 孤儿 / 0 重复 / 0 缺失） |
| ESLint（新增/修改文件单文件扫描） | `eslint <file>` | ✅ 迁移文件全部 0 error；`CollectTaskPage` 6 条 warning 为 `strict-boolean-expressions` |
| 令牌合规 | `scripts/token-scan.cjs --json` | ✅ 通过（当前 24 处 = 基线 24 处）；迁移文件无新增 HEX/裸色类 |
| 单元测试 | `vitest run src/services/data-collector/collectionReportService.test.ts` | ✅ 8/8 通过 |

## 职责边界确认

| 页面 | 所属舱室 | 职责 | 是否包含采集进度/汇报 |
|---|---|---|---|
| `/analysis/stock-pool` | 分析舱 | 股票池管理：视图切换、分组筛选、质量筛选、批量归档/移组、新建分组、个股流转、刷新行情、跳转个股评分 | ❌ 否（已彻底移除） |
| `/input/collect-tasks` | 输入舱 | 采集任务监控：任务列表、维度健康度、实时日志、时间线、泳道图、回放、**8 维度采集进度与汇报**、评分分析 | ✅ 是 |
| `/input`（InputDashboard） | 输入舱 | 录入看板：候选池、统计卡片、快捷操作 | ❌ 否（股票池看板已移除） |

## 结论

**迁移、职责拆分与既有债务治理均已完成，结论成立。**

- 输入舱股票池看板相关状态、事件、UI 已完全移除。
- 分析舱 `/analysis/stock-pool` 独立页面专注股票池管理，不再承载采集展示职责。
- 8 维度采集进度展示与采集汇报面板已迁移至 `/input/collect-tasks`，符合输入舱「数据采集」的板块功能定位。
- 「评分分析」Tab 已保留并按令牌规则修复颜色硬编码。
- 路由注册表一致性已治理：`ROUTE_REGISTRY` 删除重复 `/trading/risk`，`EXPECTED_PATHS` 补全真实页面并移除过期条目，覆盖率 62/62（100%）。
- 所有关键质量门禁（build / tsc:prod / audit:layers / audit:docs / audit:hardcode / audit:routes / token-scan）全部通过。
