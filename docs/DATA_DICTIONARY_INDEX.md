# V9 数据字典索引

> **Status**: Current  
> **Version**: v1.2.0  
> **Last Updated**: 2026-06-27  
> 本文档汇总 V9 项目所有模块级数据字典入口，便于快速查找字段定义、枚举值、服务 API 与 DataBridge 映射。

---

## 按模块索引

| 模块 | 数据字典 | 源码入口 | 覆盖范围 |
|------|----------|----------|----------|
| 交易持仓管理 | `DATA_DEFINITION.md`（根目录）、`docs/trade/API_CONTRACT.md` | `src/pages/trading/`、`src/types/modules/trade.types.ts`、`src/constants/trade.constants.ts`、`src/store/holdingsStore.ts` | 持仓明细、查询参数、交易操作、分页/筛选状态、Store 状态管理（Zustand） |
| 智能资讯中心（NewsPage） | `docs/NEWS_DATA_DEFINITION.md`、`docs/news/DATA_DEFINITION.md` | `src/pages/news-v6/`、`src/services/news/`、`src/data/types.ts`、`src/store/newsStore.ts` | `NewsArticle`、`NewsStockMap`、`SentimentCache`、V6/V9 适配、路由、Store 状态管理（Zustand） |
| AI 智能体调度中心 / 健康监控 / 诊断分析 | `docs/AI_CENTER_DATA_DEFINITION.md` | `src/constants/ai-center.constants.ts`、`src/constants/health.constants.ts`、`src/types/modules/ai-center.types.ts`、`src/services/ai-center/` | Agent、健康指标、诊断报告、统一 `AICenterData` |
| 金融业务驾驶舱 Widget | `DATA_DEFINITION.md`（根目录，§2~§5）、`docs/cockpit/DATA_DEFINITION.md` | `src/cockpit/widgets/`、`src/services/stock-analysis/`、`src/services/data-collector/`、`src/types/modules/widget.types.ts`、`src/store/widgetStore.ts` | 投资画像、股票池、KAI 评分、模型对比、聊天界面、Widget 实例管理 |

---

## 通用类型与常量

| 类型/常量文件 | 说明 | 被哪些字典引用 |
|---------------|------|----------------|
| `src/data/types.ts` | 全局数据类型：`Stock`、`Order`、`Portfolio`、`NewsArticle`、`NewsStockMap`、`SentimentCache` 等 | News、Trade、Widget 字典 |
| `src/config/dbConfig.ts` | IndexedDB store 配置、`EnvelopeAction`、`EnvelopeTarget` | News、Trade、AI Center 字典 |
| `src/constants/cockpit.constants.ts` | 驾驶舱常量：颜色映射、评分等级、维度名称、模型版本、轮询间隔 | Widget 字典 |
| `src/constants/ai-center.constants.ts` | AI 中心常量：Agent 状态/标签/类型、数据源配置 | AI Center 字典 |
| `src/constants/health.constants.ts` | 健康监控常量：健康状态、模块分类、诊断等级、评分阈值 | AI Center 字典 |

---

## 新增模块 SOP

新增模块如需补充数据字典，请按以下步骤执行：

1. 在 `src/constants/` 中定义颜色、状态、枚举、模型版本、轮询间隔等常量；
2. 在 `src/types/modules/` 中定义 TypeScript 接口；
3. 在 `src/services/` 中实现服务层 API；
4. 在 `docs/` 下新增 `MODULE_NAME_DATA_DEFINITION.md`；
5. 更新本文档索引表；
6. 更新 `CHANGELOG.md`；
7. 执行 `tsc → lint → test → build` 验证。

---

## 待补充字典

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据流引擎（DataFlow Engine） | ✅ 已补充 | 已新增 `docs/DATAFLOW_DATA_DEFINITION.md`，覆盖 `DataChannel`、`DataPacket`、`ChannelMeta`、API、事件、回退数据、重连策略 |
| 数据融合引擎（Data Fusion） | ✅ 已实现 | `src/services/unifiedStockService.ts` 已落地，`UnifiedStockView` 统一视图整合 7 种数据源 |
| 股票池分组 | 🟡 待补充 | 代码已实现，字段 `Stock.group`、`PoolGroupMeta` 等需纳入 Trade 字典 |
| 交易引擎（信号/仓位/风控） | 🟡 待补充 | `Signal`、`PositionAdvice`、`RiskCheckResult` 等类型需字典化 |

---

## 相关文档

- `docs/implementation/doc-sync-execution-plan.md`：代码-文档同步整体方案
- `docs/implementation/doc-sync-gap-list.md`：差异清单与闭环追踪
- `docs/03-architecture-standards.md`：架构标准与分层约定
- `docs/09-quality-gates.md`：质量门禁与审计基线
