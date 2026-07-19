---
title: P4 系统性目录梳理报�?
type: meta
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "生成日期: 2026-07-20 对比基准: AGENTS.md v1.4.3 + file-management-guide.md v1.3.0 扫描范围:..."
tags: [qa, audit, system]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# P4 系统性目录梳理报�?
> **生成日期**: 2026-07-20
> **对比基准**: AGENTS.md v1.4.3 + file-management-guide.md v1.3.0
> **扫描范围**: `src/`（深�?层）、`tests/`、`docs/`、`scripts/`、`public/`、`design-tokens/`、`.husky/`

---

## 一、AGENTS.md §一 目录定义 vs 实际目录对比

### 1.1 已定义且实际存在的目�?✅（�?18 个）

| 目录 | AGENTS.md 定义 | 实际状�?|
|------|---------------|----------|
| `src/agents/` | AI 行为扩展（运行时模块，core 层扩展）——依赖规则中提到 | �?存在 |
| `src/apps/` | App 分发器（�?§�?路由注册规则中提到，三级加载链中间层�?| �?存在 |
| `src/cockpit/` | 驾驶舱层（在 §一 components/ 描述中提�?chart/cabin/cockpit/widgets�?| �?存在 |
| `src/components/` | 组件层（atoms/molecules/organisms/templates + chart/cabin/cockpit/widgets�?| �?存在 |
| `src/config/` | 配置层（零硬编码锚点�?| �?存在 |
| `src/constants/` | 常量层（零硬编码锚点�?| �?存在 |
| `src/core/` | 核心工具与类型守卫（DataBridge/ACL/Envelope/MemoryCache/EventBus�?| �?存在 |
| `src/data/` | 数据层（IndexedDB/dataLayer/queryBuilder/types�?| �?存在 |
| `src/devtools/` | 开发环境调试工具（DEV 注入�?| �?存在 |
| `src/fixtures/` | Mock 数据供给（测试数据） | �?存在 |
| `src/hooks/` | 自定�?React Hooks（跨组件共享逻辑�?| �?存在 |
| `src/i18n/` | 国际化配置与翻译资源 | �?存在 |
| `src/lib/` | 库函数（logger/format/errors/utils/localStorageManager�?| �?存在 |
| `src/pages/` | 页面层（5舱：input/analysis/trading/output/command�?| �?存在 |
| `src/portal/` | PortalShell 舱室入口�?| �?存在 |
| `src/services/` | 服务层（20个子域：analysis/scoring/fetcher/news/llm/trading/execution/...�?| �?存在 |
| `src/store/` | 状态层�?9个Zustand Store + helpers/withBroadcast�?| �?存在 |
| `src/types/` | 零依赖（纯类型定义，可被所有层引用�?| �?存在 |

### 1.2 实际存在�?AGENTS.md §一 未定义的目录 ⚠️（共 4 个）

| 目录 | 实际内容 | �?AGENTS.md 中的提及情况 | 建议 |
|------|---------|------------------------|------|
| `src/generated/` | 自动生成文件（可能由脚本/token生成器产出） | AGENTS.md 全文未提�?| ⚠️ P2：需确认内容，可能应�?.gitignore 忽略 |
| `src/mcp/` | MCP 服务器层�?0+ 个子服务器：analysis/backtest/data-collector/execution/export/fetcher/input/llm/news/portfolio/scoring/screening/stockpool/system/trade/trading�?| AGENTS.md 全文未提�?| ⚠️ P1：需�?AGENTS.md §一 新增定义，明确其分层归属 |
| `src/schema/` | Zod/JSON Schema 定义（类型校验层�?| AGENTS.md 全文未提�?| ⚠️ P1：需确认 schema/ 是独立层还是应归�?types/ |
| `src/showcase/` | 组件展示/Storybook 替代页（WidgetStateShowcase/UIComponentShowcase/StockDataShowcase/ColorTokenShowcase�?| AGENTS.md 全文未提�?| ⚠️ P2：开发环境专用，建议归入 devtools/ 或单独定�?|

### 1.3 已废�?不存在的目录清理状�?
| 目录 | 状�?| 说明 |
|------|------|------|
| `src/lib/` | �?已删�?| 2026-07-20 清理完成，文件已迁移�?`src/lib/` |
| `src/core/databridge.ts` | �?已删�?| 2026-07-20 清理完成，适配器迁移至 `src/core/databridgeAdapter.ts` |
| `src/blueprints/` | �?已迁�?| 2026-07-20 清理完成，迁移至 `tests/blueprints/` |

---

## 二、src/ 下二级子目录结构概览

### 2.1 新增/重要二级子目�?
```
src/
├── agents/__tests__/          # Agent 层单元测�?├── apps/
�?  ├── analysis/              # 分析�?App 分发�?�?  ├── command/               # 指挥�?App 分发�?�?  ├── input/                 # 输入�?App 分发�?�?  ├── output/                # 输出�?App 分发�?�?  └── trading/               # 交易�?App 分发器（�?components/ panels/�?├── cockpit/
�?  ├── core/                  # 驾驶舱核心逻辑
�?  ├── data/                  # 驾驶舱数据层
�?  ├── providers/             # 驾驶�?Provider �?�?  └── widgets/               # 驾驶�?Widget（含 components/�?├── components/
�?  ├── atoms/                 # 原子组件（Button/Input/Table...�?�?  ├── molecules/             # 分子组件（含 states/�?�?  ├── organisms/             # 有机体组件（analysis/collection/input/news/output/pool/scoreDoc/strategy/system/trading/shared�?�?  ├── templates/             # 页面模板（CockpitLayout/DashboardLayout/SidebarLayout/PageHeader/PageContainer�?�?  ├── chart/                 # 图表组件（LineChart/BarChart/AreaChart/GaugeChart�?�?  ├── cabin/                 # 舱室组件
�?  ├── cockpit/               # 驾驶舱组件（SignalSpectrum�?�?  └── widgets/               # 独立 Widget 组件
├── constants/
�?  ├── theme/                 # 主题常量
�?  └── uiText/                # UI 文本常量
├── core/
�?  └── dataflow/              # 数据流核心工�?├── data/
�?  ├── migrations/            # DB 迁移脚本
�?  ├── schemas/               # DB Schema 定义
�?  └── types/                 # 数据层类型定�?├── hooks/
�?  └── cabin/                 # 舱室专用 Hooks
├── lib/
�?  └── store-audit/           # Store 审计工具
├── mcp/
�?  ├── __tests__/             # MCP 测试
�?  ├── bridge/                # MCP 桥接�?�?  ├── core/                  # MCP 核心
�?  └── servers/               # MCP 服务器（20+ 子域�?├── pages/
�?  ├── analysis/              # 分析舱页�?�?  ├── command/               # 指挥舱页面（�?__tests__/ agent/ health/ showcase/�?�?  ├── input/                 # 输入舱页�?�?  ├── output/                # 输出舱页面（�?__tests__/�?�?  └── trading/               # 交易舱页面（�?components/�?├── portal/
�?  └── __tests__/             # PortalShell 测试
├── services/
�?  ├── ai-center/             # AI 中心服务
�?  ├── analysis/              # 分析服务（含 __tests__/ rotation/�?�?  ├── backtest/              # 回测服务
�?  ├── collection/            # 采集服务
�?  ├── data-collector/        # 数据收集服务（含 collectors/�?�?  ├── execution/             # 执行服务
�?  ├── export/                # 导出服务（含 __tests__/�?�?  ├── fetcher/               # 数据获取服务（含 orchestrator/�?�?  ├── hybrid-proofread/      # 混合校对服务
�?  ├── input/                 # 输入服务
�?  ├── llm/                   # LLM 服务
�?  ├── news/                  # 新闻服务（含 __tests__/�?�?  ├── portfolio/             # 投资组合服务
�?  ├── pwa/                   # PWA 服务
�?  ├── rbac/                  # RBAC 权限服务
�?  ├── scoring/               # 评分服务（含 v6-engine/�?�?  ├── screening/             # 筛选服�?�?  ├── stock-analysis/        # 股票分析服务
�?  ├── stockpool/             # 股票池服�?�?  ├── system/                # 系统服务（含 migration/�?�?  ├── trade/                 # 交易服务
�?  ├── trading/               # 交易服务（含 tradeErrorUtils/tradeErrorClassifier/tradeReviewAI�?�?  └── useCase/               # 用例服务
├── showcase/                  # ⚠️ 未在 AGENTS.md 定义
�?  └── __tests__/             # Showcase 测试
└── types/modules/             # 类型模块
```

---

## 三、关键发现与问题汇�?
### 🔴 P0：AGENTS.md §一 遗漏 4 个目�?
| # | 遗漏目录 | 问题严重�?| 建议操作 |
|---|---------|-----------|---------|
| 1 | `src/mcp/` | **�?* | �?AGENTS.md §一 目录列表中新增，明确其分层定位（建议：类�?services/ 的扩展层，或独立层） |
| 2 | `src/schema/` | **�?* | 确认其职责——若�?Zod Schema 定义，可归入 `src/types/` 或独立定义；若含运行时校验逻辑，需明确依赖方向 |
| 3 | `src/showcase/` | **�?* | 开发环境展示页，建议在 AGENTS.md 中标注为"开发环境专用，不进入生产构�? |
| 4 | `src/generated/` | **�?* | 需检查内容来源——若为脚本自动生成，应加�?`.gitignore`；若为提交产物，需明确归属 |

### 🟡 P1：依赖方向规则需补充

| 目录 | 当前状�?| 需补充的规�?|
|------|---------|------------|
| `src/apps/` | §�?提到但未�?§一 列表�?| 应在 §一 代码块中正式列出 |
| `src/cockpit/` | §一 components/ 描述中提�?| 应在 §一 代码块中独立列出，明确其层定�?|
| `src/mcp/` | 全文未提�?| 需定义其可依赖层和可被依赖�?|

### 🟢 P2：文档同步确认项

| 检查项 | 状�?| 说明 |
|--------|------|------|
| `src/lib/` 残留引用 | �?已清�?| 生产代码中无 `@/utils/` �?`src/lib/` 引用 |
| `src/core/databridge.ts` 残留引用 | �?已清�?| 适配器已迁移�?`src/core/databridgeAdapter.ts` |
| `src/blueprints/` 残留引用 | �?已清�?| 已迁移至 `tests/blueprints/` |
| AGENTS.md lib 白名�?`utils` | �?正确 | �?`src/lib/` 内的 `utils.ts`，非 `src/lib/` 目录 |
| file-management-guide.md 目录映射 | �?已同�?| v1.3.0 已包�?hooks/devtools/fixtures/i18n |

---

## 四、架构梳理结�?
### 4.1 当前完整目录架构（v1.4.3+ 实际�?
```
src/
├── config/        �?配置层（零硬编码锚点�?├── constants/     �?常量层（零硬编码锚点，可被所有层引用�?├── core/          �?核心工具与类型守�?├── data/          �?数据层（IndexedDB/dataLayer/queryBuilder/types�?├── lib/           �?库函数（logger/format/errors/localStorageManager�?├── types/         �?零依赖（纯类型定义，可被所有层引用�?├── agents/        �?AI 行为扩展（core 层扩展，仅可依赖 core/ �?data/�?�?├── services/      �?服务层（20+ 子域�?├── store/         �?状态层�?9�?Zustand Store�?├── hooks/         �?自定�?React Hooks（可依赖 store/services/lib�?├── i18n/          �?国际化配置（可依�?lib/，可�?components/pages 引用�?�?├── portal/        �?PortalShell 舱室入口�?├── apps/          �?App 分发器（React.lazy 加载，三级加载链中间层）
├── pages/         �?页面层（5�?+ command�?├── components/    �?组件层（atoms/molecules/organisms/templates/chart/cabin/cockpit/widgets�?├── cockpit/       �?驾驶舱层（core/data/providers/widgets�?�?├── mcp/           �?⚠️ MCP 服务器层（未�?AGENTS.md 定义�?0+ 子服务器�?├── schema/        �?⚠️ Schema 定义层（未在 AGENTS.md 定义�?├── showcase/      �?⚠️ 组件展示层（未在 AGENTS.md 定义�?├── generated/     �?⚠️ 自动生成文件（未�?AGENTS.md 定义�?├── devtools/      �?开发环境调试工�?├── fixtures/      �?Mock 数据供给（仅�?tests/ 依赖�?└── [已删除] utils/     �?已废弃，迁移�?lib/
```

### 4.2 推荐行动优先�?
| 优先�?| 行动�?| 预估工作�?| 影响范围 |
|--------|--------|-----------|---------|
| **P0** | �?AGENTS.md §一 新增 `src/mcp/`、`src/schema/`、`src/showcase/`、`src/generated/` 定义 | 30min | AGENTS.md + file-management-guide.md |
| **P1** | �?AGENTS.md §一 代码块中补全 `src/apps/` �?`src/cockpit/`（当前只在描�?依赖规则中提及） | 15min | AGENTS.md |
| **P2** | 明确 `src/mcp/` 的依赖方向规则（可依赖哪些层、可被哪些层依赖�?| 1h | AGENTS.md |
| **P2** | 检�?`src/generated/` 内容，决定是否加�?`.gitignore` 或定义其生命周期 | 30min | `.gitignore` + AGENTS.md |
| **P3** | 执行 `npx tsc --noEmit` + `npm run audit:layers` 验证当前状�?| 5min | 全项�?|
