# 智能投研复盘系统 V9

> 当前版本：`v2.0.0`  
> 面向中国 A 股个人投资者的研究决策与复盘工具

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui 风格组件
- Zustand
- React Router 7 (HashRouter)
- IndexedDB（原生 API）

## 架构

```
L5 展示层：pages/, components/, portal/, cockpit/
L4 应用层：apps/（输入/分析/交易/输出/总控五舱）
L3 引擎层：services/（scoring/fetcher/trading/input）、agents/ 初始实现、core/dataflow/ 已实现
L2 数据层：data/, db/
L1 基础设施层：lib/, config/, core/
```

核心原则：

- 纯前端，数据本地 IndexedDB 存储
- 所有跨模块写操作走 `DataBridge.forward(StandardEnvelope)`
- 五舱工作流：输入 → 分析 → 交易 → 输出 → 总控
- 股票池采用单表多状态：candidate / screened / deepDive / watching / archived

## 快速启动

```bash
npm ci          # ⚠️ 强制使用 npm ci，禁止使用 npm install（确保依赖版本锁定）
npm run dev
```

> **新环境安装关键提示**：若功能窗口（帮助文档、AI 面板、上下文弹窗）无法打开，请按序检查：
> 1. IDE 扩展：安装 `.vscode/extensions.json` 推荐的所有扩展。
> 2. 工作区信任：VSCode/Cursor 需将本文件夹设为"受信任工作区"。
> 3. 浏览器弹窗：若 `window.open()` 无反应，检查浏览器弹窗拦截设置。
> 4. 详见 `.agents/skills/feature-window-context-doc/SKILL.md` 完整诊断流程。

## 常用命令

```bash
npm run lint      # ESLint
npm run test      # 单元测试
npm run build     # 生产构建
npm run preview   # 预览生产构建
```

## 构建优化（PR-5）

本项目采用 Vite v6.4.3 构建，已实施以下优化（详见 [docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md](docs/reference/changelogs/2026-07/pr-5-build-optimization-summary.md)）：

### ManualChunks 配置

大型第三方库独立成 chunk，消除重复打包：

- `vendor`：react/react-dom/react-router/zustand/dayjs
- `ui`：lucide-react/clsx/tailwind-merge/@heroicons/react
- `charts`：recharts/lightweight-charts（消除 5 个图表组件的 recharts 重复打包）
- `pdf`：jspdf/jspdf-autotable（配合 `await import()` 懒加载）
- `excel`：xlsx（配合 `await import()` 懒加载）

### Sourcemap 策略

- **生产环境**：`sourcemap: false`（关闭，减少 12.1 MB 输出）
- **调试环境**：临时改为 `sourcemap: 'hidden'`（生成但不暴露给浏览器）
- **错误追踪**：依赖 `src/lib/logger.ts` 记录错误堆栈，不依赖 sourcemap

### 优化效果

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| dist 体积 | ~15.6 MB | ~3.1 MB | ↓ 80.1% |
| .map 文件 | 137 个（12.1 MB） | 0 个 | 全部消除 |
| ScoreRadar chunk | 299 kB | 0.96 kB | ↓ 99.7% |
| recharts 重复打包 | ~662 kB | 0 kB | 消除 |

### 大型模块预先诊断清单

新增大型第三方库前，请检查：

1. 体积 > 100 kB 的库是否已加入 `manualChunks`
2. 被 3+ 组件引用的共享库是否独立成 chunk
3. 功能性库（导出/解析）是否使用 `await import()` 懒加载
4. 图标库是否按需导入（`import { Menu } from 'lucide-react'`）

## 已实现功能

- [x] 五舱导航框架（PortalShell）
- [x] 驾驶舱 Dashboard（CockpitShell）
- [x] IndexedDB 数据层 + DataBridge 信封化
- [x] ACL 权限矩阵
- [x] 输入舱：股票录入、搜索一键录入、批量导入、热门板块、候选池看板/列表视图、批量归档/流转、数据质量筛选
- [x] 分析舱：V6 九维评分（自动评分）、V4 行业智能评分、V6 个股智能评分、筛选引擎（candidate→screened→deepDive）
- [x] 交易舱：模拟买入/卖出、持仓订单、信号扫描与持久化
- [x] 输出舱：数据导出
- [x] 总控舱：系统统计、数据重置、V6 Pro → V9 JSON 数据迁移入口
- [x] 数据迁移：`v6MigrationService` 支持 12 个核心 store 的解析、转换、导入；`MigrationPanel` 提供上传/预览/导入/报告
- [x] 基础 UI 组件（Button/Card/Input/Badge/Checkbox/Progress/Textarea/Tabs/Dialog/Switch）
- [x] 单元测试（291 tests，覆盖 DataBridge + dataLayer + 智能评分 + 筛选引擎 + 信号持久化 + 输入舱组件 + V6 迁移服务）

## 待实现

- [x] AKShare 数据采集接入（P0 基础字段）
- [~] 真实财务/行情数据驱动的评分（部分接入，持续优化）
- [~] 板块轮动评分引擎已实现，上层展示待完善
- [~] 策略回测引擎（核心实现+测试已完成，UI 页面待完善）
- [~] 交易复盘笔记（核心功能已实现，AI 复盘报告待优化）
- [~] PWA 离线化（manifest 已配置，service worker 待实现）
- [x] Playwright E2E 测试（5 条核心链路）
- [~] CI 覆盖率门禁（基础 CI 已配置，覆盖率阈值门禁待启用）

## 文档

详见 `docs/` 目录：

- `01-vision-and-goals.md`
- `02-functional-specs.md`
- `03-architecture-standards.md`
- `04-ui-ux-specs.md`
- `05-engine-specs.md`
- `06-routing-specs.md`
- `07-operation-strategy.md`
- `08-implementation-plan.md`
- `09-quality-gates.md`
- `10-glossary.md`

## 设计参考

UI 设计参考：https://hslqownhhwaig.ok.kimi.link/

## 状态

- `tsc --noEmit`：通过
- `npm run lint`：通过
- `npm run test`：通过（291/291，44 个测试文件）
- `npm run test:e2e`：通过（5/5）
- `npm run build`：通过
test
test
