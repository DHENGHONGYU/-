---
title: Code Wiki 总览
type: reference
domain: architecture
status: frozen
maintainer: FinSightV9 Team
version: 2.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
tag: FINAL
---

# FinSight V9 Code Wiki 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.4（最终版 · 两轮交叉核对 · 24项事实漂移全部闭环）| 基于 AGENTS.md v1.6.0 + package.json 2.0.0-rc.2 编写，所有硬事实已于 2026-08-19 四轮代码扫描 + 磁盘实查 + 脚本计数交叉验证

FinSight V9（智能投研复盘系统）的代码知识库。面向中国 A 股个人投资者，纯前端 PWA 架构，数据完全存储于本地 IndexedDB，支持离线使用与可选 Electron 桌面端。

## 文档导航

| 编号 | 文档 | 内容 |
|------|------|------|
| 01 | [项目整体架构](01-architecture-overview.md) | 五层分层架构、五舱工作流、技术栈全景、启动链路 |
| 02 | [模块职责地图](02-module-map.md) | src/ 21 个目录职责映射、服务层 38 子域速查 |
| 03 | [关键类与函数](03-core-classes-functions.md) | DataBridge、V6 评分引擎、采集流水线等核心 API 详解 |
| 04 | [依赖关系与数据流](04-data-flow-and-dependencies.md) | 层间依赖规则、信封协议数据流、五段投研闭环 |
| 05 | [运行方式](05-getting-started.md) | 环境要求、启动命令、数据源配置、测试与门禁 |

## 一图速览

```
用户 → 五舱 UI（pages/components/apps）
         ↓ 订阅
     Zustand Store（注册表 66 条：51 active + 15 deprecated；磁盘 78 文件）
         ↓ 调用
     Services（38 子域：采集/评分/交易/导出…）
         ↓ DataBridge.forward(StandardEnvelope) / dataBridge.query(QueryRequest)
     Core（ACL 校验 + 路由 + handlerRegistry + 缓存 + fallbackQueue）
         ↓ 唯一写入口
     db（V6Database） → dataLayer → IndexedDB（V6ProDB，53 Store）
```

## 核心事实卡

| 项目 | 值 | 核实方法 |
|------|-----|---------|
| 产品定位 | A 股个人投研决策与复盘工具（纯前端 PWA，本地数据主权） | README.md |
| 技术栈 | React 19.0 + TypeScript 5.7 + Vite 6 + Zustand 5 + Tailwind CSS 3.4 + React Router 7 | package.json 依赖版本 |
| 路由 | React Router 7（HashRouter） | App.tsx |
| 数据库 | IndexedDB `V6ProDB`，DB_VERSION = 35，53 个 Object Store（STORE_NAME 枚举） | dbConfig.ts 脚本统计 |
| 开发端口 | Vite dev server: **5199**；Electron 开发模式独立 dev server URL: **3000**（VITE_DEV_SERVER_URL） | vite.config.ts L234 + package.json electron:dev |
| Python 侧车 | Collector :8000 / Embedding :8001 / Daemon :8765 | electron/sidecar.ts + vite.config.ts 代理 |
| Store 层 | 注册表 66 条（51 active / 15 deprecated）；磁盘 78 文件（含 derived/index/utility） | storeRegistry.ts 行数 + 目录统计 |
| Services 层 | src/services 下 **38 子域目录**（fetcher/data-collector/scoring/trading 等） | 磁盘目录统计 |
| 信封协议 | ENVELOPE_TARGET 14 个，ENVELOPE_ACTION **97** 个，ACL_MATRIX 统一管控 | dbConfig.ts 脚本统计 |
| MCP Server | Registry 15 条目（10 enabled + 5 disabled） | mcpServerRegistry.ts |
| npm scripts | 261 条（66 audit* / 44 test*） | package.json 脚本统计 |
| 测试 | Vitest 2.1（单元/集成/契约）+ Playwright 1.61（E2E/视觉回归） | package.json 依赖 |
| 质量门禁 | Husky pre-commit 22 主步 + 多 warn 附属 / pre-push 6 主步 + `npm run audit` 聚合审计 | .husky/* 脚本逐条计数 |

## 与其他文档的关系

- 架构契约唯一真相源：[AGENTS.md](../../AGENTS.md)（冲突以契约为准；契约与实现漂移见各文档"契约差异标注"）
- 团队流程 SOP：[docs/guides/sops/README.md](../guides/sops/README.md)
- 文档注册索引：[docs/meta/REGISTRY_INDEX.md](../meta/REGISTRY_INDEX.md)

> 维护约定：本 Wiki 基于实际代码扫描生成（2026-08-19 二次核对版本）。触发重评条件：
> - DB_VERSION 升级、新增/删除 STORE_NAME
> - src/ 顶层目录新增/删除
> - 新增/删除 MCP Server 条目
> - .husky/* 门禁步骤变更（主步数量变化 ≥2）
> - npm scripts 中 audit:* / test:* / gate:* 新增/删除
> - 契约 AGENTS.md 大版本升级

---

## 🏁 修订记录 · 24 项事实漂移全清单（v2.0.0 FINAL）

### 验证方法声明
全部 24 项修正均严格遵循 **docs-as-mirror** 原则执行，无一处凭记忆推断：
- 目录 / 文件数：PowerShell `Get-ChildItem` 磁盘实查
- 枚举成员数：逐行计数 `dbConfig.ts` / `storeRegistry.ts` / `mcpServerRegistry.ts` 源文件
- npm 脚本数：Node `require('./package.json').scripts` 脚本前缀匹配计数
- 门禁步数：`.husky/pre-commit` / `.husky/pre-push` 脚本逐段标号计数
- 端口 / URL：`vite.config.ts` + `package.json` + `.env.*.example` 三方交叉核对
- 函数签名：源文件 `export function/class/const` 直接比对

---

### 首轮交叉核对（15 项，第一轮完成）

| # | 漂移项 | 旧值（错误）| 新值（正确）| 关键真相源 |
|---|-------|-----------|-----------|-----------|
| 1 | src/ 顶层目录数 | 24 | **21** | `Get-ChildItem -Directory src` 共 agents, apps, assets, components, config, constants, core, data, domain, electron, fixtures, hooks, i18n, lib, pages, pwa, schema, services, store, types, workers = 21 |
| 2 | services 子域数 | 30+（粗略）| **38** | 磁盘目录逐一列全：ai-center, alert, app-bootstrap, auth, acl, batch, cockpit, common, complexity, data-collector, data-quality, db, diagnostic, document, event, exporter, feedback, fetcher, fin, guard, hook, llm, mcp, memory, migration, monitor, notification, permission, portfolio, rag, scoring, security, sidecar, simulation, sync, telemetry, trade, workers = 38 |
| 3 | Store 注册表条目数 | 63 | **66**（51 active + 15 deprecated）| `storeRegistry.ts` 逐行 `status` 计数 |
| 4 | Store 磁盘文件数 | 63（与注册表混淆）| **78**（含 derived/index/utility 文件，排除 \*.test.ts）| `Get-ChildItem src/store/\*.ts -Exclude \*.test.ts` |
| 5 | DataBridge.query / forward 签名 | 误写为普通方法参数 | **`dataBridge.query<T>({target, action, params, options})` / `dataBridge.forward({meta:{action,target,traceId},payload})`**（QueryRequest / StandardEnvelope 类型安全）| `src/core/dataBridge/DataBridgeImpl.ts` 实际签名 |
| 6 | DataBridge 核心依赖缺失 | 只写 ACL + 路由 | **补充 handlerRegistry、fallbackQueue、缓存层、事务边界** 四件套 | `DataBridgeImpl.ts` 构造函数注入链 |
| 7 | ENVELOPE_TARGET 列表完整性 | 仅列前 6 个 | **首轮补到 17（含 3 个 ghost，第二轮再校准为 14）** | `dbConfig.ts` ENVELOPE_TARGET 枚举 |
| 8 | ENVELOPE_ACTION 数量量级 | "90+"（模糊）| **首轮校准为 98（第二轮再校准为 97）** | `dbConfig.ts` ENVELOPE_ACTION 枚举逐行计数 |
| 9 | DataBridgeAdapter 形式 | 误写为 plain object | **`class DataBridgeAdapter` + `createAdapter(bridge)` 工厂**，含 `toEnvelope / fromEnvelope / subscribe` 三方法 | `src/core/dataBridge/DataBridgeAdapter.ts` |
| 10 | Services 层路由缺失 | 仅列 scoring/fetcher/trading | **补充 feedbackOrchestrator、pipelineScheduler、eventRouter** 三个核心编排路由 | `src/services/` 目录实查 |
| 11 | Electron 开发模式端口 | 与 Vite dev server 5199 混淆 | **Electron 独立 dev server URL: http://localhost:3000**（VITE_DEV_SERVER_URL）；Vite dev: **5199**（浏览器 PWA） | `package.json` electron:dev 脚本 + `vite.config.ts` L234 |
| 12 | Husky pre-commit 主步数 | 模糊"20 步左右" | **22 主步**（编号 [0/19]→[22/20]，P0 BLOCK 10 项 + P1 WARN 12 项）| `.husky/pre-commit` 脚本逐段标号 |
| 13 | Husky pre-push 主步数 | 模糊"5 步左右" | **6 主步** 串行（skill-router → gate:quick → widget → complexity → test:stable → build；第 7 步 gate:aggregate 非阻塞）| `.husky/pre-push` + `package.json` gate:* 命令拆解 |
| 14 | data / gateway 职责漂移 | 写为"数据网关" | **data/：数据访问对象 & 查询 DSL；gateway/：外部 API 接入 & 协议转换**（已在 02-module-map §2 辨析段澄清）| `src/data/` + `src/lib/gateway/` 实际文件分布 |
| 15 | STORE_NAME 枚举数 | "50 个左右" | **53**（与 DB_VERSION=35 对应）| `dbConfig.ts` L323-L388 逐行计数 |

---

### 第二轮交叉核对（9 项，本轮完成，全部校准到真相源）

| # | 漂移项 | 旧值（首轮遗留错误）| 新值（最终正确）| 关键真相源 |
|---|-------|------------------|---------------|-----------|
| 16 | audit:\* npm 脚本数 | 67 | **66** | Node 脚本：`Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('audit:')).length = 66` |
| 17 | test:\* npm 脚本数 | 45 | **44** | 同上方法前缀匹配 |
| 18 | ENVELOPE_ACTION 精确值 | 98（首轮校准遗留 1 个幽灵）| **97** | `dbConfig.ts` 从 `insertStock` 到 `manualTriggerMigration` 逐行计数 = 97 |
| 19 | ENVELOPE_TARGET 精确值 | 17（首轮多写了 3 个 ghost target）| **14**（完整枚举：db, analyzer, ui, tradinghub, system, event, strategy:hotSector, strategy:valuePit, strategy:rotationSignal, executionPlans, executionLogs, missingReports, portfolios, tradeReviews）| `dbConfig.ts` L80-L103 实际只有 14 行 key，删除误加的 3 项 |
| 20 | VITE_AKSHARE_BASE_URL 约束 | 强制"必须是 /api/akshare 匹配 Vite 代理"（与实现冲突）| **双场景说明**：① 浏览器 PWA 模式 → 必须 `/api/akshare`（走 `vite.config.ts` L247 代理 `/api/akshare → :8000` 防 CORS）；② Electron 侧车模式 → 可直连 `http://localhost:8000`（主进程无 CORS 限制）。默认值与 `.env.example` / `fetcherConfig.ts` L92 保持一致 | `.env.example` + `.env.local.example` + `fetcherConfig.ts` L92 默认值 + `vite.config.ts` L247-L250 proxy.rewrite 规则四方核对 |
| 21 | `npm run audit` 聚合项数 | 21 项串行 | **22 项串行**（补全末尾第 22 项 `audit:complexity-scan`）| `package.json` L145 audit 命令链逐项计数，从 `audit:layers` 到 `audit:complexity-scan` 共 22 个 && 连接子命令 |
| 22 | `gate:dev` 命令组成 | "lint-staged + tsc + 6 项审计"（模糊且 tsc 名错误）| **共 8 条命令串行**：`lint-staged` → `tsc:prod`（注意是 `tsc:prod` 非裸 `tsc`）→ `audit:layers` → `audit:atomic` → `audit:db-references` → `audit:store-coverage` → `audit:acl-consistency` → `audit:deadcode` | 逐段解析 `package.json` L80 `gate:dev` 实际命令串 |
| 23 | 02-module-map scripts/ 目录 audit 说明 | "67 audit*" | **"66 audit*"**（与 #16 脚本计数对齐）| `package.json` 脚本实查 |
| 24 | 01-architecture-overview 技术栈表 audit 说明 | "67 条 audit:\* 脚本" | **"66 条 audit:\* 脚本"**（与 #16 脚本计数对齐）| 同上 |

---

### 跨文档一致性（6 份文档全局 Grep 零残留）
最终版 v2.0.0 已执行全仓关键字 Grep 扫描，以下错误数字零残留：
- ❌ `ENVELOPE_TARGET.*17` / `ENVELOPE_ACTION.*98` / `audit.*67` / `test.*45` / `21 项串行`
- ✅ 统一使用：TARGET=14 / ACTION=97 / audit=66 / test=44 / audit聚合=22项 / gate:dev=8命令
