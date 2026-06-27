---
title: V9 模块完成度逆向校验 — 修复行动清单
version: v1.2.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: active
change_log:
  - date: 2026-06-27
    author: Quality Auditor
    desc: 全部 6 项 P2 任务已完成（P2-8: 驾驶舱 LLM SSE 流式接口替换）
  - date: 2026-06-27
    author: Quality Auditor
    desc: 3 项 P1 + 2 项 P2 已修复并应用到代码；更新修复状态
  - date: 2026-06-27
    author: Quality Auditor
    desc: 阶段四：汇总批次 1（5 模块）剖面图，生成修复行动清单
---

# V9 模块完成度逆向校验 — 修复行动清单

> 审计范围：批次 1（5 模块）— 首页 / 驾驶舱 / 新闻资讯V6 / 交易持仓 / 录入看板  
> 发现总数：**11 项**（P0: 0, P1: 3, P2: 8）  
> 修复进度：**11 项全部修复**（P1: 3/3, P2: 8/8），**0 项跟踪中**  
> 综合健康度：🟢 5 健康（全部 🟢）

---

## 一、P0 — 待修复（含 ❌ 层，阻断性问题）

| 优先级 | 模块名称 | 问题层 | 问题描述 | 修复建议 | 预估工时 |
|:---|:---|:---|:---|:---|:---|
| — | — | — | **本次审计未发现 P0 级阻断性问题** | — | — |

---

## 二、P1 — 需补强（含 🟡 层，功能不完整）

| 优先级 | 模块名称 | 问题层 | 问题描述 | 修复建议 | 预估工时 |
|:---|:---|:---|:---|:---|:---|
| **P1** | 新闻资讯 V6 | L2 状态 | `handleFilterChange` 仅打印日志，筛选逻辑未执行。`NewsPage.tsx` L91-93 收到 `NewsFilter` 后未过滤 `articles` 列表 | 在 `NewsPage.tsx` 中增加 `useMemo` 过滤逻辑：按 `filter.category`/`filter.sentiment`/`filter.keyword` 筛选 `articles`，将过滤结果传给 `NewsFeed` | 1h |
| **P1** | 新闻资讯 V6 | L2 状态 | `handleBookmark` 收藏功能未实现持久化。`NewsPage.tsx` L101-103 仅 `logger.info` 打印，未调用 `dataLayer` 或 `localStorage` 存储 | 方案 A：调用 `dataLayer.news.update()` 更新 `bookmarked` 字段；方案 B：独立 `newsBookmarkStore` 管理收藏状态。需同步更新 UI 收藏图标状态 | 2h |
| **P1** | 新闻资讯 V6 | L2 状态 | `loadMore` 硬编码 `setHasMore(false)`，真实分页未实现。`NewsPage.tsx` L74 直接终止分页 | 扩展 `listNews` 支持 `offset`/`cursor` 参数，`loadMore` 中追加数据到 `articles` 列表尾部，`hasMore` 根据返回 `total` 计算 | 2h |

---

## 三、P2 — 可交付（全部 ✅ 层，仅需优化）

| 优先级 | 模块名称 | 问题层 | 问题描述 | 修复建议 | 预估工时 |
|:---|:---|:---|:---|:---|:---|
| P2 | 新闻资讯 V6 | L2 状态 | 无独立 Pinia/Zustand Store，状态完全在组件内管理，`articles`/`loading`/`selectedArticle` 无法跨组件共享 | 新建 `src/store/newsStore.ts`（Pinia），迁移 `articles`/`loading`/`selectedArticle`/`error` 状态，暴露 `loadNews`/`filterNews`/`bookmarkArticle` actions | 4h |
| P2 | 新闻资讯 V6 | L3 数据 | 无 DataBridge 端点注册，数据流通过 `newsService` 直连 `dataLayer`，不可追溯 | 在 `newsService` 层增加 `DataBridge.forward()` 调用，注册 `news:article:loaded`/`news:article:bookmarked` 等事件通道 | 1h |
| P2 | 驾驶舱 | L4 逻辑 | `handleLayoutChange` 为空函数。`CockpitShell.tsx` L104 布局变更后未持久化，刷新后丢失用户自定义布局 | 在 `handleLayoutChange` 中调用 `localStorage.setItem('cockpit-layout', JSON.stringify(layout))`，初始化时从 `localStorage` 读取恢复 | 0.5h |
| P2 | 驾驶舱 | L4 逻辑 | `sendChatMessage` 生产环境 REST 路径标记为 TODO。`MarketDataProvider.tsx` L151 注释"生产环境替换为 SSE 流式接口" | 补充真实 LLM 推理接口调用（SSE 流式），当前 Mock 环境可正常运行，生产环境需替换 | 4h |
| P2 | 交易持仓 | L2 状态 | 无独立 Pinia/Zustand Store，`useReducer` 状态无法跨组件共享（如与 TradingApp 的 CoreResourcePanel 共享持仓数据） | 新建 `src/store/holdingsStore.ts`（Pinia），迁移 `data`/`filter`/`pagination` 状态，暴露 `fetchHoldings`/`executeTrade`/`exportCSV` actions | 4h |
| P2 | 交易持仓 | L3 数据 | 无 DataBridge 端点注册，数据流通过 `fetch` 直连 API，未纳入 DataBridge 体系 | 在 `holdingsService` 层增加 `DataBridge.forward()` 调用，注册 `trade:holding:loaded`/`trade:action:executed` 等事件通道 | 1h |
| P2 | 录入看板 | L5 集成 | `InputApp.tsx` 子路由分发使用 `if/else` 链（L13-27），新增子面板需修改 `InputApp` 源码 | 替换为 `Routes`/`Route` 组件 + `Outlet` 嵌套路由，新增子面板仅需在 `routes.ts` 注册，无需修改 `InputApp` | 2h |
| P2 | 录入看板 | L5 集成 | `InputPrototype` 临时原型页路由 `/input/prototype` 仍注册为正式路径 | 移除 `routes.ts` L77-81 注册，或将 `InputPrototype` 移入 `src/apps/input/__prototype__/` 并通过环境变量 `VITE_ENABLE_PROTOTYPE` 控制可见性 | 0.5h |

---

## 四、工时汇总

| 优先级 | 总数 | 已修复 | 跟踪中 | 剩余工时 |
|:---|:---|:---|:---|:---|
| P0 | 0 | 0 | 0 | 0h |
| P1 | 3 | **3** | 0 | **0h** |
| P2 | 8 | **8** | 0 | **0h** |
| **合计** | **11** | **11** | **0** | **0h** |

---
## 五、修复状态

```
✅ 已完成 (11 项，全部完成)
  ├── P1-1: 新闻筛选逻辑 — NewsPage.tsx 新增 activeFilter + filteredArticles useMemo
  ├── P1-2: 新闻收藏持久化 — NewsPage.tsx 新增 bookmarkedIds + localStorage
  ├── P1-3: 新闻分页加载 — NewsPage.tsx 新增 currentOffset + loadData append 模式
  ├── P2-1: 新闻 Store 抽离 — 新建 newsStore.ts (Zustand)
  ├── P2-2: 驾驶舱布局持久化 — CockpitShell.tsx 新增 loadLayout/saveLayout
  ├── P2-3: 新闻 DataBridge 集成 — newsService.ts 新增 forward 调用
  ├── P2-4: 持仓 Store 抽离 — 新建 holdingsStore.ts (Zustand)
  ├── P2-5: 持仓 DataBridge 集成 — holdingsService.ts 新增 forward 调用
  ├── P2-6: 输入舱路由重构 — InputApp.tsx 使用 Routes/Route 替代 if/else
  ├── P2-7: 临时原型页清理 — routes.ts 移除 /input/prototype
  └── P2-8: 驾驶舱 LLM 接口替换 — streamingChat SSE 流式接口
```

---

## 六、变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-06-27 | v1.0.0 | 阶段四：汇总 5 模块 11 项问题，生成修复行动清单 | Quality Auditor |