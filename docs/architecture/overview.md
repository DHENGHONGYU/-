# V9 全局架构总览（Architecture Overview）

> **定位**：本文是 V9 的**单一全局架构说明**，补《文档理解核查报告》指出的「缺全局 Overview」缺口。
> **权威契约**：`AGENTS.md`（分层规则 + 四步集成）。**注意**：仓库根 `ARCHITECTURE.md` 实为 **Cockpit 驾驶舱子系统架构**，非全局总览，阅读时勿混淆。
> **状态**：✅ P0 新增（骨架版，后续由架构组持续扩写引擎/数据流细节）

---

## 1. 系统定位

V9 是**纯前端**的智能投研复盘系统：本地 IndexedDB 自管数据，AI 输出标注「仅供参考非投资建议」，面向个人股票研究/复盘辅助。**非金融产品**。

---

## 2. 分层架构（依赖方向见 AGENTS.md §一）

```
src/config/      配置层（零硬编码锚点）        src/constants/  常量层（零硬编码锚点）
src/core/        核心工具/类型守卫             src/types/      纯类型（零依赖）
src/data/        数据层（IndexedDB/dataLayer） src/lib/        库函数（白名单基础设施）
src/services/    服务层（24 子域）             src/store/      状态层（49 Zustand Store）
src/components/  组件层（atoms→molecules→organisms→templates + chart/cabin/cockpit/widgets）
src/portal/      PortalShell 舱室入口          src/pages/      页面层（5 舱）
src/apps/        App 分发器（每舱一个）
```

**依赖铁律**：`pages/components → store/services`；`store → services/core`；`services → core/data/lib(白名单)`；`lib → core/config`；`config/constants/types` 可被全局引用但零运行时依赖。跨层调用由 `npm run audit:layers` 门禁拦截（当前 0 违规）。

---

## 3. 三级加载链（路由 → 舱 → 页面）

```
src/config/routes.ts (62 条路由)
   └─> src/portal/PortalShell.tsx (舱室导航/布局/懒加载壳)
         └─> src/apps/{cabin}/{Cabin}App.tsx (App 分发器：React.lazy / 分支)
               └─> src/pages/{cabin}/*Page.tsx (具体页面)
```

- 路由与舱映射、页面清单见 `architecture/cabins-overview.md` 与 `02-design/06-routing-specs.md`。
- 所有页面经 PortalShell 统一壳，保证布局/权限/主题一致。

---

## 4. 数据流向

```
外部行情/资讯 API
   └─> services/fetcher (采集) ─> core/DataBridge.forward() ─> data/dataLayer ─> IndexedDB
                                                                          │
                                              services/data-collector (orchestrator/pipeline/quality)
                                                                          │
                                              services/* (analysis/scoring/screening/...) 读 IndexedDB
                                                                          │
                                              DataFusion ─> UnifiedStockData (统一股票数据模型)
                                                                          │
                                              store/* (Zustand + withBroadcast 跨 Tab 广播)
                                                                          │
                                              components/pages (仅经 Store 取数，禁直连 db)
```

- **DataBridge** 是 services→data 的唯一通道（禁 services 直写 db）。
- **UnifiedStockData** 是数据融合的统一契约（见 `DATA_DEFINITION` 索引 `standards/DATA_DICTIONARY_INDEX.md`）。

---

## 5. 引擎分层（L0–L8，详见 `02-design/05-engine-specs.md`）

- **L3 纯计算层**：评分（scoring v6）、信号（signal）、风控（riskControl）、数据融合（DataFusion）—— 无副作用，可单测。
- **Fetcher→DataBridge→IndexedDB** 构成数据获取主链路。
- 五因子评分当前为**合成种子**，UI 须标「示例」；真实信号走 `detectBySector`。

---

## 6. 设计令牌体系（L1–L6）

- L1 `THEME_TOKENS` / L2 `COLOR_TOKENS` / L3 `COLOR_SHADES`+`twText/twBg/twBorder` / L4 `chartColors` / L5 股票红涨绿跌固定色 / L6 `SEMANTIC_COLOR_ROLES`。
- 宋韵美学：亮色用 `stone` 暖灰系，暗色统一 `neutral` 高级灰。
- **UI 颜色必须走令牌**，零硬编码由 `lint:colors` 门禁拦截（当前 0 违规）。映射表见 `02-design/design-token-mapping.md` + `token-usage-cookbook.md`。

---

## 7. 质量门禁（12 道，Husky 串联）

| 阶段 | 门禁 |
|------|------|
| pre-commit | lint-staged → lint:colors → tsc:prod → audit:layers → audit:atomic → audit:docs → verify:tokens → audit:tokens → audit:jsdoc → audit:complexity |
| pre-push | test:clean → build |

当前基线：综合评分 93（架构健康）；跨层调用 0、颜色硬编码 0、深层嵌套 0、长链 0、重复条件 0、JSDoc 缺失 0、文档同步 0。

---

## 8. 文档与代码一致性

- 本文与 `AGENTS.md`、`02-design/05-engine-specs.md`、`02-design/06-routing-specs.md`、`architecture/cabins-overview.md`、`architecture/services-catalog.md` 互为补充。
- 任何分层/加载链/数据流变更须同步本文与对应子类文档，并由 `audit:docs` 校验。
