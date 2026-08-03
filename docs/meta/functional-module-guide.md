---
title: 功能模块分类图示与开发者必读清单
tier: important
status: active
maintainer: V9 Architecture Team
summary: "写入流程：UI/Store → Service → DataBridge.forward(StandardEnvelope) → data/gateway → IndexedDB"
tags: [project, guide, checklist, component, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-015
referenced_by: [V9-DOC-META-000]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---meta
domain: project
tier: important
doc_id: V9-DOC-PROJ-015
status: active
maintainer: V9 Architecture Team
summary: "写入流程：UI/Store → Service → DataBridge.forward(StandardEnvelope) → data/gateway → IndexedDB"
tags: [project, guide, checklist]
phase: development
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# 功能模块分类图示与开发者必读清单

> 本文档按功能模块对 docs/ 下 596 份文档进行分类，每个模块配备颜色标注与图示说明。
> 核心板块附流程图/架构图，文末附开发者必读注意事项清单。
---

## 一、功能模块分类（17 类 × 3 层级 × 颜色编码）
### 颜色编码规则

| 颜色 | 色系 | 含义 |
|------|------|------|
| 🔴 coral | 珊瑚红 | 治理/安全——变更需架构评审 |
| 🔵 blue | 蓝 | 架构/性能——系统骨架 |
| 🟢 teal | 青绿 | 数据/AI——数据资产 |
| 🟣 purple | 紫 | 契约/MCP——接口约定 |
| 🟡 green | 绿 | 指南/迁移——开发指导 |
| 🟠 amber | 琥珀 | 规格——技术标准 |
| 🩷 pink | 粉 | 设计——UI/UX 规范 |
| ⬜ gray | 灰 | 界面/参考——辅助/归档 |
| 🔴 red | 红 | 测试——质量保障 |

### 核心层（core, 70 份）——变更需评审

| 颜色 | 类目 | 代码 | 文档数 | 典型文档 | 关注点 |
|------|------|------|--------|----------|--------|
| 🔴 | 治理 | GOV | 30 | governance.md, directory-structure-guide.md, doc-trigger-action-map.md | 文档治理宪法、目录规则、触发映射 |
| 🔵 | 架构 | ARC | 29 | 03-architecture-standards.md, architecture.md | 分层规则、依赖方向、跨层调用禁止 |
| 🟢 | 数据 | DAT | 40 | data-dictionary-index.md, data-definition.md, data-flow-spec.md | 数据字典、DataBridge 契约、IndexedDB schema |
| 🟣 | 契约 | API | 34 | api-contract.md, databridge端点与数据映射清单.md | API 签名、端点映射、功能模块数据契约 |

### 重要层（important, 283 份）——开发查阅

| 颜色 | 类目 | 代码 | 文档数 | 典型文档 | 关注点 |
|------|------|------|--------|----------|--------|
| 🟡 | 指南 | GUIDE | 30 | hooks-guide.md, component-library-guide.md, how-to-add-service.md | 开发流程、组件使用、四步集成 |
| 🟠 | 规格 | SPEC | 49 | 05-engine-specs.md, 06-routing-specs.md, 09-quality-gates.md | 引擎规格、路由、质量门禁 |
| 🩷 | 设计 | DESIGN | 13 | ui-design-system.md, design-token-mapping.md, song-aesthetics.md | 设计令牌、宋韵美学、a11y |
| ⬜ | 界面 | UI | 10 | atomic-component-system.md, widget-development-guide.md | 原子组件、Widget 注册三处同步 |
| 🔴 | 测试 | TEST | 20 | testing-strategy.md, regression-suite.md, completeness-profile.md | 测试策略、回归套件、覆盖率 |
| 🔴 | 安全 | SEC | 2 | rbac整合可行性分析.md | RBAC、权限模型 |
| 🔵 | 性能 | PERF | 1 | performance-baseline.md | 性能基线、压力测试 |
| 🟢 | AI | AI | 5 | ai-center-data-definition.md, ai-memory-layer.md | AI 调度中心、记忆层 |
| 🟣 | MCP | MCP | 0 | (规划中) | MCP 服务器生命周期 |
| 🟡 | 迁移 | MIGR | 6 | v6-to-v9-migration-spec.md, db-migration-v4-to-v6.md | 版本迁移、数据库 schema 升级 |

### 参考层（reference, 243 份）——只读归档

| 颜色 | 类目 | 代码 | 文档数 | 说明 |
|------|------|------|--------|------|
| ⬜ | 决策 | ADR | 8 | 架构决策记录（adr-001~adr-009） |
| ⬜ | 报告 | RPT | 160 | 审计报告、复盘、整改方案 |
| ⬜ | 日志 | LOG | 23 | changelog、weekly-task |
| ⬜ | 其他 | MISC | 136 | 未分类历史文档 |

---

## 二、核心板块架构图

### 2.1 分层依赖架构

```
config/  →  core/  →  data/  →  services/  →  store/  →  pages/ + components/
  ↑            ↑          ↑          ↑           ↑              ↑
 配置层      核心工具    数据层     服务层      状态层         UI层
 (零硬编码)  DataBridge  IndexedDB  20+子域    49个Store      5舱+组件
```

**禁止跨层调用**：
- pages/components → 禁止直接调 dataLayer / db
- services → 禁止直接写 db（必须通过 DataBridge.forward() → data/gateway/）
- 验证：`npm run audit:layers`（期望 0 violations）
### 2.2 数据流架构（DataBridge → dataLayer → IndexedDB）
**写入流程**：UI/Store → Service → DataBridge.forward(StandardEnvelope) → data/gateway → IndexedDB
**读取流程**：UI/Store → DataBridge.query() → dataLayer → IndexedDB

**关键约束**：
1. 所有写入封装为 StandardEnvelope（type/data/meta/timestamp）
2. withBroadcast 实现跨 Tab 同步
3. EventBus 仅用于事件通知，不用于数据流
### 2.3 文档自动更新管线

代码变更 → TRIGGER_RULES(T1-T10) 模式匹配 → DocGenerator 生成/更新 → audit:docs 引用校验 → doc:gate 4/4 通过

**10 条触发规则**：T1 类型定义 / T2 接口 / T3 架构 / T4 配置 / T5 Store / T6 组件 / T7 Hook / T8 页面 / T9 Widget / T10 版本

---

## 三、开发者必读注意事项清单

> **每位开发者在本项目开发前必须阅读并遵守以下清单。**

### 3.1 核心规范（必须遵守）

| # | 规范 | 验证命令 | 违反后果 |
|---|------|----------|----------|
| 1 | **分层依赖**：严格按 config→core→data→services→store→pages 层次，禁止跨层 | `npm run audit:layers` | 门禁阻断 |
| 2 | **颜色令牌**：UI 颜色必须引用 `src/constants/` 令牌，禁止 HEX/Tailwind 数字类 | `npm run lint:colors` | 门禁阻断 |
| 3 | **零 any**：禁止 `any`，禁止 `@ts-ignore`（用 `@ts-expect-error` + 注释） | `npx tsc --noEmit` | 编译失败 |
| 4 | **文档同步**：改代码后跑 `npm run doc:check`，确认 TRIGGER_RULES 路径有效 | `npm run doc:gate` | 门禁阻断 |
| 5 | **frontmatter**：每个 .md 必须有 `tier` + `code_version` frontmatter | `npm run doc:version-check` | 门禁阻断 |

### 3.2 四步集成编码契约（新增模块必须遵守）

```
1. 类型定义 → src/types/modules/ 或 src/data/types.ts
2. Store/状态 → src/store/（Zustand + withBroadcast 跨 Tab）
3. Service/适配层 → src/services/（通过 DataBridge 写入）
4. UI 集成 → src/pages/ 或 src/components/（仅通过 Store 获取数据）
```

每步可独立回滚，完成后 `npx tsc --noEmit` 验证。

### 3.3 常见问题（FAQ）
| 问题 | 原因 | 解决 |
|------|------|------|
| `audit:layers` 报跨层违规 | services 引入了 lib/ 非白名单模块 | 只引 logger/format/errors/utils 等基础设施白名单 |
| `lint:colors` 报硬编码颜色 | 直接写了 HEX 或 Tailwind 数字类 | 改用 `src/constants/` 中的令牌常量 |
| `doc:check` 报路径缺失 | 移动文档后未同步 TRIGGER_RULES | 同步映射表 §二 + 代码 docsToUpdate + 跑 doc:check |
| `tsc:scripts` 报 ROOT 路径错误 | 脚本移到子目录后未更新 ROOT 计算 | 用 `__dirname.replace(/[\\/]scripts([\\/].*)?$/, '')` |
| Husky pre-commit 循环 stash | 独立跑过 lint-staged 再跑 hook | hook 前不做独立 lint-staged |
| 批量删除 >50 文件被拦截 | SAFE_DELETE_BULK_CONFIRM_REQUIRED | 分批执行，每批 ≤40 |
| git diff 中文文件名转义 | core.quotepath=true 默认 | 用 `git -c core.quotepath=false` |
| JSDoc 注释含 `*/` | `**/` 提前闭合块注释 → tsc 级联报错 | 改用文字描述，不含字面 `*/` |

### 3.4 必须遵守的开发约定
| # | 约定 | 说明 |
|---|------|------|
| 1 | **A 股红涨绿跌** | 涨=红色，跌=绿色（中国股市惯例，与欧美相反） |
| 2 | **货币格式** | 默认 ¥（CNY/RMB） |
| 3 | **宋韵美学** | 亮色用 stone 暖灰系；暗色用 neutral 高级灰（hue 0） |
| 4 | **Widget 三处同步** | 新增 Widget 必改：widgetRegistry.ts + DEFAULT_WIDGET_CONFIG + WIDGET_DEFAULT_DATA_SOURCE |
| 5 | **事件名规范** | 采集事件：collect:triggered/source:start/success/fail/complete |
| 6 | **行情 URL 集中** | 所有行情 URL 在 `src/config/marketDataEndpoints.ts` |
| 7 | **API 路径集中** | 所有 API 路径在 `src/config/collectConfig.ts` |
| 8 | **AI 输出标注** | AI 输出须标「仅供参考非投资建议」 |
| 9 | **五因子评分** | 当前为合成种子，UI 须标「示例」；真实信号走 detectBySector |
| 10 | **slug 永不改** | 文件名(slug)是唯一标识符，重命名=全仓链接断链 |

### 3.5 门禁速查

| 门禁 | 命令 | 期望 |
|------|------|------|
| 分层审计 | `npm run audit:layers` | 0 violations |
| 颜色审计 | `npm run lint:colors` | 0 硬编码 |
| 类型安全 | `npx tsc --noEmit` | 0 错误 |
| 文档门禁 | `npm run doc:gate` | 4/4 通过 |
| 文档路径 | `npm run doc:check` | 22/22 ✓ |
| 复杂度 | `npm run audit:complexity` | 0 深层嵌套 / 0 长链 |

---

## 四、文档查阅指南

| 我是... | 应该先读... | 然后读... |
|---------|-----------|----------|
| **新人** | 本文档 + tutorials/getting-started.md | 03-architecture-standards.md（C-11） |
| **后端开发** | api-contract.md（C-08）+ data-dictionary-index.md（C-19） | data-flow-spec.md + databridge端点与数据映射清单.md |
| **前端开发** | hooks-guide.md（I-xx）+ component-library-guide.md | ui-design-system.md + 06-routing-specs.md |
| **架构治理** | governance.md + directory-structure-guide.md | doc-trigger-action-map.md + AGENTS.md |
| **QA** | testing-strategy.md + 09-quality-gates.md | regression-suite.md + completeness-profile.md |

> 编号查阅：`docs/00-meta/doc-manifest.csv`（可 Excel 打开，按 tier 分区 C/I/R）
