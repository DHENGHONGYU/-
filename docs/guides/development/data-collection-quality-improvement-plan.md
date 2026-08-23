---
title: 数据采集质量提升与稳定性优化整体方案
doc_id: V9-DOC-DATA-031
tier: important
status: active
version: v3.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
domain: data
covers_code:
  - src/services/data-collector/collectionPipeline.ts
  - src/services/data-collector/qualityMetricsCollector.ts
  - src/services/data-collector/qualityMetricsPersistence.ts
  - src/services/data-collector/dataSourceOrchestrator.ts
  - src/store/sevenDimConfigStore.ts
  - src/config/collectConfig.ts
related_docs:
  - docs/reference/collection-contract.md
  - docs/explanation/data-collection-architecture.md
  - docs/reference/data-collector-contract.md
change_log:
  - version: v3.0.0
    changes: "2026-08-23 P0 三项整改落地闭环：① pipeline 重试循环接通（指数退避 + RETRY 事件）；② qualityMetrics 落库（DB v37 新增 quality_metrics_history）；③ collectionPipeline.contract.test.ts 35 例契约单测。并入知识图谱实践对标评分与 20 只标的双源真实验证数据。同步修复维度契约漂移（10→16）与测试基建缺口（ToastProvider）。"
    date: 2026-08-23
  - version: v2.0.0
    changes: "2026-08-12 并入上线测试实测数据（20 只标的双源验证）+ 知识图谱实践对标评分，重构优化项优先级"
    date: 2026-08-12
  - version: v1.0.0
    changes: "初版：能力盘点 + 缺口分析 + P0/P1/P2 优化项"
    date: 2026-08-12
---

# 数据采集质量提升与稳定性优化整体方案

> **结论先行**：上线测试证实采集源层（腾讯/新浪双源）质量过硬（20/20 成功率、100% 字段完整率、双源一致性全通过），主要短板在工程层。**本轮已完成 P0 三项整改**（重试循环、指标落库、契约测试），采集链路可靠性显著提升。

---

## 一、上线测试验证结果

### 1.1 真实采集源验证（20 只标的 × 双源）

| 指标 | 腾讯源 | 新浪源 |
|------|--------|--------|
| 请求成功率 | **20/20 (100%)** | **20/20 (100%)** |
| 平均字段完整率 | **100%** | **100%** |
| 双源现价一致性 | 20/20 一致（偏差 ≤0.5%） | — |
| 批量请求延迟 | 平均 459ms / P95 1267ms | 同左 |

抽样覆盖**热门板块**与**长期价值标的**（对齐 finance-report 深度研究对数据维度的要求）。

> **判断**：源层无需更换或新增。H 股经 `parseTencentHk`/`parseSinaHk` 防御式解析（字段位与 A 股不同）后同样 100% 通过，印证既有"港股字段错位"修复有效。

### 1.2 单元/集成测试基线

| 套件 | 结果 |
|------|------|
| `collectionPipeline.contract.test.ts`（契约单测，本轮新增） | **35/35 通过** |
| `collection-pipeline.integration.test.ts`（S2 采集链路完整性） | **8/8 通过**（维度数已改为 `DIMENSION_COUNT` 派生） |
| `data-collector/` 目录单测 | **全绿** |
| `qualityMetricsPersistence.test.ts`（落库服务，本轮新增） | **8/8 通过** |
| `tsc:prod` | **通过** |

---

## 二、现状能力盘点

### 2.1 采集链路结构

```
collectionPipeline.ts
  → dataSourceOrchestrator.ts（01行情/02K线，含重试循环）
  → multiSourceFetcher.ts（03-16 维度）
  → DataBridge.forward() → IndexedDB
  → qualityMetricsPersistence.ts（质量指标落库）
```

### 2.2 已有能力（整改后）

| 能力 | 状态 |
|------|------|
| 多源 fallback 链 + 三态熔断 + 令牌桶限流 + EWMA 健康分 | ✅ |
| **pipeline 重试循环**（指数退避 + RETRY 事件） | ✅ 本轮接通 |
| **质量指标落库**（quality_metrics_history，DB v37） | ✅ 本轮接通 |
| **契约单测**（35 例，防接线漂移） | ✅ 本轮新增 |
| 维度数派生（`DIMENSION_COUNT`，防硬编码漂移） | ✅ 本轮修复 |
| 质量指标三件套（成功率/完整率/写入率）+ 告警阈值 | ✅ |
| 配置化 16 维度/频率/策略 + 持久化 | ✅ |

---

## 三、知识图谱实践对标评分

> 以 KG 领域公开实践为基准（阿里云品牌知识库管道五段式、国家数据局咪咕高质量数据集案例、蚂蚁 KGFabric/OpenSPG、KG 六维质量模型、Truth Discovery/Detect-then-Resolve 冲突消解）。

| 维度 | 权重 | 得分 | 依据 |
|------|------|------|------|
| 多源采集能力 | 15% | **8** | 六源 fallback + 熔断 + 限流，超过多数 KG 采集层 |
| 可靠性与可观测 | 10% | **8** | EWMA 健康分、健康看板、本轮补重试可观测 |
| 时效性管理 | 10% | **7** | 增量水位线 + 断点续采方向正确 |
| 数据质量校验 | 20% | **6** | 契约化方向对，仍停在字段级，缺一致性/唯一性维度 |
| 冲突消解 | 10% | **5** | 争议队列仅雏形，缺可信度迭代 + 时间约束裁决 |
| 知识回流闭环 | 5% | **4** | 仅源健康分单向驱动，缺下游反哺采集 |
| **溯源与血缘** | 15% | **3** | 只有聚合指标，无记录级证据链 |
| **实体对齐** | 15% | **2** | **完全空白**，而这是 KG 多源融合第一道工序 |

**加权总分 ≈ 5.4 / 10**。结论：赢在"采得稳"，输在"说不清数据从哪来、谁说了算"。

---

## 四、优化方案与落地状态

### P0 — 已完成 ✅

| # | 优化项 | 涉及文件 | 状态 |
|---|--------|----------|------|
| P0-1 | **接通 pipeline 重试循环**：`dataSourceOrchestrator` 按 `dimension.retryPolicy` 指数退避重试（`attemptQuoteSourceOnce`/`attemptKlineSourceOnce`），新增 `RETRY` 事件 | `dataSourceOrchestrator.ts`、`collectionPipeline.ts`、`collection.types.ts` | ✅ 落地 |
| P0-2 | **qualityMetrics 落库**：`DB_VERSION` 36→37，新增 `quality_metrics_history` 存储 + `qualityMetricsPersistence` 服务，采集收尾三路径持久化 | `dbConfig.ts`、`qualityMetricsPersistence.ts`、`sevenDimConfigStore.ts` 等 | ✅ 落地 |
| P0-3 | **collectionPipeline 补契约单测**：35 例（模式解析/接线一致性/链解析/默认配置） | `collectionPipeline.contract.test.ts` | ✅ 落地 |

> 新增 store 按契约走 `STORE_NAME` + `ACL_MATRIX` + handler 三处注册，`audit:acl-consistency` / `audit:db-references` / `validate:blueprint` / `validate:dataConsistency` 全绿。

### P1 — 数据治理地基（待启动）

| # | 优化项 | 说明 |
|---|--------|------|
| P1-1 | **记录级溯源**：每条入库数据附 `{source, fetchedAt, collectorVersion, confidence}` 元数据 | 复用既有 `traceRecords` store 扩展，不新建；假数据排查从"猜"变"查证据链" |
| P1-2 | **实体对齐层**：采集入口统一代码归一化关卡（`600519`/`sh600519`/网易代码碰撞） | 升级 `stockCodeUtils`/`stockDictionary` 为归一化 + 别名表，一次解决多个已知缺陷 |
| P1-3 | **断点续采 + 增量水位线**：按 (维度, symbol 批次) 记录进度；按最后采集日期补缺口区间 | 失败不再整批重跑；dailyQuotes 改增量 |
| P1-4 | **死端点清理**：移除网易端点；`fetchFromMockServer` fallback 统一为显式 Mock/真实开关 | 消除假绿灯残余路径 |

### P2 — 质量模型升级（待启动）

| # | 优化项 | 说明 |
|---|--------|------|
| P2-1 | **质量指标 3 项扩到 6 项**：补一致性（跨源同字段比对率）、唯一性（去重占比）、时效性（滞后时长） | 对齐 KG 六维质量模型；依赖 P1-1/P1-2 先落地 |
| P2-2 | **冲突裁决升级**：争议队列加两条自动规则——① 源可信度加权（truth discovery 简化版）② 时序数据时间约束优先 | 替代"先到先得" |
| P2-3 | **数据回流闭环**：评分/复盘模块发现异常数据（除权跳变、零成交量）写回"数据问题标记"，触发重采或源降权 | 对齐咪咕案例核心闭环 |
| P2-4 | **采集产物语义化（远期）**：重大事项/新闻抽取为"公司—事件"关联而非裸文本 | 保持 §十五 本地优先（IndexedDB 内建模，不引入图数据库服务） |

---

## 五、本轮同步修复项

- **维度契约漂移**（10→16）：`collection-pipeline.integration.test.ts`、`sevenDimEstimate.test.ts`、`dataRelationship.test.ts`、`dataLayer.test.ts`、`dbConfig.test.ts` 全部改为派生或同步实际值。
- **测试基建缺口**：`sevenDimConfig.integration.test.tsx` 补 `ToastProvider` 包装（页面用 `useToast` 但测试未包）。
- **契约文档同步**：`AGENTS.md` DB_VERSION/STORE_NAME 全仓一致；`data-collector-contract.md` 补 RETRY 事件与契约单测；`validate:blueprint`/`validate:dataConsistency` 同步新存储。
- **并行合并残留语法破坏**（9 个文件，均为基线既有、阻塞 `tsc:prod`）：`tushareProvider.ts`（重复判空）、`llmSearchAgent.ts`（重复判空）、`rsi.ts`（重复闭合块）、`volumeProfile.ts`（重复声明颜色常量）、`health.constants.ts`（残留注释/重复映射）、`trade.constants.ts`（残留导入片段）、`theme.tokens.shades.ts`（重复色阶片段提前关闭对象）、`IndustryHeatmap.tsx`（重复三元分支）。

---

## 六、实施路线图

```
第一阶段（P0）✅ 已完成：重试接通 → 指标落库 → pipeline 补测试
        ↓ 验收：audit 全绿 + tsc:prod 0 错误 + 契约测试全绿
第二阶段（P1）：溯源元数据 → 实体对齐关卡 → 断点续采 → 死端点清理
        ↓ 验收：假数据可追溯 + 代码归一 100% + 增量采集生效
第三阶段（P2）：六维质量模型 → 冲突裁决 → 数据回流
        ↓ 验收：质量看板六维齐全 + 争议队列自动裁决率 >60%
```

**约束**：所有改动遵守——写入走 DataBridge 信封协议、新 store 跑 `audit:acl-consistency`、不引入后端依赖（§十五 本地优先）。

---

## 七、风险与已知遗留

| 风险/遗留 | 等级 | 说明 |
|-----------|------|------|
| `audit:mock-modules` P0 违规 | 中 | qualityGate 测试文件既有问题，需 `importActual + 局部覆盖` 改造，与采集链路解耦处理 |
| 指标落库新增 store | 低 | 已按契约三处注册 + ACL 审计通过 |
| 实体对齐误归一 | 中 | 别名表需灰度验证，避免跨市场代码碰撞误合并 |
| H 股字段位差异 | 低 | 已防御式解析，新增源时需同步校验字段映射 |

---

## 附：与 finance-report 的关系

finance-report 深度研究报告所需数据维度（行情/K线、财务、估值、行业格局、新闻舆情、重大事项、研报、资金流向、板块热度）与本项目采集维度一一对应。本轮真实测试即按深度研究的数据质量要求设计抽样与校验口径，验证采集源能否支撑下游深度研究消费。**结论：源层可支撑，短板在工程层与治理层。**
