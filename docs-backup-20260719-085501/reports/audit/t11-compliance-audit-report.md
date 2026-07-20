---
title: T-11 分层依赖与文档同步审计报�?
type: reports
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "任务: T-11 · 分层依赖与文档同步审�?> 执行时间: 2026-07-10 执行节点: Node.js 22.22.2 (managed) 报告范围: UI..."
tags: [qa, audit, report, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---orts
domain: qa
phase: testing
tier: standard
status: active
maintainer: V9 Architecture Team
tags: [qa, audit, report, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
---

# T-11 分层依赖与文档同步审计报�?
> **任务**: T-11 · 分层依赖与文档同步审�?> **执行时间**: 2026-07-10
> **执行节点**: Node.js 22.22.2 (managed)
> **报告范围**: UI 设计优化实施计划 T-01 ~ T-10 完成后的最终合规回�?
---

## 1. 审计总览

| 门禁 | 命令 | 状�?| 说明 |
|------|------|------|------|
| TypeScript 类型检�?| `tsc --noEmit` | �?通过 | 0 错误 |
| 跨层调用审计 | `audit:layers` | �?通过 | 0 违规�? 警告 |
| 颜色硬编�?裸色�?| `lint:colors` | �?通过 | 0 违规 |
| 令牌债务回归 | `audit:tokens` | �?通过 | 当前 0，基�?0 |
| 代码-文档同步 | `audit:docs` | �?通过 | 0 未文档化 |
| 路由一致�?| `audit:routes` | �?通过 | 62/62，覆盖率 100% |
| 测试规范审计 | `audit:tests` | �?通过 | 319 个测试文件合�?|
| @reserved Store | `audit:reserved-stores` | �?通过 | �?reserved Store |
| Token 消耗检�?| `audit:token-consumption` | �?通过 | 0 浪费 |
| MCP 架构一致�?| `audit:mcp` | ⚠️ 3 处违�?| 页面直接 import service（预存债务�?|
| 硬编码审�?| `audit:hardcode` | ⚠️ 未执�?| Node 22 段错�?访问冲突，环境不稳定 |
| 死代码审�?| `audit:deadcode` | ⚠️ 未执�?| Node 22 段错�?访问冲突，环境不稳定 |

---

## 2. 关键修复与变�?
### T-07 现有数据 Widget 四态接�?- 复用 `WidgetStateShell` 覆盖 `src/cockpit/widgets/` �?20+ 个数�?Widget�?- 补齐迁移拆分遗留组件：`CollectionProgressPanel`、`CollectionReportPanel`�?- 修正 `src/components/pool/*` 重导出为具名导出，与 `organisms/pool/*` 对齐�?- 修复 `SignalQualityDashboardWidget` 未完成的四态转换与 `Toast` 类型导出�?
### T-08 令牌审计与债务消减
- `src/services/hybrid-proofread/reportGenerator.ts` 24 �?HEX 替换�?`COLOR_SHADES` 令牌�?- 补充 `COLOR_SHADES.slate.hex[800]`�?- `.token-baseline.json` 债务�?24 降至 0�?
### T-10 Playwright 视觉 diff 方案
- `playwright.config.ts` 增加 `expect.toHaveScreenshot` 配置�?- 新增 `e2e/visual-regression.spec.ts`，覆�?5 个核心舱页面�?- 生成 5 �?baseline 快照：`input-cabin`、`analysis-cabin`、`trading-cabin`、`output-cabin`、`command-cabin`�?- 新增 npm scripts：`test:e2e:visual`、`test:e2e:visual:update`�?
---

## 3. 遗留问题与建�?
### 3.1 MCP 架构直接调用（预存债务�?
`audit:mcp` 发现 3 处页面直�?import service，未通过 MCPClient�?
| 文件 | 行号 | 直接导入 | 建议 |
|------|------|----------|------|
| `src/pages/input/CollectTask/index.tsx` | 23 | `buildCollectionReport` from `collectionReportService` | 将报告构建逻辑下沉�?Store，页面仅消费 Store |
| `src/pages/input/FetcherConfigPage.tsx` | 57 | `testSourceConnectivity` from `dataSourceOrchestrator` | 通过 Store �?MCP Tool 封装连通性探�?|
| `src/pages/trading/TradingFlowPage.tsx` | 17 | `generateMockTradingData` from `mockDataGenerator` | DEV 模式�?Mock 数据生成移至 Store；生产构建不打包 |

> 说明：AGENTS.md §一允许 `pages/` �?`services/` 的依赖方向，因此这三处不构成跨层违规；`audit:mcp` 是更高阶的架构契约（统一 MCP 入口），属于预存优化债务，不在本�?UI 设计优化范围内�?
### 3.2 Node 22 环境偶发段错�?
以下脚本�?Node 22.22.2 上偶�?`-1073741819`/`STATUS_ACCESS_VIOLATION` �?`Segmentation fault`�?
- `audit:hardcode`
- `audit:deadcode`
- `audit:tokens --strict`
- Playwright 5 worker 并发下输入舱偶发浏览器崩�?
建议�?1. CI 环境固定使用 Node 22 LTS 最�?patch，并设置 `workers: 1`�?2. 对不稳定脚本增加重试机制或单 worker 运行�?3. 考虑�?Linux/macOS 环境跑全量门禁，Windows 本地�?`tsc` + `audit:layers` + `lint:colors` + `audit:tokens` 为核心闸�?
### 3.3 视觉回归基线维护

- 首次基线已在 Windows + Chromium 下生成，文件名为 `*-chromium-win32.png`�?- 不同操作系统/字体可能导致基线不一致，建议�?CI（Linux）重新生成并提交 Linux 基线�?- UI  redesign 后需执行 `npm run test:e2e:visual:update` 重新冻结基线�?
---

## 4. 验收结论

- **本次 UI 设计优化实施计划（T-01 ~ T-10）核心门禁全部通过**�?- `audit:mcp` 3 处违规为预存债务，不影响 T-07/T-08/T-10 的交付质量�?- `audit:hardcode` / `audit:deadcode` 因本�?Node 22 运行环境不稳定未获得结果，建议在稳定 CI 环境补跑�?- 推荐下一步：�?CI 固化 `npm run test:e2e:visual`，将视觉回归纳入常规回归流程�?