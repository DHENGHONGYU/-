---
title: data-collection-route-ui-audit
code_version: 2.0.0
tier: reference
status: archived
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
---

# 数据采集模块路由与UI校对分析报告

> 基于V9路由注册表、UI组件清单、F盘V6设计文档的三维交叉校对
> 
> **Version**：v1.0 | 日期：2026-07-01

---

## 一、路由映射校对

### 1.1 V9路由注册表 vs V6路由架构

| V6路由 | V6页面名称 | V9对应路由 | V9页面组件 | 校对结果 |
|:---|:---|:---|:---|:---:|
| `/data-hub` | 数据工场（4 Tab） | `/input` | `InputDashboard` | ⚠️ 降级 |
| `/seven-dim` | 七维采集 | `/input/seven-dim` | `SevenDimConfigPage` | ✅ 已新建 |
| `/fetcher` | 抓取引擎 | — | — | ❌ 缺失 |
| `/collect-task` | 采集任务 | — | — | ❌ 缺失 |
| `/news` | 智能资讯 | `/analysis/news` | `NewsPage` | ⚠️ 位置迁移 |
| `/data` | 数据管理 | — | — | ❌ 缺失 |
| — | — | `/input/bulk-import` | `BulkImportPanel` | ✅ V9新增 |
| — | — | `/input/hot-sectors` | `HotSectorPanel` | ✅ V9新增 |
| — | — | `/input/data-test` | `DataTestPanel` | ✅ V9新增 |
| — | — | `/input/local-knowledge` | `LocalKnowledgePage` | ✅ V9新增 |

### 1.2 路由注册合规性问题

| 优先级 | 问题 | 影响 | 建议操作 |
|:---:|:---|:---|:---|
| **高** | `/input/seven-dim` 未在 `ROUTE_REGISTRY` 注册 | 脱离中央路由表管控，违反"所有业务路由必须在此注册"规则 | ✅ 已修复（2026-07-01） |
| **高** | `ResearchReportPage.tsx` / `TradeReviewPage.tsx` 为完全孤儿 | 已实现的页面无法访问 | ✅ 已修复（2026-07-01） |
| **中** | `./06-routing-specs.md` 第8节残留 `/hub` 和 `/analysis/news-v6` | 文档与代码不一致 | 同步文档映射表 |
| **中** | 文档版本号矛盾（v1.5.0 vs v1.2.0 / 29条 vs 31条） | 文档可信度降低 | 修正版本号与路由计数 |
| **中** | 文档第7节"ErrorBoundary仅包裹根路由"描述滞后 | `RouteErrorBoundary` 已实现但文档未更新 | 更新文档标注已闭环 |
| **低** | `OutputApp` 未显式包 `<React.Suspense>` | Suspense边界不明确 | 显式包裹 |

### 1.3 V6数据工场4 Tab → V9迁移状态

V6数据工场 `/data-hub` 含4个Tab，V9的迁移情况：

| V6 Tab | 功能 | V9对应 | 迁移状态 |
|:---|:---|:---|:---:|
| 模块总览 | 6大子模块入口卡片 | `InputHubPage`（6卡片） | ✅ 已迁移 |
| 数据看板 | 8维度数据卡片 | — | ❌ 缺失 |
| 七维状态 | 实时采集状态监控 | — | ❌ 缺失 |
| 数据导出 | JSON/CSV导出 | `/output/export` | ⚠️ 迁移至输出舱 |

---

## 二、UI组件校对

### 2.1 V6采集模块UI组件 → V9对照

| V6组件 | V6功能 | V9对应组件 | 校对结果 |
|:---|:---|:---|:---:|
| `SevenDimCollectPage` | 七维采集页（~400行） | `SevenDimConfigPage` | ✅ 已新建（框架） |
| `CollectParamPanel` | 采集参数调整面板 | SevenDimConfigPage内嵌面板 | ⚠️ 简化版 |
| `CollectMonitor` | 采集监控界面（7维度状态卡） | — | ❌ 缺失 |
| `CollectTaskPage` | 采集任务页（3Tab：任务/评分/日志） | — | ❌ 缺失 |
| `FetcherPage` | 抓取引擎页（数据源列表/日志） | — | ❌ 缺失 |
| `DataHubPage` | 数据工场4Tab架构 | `InputHubPage` + `InputDashboard` | ⚠️ 拆分迁移 |
| `NewsPage`(V6) | 智能资讯页 | `NewsPage`(V9, `/analysis/news`) | ⚠️ 位置迁移 |
| `DirectDataAPI` | 前端直连腾讯/新浪/网易 | `fetcherClient` | ⚠️ 仅AKShare |
| 接口测试弹窗 | 5接口一键测试 | `DataTestPanel` | ✅ 已实现（简化版） |

### 2.2 V9现有采集UI组件清单与合规性

| 组件 | 文件 | ErrorBoundary | 四步契约 | 加载/错误/空态 | 综合评价 |
|:---|:---|:---:|:---:|:---:|:---:|
| `InputHubPage` | [InputHubPage.tsx](file:////src/pages/input/InputHubPage.tsx) | ✅ | 部分 | 无（静态页） | 🟢 良好 |
| `SevenDimConfigPage` | [SevenDimConfigPage.tsx](../../src/pages/input/SevenDimConfigPage.tsx) | ✅ | 良好 | 全覆盖 | 🟢 良好 |
| `LocalKnowledgePage` | [LocalKnowledgePage.tsx](../../src/pages/input/LocalKnowledgePage.tsx) | ❌ | 良好 | 全覆盖 | 🟡 需补EB |
| `InputDashboard` | [InputDashboard.tsx](../../src/apps/input/InputDashboard.tsx) | ❌ | **违规** | 有加载/错误 | 🔴 DF-002 |
| `DataTestPanel` | [DataTestPanel.tsx](../../src/apps/input/DataTestPanel.tsx) | ❌ | 良好 | 全覆盖 | 🟡 需补EB |
| `HotSectorPanel` | [HotSectorPanel.tsx](../../src/apps/input/HotSectorPanel.tsx) | ❌ | **违规** | 有加载/错误 | 🔴 DF-002 |
| `BulkImportPanel` | [BulkImportPanel.tsx](../../src/apps/input/BulkImportPanel.tsx) | ❌ | **违规** | 有加载/错误 | 🔴 DF-002 |
| `StockSearch` | [StockSearch.tsx](../../src/components/organisms/input/StockSearch.tsx) | ❌ | **违规** | 有加载/空态 | 🔴 DF-002 |

### 2.3 缺失的UI组件（需新建）

| 优先级 | 组件 | V6参考 | 功能描述 | 建议路由 |
|:---:|:---|:---|:---|:---|
| P0 | `CollectTaskPage` | V6 CollectTaskPage | 采集任务列表/评分卡片/采集日志 3Tab | `/input/collect-task` |
| P0 | `CollectMonitor` | V6 CollectMonitor | 7维度状态卡+统计面板+变动率监控+实时日志 | `/input/collect-monitor` |
| P1 | `FetcherConfigPage` | V6 FetcherPage | 数据源列表+适配器配置+采集日志+自动清洗 | `/input/fetcher` |
| P1 | `DataDashboard` | V6 数据看板Tab | 8维度数据卡片+数据质量报告 | `/input/dashboard`增强 |
| P2 | `CollectParamPanel` | V6 CollectParamPanel | 额度预估仪表盘+Kimi套餐+8维度频率表 | 嵌入SevenDimConfigPage |

---

## 三、SevenDimConfigPage V6→V9 UI对照

### 3.1 页面布局对比

| UI区域 | V6设计 | V9实现 | 差距 |
|:---|:---|:---|:---|
| 页面头部 | 返回链接+h1标题+副标题+查看任务链接 | 面包屑+h1+副标题+V9徽章 | ⚠️ 缺"查看采集任务"链接 |
| 策略模板卡片 | 5卡片（蓝/绿/橙/紫/红） | 5卡片（无边框色） | ⚠️ 缺颜色标识 |
| 左侧维度选择 | 7维度开关（全量/轻量化标签） | 8维度开关（含色块+Badge+字段标签） | ✅ V9更丰富 |
| 右侧参数配置 | 目标股票+历史天数+数据源+预估+开始采集 | 标的数+历史天数（简化版） | ⚠️ 缺目标股票输入、预估数据量 |
| 采集参数面板 | 月调用3卡片+额度进度条+Kimi套餐+频率表+限流 | 额度预估卡片（月调用+日限+AKShare+使用率） | ⚠️ 缺Kimi套餐、频率表、限流配置 |
| 采集方案整合面板 | 四层架构图+维度接口映射+频率表+接口测试+开始采集 | — | ❌ 完全缺失 |
| 接口测试弹窗 | 5接口一键测试+多源对比+降级测试 | — | ❌ 完全缺失 |

### 3.2 功能完整性评分

| 功能模块 | V6完整度 | V9实现度 | 差距 |
|:---|:---:|:---:|:---:|
| 策略模板选择 | 100% | 90% | 10% |
| 维度开关 | 100% | 95% | 5% |
| 参数配置 | 100% | 40% | 60% |
| 额度预估 | 100% | 50% | 50% |
| 采集方案整合 | 100% | 0% | 100% |
| 接口测试 | 100% | 0% | 100% |
| 四层降级展示 | 100% | 0% | 100% |
| **加权平均** | **100%** | **~40%** | **~60%** |

---

## 四、功能模块校对

### 4.1 V6→V9功能迁移完整度

| V6功能模块 | V9迁移状态 | 说明 |
|:---|:---:|:---|
| 股票池管理（4分组/32只/导入导出） | 🟡 60% | 有PoolBoard+StockSearch，缺分组管理增强 |
| 七维采集（5模板/7维度/参数配置） | 🟡 40% | 有SevenDimConfigPage框架，缺采集方案整合面板 |
| 采集任务（进度监控/评分卡片/日志） | 🔴 0% | 完全缺失 |
| 智能资讯（新闻索引/研报/情感分析） | 🟡 20% | newsService仅保存，无爬虫 |
| 抓取引擎（多源/适配器/清洗） | 🟡 30% | fetcherService+fetcherClient，缺UI面板 |
| 本地存储（7维JSON/数据看板/导出） | 🟡 40% | IndexedDB已实现，缺数据看板 |
| 数据流水线可视化（7节点） | 🔴 0% | 完全缺失 |
| 数据导出（JSON/CSV/按维度筛选） | 🟡 50% | OutputApp有导出面板 |
| 接口测试（5接口一键测试） | 🟡 30% | DataTestPanel简化版 |
| 四层数据源降级（腾讯→AKShare→Kimi→Mock） | 🔴 10% | 仅AKShare+Mock两Provider |

### 4.2 V6数据工场6大子模块 → V9映射

| V6子模块 | V6入口 | V9入口 | V9组件 | 映射状态 |
|:---|:---|:---|:---|:---:|
| 股票池管理 | `/data-hub`→模块总览 | `/input` | `InputDashboard` | ✅ 已映射 |
| 七维采集 | `/seven-dim` | `/input/seven-dim` | `SevenDimConfigPage` | ✅ 已映射 |
| 采集任务 | `/collect-task` | — | — | ❌ 缺失 |
| 智能资讯 | `/news` | `/analysis/news` | `NewsPage` | ⚠️ 迁移至分析舱 |
| 抓取引擎 | `/fetcher` | — | — | ❌ 缺失 |
| 本地存储 | `/data-hub`→数据看板 | — | — | ❌ 缺失 |

---

## 五、架构问题汇总

### 5.1 路由层问题

```
问题1：/input/seven-dim 未在 ROUTE_REGISTRY 注册 ✅ 已修复（2026-07-01）
  ├─ 影响：脱离中央路由表管控，isPathWhitelisted() 不包含此路径
  ├─ 风险：外部跳转校验可能拒绝此URL
  └─ 修复：routes.ts 添加 { path: '/input/seven-dim', component: PortalShell, ... } — 已完成

问题2：ResearchReportPage.tsx / TradeReviewPage.tsx 完全孤儿 ✅ 已修复（2026-07-01）
  ├─ 影响：已实现的页面无法通过路由访问
  ├─ 现状：OutputApp 用 PlaceholderPanel 占位
  └─ 修复：替换 PlaceholderPanel → lazy import 实际页面 — 已完成

问题3：docs/06-routing-specs.md 与代码不一致
  ├─ 第8节残留 /hub 路径（已移除）
  ├─ 第8节残留 /analysis/news-v6（已删除）
  ├─ 第8节缺失14条已注册路由
  ├─ 第9节版本号矛盾（v1.5.0 vs v1.2.0）
  └─ 第7节 ErrorBoundary 描述滞后（已实现 RouteErrorBoundary）
```

### 5.2 UI组件层问题

```
问题4：4个组件违反四步契约（DF-002 数据流违规）
  ├─ InputDashboard：直接调 inputService/stockpoolService
  ├─ HotSectorPanel：直接调 hotSectorService
  ├─ BulkImportPanel：直接调 batchImportService
  └─ StockSearch：直接调 inputService
  → 整改方向：操作封装到 Store action

问题5：5个组件缺ErrorBoundary
  ├─ LocalKnowledgePage
  ├─ InputDashboard
  ├─ DataTestPanel
  ├─ HotSectorPanel
  └─ BulkImportPanel
  → 整改方向：参照 InputApp 模式补 ErrorBoundary

问题6：AnalysisApp/TradingApp/OutputApp/CommandApp 内部无独立 ErrorBoundary
  ├─ 仅 InputApp 有 <ErrorBoundary> 包裹子路由
  └─ 其他4舱依赖外层 RouteErrorBoundary 兜底
  → 整改方向：统一补 ErrorBoundary
```

### 5.3 功能缺失问题

```
问题7：4个核心UI组件完全缺失
  ├─ CollectTaskPage（采集任务监控）
  ├─ CollectMonitor（采集实时监控）
  ├─ FetcherConfigPage（抓取引擎配置）
  └─ DataDashboard（8维度数据看板）

问题8：SevenDimConfigPage 功能不完整
  ├─ 缺采集方案整合面板（四层架构图/维度接口映射/频率表）
  ├─ 缺接口测试弹窗
  ├─ 缺Kimi Work套餐选择
  ├─ 缺8维度频率表
  ├─ 缺限流配置展示
  └─ 缺目标股票输入框

问题9：数据流水线可视化完全缺失
  └─ V6有完整7节点流水线+动画+状态指示，V9未开始
```

---

## 六、优化建议

### 6.1 即时修复（P0 - 路由合规）

| 编号 | 操作 | 文件 | 复杂度 |
|:---:|:---|:---|:---:|
| F-01 | `/input/seven-dim` 注册到 `ROUTE_REGISTRY` | [routes.ts](file:////src/config/routes.ts) | ✅ 已完成 |
| F-02 | 替换 OutputApp 的 PlaceholderPanel → 实际页面 | [OutputApp.tsx](../../src/apps/output/OutputApp.tsx) | ✅ 已完成 |
| F-03 | 同步 docs/06-routing-specs.md 路由表 | [06-routing-specs.md](../../../reference/06-routing-specs.md) | 中 |

### 6.2 短期优化（P1 - UI组件合规）

| 编号 | 操作 | 影响文件 | 复杂度 |
|:---:|:---|:---|:---:|
| F-04 | 4个组件补 ErrorBoundary | LocalKnowledgePage/DataTestPanel/HotSectorPanel/BulkImportPanel | 低 |
| F-05 | 4个CabinApp补内部ErrorBoundary | AnalysisApp/TradingApp/OutputApp/CommandApp | 低 |
| F-06 | DF-002整改：InputDashboard操作封装到Store | InputDashboard.tsx + inputHubStore.ts | 中 |
| F-07 | DF-002整改：HotSectorPanel操作封装到Store | HotSectorPanel.tsx + poolStore.ts | 中 |
| F-08 | DF-002整改：BulkImportPanel操作封装到Store | BulkImportPanel.tsx + poolStore.ts | 中 |

### 6.3 中期建设（P2 - 缺失组件）

| 编号 | 操作 | 新建文件 | 复杂度 |
|:---:|:---|:---|:---:|
| F-09 | 新建 CollectTaskPage（采集任务监控3Tab） | `src/pages/input/CollectTask/index.tsx` | 高 |
| F-10 | 新建 CollectMonitor（实时采集监控） | `src/pages/input/CollectTask/index.tsx` | 高 |
| F-11 | 新建 FetcherConfigPage（抓取引擎配置） | `src/pages/input/FetcherConfigPage.tsx` | 中 |
| F-12 | SevenDimConfigPage 补全采集方案整合面板 | SevenDimConfigPage.tsx | 中 |
| F-13 | 新建 DataDashboard（8维度数据看板） | `src/apps/input/InputDashboard.tsx` | 高 |
| F-14 | 新建数据流水线可视化组件 | `src/core/pipelineScheduler.ts` | 高 |

### 6.4 长期演进（P3 - V6对齐）

| 编号 | 操作 | 说明 |
|:---:|:---|:---|
| F-15 | 四层数据源降级编排 | 腾讯→AKShare→Kimi→Mock 自动降级 |
| F-16 | 接口测试弹窗（5接口一键测试） | 参照V6 DirectDataAPI |
| F-17 | Kimi Work套餐选择UI | Andante/Allegretto/Presto三档 |
| F-18 | 8维度调用频率表 | 8维度×频率×数据源交叉表 |
| F-19 | 限流配置面板 | 分钟/小时/日限流参数可配置 |

---

## 七、校对结论

### 7.1 整体健康度

| 维度 | 评分 | 说明 |
|:---|:---:|:---|
| 路由注册合规性 | 70% | 已全部修复（2026-07-01） |
| UI组件合规性 | 55% | 4个DF-002违规 + 5个缺ErrorBoundary |
| V6功能迁移完整度 | 35% | 6大子模块仅2个完整迁移，4个缺失 |
| SevenDimConfigPage完整度 | 40% | 框架已建，采集方案整合面板缺失 |
| 采集能力实质完整度 | 12% | 8维度仅2个有框架，0个真实接入 |

### 7.2 需要进一步优化的核心领域

> **三个最需要优化的领域**：

1. **路由注册合规化**（P0即时）
   - `/input/seven-dim` 注册到 `ROUTE_REGISTRY`
   - 孤儿页面 `ResearchReportPage` / `TradeReviewPage` 接入路由 ✅ 已完成
   - 路由文档同步更新

2. **缺失UI组件建设**（P2中期）
   - 新建 `CollectTaskPage`（采集任务监控）
   - 新建 `CollectMonitor`（实时采集监控）
   - 补全 `SevenDimConfigPage` 的采集方案整合面板

3. **四步契约合规化**（P1短期）
   - 4个DF-002违规组件整改（操作封装到Store action）
   - 5个组件补ErrorBoundary
   - 4个CabinApp补内部ErrorBoundary

### 7.3 V6→V9架构迁移成熟度

```
V6数据采集层完整架构
  ├── 数据工场入口 ──────────── ✅ 已迁移（InputHubPage）
  ├── 七维采集配置 ──────────── 🟡 框架已建（40%）
  ├── 采集任务监控 ──────────── ❌ 完全缺失
  ├── 抓取引擎配置 ──────────── ❌ 完全缺失
  ├── 智能资讯 ──────────────── 🟡 迁移至分析舱（20%）
  ├── 数据看板 ──────────────── ❌ 完全缺失
  ├── 数据流水线 ────────────── ❌ 完全缺失
  ├── 四层数据源降级 ────────── 🔴 仅1/4层（10%）
  └── 接口测试 ──────────────── 🟡 简化版（30%）

整体迁移成熟度：约 30%
```
