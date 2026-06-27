---
title: V9 输入舱升级策略报告
version: v0.9.0
last_updated: 2026-06-24
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-24
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# V9 输入舱升级策略报告

> **Status**: Current  
> **Version**: v0.9.0-docs-review  
> **Last Updated**: 2026-06-24
>
> 基于 `D:\v6-pro-cockpit\docs` 整体业务板块架构/功能设计检索，与 V9 当前 `docs/` 及已实现代码进行校对，明确缺失的体系化内容与思考深度，提出 UI 组件、代码、路由、映射的修改策略与理由。

---

## 1. 背景与目标

### 1.1 已完成工作

- **输入舱 UI 体系化重塑**：PortalShell 升级为 Kimi 经典深色布局；输入舱拆分为 `/input`、`/input/bulk-import`、`/input/hot-sectors`、`/input/data-test` 四个子页面。
- **批量导入 bug 修复**：`parseBulkInput` 正确解析 `代码,名称` 格式。
- **交互原型页**：`/input/prototype` 已上线，模拟了搜索、质量指示、批量导入状态行、热门板块因子进度条、采集测试数据源健康度等增强点。

### 1.2 本次任务

从 `v6-pro-cockpit\docs` 中吸收其**模块架构、功能规格、数据协议、UI/UX 原则、路由映射、实施治理**等方面的体系化成果，对 V9 输入舱进行再校对、再提升，并形成可落地的修改策略。

---

## 2. v6 文档体系与 V9 当前文档的对比

### 2.1 v6 文档体系特点

| 维度 | v6 文档体现 | V9 当前状态 |
|------|------------|-------------|
| **架构版本统一** | 有 `architecture-guide.md`、`v6_pro_full_architecture_redefinition.md` 等统一三舱/三层规范 | 五层架构在 `03-architecture-standards.md` 中已定义，但缺少与 v6 三舱硬隔离、Gateway 双仲裁、StateBoard 字段契约的显式对照 |
| **模块功能映射** | `UI_FUNCTION_MAPPING.md` 32 个模块、Agent 标签→模块→字段 3D 映射 | `02-functional-specs.md` 有用户故事和流程，但缺少**模块→组件→路由**的完整映射表 |
| **设计令牌体系** | `theme.config.ts` 宋瓷令牌覆盖 471+ 处，已迁移完成 | `src/theme.config.ts` 已建立，但缺少「已迁移/待迁移」清单和硬编码审计基线 |
| **数据协议** | `v6_pro_data_interaction_protocols.md`、`StateBoard` 字段契约、来源/版本/审计 | V9 使用 DataBridge + dataLayer + eventBus，但缺少**字段级写入契约**和**来源 provenance** 的明确规范 |
| **路由漂移治理** | 明确记录 22 个旧页面未引用、6 个模块指向不存在文件 | V9 `06-routing-specs.md` 已注册当前路由，但缺少**文件存在性审计**和**未引用文件清单** |
| **实施治理** | Scheme A、P0–P3 治理、缺口分析、交付检查清单、质量审计报告 | V9 `08-implementation-plan.md` 有阶段任务，`09-quality-gates.md` 有门禁，但缺少**缺口分析报告**和**引擎→UI 映射补全计划** |
| **权衡记录** | 大量文档记录「为什么这样选」「代价是什么」 | V9 部分技术选型理由在 `03-architecture-standards.md` 中，但 UI/UX、路由、数据协议层面的权衡记录不足 |

### 2.2 V9 文档当前缺失的体系化内容

1. **缺少「输入舱业务蓝图」**：没有把「数据采集 → 股票池管理 → 评分 → 交易」端到端流程与输入舱子页一一对应。
2. **缺少「组件→路由→服务」映射表**：现有 `06-routing-specs.md` 只有路由表，没有组件和服务层对照。
3. **缺少 UI/UX 决策记录**：为什么用深色主题、为什么 Sidebar 分组、卡片网格几列等，没有决策上下文。
4. **缺少数据字段契约**：输入舱写入 stocks/intelligent_scores 等 store 时，字段、来源、版本、审计规则未文档化。
5. **缺少质量缺口清单**：硬编码、测试覆盖率、引擎→UI 映射缺口没有量化基线。
6. **缺少原型到落地的迁移计划**：`/input/prototype` 是临时页，哪些能力进入正式子页、进入顺序、数据协议如何对接，尚未明确。

---

## 3. 输入舱当前问题诊断（结合原型校验）

### 3.1 业务闭环完整性

| 环节 | 当前状态 | 缺失 | 影响 |
|------|---------|------|------|
| 股票录入 | 手动输入 symbol/name，或批量文本导入 | 无搜索组件、无代码自动补全 | 用户记忆成本高，易出错 |
| 候选池管理 | 五态看板 + 单卡片流转 | 无批量选择、无质量指示、无导入/导出 | 标的多了操作低效，数据完整性不可见 |
| 批量导入 | 解析预览 + 导入结果错误 | 无行级有效/无效状态、无导入进度列表 | 用户无法提前识别问题，过程不可见 |
| 热门板块 | 板块卡片 + 关联股票 | 无因子进度条、无排名轮动建议 | 信息密度低，难以辅助决策 |
| 采集测试 | 健康检查 + 单/批量接口测试 | 无多数据源健康度、无实时行情探测、无清洗检查 | 无法全面评估采集可用性 |
| 采集配置 | 无 UI | `fetcherConfig.dimensions` 只能在代码中改 | 用户无法按需调整维度/频率/限流 |

### 3.2 架构/代码层面

| 问题 | 说明 | 风险 |
|------|------|------|
| 路由表未审计 | `src/config/routes.ts` 未与 `src/apps/`、`src/pages/` 文件做一致性扫描 | 新增/删除文件后易出现漂移 |
| UI 层仍存硬编码 | 原型中使用了部分 Tailwind 颜色字符串（如 `text-red-400`） | 违反 `03-architecture-standards.md` 映射层规范 |
| 引擎→UI 映射不完整 | `FetcherScheduler`、`poolTransitionEngine` 等引擎已有能力，但 UI 未全部暴露 | 能力浪费，用户感知弱 |
| 缺少输入舱专用配置层 | 批量导入上限、默认解析格式、质量指示规则等散落在组件中 | 难以维护和统一调整 |
| 事件总线使用不规范 | 组件直接刷新本地状态，缺少统一订阅/广播规范 | 多页面数据不同步 |

---

## 4. 修改策略与理由

### 4.1 总体策略

**策略 A：先补齐文档与映射，再落地方案**

理由：v6 的成功之处在于「文档即代码契约」。V9 当前代码已跑通，但文档滞后。若直接继续堆功能，会加剧路由漂移、硬编码、测试覆盖不足等问题。

**策略 B：输入舱能力分 P0/P1/P2 落地**

| 阶段 | 目标 | 范围 |
|------|------|------|
| P0 | 补齐录入与导入闭环 | 搜索组件、质量指示、批量导入状态行、导入/导出 |
| P1 | 提升板块与采集信息密度 | 热门板块因子进度条、排名轮动、数据源健康度、实时行情探测 |
| P2 | 高级配置与全局体验 | 采集维度配置、面包屑、底部状态栏、键盘快捷键 |

**策略 C：所有 UI 增强必须对应 config + service + route 三处同步**

理由：避免「UI 孤岛」。v6 的 `UI_FUNCTION_MAPPING.md` 要求模块→字段→UI 三向可追踪，V9 应建立类似机制。

---

### 4.2 UI 组件修改策略

| 组件/模块 | 修改内容 | 理由 | 利弊分析 |
|-----------|---------|------|----------|
| `StockSearch`（新增） | 防抖搜索 + 下拉表格（代码/名称/行业/PE/PB/市值/操作） | 降低录入门槛，减少错误 | ✅ 提升效率；⚠️ 需要 mock 或接入本地股票基础库 |
| `QualityIndicator`（新增） | 数据质量圆点/进度条（basic/kline/finance） | 让用户一眼判断标的是否可分析 | ✅ 信息前置；⚠️ 需要定义质量计算规则 |
| `PoolBoard` 增强 | 列表视图切换、复选批量操作、批量流转/采集/删除 | 标的多了之后提升操作效率 | ✅ 减少重复点击；⚠️ 批量操作需二次确认 |
| `BulkImportPanel` 增强 | 行级状态列、导入进度列表、上限提示、清空按钮 | 让导入过程透明可控 | ✅ 降低失败率；⚠️ 增加 UI 复杂度 |
| `HotSectorPanel` 增强 | 五因子进度条、排名 #、轮动建议文案 | 提升板块决策信息密度 | ✅ 接近 v6 成熟设计；⚠️ 数据来自 mock 或需接入 SKILL |
| `DataTestPanel` 增强 | 数据源健康列表、延迟、实时行情探测、清洗检查 | 全面评估采集可用性 | ✅ 降低运行时故障；⚠️ 需扩展 fetcherService 契约 |
| `FetcherConfigPanel`（新增） | 维度启用/频率/数据源优先级/限流配置 | 把 `fetcherConfig` 从代码配置变为 UI 配置 | ✅ 提升灵活性；⚠️ 需要持久化和版本迁移 |
| `Breadcrumb`（新增） | 顶部面包屑 | 导航清晰，符合 04-UI 规范 | ✅ 体验增强；⚠️ 需要维护 crumb 映射 |

---

### 4.3 代码/服务层修改策略

| 修改点 | 内容 | 理由 |
|--------|------|------|
| `src/config/inputConfig.ts`（新增） | 集中定义输入舱常量：导入上限、解析分隔符、质量规则、默认视图 | 避免硬编码，符合配置层规范 |
| `src/services/input/inputService.ts` 增强 | 增加 `searchStocks`、`batchCollect`、`exportPool`、`importPool` | 把搜索/批量/导入导出逻辑下沉到服务层 |
| `src/services/input/batchImportService.ts` 增强 | 解析结果返回行级状态（valid/duplicate/invalid） | 支持 UI 预览和错误高亮 |
| `src/services/input/hotSectorService.ts` 增强 | 返回 factor 明细、排名、轮动建议 | 支持热门板块进度条与文案 |
| `src/services/fetcher/fetcherService.ts` 增强 | 增加 `checkDataSources`、`probeQuote`、`cleanData` | 支持采集测试多维度能力 |
| `src/services/fetcher/fetcherConfigService.ts`（新增） | 读写 `fetcherConfig` 到 IndexedDB | 支持 UI 配置持久化 |
| `src/components/pool/PoolCard.tsx` 增强 | 集成 `QualityIndicator`、复选框 | 看板信息密度提升 |
| `src/portal/PortalShell.tsx` 增强 | 增加面包屑、底部状态栏（可选） | 全局导航与状态可见 |

---

### 4.4 路由与映射修改策略

| 修改点 | 内容 | 理由 |
|--------|------|------|
| `src/config/routes.ts` | 保持当前 `/input/*` 子路由；删除临时 `/input/prototype` 前确认迁移完成 | 路由表即真相源 |
| `docs/06-routing-specs.md` | 增加「输入舱子页 → 组件 → 服务」映射表 | 补齐映射缺口 |
| `docs/implementation/input-cabin-ui-reshaping.md` | 更新为正式落地文档，删除原型描述 | 文档与代码同步 |
| `docs/02-functional-specs.md` | 补充输入舱用户故事 US-006~US-009：搜索、批量操作、导入导出、板块推荐 | 需求层面闭环 |
| `docs/08-implementation-plan.md` | 将原型能力拆分为 P0/P1/P2 任务，标注状态 | 实施计划可追踪 |

---

### 4.5 数据协议修改策略

| 修改点 | 内容 | 理由 |
|--------|------|------|
| 明确输入舱写入契约 | 录入/导入/流转均通过 `DataBridge.forward()`，携带 `source: input-cabin` | 满足 `03-architecture-standards.md` 数据访问规范 |
| 增加 `dataQuality` 字段 | 在 `Stock` 或独立 `stock_quality` store 记录 basic/kline/finance 完整度 | 支撑质量指示组件 |
| 事件总线规范 | 输入舱内统一使用 `eventBus.emit('input:poolChanged')` | 保证多子页数据同步 |
| 导入/导出格式 | 定义 JSON Schema：`{ version, exportedAt, stocks[], scores? }` | 数据迁移与备份可校验 |

---

## 5. 利弊与风险分析

### 5.1 收益

| 收益 | 说明 |
|------|------|
| 用户体验提升 | 搜索、批量操作、进度反馈、质量指示显著降低操作成本 |
| 信息密度提升 | 热门板块因子进度条、数据源健康度让决策更有依据 |
| 可维护性提升 | 配置层集中、服务层下沉、文档同步，减少硬编码 |
| 架构一致性提升 | 输入舱能力通过 DataBridge/事件总线规范接入，符合五层架构 |

### 5.2 成本与风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 原型页代码直接复用导致硬编码 | 违反映射层规范 | 落地时抽取配置、使用 theme 令牌、补充测试 |
| 新增服务增加测试负担 | 测试覆盖率下降 | 每个新增服务同步补充单元测试 |
| `fetcherConfig` UI 配置持久化复杂 | 可能引入 DB 版本迁移 | 先前端内存配置，稳定后再持久化 |
| 热门板块数据仍依赖 mock | 用户感知为演示 | 明确标注 mock 来源，接入 V4/V6 评分 SKILL 后替换 |
| 路由/文件漂移 | 新增组件未注册或旧文件未清理 | 每次变更后运行 `audit:deadcode` 和路由一致性检查 |

---

## 6. 分阶段实施建议

### Phase 1：文档与基础组件补齐（1–2 天）

1. 新增 `src/config/inputConfig.ts`，集中输入舱常量。
2. 新增 `StockSearch`、`QualityIndicator` 组件。
3. 更新 `InputDashboard`：接入搜索、质量指示、列表视图、批量操作、导入/导出按钮。
4. 更新 `docs/02-functional-specs.md`、`docs/06-routing-specs.md`、`docs/08-implementation-plan.md`。
5. 补充单元测试。

### Phase 2：批量导入与热门板块增强（2–3 天）

1. 增强 `batchImportService` 返回行级状态。
2. 重写 `BulkImportPanel`：预览表格含状态列、导入进度列表、上限提示。
3. 增强 `hotSectorService` 返回 factor 明细与排名。
4. 重写 `HotSectorPanel`：因子进度条、轮动建议、关联股票列表增强。
5. 同步更新文档与测试。

### Phase 3：采集测试与配置面板（3–4 天）

1. 增强 `fetcherService`：数据源健康检查、实时行情探测、清洗检查。
2. 重写 `DataTestPanel`：多数据源列表、探测卡片、清洗结果。
3. 新增 `FetcherConfigPanel`（抽屉或子页）：维度/频率/数据源/限流配置。
4. 新增 `fetcherConfigService` 持久化配置。
5. 更新 `docs/implementation/data-collection-architecture.md`。

### Phase 4：全局体验优化（1–2 天）

1. `PortalShell` 增加面包屑、底部状态栏（可选）。
2. 输入舱全局键盘快捷键。
3. 删除临时 `/input/prototype` 路由与文件（或保留为设计档案）。
4. 运行全部质量门禁，更新 `CHANGELOG.md`。

---

## 7. 立即需要确认的问题

1. **是否接受新增 `src/config/inputConfig.ts` 和 `fetcherConfigService`？** 这会把部分配置从代码层提升到可运行时调整。
2. **搜索组件的数据源**：使用本地 mock 股票库、接入 AKShare 搜索接口，还是仅对候选池做本地过滤？
3. **热门板块数据**：继续 mock，还是优先接入 V4 行业评分 SKILL？
4. **采集配置是否立即持久化到 IndexedDB**：建议 Phase 3 先做内存配置，验证稳定后再持久化。
5. **是否保留 `/input/prototype`**：建议 Phase 4 删除，或移动到 `docs/implementation/prototype-reference.md` 作为设计档案。

---

## 8. 结论

V9 输入舱已具备良好骨架，但与 v6 相比，在**文档体系化、模块→组件→路由映射、数据字段契约、引擎→UI 映射、质量缺口清单**等方面仍有差距。建议先按本报告补齐文档与配置层，再分 P0/P1/P2 落地原型中验证过的 UI 增强，确保每次修改都同步更新代码、路由、服务与文档。
