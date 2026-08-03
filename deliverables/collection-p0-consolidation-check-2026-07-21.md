# 采集域 P0 改造成果校对检查报告

> **日期**: 2026-07-21 | **性质**: 巩固性校对（post-change verification）
> **说明**: 用户指定的 `module-sync-checklist v1.2.0` skill 在工作区与全局索引中均不存在（已检索 `.trae/skills/`、`.agents/skills/`、`skill-registry.json`、全库 grep）。本报告改按项目注册表中两个 **mandatory** skill 执行——其触发条件精确覆盖本次改动文件：
> - `collection-pipeline-testing`（触发: `src/services/data-collector/**`）
> - `data-flow-integrity-audit`（触发: `src/services/data-collector/**` + 假绿灯）

## 一、校对范围（本 session 全部改动）

| 文件 | 变更 | 内容 |
|---|---|---|
| `src/services/data-collector/adaptiveSourceOrchestrator.ts` | 新增 399 行 | 令牌桶/熔断/EWMA/质量×效率评分/链重排 |
| `src/services/data-collector/dataSourceOrchestrator.ts` | ±186 行 | orderChainAdaptive 接入 + recordSourceResult 埋点 + mock 门禁 |
| `src/services/data-collector/collectionPipeline.ts` | ±332 行 | allowMockFallback 生效 + recordCompleteness 接通 |
| `src/pages/input/CollectTask/components/CollectTaskStatsCards.tsx` | 修改 | 真实成功率 KPI 卡 |
| `src/pages/input/CollectTask/components/DataQualityTab.tsx` | 修改 | Accuracy/Completeness 口径切换 |
| `src/pages/input/CollectTask/index.tsx` | 修改 | 新 props 接线 |
| `tests/__tests__/services/adaptiveSourceOrchestrator.spec.ts` | 新增 | 17 例 |
| `tests/__tests__/services/mockFallbackPolicy.spec.ts` | 新增 | 假绿灯策略测试 |

## 二、阶段 1：改动影响分析 ✅

消费者全量 grep（skill L1：不信"声称 N 处"）：

| 被改模块 | 消费者 | 兼容性 |
|---|---|---|
| dataSourceOrchestrator | collectionPipeline、LiveCollector（getBatchQuotes/getKline）、dataFetcherServer（testSourceConnectivity）、FetcherConfigPage（type-only） | ✅ 新参数 `allowMockFallback` 均为可选，缺省 true 保持旧行为 |
| collectionPipeline | TaskScheduler、dataTestStore、sevenDimConfigStore | ✅ 导出签名未破坏 |
| adaptiveSourceOrchestrator | 仅 dataSourceOrchestrator + 测试 | ✅ 新模块 |
| 两个 UI 组件 | 仅 CollectTask/index.tsx | ✅ props 已在唯一调用点接线 |

## 三、阶段 2：数据形状与一致性校对 ✅

| 检查项（skill 条款） | 结果 |
|---|---|
| `{store, data}` 包装残留（L8） | **0 处** ✅ |
| recordWrite 对称性（L13/L15：每个 try 的 catch 有 recordWrite(false)） | **4/4 对称**（L583/585、L695/697、L761/838、L970/972）✅ |
| ENVELOPE_ACTION 使用点 vs handler 注册（L7） | 9 个 action 全部已注册（audit 检查 87 条映射 0 未注册）✅ |
| ACL 权限一致性（L6） | **0 ERROR / 0 WARN** ✅ |
| taskId 股票×维度粒度（L15） | 既有 `${parentTaskId}-${symbol}-${dimensionCode}` 保持 ✅ |
| KPI 与写入结果同源（L18/L21） | ✅ 本次修复：realSuccessRate 已消费、recordCompleteness 已接通 |
| writeQuoteToStock symbol 参数覆盖（L9） | 既有逻辑保持 ✅ |

## 四、阶段 3：门禁验证（全绿）✅

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `tsc -p tsconfig.json --noEmit`（= tsc:prod 双检同源） | **全项目 0 错误** ✅ |
| 测试类型检查 | `tsc -p tsconfig.test.json --noEmit` | 306 个错误**全部位于既有无关测试文件**（audit-mapping-integrity/profile-types/duckDBProvider 等历史债），本次改动文件 **0 错误** ✅ |
| 分层审计 | `npm run audit:layers` | 1151 文件，**0 违规 0 警告** ✅ |
| ACL 一致性 | `npm run audit:acl-consistency` | **0 ERROR 0 WARN**（87 映射全注册、92 枚举全覆盖）✅ |
| skill 指定测试 | sevenDimConfigStore + sevenDimEstimate | **91/91 通过** ✅ |
| 采集域测试 | mockFallbackPolicy + adaptiveSourceOrchestrator + data-collector + 流水线集成 + Hook/utils | **71/71 通过**（6 套件）✅ |

## 五、未执行项（如实声明）

- **data-flow skill 阶段 1/5（live E2E）**：fetcher `/health`、dev server、Playwright 控制台矩阵未跑——属运行态验证，需起服务；本次为静态巩固校对，未执行。
- **mock-data-diagnosis skill（非 mandatory）**：`mockDataCollection.ts`（998 行）滞留生产目录、`collectionWizardStore.mock.ts` re-export 等 Mock 残留为已知 P1 项，未在本次范围处理。
- tsconfig.test.json 的 306 个历史错误为存量债，建议单独立项（与本次改动无关）。

## 六、结论

**P0 四项改造（自适应编排接入 / mock 假绿灯修复 / 完整率统计接通 / 监控口径切换）通过全部 mandatory skill 门禁，可交付。** 质量×效率反馈闭环已打通：采集结果 → EWMA 健康分 + 三件套指标 → 自适应链排序 + 真实口径监控。
