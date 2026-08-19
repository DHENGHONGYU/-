---
title: 01 - 项目整体架构
type: wiki
domain: architecture
status: frozen
maintainer: FinSightV9 Team
version: 2.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
tag: FINAL
---

# 01 - 项目整体架构 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.4（最终版 · 两轮交叉核对 · 修正 audit:*=66 / pre-commit=22 / pre-push=6 等 6 项）| 基于 AGENTS.md v1.6.0 + vite.config.ts / package.json / .husky/* 实查编写，所有硬事实已四轮交叉验证

## 1. 产品定位

FinSight V9 是一款**面向中国 A 股个人投资者的智能投研复盘系统**：

- **纯前端 PWA**：无后端服务器依赖，可离线运行
- **数据本地主权**：全部业务数据存于浏览器 IndexedDB（`V6ProDB`），不上传云端
- **完整投研闭环**：股票录入 → 智能分析 → 模拟交易 → 复盘输出
- **可选增强**：Electron 桌面端封装 + Python 数据采集侧车（真实行情）

## 2. 五层分层架构

```
┌──────────────────────────────────────────────┐
│  L5 展示层  pages/ components/ cockpit/ portal/ showcase/ fixtures/ │ ← UI/样例
├──────────────────────────────────────────────┤
│  L4 应用层  apps/（五舱分发器 + 懒加载）          │ ← 舱室路由
├──────────────────────────────────────────────┤
│  L3 引擎层  services/ agents/ mcp/ hooks/       │ ← 业务引擎（38 子域）+ 横切 Hooks
├──────────────────────────────────────────────┤
│  L2 数据层  store/ core/ data/ domain/ schema/  │ ← IndexedDB + DataBridge + 状态层
├──────────────────────────────────────────────┤
│  L1 基础设施  lib/ config/ constants/ types/ i18n/ pwa(service worker) │ ← 工具/配置/国际化
└──────────────────────────────────────────────┘
```

各层只能向下依赖、禁止跨层调用（详见 [04 依赖关系](04-data-flow-and-dependencies.md)），由 `npm run audit:layers` 强制校验（期望 0 violations）。

> 契约差异标注：AGENTS.md §一定义 src/ 下 22 个目录；实际磁盘 21 个目录（已核实：无 `data/gateway`、无 `utils/`、无 `migrations/` 独立目录）。顶层完整清单见 [02 模块职责地图 §2](02-module-map.md)。

## 3. 五舱工作流（核心 UX 模型）

系统按个人投资者工作习惯组织为五个"舱室"（Cabin），由 [PortalShell](../../src/portal/PortalShell.tsx) 统一壳层渲染、[cabinDispatcher](../../src/apps/cabinDispatcher.ts) 懒加载分发：

| 舱室 | 路由前缀 | 职责 | 代表页面 |
|------|---------|------|---------|
| 输入舱 | `/input` | 股票录入、批量导入、热门板块、意向池、采集监控与策略配置 | 录入看板、采集监控台 |
| 分析舱 | `/analysis` | V6 九维评分、行业智能评分、多因子筛选、资讯情感、回测 | 评分页、行业仪表盘 |
| 交易舱 | `/trading` | 模拟买卖、持仓管理、信号扫描、风控、策略快照 | 持仓页、风控页 |
| 输出舱 | `/output` | 数据导出、研究报告生成、交易复盘、因子看板 | 报告页、复盘页 |
| 总控舱 | `/command` | 系统统计、数据管理、智能体、MCP 服务器、配置中心 | 系统监控、Agent 管理 |

另有两个独立入口：

- `/` 首页（[HomePage](../../src/pages/HomePage.tsx)）
- `/cockpit` 驾驶舱（[CockpitShell](../../src/cockpit/CockpitShell.tsx)，结果优先视图：今日快照 / 持仓状态 / 市场扫描 / 深度钻取）

路由唯一真相源为 [src/config/routes.ts](../../src/config/routes.ts) 的 `ROUTE_REGISTRY`（所有业务路由必须注册，禁止组件内硬编码路径；废弃路由标记 `deprecated` 自动隐藏并重定向）。

### 舱室特殊路由（cabinDispatcher 特殊分发）

- `/command/agents` → AgentApp（懒加载 `src/apps/command/AgentApp`）
- `/command/mcp-servers` → MCPServerDashboardPage（懒加载 `src/pages/command/MCPServerDashboardPage`）

## 4. 技术栈全景（所有依赖版本均已核实 package.json）

| 类别 | 选型（精确版本） | 用途 |
|------|----------------|------|
| 前端框架 | React `^19.0.0` + TypeScript `^5.7.0` | UI 与类型安全 |
| 构建 | Vite `^6.0.0` | 开发服务器（端口 5199，predev 钩子自动运行 `tsc:prod`）+ 生产构建 |
| 状态管理 | Zustand `^5.0.0`（注册表 66 条：51 active + 15 deprecated；磁盘 78 文件含 derived/utility/index） + `withBroadcast` 跨 Tab 广播 | 全局状态 |
| 路由 | React Router `^7.0.0`（HashRouter） | SPA 路由 |
| 数据存储 | IndexedDB 原生 API（DB_VERSION=35，53 个 STORE_NAME 枚举） | 本地持久化 |
| 图表 | Recharts `^3.9.1` + lightweight-charts `^5.2.0` | 业务图表 + 专业 K 线 |
| UI 样式 | Tailwind CSS `^3.4.15` + 自研 Design Tokens（V5 Apple Business 冷色调） | 视觉系统 |
| 虚拟列表 | @tanstack/react-virtual `^3.14.4` | 大数据量渲染 |
| 向量检索 | @xenova/transformers `2.17.2` + hnswIndex + @duckdb/duckdb-wasm `1.33.1-dev57.0` | 本地 Embedding / 语义搜索 / 列式分析 |
| 导出 | jspdf `^4.2.1` + jspdf-autotable + xlsx `^0.18.5` | PDF / Excel 报告 |
| 桌面端 | Electron `33.4.11` + electron-builder `^25.1.8`（NSIS） | 可选打包 |
| 数据采集 | Python（AkShare / Tushare / FastAPI） | 可选真实数据侧车（Collector :8000） |
| 测试 | Vitest `^2.1.0` + Testing Library + @playwright/test `^1.61.1` | 单元 / 组件 / 契约 / E2E / 视觉回归 |
| 质量门禁 | Husky `9.1.7` + lint-staged `^17.0.8` + 66 条 audit:* 脚本 | 提交前强校验 |

> 注：manualChunks 拆分的 `html2canvas` 块当前在 package.json 依赖中未声明（vite.config.ts L406），为构建配置项而非已安装依赖。

## 5. 应用启动链路

```
index.html
  └─ src/main.tsx（bootstrap() 异步启动函数）
       ├─ verifyDesignTokensOnReady()       # 开发环境设计令牌校验（V5 Apple Business）
       ├─ useThemeStore.getState()          # React 首屏渲染前应用持久化主题
       ├─ setLogLevel() + getLogger()       # 日志初始化（VITE_LOG_LEVEL）
       ├─ installGlobalErrorHandler()       # 全局错误捕获
       ├─ Promise.all(并行动态 import 11 个模块, L29-L61 脚本)
       │    ├─ ① setStrategyAnalyzers({hotSector/rotation/valuePit})
       │    │     注入 → databridgeStrategyRouter
       │    ├─ ② setFeedbackServices({runV6Score/getV6ScoreQuality/fetchStockBasic/Kline/Financial})
       │    │     注入 → feedbackOrchestrator
       │    ├─ ③ setPipelineServices({runV6Score})
       │    │     注入 → pipelineScheduler
       │    ├─ ④ setScoreTriggerServices + scoreAutoTrigger.start()
       │    │     启动 → services/scoring/scoreAutoTrigger
       │    ├─ ⑤ setIndustryAnalysisServices
       │    │     注入 → v6ScoreService 内部
       │    └─ fetchStockBasic/Kline/Financial
       │          就绪 → services/fetcher/fetcherService
       └─ createRoot(<StrictMode><App /></StrictMode>)
            └─ src/App.tsx
                 └─ HashRouter + ErrorBoundary + Toast
                      └─ AppContent 遍历 ROUTE_REGISTRY 渲染 Route
                           └─ /input|/analysis|... → PortalShell
                                └─ cabinDispatcher.getActiveApp(activeCabin, isAgentPath, isMCPPath)
                                     └─ 各舱 App 内部子路由匹配具体页面
```

关键机制：

- **舱室预加载**：`cabinDispatcher` 的 `PRELOADERS` 通过 `requestIdleCallback`（缺省 200ms setTimeout 兜底）在浏览器空闲时预载**相邻舱** chunk（CABIN_ADJACENCY：input↔analysis↔trading↔output↔command 链式相邻），并去重防止重复加载
- **服务注入反转**：main.tsx 将 Services 层函数注入 Core 层**四个**路由器（databridgeStrategyRouter、feedbackOrchestrator、pipelineScheduler + industryAnalysisServices），避免 Core 反向依赖 Services 的层违规
- **错误失败信封重试**：`dataBridge.failedEnvelopes` 失败队列 + `retryFailed()` 提供信封级自动/手动重试

## 6. 桌面端与数据侧车架构（可选运行形态）

```
Electron 主进程（electron/main.ts）
  ├─ 窗口管理
  │     · 开发模式：加载 VITE_DEV_SERVER_URL=http://localhost:3000（独立于 Vite 5199；package.json electron:dev 行 L266）
  │     · 生产模式：加载 dist/index.html
  │     · 安全配置：contextIsolation=true、nodeIntegration=false、preload 安全桥
  ├─ preload.ts（contextBridge 暴露白名单 IPC 通道）
  ├─ proxy.ts（生产模式本地代理：/api/akshare→:8000、/api/embed→:8001、/api/collect→:8000）
  └─ sidecar.ts（拉起 Python 侧车进程，默认端口：daemon 8765 / embedding 8001 / collector 8000；停止时回收）
        └─ backend/sidecar_entry.py 统一入口：
             ├─ AKShare Collector   :8000（数据采集 FastAPI）
             ├─ Embedding Service   :8001（本地向量化 FastAPI）
             └─ Embedding Daemon    :8765（守护进程；三服务缺失 collector 时可降级运行）
```

浏览器形态下由 [vite.config.ts](../../vite.config.ts#L233-L377) 开发代理承担同样职责（含腾讯/新浪行情的 CORS 处理、GBK→UTF-8 编码转换、gzip/deflate/br 解压；腾讯 K 线代理使用自定义 connect 插件避免逗号编码 bug）。

## 7. 架构核心原则

1. **数据优先于界面**：所有写操作必须封装为 `StandardEnvelope` 经 `DataBridge.forward()` → `handlerRegistry` 分发 → db，禁止组件直连 dataLayer
2. **配置驱动零硬编码**：阈值/权重/颜色/路径全部收敛到 `src/config/` 与 `src/constants/`，由 `audit:hardcode` 分级扫描（Critical/Major 阻断，Warning 告警）
3. **类型安全铁律**：禁 `any`、禁 `@ts-ignore`、复杂泛型必须有类型测试
4. **响应式订阅**：组件必须通过 Zustand selector 订阅数据字段；派生函数分三类（Selector Hook useXxx / 纯函数 / @nonReactive 标注的 getState 查询）
5. **门禁化质量**：pre-commit 22 主步（P0 BLOCK × scope-guard/env/secrets/tsc:prod/×layers/×atomic/×db-references/doc-id-reverse/×registry/vitest registryContract/RAG 幻觉/agents-consistency + warn 附属）+ pre-push 6 主步（0/5 skill-router → 1/5 gate:quick → 2/5 widget-registry + registry:regression → 3/5 complexity-scan → 4/5 test:stable → 5/5 build + 6/6 gate:aggregate 非阻塞聚合）+ `npm run audit` 聚合审计

## 8. 下一站

- 各目录/子域的具体职责 → [02 模块职责地图](02-module-map.md)
- DataBridge / V6 引擎等核心 API → [03 关键类与函数](03-core-classes-functions.md)

---

## 🏁 修订记录摘要（v2.0.0 FINAL · 两轮共 24 项事实漂移）

**本文档涉及的 6 项修正：**

| # | 漂移项 | 旧值 | 新值（最终）| 核实真相源 |
|---|-------|------|-----------|----------|
| 1 | src/ 顶层目录数 | 24 | **21** | 磁盘 `Get-ChildItem -Directory src` 实查 |
| 2 | services 子域数 | 30+ | **38** | `src/services/` 目录逐一列出 |
| 3 | Store 注册表/磁盘文件 | 63 | **66 条目（51a+15d）/ 78 文件** | `storeRegistry.ts` + 目录统计 |
| 4 | Husky pre-commit 主步数 | 20 步左右 | **22 主步（P0×10 + P1×12）** | `.husky/pre-commit` 逐段标号 |
| 5 | Husky pre-push 主步数 | 5 步左右 | **6 主步串行** | `.husky/pre-push` 逐段标号 |
| 6 | 技术栈表 audit:\* 脚本数 | 67 条 | **66 条** | `package.json` 脚本 Node 前缀计数 |

> 完整 24 项漂移清单、两轮轮次归属、验证方法声明 → 见 [README.md §修订记录](README.md#🏁-修订记录--24-项事实漂移全清单v200-final)
