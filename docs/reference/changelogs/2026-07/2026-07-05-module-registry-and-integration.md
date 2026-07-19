---
title: 2026-07-05 模块注册体系建立与未注册文件全量集成
type: reference
domain: project
phase: retrospective
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "任务状态: ? 完成 代码版本: v2.2.1 → v2.3.0 执行时间: 2026-07-05 全天"
tags: [project, integration, registry, changelog, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-171
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 2026-07-05 模块注册体系建立与未注册文件全量集成

> **任务状态**: ? 完成
> **代码版本**: v2.2.1 → v2.3.0
> **执行时间**: 2026-07-05 全天

---

## 一、任务概述

对 V9 项目 629 个文件进行全面扫描，识别 31 个未注册/未引用文件，建立三层集中注册体系（Store/Service/Component），完成 7 个 Cockpit Widget 注册和 12 个组件的页面集成。

---

## 二、人机交互记录

| 时间 | 用户指令 | AI 响应 |
|------|---------|---------|
| T+0 | 扫描本地文件夹，识别未注册文件并执行标准化注册管理 | 全面扫描 629 文件，识别 31 个未注册文件 |
| T+1 | 继续 | 创建 3 个注册表，注册 7 个 Widget |
| T+2 | 继续 | 集成 12 个组件到目标页面 |
| T+3 | 继续 | 修复历史类型错误，集成 feedbackService |
| T+4 | 继续 | 修复 ESLint 插件配置，运行全量验证 |
| T+5 | 测试循环超 10 分钟则停止，分析原因 | 分析测试失败原因，选择方案 A 跳过历史遗留 |
| T+6 | 选择方案 A | 完成 ESLint 修复，生成最终质量报告 |
| T+7 | 更新文档及日志 | 扫描文档目录，识别 9 篇需更新 + 2 篇缺失文档 |

---

## 三、文件变更详情

### 3.1 新建文件（3 个）

| 文件 | 用途 | 行数 |
|------|------|------|
| `src/store/derived.index.ts` | Store 集中注册表（29 条目） | ~200 |
| `src/services/contracts.ts` | Service 集中注册表（52 条目） | ~350 |
| `src/components/componentRegistry.ts` | Component 集中注册表（10 条目） | ~180 |

### 3.2 修改文件（17 个）

| 文件 | 变更内容 | 影响范围 |
|------|---------|---------|
| `src/constants/cockpit.constants.ts` | +7 Widget 默认配置 + 7 数据源 | Cockpit Widget 系统 |
| `src/cockpit/core/widgetRegistry.ts` | +7 Widget 模板 + 7 默认布局 | Widget 注册与渲染 |
| `src/apps/command/CommandApp.tsx` | +LogStreamPanel + AgentTaskList | 系统监控 UI |
| `src/apps/command/ConfigApp.tsx` | +LLMConfigWidget（受控模式） | 配置管理 UI |
| `src/apps/analysis/AnalysisApp.tsx` | +AnalysisTemplateCards | 分析舱默认视图 |
| `src/cockpit/CockpitShell.tsx` | +WidgetErrorBoundary | Widget 异常降级 |
| `src/pages/analysis/NewsPage.tsx` | +NewsSentimentTrend | 资讯情感趋势 |
| `src/pages/analysis/StockAnalysisPage.tsx` | +ScoreHistoryPanel | 评分历史 |
| `src/pages/analysis/IntelligentScorePage.tsx` | +MultiPeriodTrendChart + IntelligentScoreExplanation | 智能评分详情 |
| `src/services/system/bootstrapService.ts` | +initPWA() 启动链路 | 应用初始化 |
| `src/services/trading/tradingService.ts` | +feedbackService 操作反馈 | 交易执行 |
| `src/apps/trading/components/PhaseStepper.tsx` | 修复 COLOR_SHADES.white/gray 不存在 | 类型错误修复 |
| `src/pages/analysis/ValuePitPage.tsx` | 恢复 COLOR_SHADES 导入 | 类型错误修复 |
| `src/pages/analysis/BacktestPage.tsx` | 移除未使用 twBg 导入 | 类型错误修复 |
| `scripts/quality/eslint-plugin-no-hardcoded-colors.js` | CJS→ESM 导出 + rules 包装 | ESLint 配置修复 |
| `../../../reports/changelogs/CHANGELOG.md` | +v2.3.0 条目 + 文档更新表格 | 文档同步 |
| `../../registry-index.md` | 新建注册体系核心文档 | 文档新增 |
| `../../03-architecture-standards.md` | v2.2.1→v2.3.0：§3.1.8 注册体系、Widget +7、D19 修复 | 架构文档 |
| `../../widget-development-guide.md` | v1.0.0→v1.1.0：§7 Widget 清单（19 个）、§7.3 错误隔离 | Widget 指南 |
| `../../testing-strategy.md` | v1.0.0→v1.1.0：§9 注册体系测试策略、基线更新 | 测试策略 |
| `../../data-dictionary-index.md` | v1.2.0→v1.3.0：Registry 模块索引 | 数据字典 |
| `../../10-glossary.md` | v2.2.1→v2.3.0：§10.11 注册体系术语（8 条） | 术语表 |

---

## 四、技术决策记录

### 决策 1：注册表设计模式选择

**候选方案**：
- A. Class 单例模式（如 widgetRegistry）
- B. 静态常量数组模式

**决策**：Store/Service/Component 采用 B（静态常量数组），Widget 保持 A（Class 单例）

**理由**：
- Store/Service/Component 注册信息为静态元数据，无需运行时动态增删
- 静态数组更简单，无需实例化，支持 tree-shaking
- Widget 需要运行时懒加载和生命周期管理，保留 Class 单例

### 决策 2：测试失败处理策略

**问题**：单元测试 3 个文件失败（649/653 通过），第二次运行死循环

**决策**：选择方案 A — 跳过历史遗留测试失败

**理由**：
- 4 个失败用例均为历史遗留（Windows ENOENT 临时文件问题）
- 与本次代码变更无关
- 修复需要调整 Vitest 配置（pool: 'forks'），属于独立任务

### 决策 3：ESLint 插件修复

**问题**：`eslint-plugin-no-hardcoded-colors.js` 使用 CommonJS `module.exports` 但被 ESM `import` 引用

**决策**：转换为 ESM `export default { rules: { ... } }` 格式

**理由**：
- `eslint.config.js` 使用 ESM 语法
- ESLint 9.x 的 flat config 要求插件以 `rules` 对象包装
- 最小改动原则，仅修改导出格式

---

## 五、质量指标快照

| 指标 | 变更前 | 变更后 |
|------|--------|--------|
| 未注册文件数 | 31 | 0 |
| 未注册页面数 | 0 | 0 |
| tsc --noEmit 错误 | 2（dataLayer.test.ts 历史遗留） | 0 |
| audit:layers 违规 | 0 | 0 |
| audit:deadcode 告警 | 0 | 0 |
| npm run build | 通过 | 通过（1m 29s） |
| 单元测试通过率 | 99.4%（历史遗留 4 失败） | 99.4%（不变） |
| ESLint 错误 | 配置崩溃（无法运行） | 15 个（全部历史遗留） |
| 注册表覆盖 | 仅 Widget（14 个） | 四层全覆盖（Widget 19 + Store 29 + Service 52 + Component 10） |
| audit:docs 未文档化 | — | 0（452 文件全部引用） |
| 文档更新数 | — | 7 篇文档更新 + 2 篇新建 |

---

## 六、后续待办

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P1 | 9 个 available Store 的 UI 集成 | 需对应页面开发时接入 |
| P1 | Vitest Windows 兼容性修复 | 配置 `pool: 'forks'` 解决 ENOENT |
| P2 | 15 个 ESLint 历史错误修复 | no-base-to-string、restrict-template-expressions 等 |
| P2 | audit:registry 审计脚本 | 检查注册表完整性（未来扩展） |
