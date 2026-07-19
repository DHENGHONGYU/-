---
title: 架构设计文档版本比对
type: explanation
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "本文档记�?V9 智能投研复盘系统架构设计文档的校对更新历史，用于追踪 `docs/` 体系从「规划基线」到「实现校对版」再到「V6 Pro..."
tags: [architecture, plan, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-ARCH-037
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 架构设计文档版本比对

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25
>
> 本文档记�?V9 智能投研复盘系统架构设计文档的校对更新历史，用于追踪 `docs/` 体系从「规划基线」到「实现校对版」再到「V6 Pro 评估增强版」的演进�?
---

## 版本约定

| 版本标识 | 含义 | 时间 |
|----------|------|------|
| `v0.9.0-docs-base` | 项目初始架构规划基线，对应代�?v0.9.0 之前的状�?| 2026-06-24 �?|
| `v0.9.0-docs-review` | 输入�?UI 体系化重塑后的架构校对更新版 | 2026-06-24 |
| `v0.9.0-docs-v6pro-assessment` | 基于 V6 Pro 驾驶舱深度比对后的架构增强版，补充数据流引擎、数据融合、Widget 架构、板块轮动等设计 | 2026-06-25 |

---

## 总体差异概览

| 维度 | v0.9.0-docs-base | v0.9.0-docs-review | v0.9.0-docs-v6pro-assessment | 校对理由 |
|------|------------------|--------------------|------------------------------|----------|
| 文档定位 | 规划描述，较多「计�?待建�?| 规划与实现并重，补充实际映射 | 基于 V6 Pro 深度比对，补充缺失架构设�?| 代码已实现部分能力，文档滞后会导致新成员误解；V6 Pro 比对揭示了架构差�?|
| 架构分层 | 五层架构已定�?| 增加 L3 引擎层实际目录说明、输入舱子模块拆�?| 增加数据流引擎、数据融合层、Widget 架构、Agent 层设�?| 交易/采集引擎已下沉；V6 Pro 比对发现数据感知层与界面呈现层缺失关键能�?|
| 调用方向 | 原则性铁�?| 增加输入舱数据写入契约与事件总线规范 | 增加数据流引擎通道配置与事件联动规�?| 避免 UI 直接�?DB；需要更精细的数据通道管理 |
| 数据协议 | Envelope 结构通用描述 | 增加字段级来�?版本/审计要求 | 增加 `UnifiedStockData` 统一数据视图规范 | 强化数据血缘；支持多源数据融合 |
| 配置�?| 列出待建文件 | 标注已建/待建，补充输入舱配置 | 增加轮动配置、数据流配置规划 | 配置驱动原则需要持续维护清单；新架构需要新配置支持 |
| 映射�?| 通用规范 | 增加输入舱「组�?�?路由 �?服务」映�?| 增加 Widget 注册表规范、图表组件清�?| 参�?v6 UI_FUNCTION_MAPPING 思路；驾驶舱需�?Widget �?|
| 质量门禁 | 规划门禁 | 补充当前基线数据与硬编码/死代码扫描结�?| 增加 Widget 级错误隔离、操作反馈闭环要�?| 让门禁从目标变为可追踪基线；提升用户体验稳定�?|

---

## 1. 架构分层（`docs/explanation/03-architecture-standards.md`�?
| 层级 | 规划目录 | v0.9.0-docs-base 描述 | v0.9.0-docs-review 更新 | v0.9.0-docs-v6pro-assessment 更新 | 影响 |
|------|----------|------------------------|-------------------------|----------------------------------|------|
| L5 展示�?| `pages/`, `components/`, `portal/`, `cockpit/` | 基本对齐 | 明确 `portal/`, `cockpit/` 属于 L5 | 增加 Widget 架构设计、图表组件规范、ErrorBoundary 组件规划 | 驾驶舱需要重构为 Widget 化架�?|
| L4 应用�?| `apps/`, `cockpit/` | 对齐 | 增加输入舱由单页拆分�?Dashboard / BulkImport / HotSector / DataTest 四个子应�?| 增加驾驶�?Widget 注册表、懒加载引擎、跨 Widget 联动规范 | 驾驶舱从静态页面升级为可配�?Dashboard |
| L3 引擎�?| `services/`, `agents/`, `trading/` | `agents/` 未出现；`trading/` 未作为独立目�?| 修正为：交易引擎�?`src/services/trading/`；采集引擎在 `src/services/fetcher/`；`agents/` 仍待�?| 增加数据流引擎、数据融合层、板块轮动评分引擎设计；明确 `agents/` 目录结构 | 补充数据感知层与逻辑推理层缺失能�?|
| L2 数据�?| `data/`, `db/` | 对齐 | 增加 `daily_quotes` store、输入舱数据质量 store 规划 | 增加 `UnifiedStockData` 统一数据视图 Schema | 支持多源数据融合查询 |
| L1 基础设施�?| `lib/`, `config/`, `core/` | 对齐 | 增加 `src/config/inputConfig.ts` �?`fetcherConfig.ts` 规划 | 增加 `src/core/dataflow/` 数据流引擎目录；`src/config/rotationConfig.ts` 轮动配置规划 | 基础设施层扩展数据通道管理能力 |

---

## 2. 调用方向与数据访问（`docs/explanation/03-architecture-standards.md`�?
| 规则 | v0.9.0-docs-base | v0.9.0-docs-review | v0.9.0-docs-v6pro-assessment | 理由 |
|------|------------------|--------------------|------------------------------|------|
| 输入舱写�?| 通用 DataBridge 描述 | 明确录入/导入/流转均携�?`meta.source: 'input-cabin'` | 增加数据流引擎通道配置与事件联动规�?| 数据血缘需要区分舱室来源；需要更精细的数据通道管理 |
| 事件通知 | 通用 eventBus 描述 | 增加输入舱内统一事件名：`input:poolChanged`、`input:fetcherStatusChanged` | 增加 `WidgetEventBus` �?Widget 通信规范；事件名格式 `widget:{widgetId}:{event}` | 保证 `/input` 各子页数据同步；支持驾驶�?Widget 联动 |
| 数据读取 | L5/L4 可读 Service / dataLayer | 补充输入舱读取走 `inputService` / `stockpoolService` / `fetcherService` | 增加 `unifiedStockService` 统一数据视图读取入口 | 避免组件直接 import dataLayer；简化多源数据获�?|

---

## 3. 配置层清单（`docs/explanation/03-architecture-standards.md`�?
| 文件 | v0.9.0-docs-base | v0.9.0-docs-review |
|------|------------------|--------------------|
| `src/config/routes.ts` | 已建 | 已建 |
| `src/config/dbConfig.ts` | 已建 | 已建 |
| `src/config/scoreFactors.ts` | 已建 | 已建 |
| `src/config/tradingConfig.ts` | 未列�?| 已建（交易引�?P0 已落地） |
| `src/config/fetcherConfig.ts` | 未列�?| 已建（数据采集已落地�?|
| `src/config/inputConfig.ts` | 未列�?| 待建（输入舱 UI 增强需要） |
| `src/config/thresholds.ts` | 待建 | 待建 |
| `src/config/symbols.ts` | 待建 | 待建 |

---

## 4. 数据 Schema（`docs/explanation/03-architecture-standards.md`�?
| Store | v0.9.0-docs-base | v0.9.0-docs-review | 说明 |
|-------|------------------|--------------------|------|
| `stocks` | 已定�?| 增加 `dataQuality` 字段建议 | 支撑质量指示组件 |
| `daily_quotes` | 未列�?| 已定�?| 数据采集模块已落�?|
| `research_logs` | 已定�?| 已定�?| 无变�?|
| 新增 `stock_quality` | 未提�?| 规划�?| 若不想扩�?`stocks` 表，可独�?store |

---

## 5. 路由�?UI 映射（`docs/reference/06-routing-specs.md`�?
| 路径 | v0.9.0-docs-base | v0.9.0-docs-review | 组件 | 服务 |
|------|------------------|--------------------|------|------|
| `/input` | 单页输入�?| 录入看板 | `InputDashboard.tsx` | `inputService`, `stockpoolService` |
| `/input/bulk-import` | 未拆�?| 批量导入 | `BulkImportPanel.tsx` | `batchImportService` |
| `/input/hot-sectors` | 未拆�?| 热门板块 | `HotSectorPanel.tsx` | `hotSectorService` |
| `/input/data-test` | 未拆�?| 采集测试 | `DataTestPanel.tsx` | `fetcherService` |
| `/input/prototype` | 未列�?| 临时交互原型 | `InputPrototype.tsx` | mock only |

> 注：`/input/prototype` 为临时路由，策略确认后删除或归档�?
---

## 6. UI/UX 规范（`docs/reference/04-ui-ux-specs.md`�?
| 项目 | v0.9.0-docs-base | v0.9.0-docs-review | 理由 |
|------|------------------|--------------------|------|
| PortalShell 主题 | 浅色 + 翡翠�?| 深色 Kimi 经典布局；首�?驾驶舱保持浅�?| �?Kimi 产品风格对齐，提升专业感 |
| 侧边�?| 未明确分�?| 260px 分组侧边栏：常用 / 采集 / 工具 | 功能多时导航更清�?|
| 顶部�?| 未细�?| 56px 顶部状态栏：Logo/五舱/健康/运行时长/版本 | 全局状态可�?|
| 主内容区 | 未细�?| `p-6` 内边距，可滚�?| 统一页面间距 |
| 输入舱布局 | 单页 Tab | 子页�?+ 页面标题�?+ 子路由分�?| 避免单文件巨石组�?|

---

## 7. 实施计划（`docs/reference/08-implementation-plan.md`�?
| Phase | v0.9.0-docs-base | v0.9.0-docs-review |
|-------|------------------|--------------------|
| Phase 1 | 骨架完成 | 骨架完成 |
| Phase 2 | 功能填充 | 拆分�?P0/P1/P2，明确输入舱子任务：搜索、质量指示、批量导入状态、热门板块因子、数据源健康度、采集配�?|
| Phase 3 | 质量加固 | 质量加固 |
| Phase 4 | 发布准备 | 发布准备 |

---

## 8. 质量门禁（`../reference/09-quality-gates.md`�?
| 门禁�?| v0.9.0-docs-base | v0.9.0-docs-review |
|--------|------------------|--------------------|
| 跨层调用审计 | 规划 | 当前基线�? 违规 / 0 警告 |
| 硬编码审�?| 规划 | 当前基线�?1 �?|
| 死代码审�?| 规划 | 当前基线�? 处提�?|
| 测试 | 6/6 | 19 文件 / 107 测试全部通过 |
| 覆盖�?| 未配置阈�?| 已列出目标阈值（待配置） |

---

## 9. 功能规格（`docs/reference/02-functional-specs.md`�?
| 用户故事 | v0.9.0-docs-base | v0.9.0-docs-review |
|----------|------------------|--------------------|
| US-001 录入 | �?| �?|
| US-002 V6 评分 | �?| �?|
| US-003 池间流转 | �?| �?|
| US-004 模拟交易 | �?| �?|
| US-005 复盘笔记 | �?| �?|
| US-006 股票搜索 | 缺失 | 新增 |
| US-007 批量导入预览 | 缺失 | 新增 |
| US-008 热门板块推荐 | 缺失 | 新增 |
| US-009 采集测试 | 缺失 | 新增 |

---

## 10. 仍未解决/待决策项

| 问题 | 状�?| 备注 |
|------|------|------|
| `agents/` 目录是否启用 | **已规�?* | 已在架构文档中定�?`src/agents/` 目录结构，Phase 2/P3 按需求逐步落地 |
| 输入�?`/input/prototype` 删除或归�?| 待决�?| 原型验证完成后处�?|
| 热门板块数据来源 | **已规�?* | 已规划板块轮动评分引擎，数据源优先接�?V4 行业评分 SKILL |
| 搜索组件数据�?| 待决�?| 本地股票�?/ AKShare / 候选池过滤 |
| `fetcherConfig` 是否 UI 化并持久�?| 待决�?| 建议 Phase 3 实现 |
| **数据流引擎技术选型** | **待决�?* | 自研 vs 引入 `rxjs`；建议先自研轻量版本，后续按需升级 |
| **图表库选型优先�?* | **待决�?* | `lightweight-charts`（专�?K线）vs `recharts`（通用）；建议两者同时引入，各司其职 |
| **Widget 状态持久化** | **待决�?* | 用户自定义布局是否持久化到 IndexedDB；建�?Phase 2 先内存状态，稳定后持久化 |

---

## 11. V6 Pro 对照评估新增偏差�?
基于 V6 Pro 驾驶舱深度比对，本次文档更新新增以下架构偏差记录�?
| # | 偏差 | 影响 | 计划 |
|---|------|------|------|
| D12 | 缺少数据流引�?| 仅基础 `on/emit/off`，缺少缓�?定时/优先�?SSE支持 | Phase 2 实现 `src/core/dataflow/` |
| D13 | 缺少数据融合�?| 各服务分散获取数据，缺少统一 `UnifiedStockData` 视图 | Phase 2 实现 `unifiedStockService.ts` |
| D14 | 驾驶�?Widget 框架缺失 | 静态页面，缺少可插�?Widget、懒加载、跨 Widget 联动 | Phase 2 重构驾驶舱为 Widget 架构 |
| D15 | 评分算法能力降级 | 仅启发式计算 + 随机数降级，缺少 LLM 集成与报告生�?| Phase 2 升级评分引擎 |
| D16 | 缺少图表组件�?| �?`lightweight-charts` / `recharts`，数据可视化能力缺失 | Phase 2 引入图表组件 |
| D17 | 板块轮动评分缺失 | 使用静态样本数据，缺少量化轮动模型 | Phase 2 实现 `rotationScoreService.ts` |
| D18 | 缺少操作反馈闭环 | 仅基础 Toast，缺少操作状态实时更新、数据质量反�?| Phase 2 完善反馈机制 |
| D19 | 缺少 Widget 级错误隔�?| 单个组件崩溃可能影响整个驾驶�?| Phase 2 实现 `ErrorBoundary` 组件 |

---

## 附录：受影响的文档清�?
- `../reference/03-architecture-standards.md`
- `../reference/02-functional-specs.md`
- `../reference/04-ui-ux-specs.md`
- `../reference/05-engine-specs.md`
- `../reference/06-routing-specs.md`
- `../reference/08-implementation-plan.md`
- `../reference/09-quality-gates.md`
- `../reference/architecture-version-comparison.md`
- `../../CHANGELOG.md`


<!-- merge-source: docs/reference/architecture-version-comparison.md (2026-07-14 内容融合，避免去重丢失有效信�? -->
## 补充内容（合并自 `docs/reference/architecture-version-comparison.md`�?
## 1. 架构分层（`../reference/03-architecture-standards.md`�?## 2. 调用方向与数据访问（`../reference/03-architecture-standards.md`�?## 3. 配置层清单（`../reference/03-architecture-standards.md`�?## 4. 数据 Schema（`../reference/03-architecture-standards.md`�?## 5. 路由�?UI 映射（`../reference/06-routing-specs.md`�?## 6. UI/UX 规范（`../reference/04-ui-ux-specs.md`�?## 7. 实施计划（`../reference/08-implementation-plan.md`�?## 8. 质量门禁（`../reference/09-quality-gates.md`�?## 9. 功能规格（`../reference/02-functional-specs.md`�?