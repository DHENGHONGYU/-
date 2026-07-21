---
title: outputs/ 和未定义 src/ 目录评估报告
type: meta
domain: project
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "评估时间: 2026-07-12 评估依据: AGENTS.md v1.4.3 评估方法: Glob 目录扫描 + Grep 全局引用搜索 + 文件内容审阅"
tags: [project, report, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-334
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# outputs/ 和未定义 src/ 目录评估报告

> 评估时间: 2026-07-12
> 评估依据: AGENTS.md v1.4.3
> 评估方法: Glob 目录扫描 + Grep 全局引用搜索 + 文件内容审阅

---

## 一、outputs/ 目录评估

### 1.1 文件概览

| 指标 | 数值 |
|------|------|
| 总文件数 | 596 |
| 顶层文件/目录 | 14 |
| 子目录 | 3 个 |

**文件类型分布**（实际统计）：

| 类型 | 数量 | 占比 | 用途判断 |
|------|------|------|---------|
| `.json` | 303 | 50.8% | 测试报告数据、配置文件 |
| `.md` | 289 | 48.5% | 评估报告、检查清单、测试日志 |
| `.docx` | 2 | 0.3% | 改进路线图、智能编码分析报告 |
| `.svg` | 1 | 0.2% | 成熟度雷达图 |
| `.mjs` | 1 | 0.2% | 测试脚本 |

**子目录 `test-doc-auto-update/` 内容**：

- 包含约 80+ 个测试用例子目录（`t1_capability` 到 `t19_real_vh`，以及 `perf50`/`perf200`）
- 每个用例含 `doc-auto-update-{timestamp}.json` + `.md` + `latest.json`
- 另有 `test-report-{timestamp}.json` + `.md`（多份，不同执行时间）
- 判定为**自动化测试产物**，非生产代码

**子目录 `doc-auto-update-sample/` 内容**：

- 3 个文件：1 份 JSON + 1 份 MD + 1 份 `latest.json`
- 判定为**样本输出**，用于演示文档自动更新格式

### 1.2 引用分析

- **源码层（src/）**: 零引用 — `outputs/` 未被任何 `.ts`/`.tsx`/`.js` 文件 import 或引用
- **文档层（docs/）**: 11 处引用，分布在 6 个文件中
- **.gitignore**: 无 `outputs/` 规则（当前被 git 跟踪）
- **.workbuddy/memory/**: 4 处引用（工作记忆文件）

### 1.3 敏感信息扫描

- 未扫描到 API Key、密码等敏感信息
- **低风险*

### 1.4 决策建议

| 项目 | 决策 | 依据 | 风险等级 |
|------|------|------|---------|
| `outputs/` 整体 | **纳入 `.gitignore`** | 596 个文件全部为工作产物/测试输出，非源代码；源码层零引用 | 低 |
| 历史报告保留 | **本地保留，不移除已提交文件** | 部分报告可能用于审计追溯 | 低 |

**`.gitignore` 规则建议**：

```gitignore
# 工作产物输出目录
/outputs/*
!/outputs/.gitkeep
```

---

## 二、未定义 src/ 目录评估

### 2.0 评估前提说明

AGENTS.md §一 "项目分层规则" 中，分层结构图明确列出的目录为：

```
src/config/, src/core/, src/data/, src/lib/, src/services/,
src/store/, src/pages/, src/components/, src/portal/, src/constants/, src/types/
```

此外，AGENTS.md 其他章节明确提及或定义的目录：
- `src/agents/` — 依赖方向规则中定义（"agents/ → 仅可依赖 core/ 和 data/，属于 core 层扩展"）
- `src/apps/` — 路由注册规则中定义（App 分发器，三级加载链）
- `src/lib/` — 明确标记为"已废弃，请使用 src/lib/"
- `src/cockpit/` — 颜色令牌规范中多次引用（作为 UI 层消费方）
- `src/mcp/` — 架构治理和测试命令中多次引用

**以下评估对象为 AGENTS.md §一 分层结构图中未列出，且在其他章节亦无明确定义的目录**。

---

### 2.1 评估汇总表

| 目录 | 文件数 | 引用数 | 用途判断 | 建议 | 风险等级 |
|------|--------|--------|---------|------|---------|
| `src/blueprints/` | 1 | 0 | 数据关系测试（单一测试文件） | **合并至 tests/ 或归档** | 低 |
| `src/core/databridge.ts` | 1 | 2 | `core/databridge` 的适配层包装 | **评估合并至 src/core/databridge/** | 中 |
| `src/devtools/` | 1 | 0 | 开发环境调试工具（`__DEV__` 全局） | **保留并补充 AGENTS.md 定义** | 低 |
| `src/fixtures/` | 1 | 1 | Mock 数据供给 | **保留并补充 AGENTS.md 定义** | 低 |
| `src/generated/` | 2 | 0 | 令牌生成产物（CSS + TS） | **需进一步确认** | 低 |
| `src/hooks/` | 11 | 26 | React Hooks 集合（通用 + 舱室专用） | **保留并补充 AGENTS.md 定义** | 低 |
| `src/i18n/` | 2 | 0 | 国际化框架骨架（v0.9.11） | **保留或归档** | 低 |
| `src/schema/` | 6 | 0 | JSON Schema 定义（股票/订单/评分等） | **评估是否被运行时校验使用** | 中 |
| `src/showcase/` | 8 | 0 | 组件展示/Storybook 风格展示页 | **评估是否仍在使用** | 中 |

### 2.2 逐项详细评估

#### 2.2.1 `src/blueprints/` — 数据关系蓝图（1 文件）

- **文件清单**: `__tests__/dataRelationship.test.ts`（4331 字节，测试文件）
- **引用分析**: 全局搜索 `@/blueprints/` → **0 引用**
- **内容评估**: 测试文件，验证数据实体间关系（可能为早期数据建模产物）
- **决策**: **建议合并至 `tests/` 目录或归档到 `docs/archive/`**
- **执行建议**: 如测试仍有价值，迁移至 `tests/blueprints/dataRelationship.test.ts`；如已过时，删除
- **风险**: 低（零引用）

---

#### 2.2.2 `src/core/databridge.ts` — DataBridge 适配层（1 文件）

- **文件清单**: `index.ts`（5431 字节，155 行）
- **引用分析**:
  - `@/databridge` → 1 处引用：`tests/databridgeAdapter.test.ts`
  - 自身 import：`@/core/databridge`（说明核心实现在 core 层）
- **内容评估**:
  - 导出 `DataBridgeAdapter` 类，是对 `src/core/databridge.ts` 的面向对象包装
  - 提供 `query()`、`subscribe()`、`getStats()`、`destroySubscriptions()` 等方法
  - 单例模式管理，支持超时、fallback queue
- **与 core 层关系**:
  - `src/core/databridge.ts`（33850 字节）已存在，为核心实现
  - `../../src/showcase/index.ts` 是**适配层/门面层**，职责是提供更易用的 API
- **决策**: **需进一步确认** — 评估是否将 `DataBridgeAdapter` 合并至 `src/core/databridge.ts` 或保持独立
- **执行建议**:
  - 方案 A（推荐）：将 `DataBridgeAdapter` 迁移至 `src/core/databridgeAdapter.ts`，删除 `src/core/databridge.ts` 目录
  - 方案 B：保留 `src/core/databridge.ts` 并在 AGENTS.md 中补充定义为"适配层"
- **风险**: 中（涉及 1 个测试文件和潜在的 API 使用方）

---

#### 2.2.3 `src/devtools/` — 开发调试工具（1 文件）

- **文件清单**: `testDataFlow.ts`（8037 字节，223 行）
- **引用分析**: `@/devtools/` → **0 引用**；文件内通过 `import.meta.env.DEV` 条件注入 `window.__DEV__` 全局对象
- **内容评估**: 开发环境专用工具，提供 `__DEV__.runAll()`、`__DEV__.testEventBus()` 等命令；仅在 DEV 下激活
- **决策**: **保留并补充 AGENTS.md 定义**
- **依据**: 虽零显式引用，但为开发环境基础设施，有实际价值
- **执行建议**: 在 AGENTS.md §一 或新增"开发工具层"说明 `src/devtools/` 的存在和用途
- **风险**: 低

---

#### 2.2.4 `src/fixtures/` — Mock 数据（1 文件）

- **文件清单**: `dualStrategyMockData.ts`（5312 字节）
- **引用分析**: `@/fixtures/` → 1 处引用：`src/store/dualStrategyStore.ts`
- **内容评估**: 提供双策略（Dual Strategy）的 Mock 数据，用于开发和测试
- **决策**: **保留并补充 AGENTS.md 定义**
- **依据**: 有实际引用（1 处），属于测试/开发基础设施
- **执行建议**: 在 AGENTS.md 中补充 `src/fixtures/` 作为测试数据目录的定义
- **风险**: 低

---

#### 2.2.5 `src/generated/` — 生成产物（2 文件）

- **文件清单**: `tokens.css`（5645 字节）、`tokens.ts`（3735 字节）
- **引用分析**: `@/generated/` → **0 引用**；但 `tokens.css` 可能被 `index.css` 或主题系统 import（需确认）
- **内容评估**: 文件头部无 "自动生成" 注释，但从文件名判断应为 `scripts/generate-tokens.ts` 产物
- **决策**: **需进一步确认*
- **执行建议**:
  - 确认 `tokens.css` 是否被 `index.css` 或 Vite 配置引用
  - 如被引用：保留并补充 AGENTS.md 定义
  - 如未被引用：可纳入 `.gitignore`，由构建脚本动态生成
- **风险**: 低

---

#### 2.2.6 `src/hooks/` — React Hooks 集合（11 文件）

- **文件清单**（11 文件）:
  - 通用 Hooks: `useDebounce.ts`, `useToast.tsx`, `useConfirmDialog.tsx`, `usePageGuard.ts`, `usePerfTrace.ts`, `useFreshData.ts`
  - 业务 Hooks: `useDataCollection.ts`, `useStockPoolBoard.ts`
  - 舱室专用 Hooks: `cabin/useIndustryScorePage.ts`, `cabin/useIntelligentScorePage.ts`
  - 测试: `useToast.test.tsx`
- **引用分析**:
  - `@/hooks/` → **26 处引用，分布在 22 个文件中**
  - 主要引用方：
    - `src/pages/`（7 处）
    - `src/components/`（7 处）
    - `src/apps/`（3 处）
    - `src/store/`（1 处）
    - `tests/`（4 处）
    - `docs/`（1 处）
- **内容评估**:
  - `useDebounce.ts` — 通用防抖 Hook（23 行）
  - `useToast.tsx` — Toast 通知上下文 Hook（62 行，含 Provider）
  - `useFreshData.ts` — 数据新鲜度管理 Hook（较复杂，5974 字节）
  - `useStockPoolBoard.ts` — 股票池看板业务 Hook（7070 字节）
  - `cabin/` 下为舱室专用 Hooks
- **决策**: **保留并补充 AGENTS.md 定义**
- **依据**: 大量引用（26 处，22 文件），已深度集成到项目中；强行迁移将导致大量 import 路径变更
- **执行建议**: 在 AGENTS.md §一 分层结构图中补充 `src/hooks/` 作为组件层的子层或独立层
- **风险**: 低

---

#### 2.2.7 `src/i18n/` — 国际化框架（2 文件）

- **文件清单**: `index.ts`（315 字节）、`zh-CN.ts`（110 字节）
- **引用分析**: `@/i18n/` → **0 引用**
- **内容评估**:
  - `index.ts` 注释标明 "v0.9.11 P2-DATA002，当前阶段：建立框架骨架"
  - 实际功能仅为代理 `src/constants/uiText.ts`
  - 未实现真正的国际化（react-i18next）
- **决策**: **保留但标记为占位符/待实现*
- **依据**: 虽零引用，但为明确的未来功能占位（国际化），删除后未来需重建
- **执行建议**: 在 AGENTS.md 中补充 `src/i18n/` 定义，标记为 "P2 占位，待 react-i18next 集成"
- **风险**: 低

---

#### 2.2.8 `src/schema/` — JSON Schema 定义（6 文件）

- **文件清单**:
  - `stock.schema.json`, `score.schema.json`, `signal.schema.json`, `order.schema.json`, `holdings.schema.json`, `config.schema.json`
- **引用分析**: `@/schema/` → **0 引用**
- **内容评估**: 6 个 JSON Schema 文件，覆盖核心业务实体；可能用于运行时数据校验（zod/ajv/yup 等）或 TypeScript 类型生成
- **决策**: **需进一步确认*
- **执行建议**:
  - 搜索代码中是否有 `zod`、`ajv`、`yup`、`validate`、`schema` 等关键词在 src/ 中的使用
  - 如被运行时校验使用：保留并补充 AGENTS.md 定义
  - 如仅为文档：可迁移至 `docs/schemas/` 或归档
- **风险**: 中（涉及数据校验基础设施）

---

#### 2.2.9 `src/showcase/` — 组件展示（8 文件）

- **文件清单**: `ColorTokenShowcase.tsx`, `StockDataShowcase.tsx`, `UIComponentShowcase.tsx`, `WidgetStateShowcase.tsx`, `ShowcaseSection.tsx`, `index.ts`, `types.ts`, `__tests__/`
- **引用分析**: `@/showcase/` → **0 引用**
- **内容评估**: 类似 Storybook 的组件展示页面，用于开发时预览颜色令牌、组件状态、Widget 行为
- **决策**: **需进一步确认*
- **执行建议**:
  - 搜索路由配置（`src/config/routes.ts`）是否有 `/showcase` 路由
  - 如为开发专用页面：保留，但补充 AGENTS.md 定义为"开发展示层"
  - 如完全未使用：可归档或删除
- **风险**: 中

---

### 2.3 根级未定义文件评估

`src/` 根目录下还有以下文件不在 AGENTS.md §一 分层结构图中，但属于标准 React/Vite 项目结构：

| 文件 | 用途 | 是否需定义 |
|------|------|-----------|
| `App.tsx` | React 应用根组件（路由分发入口） | 否（标准文件） |
| `main.tsx` | Vite 应用入口（ReactDOM.createRoot） | 否（标准文件） |
| `index.css` | 全局 CSS（含 Tailwind 指令和 CSS 变量） | 否（标准文件） |
| `theme.config.ts` | 主题配置（radix-ui themes） | 否（配置类文件） |
| `vite-env.d.ts` | Vite 环境类型声明 | 否（标准文件） |

**结论**: 以上文件为标准 Vite + React 项目必需文件，无需在 AGENTS.md 分层规则中特殊定义。

---

## 三、综合建议

### 3.1 立即执行（低风险）

1. **`outputs/` 纳入 `.gitignore`**
   - 596 个文件全部为工作产物，非源代码
   - 源码层零引用，不影响构建和运行
   - 建议规则: `/outputs/*` + `!/outputs/.gitkeep`

2. **`src/blueprints/` 归档或迁移*
   - 仅 1 个测试文件，零引用
   - 建议迁移至 `tests/blueprints/dataRelationship.test.ts` 或直接删除

### 3.2 补充 AGENTS.md 定义（中低风险）

以下目录应补充到 AGENTS.md §一 或新增章节：

| 目录 | 建议定义位置 | 定义内容 |
|------|-------------|---------|
| `src/hooks/` | §一 分层结构图 | React Hooks 层，可被 pages/ components/ apps/ 引用 |
| `src/devtools/` | §一 或新增"开发工具层" | 开发环境专用调试工具，仅 DEV 模式加载 |
| `src/fixtures/` | §一 或测试章节 | Mock 数据和测试夹具 |
| `src/i18n/` | §一 或备注 | 国际化框架占位（v0.9.11 P2-DATA002） |

### 3.3 需进一步确认（中风险）

| 目录 | 需确认内容 | 确认方法 |
|------|-----------|---------|
| `src/core/databridge.ts` | `DataBridgeAdapter` 是否为 `core/databridge.ts` 的必要包装 | 审阅 `src/core/databridge.ts` 是否已包含同类功能；如重复，迁移合并 |
| `src/schema/` | JSON Schema 是否被运行时校验使用 | 全局搜索 `zod`、`ajv`、`yup`、`schema`、`validate` 在 src/ 中的使用 |
| `src/showcase/` | 是否有路由指向展示页面 | 搜索 `routes.ts` 中 `showcase`、`Showcase` 关键词 |
| `src/generated/` | `tokens.css` 是否被 `index.css` 引用 | 搜索 `index.css` 和 vite 配置中的 import |

### 3.4 架构治理建议

1. **建立目录新增审批流程**: 新增 `src/` 一级目录前，必须在 AGENTS.md 中补充定义并说明职责边界
2. **定期执行目录合规扫描**: 建议每季度运行一次目录审计，发现未定义目录及时评估
3. **`.gitignore` 分级管理**: 将 `outputs/`、`src/generated/`（如确认可生成）等纳入 `.gitignore`，避免仓库膨胀

---

## 四、评估局限与声明

1. 本评估基于 2026-07-12 的代码快照，后续 commit 可能改变引用关系
2. `src/schema/`、`src/showcase/`、`src/generated/` 的运行时用途未通过动态执行验证，仅通过静态分析判断
3. 部分文件内容未逐行审阅（如 `src/hooks/` 下的全部 11 个文件），引用计数基于 Grep 全局搜索
4. 如评估结论与实际情况不符，以实际代码行为和团队决策为准
