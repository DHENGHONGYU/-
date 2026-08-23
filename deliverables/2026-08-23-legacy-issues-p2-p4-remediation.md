# 遗留问题整改报告（P1–P3 闭环，2026-08-23）

> **范围**：采集管线质量评价报告遗留问题整改第二轮——P1（tsc 残差 + 七维文案）、P2（维度 11–14 专用存储收尾）、P3（collectionPipeline 拆分）+ 门禁全绿 + 契约同频。
> **契约版本**：AGENTS.md v1.7.5 → v1.7.6 | data-collector-contract v1.0.3 → v1.0.4 | collection-contract v1.0.2 → v1.0.3
> **数据库**：DB_VERSION=38 / STORE_NAME 56 项（基线 28 + 增量 28）

---

## 1. P2 维度 11–14 专用存储（本轮收尾项）

前轮已完成代码侧八处注册；本轮补齐测试侧四处同步（此前遗漏导致回归）：

| 位置 | 修复 |
|------|------|
| `tests/collection-dry-run.test.ts` | `COLLECTION_ACTION_STORE` 补登记 `saveDimensionCollectData → dimensionCollectData` |
| `src/data/dataLayer.test.ts` | `Object.keys(dataLayer)` 计数 49→50（新增 `dimensionCollectData` 暴露） |
| `tests/blueprints/dataRelationship.test.ts` | STORE_NAME 计数 55→56 |
| `scripts/other/validate-data-consistency.ts` | `STORE_TO_TYPE_MAP` 显式登记 `dimension_collect_data → DimensionCollectDataRecord` |

## 2. P1 两项

1. **IndustryHeatmap.tsx 22 个 tsc 残差**：前轮已修复，本轮复验 0 错误；顺带修复 `tsc:test` 暴露的 2 个 e2e 测试文件 4 处残差（未用声明删除 + 可选链空值兜底）。
2. **「七维」过时文案统一**：9 个代码文件 + 8 个活跃文档统一为「十六维 / 采集策略配置（历史沿用"七维"命名）」。
   - **保留边界（事实性七维）**：`dataDimensions.ts` 进度展示域真 7 维、`collectionProgressService` 真 7 维、行业评分 V4 七因子、`sevenDim*` 历史标识符、`SevenDimConfigPage` 测试锁定 UI 标题。

## 3. P3 collectionPipeline.ts 拆分（facade 模式，API 零破坏）

`collectionPipeline.ts` 1555 行 → **facade ~440 行** + 7 个子模块（`src/services/data-collector/pipeline/`）：

| 子模块 | 职责 | 规模 |
|--------|------|------|
| `pipelineTypes.ts` | CollectionMode/NON_QUOTE_MODES/选项与结果类型 | ~93 行 |
| `pipelineMappings.ts` | resolveDimensionMode / DIMENSION_TO_ACTION / 源链解析 | ~200 行 |
| `pipelineEvents.ts` | emit / traceIdFor / emitTrace | ~56 行 |
| `pipelineAudit.ts` | auditRecord / 完整度上报 | ~89 行 |
| `pipelineWriters.ts` | writeDimensionData / quote·kline 写库 | ~162 行 |
| `pipelineDataGen.ts` | 非行情数据生成 / kimiai 增强 | ~147 行 |
| `pipelineHandlers.ts` | quote/kline/financial/non-quote 四类处理器 | ~500 行 |

**公开 API 锁定清单**（13 处消费方导入零破坏）：`runSingleTrace`、`runBatchTrace`、`createDefaultCollectionConfig`、`resolveDimensionMode`、`resolveQuoteChain`、`resolveKlineChain`、`getDimensionConfig`、`NON_QUOTE_MODES`、`DIMENSION_TO_ACTION`、`TraceResult`、`buildDefaultSourcePriority`、`upgradeDimensionsToPipeline`。

## 4. 测试断言适配：重试 × 熔断交互

`mockFallbackPolicy.spec.ts`「EWMA 指标积累」用例失败根因：P0-1 接通重试后，第一轮 sina 按 `maxRetries=2` 重试 3 次全部失败 → 连续失败达 `failureThreshold=3` → 熔断 open → 第二轮被 `canExecute` 跳过（`sinaOrder=0`）。**这是重试与熔断交互的预期行为**，断言改为容错模式（仿同文件既有用例）：健康源必被调用；若熔断未触发则要求成功源排序提前。

## 5. 全量套件失败归因（重要结论）

全量 `vitest run`（604 文件）出现 30 个失败文件，经 **stash 基线对照实验**逐一归因：

- **27 个为存量失败**（基线同样失败）：MCP 注册表清理遗留（`Server llm/pool not found`）、benchmark、UI 快照类、`daily-doc-validation` 等，与本系列改动无关，留待独立立项治理；
- **2 个为本系列引入并已修复**：dataLayer/dataRelationship 计数断言（见 §1）；
- **1 个为套件间干扰**：`useTradeReviewReport.test.ts` 单独跑稳定通过。

## 6. 门禁证据（2026-08-23）

| 门禁 | 结果 |
|------|------|
| `tsc` 全量 / `tsc:prod` / `tsc:test` | 0 / 0 / 0 |
| `audit:layers` | 0 违规 |
| `audit:acl-consistency` | 0 ERROR / 0 WARN |
| `audit:db-references` | 0 问题 |
| `validate:blueprint` | 56 Stores / 990 Interfaces |
| `validate:dataConsistency` | 0 |
| `audit:agents-consistency` | A1–A7 全过（v1.7.6） |
| 采集域 vitest（10 文件） | 251/251 通过 |

## 7. 遗留事项（下轮候选）

1. 存量失败 27 个测试文件治理（建议按 MCP 注册表、benchmark、UI 三类分批）；
2. 维度 15/16 仍写 `local_docs`，待专用存储立项；
3. `.skip` 标记与 `test:clean --exclude` 清单的已知失败登记已过时（`dataRelationship` 已修复通过），可清理。
