---
title: 2026-07-05-systematic-doc-update
tier: T2
status: active
type: reference
domain: project
doc_id: V9-DOC-AUTO-D4A356
code_version: 2.0.0
summary: 结论：15 个抽样接口全部匹配，字段数和字段名零差异。
maintainer: V9 Architecture Team
phase: maintenance
---

# V9 系统性文档更新与交叉验证报告

> Report Date: 2026-07-05
> 执行范围：数据字典 · 核心文档 · 审计脚本 · 测试覆盖
> 验证方式：自动化工具扫描 + 人工复核

---

## 一、更新文档清单

| 序号 | 文档 | 更新前版本 | 更新后版本 | 更新类型 |
|------|------|-----------|-----------|----------|
| 1 | `docs/cockpit/DATA_DEFINITION.md` | v1.1.0 | v1.2.0 | 字段补充 + Widget 注册表扩展 |
| 2 | `docs/AI_CENTER_DATA_DEFINITION.md` | v1.1.0 | v1.2.0 | 9 个 Agent 运行时类型补充 |
| 3 | `docs/data-collection/DATA_DEFINITION_data-collection.md` | v1.1.0 | v1.2.0 | CollectorConfig +1 字段 + dataType 扩展 |
| 4 | `docs/news/DATA_DEFINITION_news.md` | v1.1.0 | v1.2.0 | NewsBookmark 接口 + 行号修正 |
| 5 | `docs/06-routing-specs.md` | v3.0.0 | v3.1.0 | 数量统计修正（47→48） |
| 6 | `docs/implementation/quality-audit-plan_implementation.md` | v1.0.0 | v1.1.0 | 全量审计完成 + 入口补全 |
| 7 | `docs/explanation/completeness-profile.md` | — | v1.0.0 | 新建：五层追溯完成度剖面图 |
| 8 | `docs/implementation/action-list_implementation.md` | — | v1.0.0 | 新建：35 项修复行动清单 |
| 9 | `scripts/audit/audit-hardcode.ts` | v2.4 | v2.5 | 检测范围扩展（+cockpit/+apps） |
| 10 | `tests/__tests__/scripts/audit-layer-calls.test.ts` | — | 新建 | 11 个测试用例 |
| 11 | `tests/__tests__/scripts/audit-hardcode.test.ts` | — | 新建 | 13 个测试用例 |
| 12 | `tests/__tests__/scripts/audit-dead-code.test.ts` | — | 新建 | 12 个测试用例 |
| 13 | `tests/__tests__/scripts/audit-doc-sync.test.ts` | — | 新建 | 11 个测试用例 |

---

## 二、数据字典更新详情

### 2.1 cockpit/DATA_DEFINITION.md

| 修改项 | 修改前 | 修改后 | 依据 |
|--------|--------|--------|------|
| MarketData 字段数 | 11 | 13 | `widget.types.ts:63-92`，新增 hotSectors/valuePit |
| SectorHeatmapData 字段数 | 4 | 5 | `widget.types.ts:105-112`，新增 fundFlow |
| 新增接口 | 0 | 2 | HotSectorData（五维评分）+ ValuePitData（六维评分+轮动信号） |
| Widget 注册表 | 12 个 | 21 个 | `widgetRegistry.ts` 实际注册 21 个 |
| 版本 | v1.1.0 | v1.2.0 | — |

### 2.2 AI_CENTER_DATA_DEFINITION_reference.md

| 修改项 | 修改前 | 修改后 | 依据 |
|--------|--------|--------|------|
| Agent 运行时类型 | 4 个 | 13 个 | `agent.types.ts` 实际定义 13 个接口 |
| 新增类型 | — | 9 个 | HealthSnapshot/TaskHistoryEntry/MetricsSummary/SystemMonitorSnapshot/TriggerPayload/TaskFilter/MCPCallRecord/Feedback/FeedbackSummary |
| 变更日志 | 无 | 3 条 | 补充 v1.0.0/v1.1.0/v1.2.0 |
| 版本 | v1.1.0 | v1.2.0 | — |

### 2.3 data-collection/DATA_DEFINITION_data-collection.md

| 修改项 | 修改前 | 修改后 | 依据 |
|--------|--------|--------|------|
| CollectorConfig 字段 | 3 | 4 | `widget.types.ts:420-425`，新增 headers |
| RawMarketData.dataType 值 | 11 个 | 13 个 | 新增 hotSectors/valuePit |
| MarketDataAdapter 适配规则 | 12 条 | 14 条 | 新增 adaptHotSectors/adaptValuePit |
| 版本 | v1.1.0 | v1.2.0 | — |

### 2.4 news/DATA_DEFINITION_news.md

| 修改项 | 修改前 | 修改后 | 依据 |
|--------|--------|--------|------|
| NewsArticle 行号引用 | 565-579 | 727-742 | `src/data/types.ts` 实际行号 |
| NewsStockMap 行号引用 | 582-590 | 744-752 | 同上 |
| SentimentCache 行号引用 | 593-601 | 755-763 | 同上 |
| NewsBookmark 接口 | 缺失 | 已补充 | `data/types.ts:766-769` |
| 版本 | v1.1.0 | v1.2.0 | — |

---

## 三、交叉一致性验证结果

### 3.1 数量一致性

| 指标 | 源码实际值 | 文档值 | 状态 |
|------|-----------|--------|------|
| 路由总数 | 48 条 | 48 条 | ✅ 一致（已修正 v3.1.0） |
| Store 总数 | 25 个 | 25 个 | ✅ 一致 |
| Widget 总数 | 21 个 | 21 个 | ✅ 一致 |
| DataBridge 端点 | 9 个 | 9 个 | ✅ 一致 |

### 3.2 类型定义一致性

| 数据字典 | 检查接口数 | 匹配数 | 不匹配数 |
|----------|-----------|--------|----------|
| cockpit/DATA_DEFINITION.md | 3 | 3 | 0 |
| AI_CENTER_DATA_DEFINITION_reference.md | 6 | 6 | 0 |
| news/DATA_DEFINITION_news.md | 4 | 4 | 0 |
| data-collection/DATA_DEFINITION_data-collection.md | 2 | 2 | 0 |
| **合计** | **15** | **15** | **0** |

**结论**：15 个抽样接口全部匹配，字段数和字段名零差异。

### 3.3 审计脚本与规则一致性

| 脚本 | 版本 | 与 AGENTS.md 一致性 | 主要差距 |
|------|------|-------------------|----------|
| audit-layer-calls.ts | v2.2 | 🟡 基本一致 | 缺少 store 层依赖方向检测、types/零依赖检测 |
| audit-hardcode.ts | v2.5 | ✅ 一致 | 颜色检测范围已扩展至 cockpit/ + apps/ |
| audit-dead-code.ts | — | ✅ 一致 | 三级加载链全覆盖 |
| audit-doc-sync.ts | — | 🟡 基本一致 | 匹配方式较粗，误判率较高 |

---

## 四、五层追溯审计摘要

### 4.1 审计覆盖

| 批次 | 入口数 | Widget 数 | 状态 |
|------|--------|----------|------|
| A 门户与驾驶舱 | 2 | 21 | ✅ 已完成 |
| B 输入舱 | 9 | — | ✅ 已完成 |
| C 分析舱 | 12 | — | ✅ 已完成 |
| D 交易舱 | 4 | — | ✅ 已完成 |
| E 输出舱+总控舱 | 21 | — | ✅ 已完成 |
| **合计** | **48** | **21** | **100% 覆盖** |

### 4.2 各层通过率

| 层级 | ✅ 完整 | 🟡 部分 | ❌ 缺失 | 通过率 |
|------|--------|--------|--------|--------|
| L5 集成层 | 48 | 0 | 0 | 100% |
| L1 界面层 | 39 | 7 | 2 | 81.3% |
| L2 状态层 | 34 | 8 | 6 | 70.8% |
| L4 逻辑层 | 34 | 7 | 7 | 70.8% |
| L3 数据层 | 29 | 9 | 10 | 60.4% |

**整体健康率**（五层全通入口占比）：**39.6%**

### 4.3 问题汇总

| 级别 | 数量 | 预计工时 | 主要分布 |
|------|------|---------|----------|
| P0 阻塞级 | 7 项 | 32 人时 | 输入舱桩代码、交易舱持仓功能 |
| P1 严重级 | 13 项 | 31 人时 | 状态层断裂、DataBridge 订阅未激活 |
| P2 优化级 | 15 项 | 20 人时 | 颜色硬编码、三态缺失、术语不一致 |
| **合计** | **35 项** | **83 人时** | — |

### 4.4 质量最佳模块 TOP 5

1. 驾驶舱（Cockpit）— 五层全通，Widget 生命周期管理完善
2. 板块轮动分析 — 五层全通，数据链路完整
3. 策略回测 — 五层全通，三态覆盖完整
4. 热门板块策略 — 五层全通，双数据源冗余
5. 本地知识库 — 五层全通，可作为参考模板

### 4.5 质量最差模块 TOP 5

1. 七维分析（B7）— 全链路桩代码，功能不可用
2. 采集器配置（B8）— 全页 Mock，无真实逻辑
3. 采集任务（B9）— 全页 Mock，无真实逻辑
4. 交易舱 Hub（D1）— 页面组件不存在，Store 为空壳
5. 批量导入（B3）— 无专属 Store，违反四步契约

---

## 五、测试覆盖提升

### 5.1 新增测试

| 测试文件 | 测试用例数 | 覆盖范围 |
|----------|-----------|----------|
| audit-layer-calls.test.ts | 11 | 分层调用检测 + 豁免验证 |
| audit-hardcode.test.ts | 13 | 颜色/魔法数字/URL 硬编码检测 |
| audit-dead-code.test.ts | 12 | 死代码/未注册页面检测 |
| audit-doc-sync.test.ts | 11 | 文档同步检测 |
| **合计** | **47** | — |

### 5.2 测试环境说明

- 所有脚本测试在 node 环境中运行（`// @vitest-environment node`）
- 使用 `vi.mock('node:fs')` 模拟文件系统
- 47 个测试用例全部通过

---

## 六、未解决问题及后续建议

### 6.1 P0 待修复（7 项，32 人时）

| 编号 | 问题 | 位置 | 建议优先级 |
|------|------|------|-----------|
| P0-1 | 持仓交易操作为桩实现 | holdingsStore | 最高 |
| P0-2 | 持仓导出为桩实现 | holdingsStore | 最高 |
| P0-3 | 持仓数据未实际加载 | holdingsStore.fetchData | 最高 |
| P0-4 | 七维分析功能为 TODO | B7 输入舱 | 高 |
| P0-5 | 采集器配置为 Mock | B8 输入舱 | 高 |
| P0-6 | 采集任务页为 Mock | B9 输入舱 | 高 |
| P0-7 | 交易舱 Hub 页面不存在 | D1 trading/hub | 中 |

### 6.2 后续优化建议

1. **审计脚本增强**：补充 store 层依赖方向检测、types/ 零依赖检测、agents/ 层专门规则
2. **测试覆盖扩展**：补充 cockpit/ 和 apps/ 层的组件测试（当前 0%）
3. **文档同步自动化**：优化 audit-doc-sync.ts 的匹配精度，降低误判率
4. **颜色令牌迁移**：audit-hardcode v2.5 新检测到 143 处违规（cockpit 101 + apps 42），需分批迁移

---

## 七、修改记录

| 时间 | 操作 | 内容 |
|------|------|------|
| 2026-07-05 14:00 | 数据收集 | 读取 4 份源码类型文件 + 路由配置 + Widget 注册表 |
| 2026-07-05 14:15 | 文档同步 | 4 份 DATA_DEFINITION 升级至 v1.2.0 |
| 2026-07-05 14:30 | 分布式审计 | 5 个批次并行执行五层追溯审计 |
| 2026-07-05 15:00 | 交付物生成 | completeness-profile.md + action-list_implementation.md + 更新 audit-plan |
| 2026-07-05 15:20 | 交叉检查 | 数量一致性 + 类型定义一致性 + 脚本规则一致性 |
| 2026-07-05 15:40 | 数量修正 | 06-routing-specs_design.md v3.0.0→v3.1.0 |
| 2026-07-05 15:50 | 脚本增强 | audit-hardcode.ts v2.4→v2.5，扩展检测范围 |
| 2026-07-05 16:10 | 测试补充 | 新增 4 个测试文件，47 个测试用例全部通过 |
| 2026-07-05 16:25 | 报告生成 | 本报告 |
