# 08. 实施计划

> **Status**: Current  
> **Version**: v1.1.0  
> **Last Updated**: 2026-06-26
>
> 本文档定义 V9 从 v0.9.0 到 v1.0.0 的分阶段实施计划、验收标准、任务依赖与风险登记。  
> 目标读者：项目负责人、核心开发者、产品经理。

---

## 1. 当前基线（v0.9.0）

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `tsc --noEmit` | ✅ 通过 | 0 errors |
| `npm run lint` | ✅ 通过 | 0 warnings/errors |
| `npm run test` | ✅ 44 个测试文件 / 291 个测试全部通过 | - |
| `npm run build` | ✅ 通过 | dist/ 生成成功 |
| `npm run audit:layers` | ✅ 通过 | 0 违规 / 0 警告 |
| 五舱框架 | ✅ 可用 | PortalShell + 五舱 App 骨架 |
| DataBridge + ACL | ✅ 可用 | 信封化写入 + 权限矩阵 |
| 股票录入/评分/模拟交易 | ✅ 可用 | 端到端可跑通 |
| 输入舱子页拆分 | ✅ 完成 | Dashboard / BulkImport / HotSector / DataTest |

> 注：测试在标准配置下全部通过，个别文件（`NewsPage.test.tsx`）在资源紧张时可能偶发超时，已通过 `testTimeout` 调整缓解。

---

## 2. Phase 1：核心骨架（已完成）

| # | 任务 | 文件 | 状态 | 验收标准 |
|---|------|------|------|----------|
| 1.1 | 项目配置：package/vite/tsconfig/eslint | 根目录 | ✅ | 所有命令可执行，无报错 |
| 1.2 | 主题系统与 CSS 变量 | `src/index.css`, `src/theme.config.ts` | ✅ | 主题令牌覆盖颜色/间距/圆角 |
| 1.3 | 路由注册表 | `src/config/routes.ts` | ✅ | 路由可注册、可懒加载 |
| 1.4 | IndexedDB 封装 | `src/data/db.ts` | ✅ | 支持 CRUD、迁移、导入导出重置 |
| 1.5 | DataBridge + Envelope + ACL | `src/core/*` | ✅ | 跨模块写入经 ACL 校验并审计 |
| 1.6 | 事件总线 + 日志 | `src/lib/*` | ✅ | UI 可订阅数据变更事件 |
| 1.7 | 五舱应用 + PortalShell | `src/apps/*`, `src/portal/*` | ✅ | 五舱导航可切换 |
| 1.8 | 驾驶舱 | `src/cockpit/CockpitShell.tsx` | ✅ | 系统统计与快捷入口可用 |
| 1.9 | 基础页面 | `src/pages/*` | ✅ | 分析舱页面注册完成 |
| 1.10 | 基础 UI 组件 | `src/components/ui/*` | ✅ | Button/Card/Input/Badge 可用 |
| 1.11 | 单元测试 | `tests/*` | ✅ | 44 files / 291 tests 全部通过 |

---

## 3. Phase 2：功能填充（当前进行）

### 3.1 任务清单

| # | 任务 | 优先级 | 依赖 | 负责人 | 验收标准 |
|---|------|--------|------|--------|----------|
| 2.1 | AKShare 数据采集适配器 | P1 | 1.4 | ✅ | 可配置 Python 服务地址；能拉取单只股票基础数据；失败时给出明确错误 |
| 2.1.1 | 数据采集架构文档 | P1 | - | ✅ | 新建 `docs/implementation/data-collection-architecture.md` |
| 2.1.2 | Fetcher 配置层 | P1 | - | ✅ | `src/config/fetcherConfig.ts` + `.env.example` |
| 2.1.3 | Fetcher 服务层 | P1 | - | ✅ | `src/services/fetcher/*` |
| 2.1.4 | 输入舱集成 | P1 | 2.1.3 | ✅ | 录入后可选拉取 AKShare 基础数据 |
| 2.1.5 | V6 评分真实数据接入 | P1 | 2.1.4 | ✅ | 真实字段可用时优先使用，否则降级随机数 |
| 2.1.6 | Python 接口契约 | P1 | - | ✅ | `python/data_service/collect_endpoints.py` |
| 2.1.7 | 单元测试 | P1 | 2.1.3 | ✅ | `tests/fetcherService.test.ts` |
| **2.1.8** | **数据流引擎（DataFlow Engine）** | **P1** | **1.7** | **🟡** | **代码已存在 `src/core/dataflow/`，待文档补齐与正式验收** |
| **2.1.9** | **数据融合引擎（Data Fusion）** | **P1** | **2.1.8** | **🔴** | **`src/services/analysis/unifiedStockService.ts`：统一 `UnifiedStockData` 视图** |
| 2.2 | 真实行情/财务数据接入评分 | P1 | 2.1 | TBD | `v6ScoreService.ts` 使用真实数据计算因子分；综合分与随机数时代差异可解释 |
| **2.2.1** | **评分报告生成** | **P1** | **2.2** | **🔴** | **`v6ScoreReportService.ts`：生成包含理由、目标价、风险的完整报告** |
| 2.3 | 股票池流转 UI | P1 | 1.7, 1.9 | ✅ | candidate→screened→deepDive→watching→archived 可在 UI 上点击推送；流转经 `poolTransitionEngine` 校验 |
| 2.3.1 | 股票池服务层 | P1 | - | ✅ | `src/services/stockpool/stockpoolService.ts` |
| 2.3.2 | 看板组件 | P1 | - | ✅ | `PoolBoard` / `PoolColumn` / `PoolCard` / `usePoolData` |
| 2.3.3 | 输入舱看板化 | P1 | 2.3.2 | ✅ | `InputApp.tsx` 使用看板展示五态池 |
| 2.3.4 | 单元测试 | P1 | 2.3.1 | ✅ | `tests/stockpoolService.test.ts`、`tests/poolTransitionEngine.test.ts` |
| 2.3.5 | 输入舱 UI 体系化重塑 | P1 | 2.3.2, 2.3.3 | ✅ | PortalShell 深色经典布局；InputApp 拆分为 Dashboard / 批量导入 / 热门板块 / 采集测试子页面；同步路由与文档 |
| 2.3.6 | 输入舱交互增强（P0） | P0 | 2.3.5 | 🟡 | 新增 `StockSearch` 搜索组件；`QualityIndicator` 数据质量指示；`PoolBoard` 列表视图/复选批量操作；候选池导入/导出 |
| 2.3.7 | 批量导入状态可视化（P0） | P0 | 2.3.5 | 🟡 | `BulkImportPanel` 行级 valid/duplicate/invalid 状态、导入进度列表、上限提示 |
| 2.3.8 | 热门板块信息密度增强（P1） | P1 | 2.3.5 | 🟡 | `HotSectorPanel` 五因子进度条、排名、轮动建议；数据源优先接入 V4 行业评分 SKILL |
| 2.3.9 | 采集测试多维度健康度（P1） | P1 | 2.1 | 🟡 | `DataTestPanel` 多数据源健康列表、延迟、实时行情探测、清洗检查 |
| 2.3.10 | 采集配置 UI（P2） | P2 | 2.1, 2.3.9 | 🔴 | `FetcherConfigPanel` 维度/频率/数据源优先级/限流配置；先内存配置，稳定后持久化到 IndexedDB |
| 2.4 | 板块轮动与行业分析 | P1 | 1.9 | TBD | `SectorAnalysisPage` 展示行业评分与轮动信号；V4 行业评分可保存 |
| **2.4.1** | **板块轮动评分引擎** | **P1** | **2.4** | **🟡** | **代码已存在，待上层 `SectorAnalysisPage` 接入** |
| 2.5 | 择时信号引擎 | P0 | 2.2 | ✅ | 实现 SignalGenerator，输出 buy_dip / buy_pivot / sell_profit_taking / sell_trailing_stop / hold / watch / composite 信号；参数化配置 |
| 2.6 | 仓位管理器 | P0 | 2.5 | ✅ | 实现 PositionSizer：1/4 Kelly 公式 + 整手取整 + 单笔/总仓位约束 |
| 2.7 | 风控引擎 | P0 | 2.6 | ✅ | 实现 RiskEngine：单票/组合仓位、每日交易次数、同标的冷却时间、数据时效性、卖出持仓充足性校验 |
| 2.8 | 交易错误分类器 | P1 | 2.7 | TBD | 实现 TradeErrorClassifier，支持 12 类错误检测与纪律评分 |
| 2.9 | AI 复盘引擎 | P1 | 2.8 | TBD | 实现 TradeReviewAI，输出六维复盘报告与心理画像 |
| 2.10 | 策略回测引擎 | P2 | 2.5 | TBD | 支持基于评分阈值的历史回测；输出胜率、收益率、最大回撤 |
| 2.11 | 交易复盘笔记 | P2 | 2.9 | TBD | 订单可关联文本笔记；笔记可搜索、可导出；可沉淀到知识库 |
| 2.12 | 研究报告导出 | P2 | 2.2, 2.4 | TBD | 支持导出 PDF/Markdown；包含评分、因子、 rationale |
| **2.13** | **驾驶舱 Widget 框架** | **P1** | **2.1.8** | **🟡** | **运行时引擎 `widgetEngine.ts` 已存在，`CockpitShell` 尚未接入** |
| **2.14** | **市场类 Widget** | **P1** | **2.13, 2.15** | **🔴** | **市场概览、指数行情、财经新闻 Widget** |
| **2.15** | **图表组件库** | **P1** | **-** | **🔴** | **引入 `lightweight-charts` + `recharts`，封装 K线图、折线图、雷达图等** |
| **2.16** | **持仓/策略类 Widget** | **P1** | **2.13, 2.15** | **🔴** | **组合概览、持仓明细、交易信号、板块轮动 Widget** |
| **2.17** | **Agent 运行时框架** | **P2** | **1.7** | **🟡** | **`agentRuntime.ts` 已存在，待补齐注册/调度/监控完整链路** |
| **2.18** | **Agent 监控 Widget** | **P2** | **2.13, 2.17** | **🔴** | **Agent 状态、任务队列、日志流 Widget** |
| **2.19** | **错误边界组件** | **P1** | **-** | **✅** | **`ErrorBoundary.tsx` 已存在并被路由/App 使用** |
| **2.20** | **操作反馈闭环增强** | **P1** | **-** | **🔴** | **评分理由反馈、数据质量可视化、操作状态实时更新** |
| 2.21 | V6 Pro → V9 JSON 数据迁移 | P1 | 1.4, 2.1 | ✅ | `v6MigrationService.ts` + `MigrationPanel.tsx`：解析 V6 全量导出、按规范转换 12 个 store、导入 V9；默认跳过已存在，支持覆盖；单元测试覆盖每个转换函数 |
| **2.22** | **代码-文档同步机制** | **P1** | **2.1, 2.3, 2.13** | **🟡** | **建立“扫描差异 → 补齐文档 → 验证”闭环；已输出 `docs/implementation/doc-sync-execution-plan.md`，落地 NewsPage / Widget / AI Center 数据字典；纳入 PR Checklist 待完成** |

### 3.2 依赖关系

```
1.4 IndexedDB 封装
   ↓
2.1 AKShare 适配器
   ↓
2.1.8 数据流引擎
   ↓
2.1.9 数据融合引擎 ←────────────────────────────────────┐
   ↓                                                    │
2.2 真实数据评分 ←──────────┐                            │
   ↓                        │                            │
2.2.1 评分报告生成           │                            │
   ↓                        │                            │
2.4 板块轮动/行业分析        │                            │
   ↓                        │                            │
2.4.1 板块轮动评分引擎       │                            │
   ↓                        │                            │
2.5 策略回测引擎 ←──────────┘                            │
   ↓                                                    │
2.7 研究报告导出                                        │
                                                        │
1.7 五舱框架                                            │
   ↓                                                    │
2.13 驾驶舱 Widget 框架 ←───────────────────────────────┘
   ↓
2.15 图表组件库
   ↓
2.14 市场类 Widget
2.16 持仓/策略类 Widget
   ↓
2.19 错误边界组件
2.20 操作反馈闭环增强

2.17 Agent 运行时框架
   ↓
2.18 Agent 监控 Widget
```

### 3.3 验收标准（Phase 2 整体）

- [x] 用户可在输入舱录入 symbol，系统自动或手动触发 AKShare 拉取。
- [x] 股票池可在 UI 上完成 candidate → watching 的完整流转。
- [ ] 输入舱具备搜索、批量操作、导入/导出、数据质量指示能力。
- [ ] 分析舱展示基于真实数据的 V6 九维评分。
- [ ] 行业评分页面可生成并展示 V4 七维评分。
- [ ] 新增功能均有单元测试覆盖，整体测试通过率 100%。
- [ ] `tsc` / `lint` / `build` / `audit:layers` 保持通过。
- [ ] 数据流引擎支持内存缓存、定时刷新、优先级分发。
- [ ] 数据融合引擎输出统一 `UnifiedStockData` 视图。
- [ ] 驾驶舱支持可配置 Widget 网格布局。
- [ ] 图表组件支持 K 线图、折线图、雷达图等可视化。
- [ ] Agent 运行时支持状态监控、任务队列、日志流。
- [ ] 操作反馈闭环：评分理由、数据质量、操作状态实时更新。

---

## 4. Phase 3：质量加固

| # | 任务 | 优先级 | 依赖 | 负责人 | 验收标准 |
|---|------|--------|------|--------|----------|
| 3.1 | PWA manifest + service worker | P2 | 1.1 | TBD | `manifest.json` 配置；service worker 注册；离线可加载核心页面 |
| 3.2 | E2E 测试（选股 → 评分 → 模拟交易） | P2 | 2.3, 2.2 | TBD | Playwright 覆盖 4 条核心链路；本地/CI 可运行 |
| 3.3 | CI 流水线 | P2 | 3.2 | TBD | `.github/workflows/ci.yml` 运行 lint/test/build/coverage/audit |
| 3.4 | 覆盖率门禁 | P2 | 3.3 | TBD | `vitest.config.ts` 配置阈值；CI 强制检查 |
| 3.5 | 性能优化（首屏 < 3s） | P3 | 3.1 | TBD | Lighthouse 首屏分数 ≥ 90；LCP < 2.5s |

---

## 5. Phase 4：发布准备（v1.0.0）

- [ ] 完整功能验收（对照 `docs/02-functional-specs.md` 与 `docs/09-quality-gates.md`）。
- [ ] 文档更新：确保所有 `docs/` 与代码一致，`CHANGELOG.md` 更新到 v1.0.0。
- [ ] 数据迁移测试：从 v0.9.0 数据导出 → v1.0.0 导入，验证无丢失。
- [ ] 离线可用性验证：断网后核心页面可加载、数据可读取、评分可运行。
- [ ] GitHub Pages 部署：构建产物上传，HashRouter 刷新无 404。
- [ ] 发布 tag：`git tag -a v1.0.0 -m "V9 正式版"`。

---

## 6. 时间表（参考）

| 阶段 | 预计周期 | 目标版本 |
|------|----------|----------|
| Phase 2 功能填充 | 4–6 周 | v0.10.0 ~ v0.12.0 |
| Phase 3 质量加固 | 2–3 周 | v0.13.0 |
| Phase 4 发布准备 | 1 周 | v1.0.0 |

> 时间表为粗略估计，实际进度以每周复盘为准。

---

## 7. 风险登记

| 编号 | 风险 | 概率 | 影响 | 应对措施 | 触发回滚条件 |
|------|------|------|------|----------|--------------|
| P2-R01 | AKShare 服务部署复杂，开发者环境不一致 | 中 | 中 | 提供 Docker 化 Python 服务；文档化本地启动步骤 | 无法统一环境时回退到 mock 数据 |
| P2-R02 | 真实数据质量参差不齐，评分结果波动大 | 高 | 高 | 增加数据清洗层；允许用户手动覆盖因子分；记录数据版本 | 评分不可解释时回退到 v0.9.0 自动评分 |
| P2-R03 | 股票池流转 UI 与现有组件耦合度高 | 中 | 中 | 抽取 `PoolTransitionPanel` 独立组件；单元测试先行 | 重构导致测试大面积失败时回滚 |
| P2-R04 | 策略回测引擎过度设计 | 中 | 低 | 先实现单策略、单标的回测；禁止复杂DSL | 回测结果与预期差异过大时冻结该功能 |
| P3-R05 | PWA service worker 缓存策略出错 | 低 | 高 | 使用 Workbox 默认策略；更新后提示刷新 | 用户无法加载新版时禁用 SW |
| P3-R06 | E2E 测试在 CI 中不稳定 | 中 | 中 | 使用 Playwright 固定浏览器版本；测试数据隔离 | CI 失败率 > 20% 时标记为 flaky |

---

## 8. 关键决策与下一步

### 8.1 本周下一步（示例）

1. 完成 `2.3.6` 输入舱搜索组件与数据质量指示的正式落地。
2. 为 `2.3.7` 批量导入状态可视化补充 `batchImportService` 行级解析状态。
3. 建立 `src/config/inputConfig.ts`，集中输入舱常量。

### 8.2 决策待确认

| 问题 | 选项 | 建议 |
|------|------|------|
| 搜索组件数据源 | A. 本地 mock 股票库<br>B. AKShare 搜索接口<br>C. 仅候选池过滤 | 建议 A 先跑通，稳定后接入 B |
| 热门板块数据来源 | A. 继续 mock<br>B. 接入 V4 行业评分 SKILL | 建议 B，但需明确 SKILL 接口 |
| 采集配置是否立即持久化 | A. 先内存配置<br>B. 直接持久化到 IndexedDB | 建议 A，降低版本迁移风险 |
| `/input/prototype` 处理方式 | A. 删除<br>B. 归档为设计档案 | 已确认归档计划：保留临时路径，Phase 2 末整理为设计档案或删除 |

---

## 9. 附录：状态图例

| 图例 | 含义 |
|------|------|
| ✅ | 已完成并通过验收 |
| 🟡 | 进行中/部分完成 |
| 🔴 | 未开始或存在阻塞 |
| TBD | 待指定负责人 |

---

## 10. 版本比对

本文档当前版本为 `v0.9.0-docs-review`，与规划基线 `v0.9.0-docs-base` 的差异见：

- `docs/implementation/architecture-version-comparison.md`

主要变化：

1. 当前基线更新为 107/107 测试通过、`audit:layers` 0 违规。
2. Phase 2 新增输入舱交互增强子任务（2.3.6 ~ 2.3.10）。
3. 验收标准补充输入舱能力项。
4. 决策待确认项聚焦输入舱数据来源与原型处理。
