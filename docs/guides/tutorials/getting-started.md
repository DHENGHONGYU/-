---title: "V9 智能投研复盘系统 — 新成员 30 分钟上手指南"
domain: project
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v1.0.3
change_log:
  - version: 1.0.3
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.2 / 正文 v1.0.0) → 取真值 max=1.0.2 → PATCH++ 对齐 frontmatter/正文/change_log 三轨"
    date: 2026-08-23
  - version: v1.0.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v1.0.1) → R2 PATCH++(v1.0.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---
covers_code:
  - src/data/types.ts


---
title: getting-started
type: tutorials
domain: project
phase: development
tier: important
status: active
maintainer: V9 Architecture Team
summary: "Version：v1.0.0 Date：2026-07-12 目标读者：新加入的开发者、AI Agent（ onboarding 第一站） 阅读时长：30 分钟（含 5 分钟实操）"
tags: [project, guide, tutorials, tutorial, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-PROJ-122
related_docs: [V9-DOC-PROJ-271, V9-DOC-PROJ-036, V9-DOC-BACK-023, V9-DOC-DATA-017, V9-DOC-FRONT-022, V9-DOC-DATA-055, V9-DOC-BACK-027, V9-DOC-FRONT-026]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-246, V9-DOC-PROJ-187, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 智能投研复盘系统 — 新成员 30 分钟上手指南

> **Version**：v1.0.3  
> **Date**：2026-07-12  
> **目标读者**：新加入的开发者、AI Agent（ onboarding 第一站）  
> **阅读时长**：30 分钟（含 5 分钟实操）

---

## 快速定位（1 分钟）

本系统采用 **五舱 + 驾驶舱** 架构：

| 舱室 | 路径 | 功能 | 代表页面 |
|------|------|------|----------|
| **输入舱** | `/input/*` | 数据采集、采集策略配置（历史沿用“七维”命名）、本地知识 | `CollectTaskPage`、`SevenDimConfigPage` |
| **分析舱** | `/analysis/*` | 评分、筛选、回测、板块 | `StockAnalysisPage`、`BacktestPage` |
| **交易舱** | `/trading/*` | 持仓、组合、风控、策略快照 | `HoldingsPage`、`PortfolioPage` |
| **输出舱** | `/output/*` | 研报、复盘、Dashboard | `ResearchReportPage`、`TradeReviewPage` |
| **指令舱** | `/command/*` | MCP Server、系统管理 | `MCPServerDashboardPage` |
| **驾驶舱** | `/cockpit` | 全局 Dashboard | `CockpitShell` |

---

## 第一步：理解项目分层（5 分钟）

```
src/config/       ← 配置层（零硬编码锚点）
src/core/         ← 核心工具（DataBridge/ACL/Envelope/MemoryCache/EventBus）
src/data/         ← 数据层（IndexedDB/dataLayer/queryBuilder）
src/lib/          ← 库函数（logger/format/errors/utils）
src/services/     ← 服务层（23 个子域，通过 DataBridge 写数据）
src/store/        ← 状态层（Zustand + withBroadcast 跨 Tab 广播）
src/pages/        ← 页面层（5 舱 + 驾驶舱）
src/components/   ← 组件层（atoms/molecules/organisms/widgets）
src/portal/       ← PortalShell 舱室入口
src/constants/    ← 常量层（零硬编码锚点）
src/types/        ← 类型层（零依赖）
```

### 核心依赖规则（禁止跨层）

- `pages/` → 只能依赖 `store/` 和 `services/`
- `store/` → 只能依赖 `services/` 和 `core/`
- `services/` → 只能依赖 `core/`、`data/` 和 `lib/`（白名单：logger、withBroadcast、eventBus、format、errors、utils）
- `lib/` → 只能依赖 `core/` 和 `config/`

> 验证命令：`npm run audit:layers`（期望 0 violations）

---

## 第二步：四步集成编码契约（10 分钟）

新增任何模块（Store / Service / Page / Widget）**严禁**直接在 `/views` 或 `/pages` 下孤立新建文件，必须按以下四步顺序集成：

### 步骤 1：类型定义

在 `src/types/modules/` 或 `src/data/types.ts` 中定义 Interface。

```typescript
// 示例：新增 Widget 类型
export interface WidgetConfig {
  id: string
  widgetId: string
  position: { x: number; y: number }
  size: { cols: number; rows: number }
  settings?: Record<string, unknown>
}
```

### 步骤 2：Store/状态

在 `src/store/` 中创建 Zustand Store，通过 `withBroadcast` 实现跨 Tab 广播。

```typescript
import { create } from 'zustand'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'

interface MyStoreState {
  data: string[]
  loading: boolean
  loadData: () => Promise<void>
}

export const useMyStore = create<MyStoreState>((set, get) => ({
  data: [],
  loading: false,
  loadData: async () => {
    set({ loading: true })
    // ... 调用 Service
    set({ data: result, loading: false })
    withBroadcast(EVENT_NAMES.STOCKS_CHANGED, { action: 'load' })
  },
}))
```

### 步骤 3：Builder/适配层

在 `src/services/` 中创建 Service，通过 DataBridge 写入数据。

```typescript
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'

export async function saveMyData(data: MyData) {
  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.myModule,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertMyData,
      traceId: `my-${nanoid(8)}`,
    },
    data,
  )
  return dataBridge.forward(envelope)
}
```

### 步骤 4：核心集成

在 `src/pages/` 或 `src/components/` 中创建 UI，**仅通过 Store 获取数据**。

```typescript
import { useMyStore } from '@/store/myStore'

export function MyPage() {
  const { data, loading, loadData } = useMyStore()
  // UI 渲染...
}
```

> **每步可独立回滚**，完成后运行 `npx tsc --noEmit` 验证类型安全。

---

## 第三步：开发规范速查（10 分钟）

### 类型安全

- ? 禁止 `any`（ESLint `@typescript-eslint/no-explicit-any: error`）
- ? 禁止 `@ts-ignore`（使用 `@ts-expect-error` 并附带注释）
- ? 所有数据结构先定义 TypeScript Interface

### 颜色令牌（红涨绿跌）

```typescript
// ? 正确：使用 STOCK_COLOR_TOKENS（自动豁免主题切换）
import { getStockColorClass } from '@/constants/theme.tokens'
<span className={getStockColorClass(stock.changePercent)}>
  {stock.changePercent.toFixed(2)}%
</span>

// ? 禁止：硬编码颜色
<span className="text-red-500">+3.2%</span>
```

### 日志规范

```typescript
import { getLogger } from '@/lib/logger'
const logger = getLogger()

logger.info('[MyStore] loadData() completed', { count: data.length })
logger.error('[MyStore] loadData() failed', { error: message })
```

### useEffect 清理模板

```typescript
// ? EventBus 订阅清理
useEffect(() => {
  const handler = (data: unknown) => { /* ... */ }
  EventBus.subscribe('eventName', handler)
  return () => EventBus.unsubscribe('eventName', handler)
}, [])

// ? 定时器清理
useEffect(() => {
  const timerId = setInterval(() => { /* ... */ }, 1000)
  return () => clearInterval(timerId)
}, [])
```

---

## 第四步：常用命令（5 分钟）

```bash
# 类型检查
npx tsc --noEmit

# 架构审计
npm run audit:layers      # 跨层调用
npm run audit:hardcode    # 颜色硬编码
npm run audit:deadcode    # 死代码
npm run audit:docs        # 文档同步
npm run audit:token       # Token 消耗

# 单元测试
npm test -- --run

# 生产构建
npm run build
```

---

## 第五步：文档地图（按需深入）

| 我想了解... | 阅读文档 | 路径 |
|-------------|----------|------|
| 全局架构 | overview | [../../archive/historical-2026-08-16/batch7/docs/explanation/architecture/overview.md（已归档）](../../archive/historical-2026-08-16/batch7/docs/explanation/architecture/overview.md（已归档）) |
| 舱室详情 | cabins-overview | [../../archive/historical-2026-08-16/batch7/docs/explanation/cabins-overview.md（已归档）](../../archive/historical-2026-08-16/batch7/docs/explanation/cabins-overview.md（已归档）) |
| 服务子域 | services-catalog | [../../reference/services-catalog.md](../../reference/services-catalog.md) |
| 数据字典 | data-dictionary-index | [../../archive/historical-2026-08-16/batch7/docs/explanation/design/data-dictionary-index.md（已归档）](../../archive/historical-2026-08-16/batch7/docs/explanation/design/data-dictionary-index.md（已归档）) |
| 编码规范 | AGENTS 契约 | [../../../AGENTS.md](../../../AGENTS.md) |
| 颜色令牌 | design-token-mapping | [../../reference/design-token-mapping.md](../../reference/design-token-mapping.md) |
| 如何新增 Store | how-to-add-store | [../how-to/how-to-add-store.md](../how-to/how-to-add-store.md) |
| 如何新增 Service | how-to-add-service | [../how-to/how-to-add-service.md](../how-to/how-to-add-service.md) |
| 如何新增 Widget | how-to-add-widget | [../how-to/how-to-add-widget.md](../how-to/how-to-add-widget.md) |

---

## 常见问题（FAQ）

**Q1：Store 数据如何在多个 Tab 间同步？**  
A：使用 `withBroadcast()` 广播变更事件。其他 Tab 的 Store 订阅相同事件名即可自动刷新。

**Q2：Service 能直接调用 dataLayer 吗？**  
A：不能。必须通过 `DataBridge.forward()` 发送 Envelope，由 ACL 校验后路由到 DB。

**Q3：新增页面需要注册路由吗？**  
A：必须。在 `src/config/routes.ts` 的 `ROUTE_REGISTRY` 中注册，并同步更新 `../../archive/historical-2026-08-16/batch7/docs/explanation/06-routing-specs.md（已归档）`。

**Q4：如何调试 IndexedDB 数据？**  
A：浏览器 DevTools → Application → IndexedDB → `v9-database` → 查看各 store。

---

> **下一步**：根据你的任务选择对应的 How-to 指南 → [../how-to/how-to-add-store.md](../how-to/how-to-add-store.md) / [../how-to/how-to-add-service.md](../how-to/how-to-add-service.md) / [../how-to/how-to-add-widget.md](../how-to/how-to-add-widget.md)
---

## 开发环境配置注意要点（每次安装/克隆后必做）

> **本章节为解决"功能窗口上下文文档无法打开"问题的关键配置。每次新环境安装后必须逐项执行。**

### 1. Node 与 npm 版本锁定

```bash
# 检查版本（必须与 .nvmrc 一致）
node -v
cat .nvmrc

# 若不一致，使用 nvm 切换
nvm use
# 或 nvm install $(cat .nvmrc)
```

### 2. 依赖安装（强制使用 `npm ci`）

```bash
# ?? 禁止使用 npm install —— 可能导致依赖漂移，功能组件版本不兼容
npm ci

# 验证安装成功
npm run tsc:prod
```

### 3. IDE 扩展安装（功能窗口正常工作的前提）

| IDE | 操作 | 必须项 |
|-----|------|--------|
| **VSCode** | 左侧扩展栏 → ? → Install Recommended Extensions | ESLint、Prettier、TypeScript、Tailwind CSS |
| **Cursor** | 设置 → Extensions → 安装推荐扩展 | 同上 + Cursor 内置 AI 扩展 |
| **Trae** | 检查 AI 助手插件已启用 | Trae AI + MCP 配置 |
| **CodeBuddy** | 检查 `.codebuddy/settings.local.json` 存在 | 配置自动加载 |

> **关键提示**：若缺少扩展，IDE 功能面板（AI 上下文窗口、文档预览、类型提示）可能空白或报错。

### 4. 工作区信任设置（VSCode/Cursor）

- 打开项目后，若提示"是否信任此工作区？"，必须选择 **"信任"**。
- 不受信任时，IDE 会禁用部分功能（如扩展加载、任务运行、调试等）。
- 检查：命令面板 (`Ctrl+Shift+P`) → `Workspaces: Manage Workspace Trust` → 确认当前文件夹为"Trusted"。

### 5. 浏览器运行时权限（运行时功能窗口）

若应用运行后功能窗口/文档弹窗无法打开：

| 检查项 | 验证方法 | 修复 |
|--------|----------|------|
| 弹窗拦截 | 地址栏是否有 ?? 图标 | 添加 `localhost:5173` 到白名单 |
| HTTPS/本地文件 API | 控制台搜索 `showDirectoryPicker` | 仅 HTTPS 或 localhost 可用 |
| IndexedDB 配额 | DevTools → Application → Storage | 清理旧数据或扩容 |
| CSP 策略 | 控制台搜索 `Content-Security-Policy` | 检查 `vite.config.ts` CSP 配置 |

### 6. Kimi 工具链配置（AI 辅助开发必备）

#### 6.1 Kimi WebBridge（浏览器自动化）

```bash
# Windows PowerShell
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" status
# 若未运行：
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start
```

- 确认浏览器扩展已安装且版本匹配。
- 若提示 "Please update the Kimi WebBridge extension"，请访问 [Kimi WebBridge 帮助页](https://www.kimi.com/zh-cn/features/webbridge) 更新。

#### 6.2 Kimi 桌面客户端上下文面板（? 每次客户端更新后必检）

> **关键提示**：Kimi 桌面客户端右侧"上下文"面板是 AI 辅助开发的核心入口，**每次安装或更新 Kimi 客户端后必须验证可用性**。

**验证步骤**：
1. 打开 Kimi 桌面客户端，确认已登录。
2. 将 2-3 个项目文件（如 `../../../README.md`、`../../../AGENTS.md`）添加到上下文面板。
3. 点击每个文件，确认能**打开预览内容**。
4. 若点击无反应 → **完全退出客户端**（任务栏托盘右键退出）→ 重新打开 → 重试。
5. 若仍无法打开 → **清除客户端缓存**（设置 → 高级 → 清除缓存）→ 重新登录。

**常见根因**：

| 根因 | 症状 | 修复 |
|------|------|------|
| 客户端缓存损坏 | 点击文件无反应 | 完全退出 → 重新打开，或清除缓存 |
| 文件路径含特殊字符 | 文件无法预览 | 重命名为英文路径后重新添加 |
| 文件过大 | 客户端卡顿或预览失败 | 拆分为 < 500KB 的小文件 |
| 客户端版本 Bug | 面板空白或不更新 | 更新到最新版或回退稳定版 |
| 登录态失效 | 上下文同步异常 | 重新登录 |

**替代方案**（当面板完全无法使用时）：
- 直接复制文件内容粘贴到对话输入框。
- 使用 `@` 提及功能选择文件（若客户端支持）。
- 通过 `npx tsx scripts/query-ai-memory.ts "<关键词>" --top 5` 提取内容后手动发送。

### 7. 验证清单（安装后 2 分钟自检）

```bash
# 环境基线
node -v && npm -v && git config --list | grep -E "user\.(name|email)"

# 项目健康
npm run tsc:prod
npm run audit:layers

# 功能窗口验证（手动）
# 1. npm run dev
# 2. 打开 http://localhost:5173
# 3. 点击各舱室的 "?" 帮助按钮或文档链接
# 4. 确认弹窗/抽屉/新窗口正常加载，无空白/报错

# AI 客户端上下文面板验证（每次 Kimi 更新后）
# 1. 打开 Kimi 桌面客户端
# 2. 添加 2-3 个文件到上下文面板
# 3. 点击每个文件，确认能打开预览
# 4. 若无法打开 → 完全退出客户端 → 重新打开 → 重试
# 5. 若仍无法打开 → 清除客户端缓存 → 重新登录
```

> **若仍无法打开**：激活 `../../../.agents/skills/architecture-cleanup/SKILL.md` 进行深度诊断。

---

> **下一步**：根据你的任务选择对应的 How-to 指南 → `../how-to/../how-to/how-to-add-store.md` / `../how-to/../how-to/how-to-add-service.md` / `../how-to/../how-to/how-to-add-widget.md`
