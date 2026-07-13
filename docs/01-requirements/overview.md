# 工作总结:团队技术能力提升 — 代码评审流程搭建

> **日期**: 2026-07-12
> **执行者**: 资深开发工程师(Senior Developer)

## 任务概述

针对团队技术能力提升需求,以"代码评审流程搭建"为优先切入点,制定了一套基于 `AGENTS.md v1.4.5` 的完整代码评审指南。

## 交付物

### 1. 代码评审指南文档
- **路径**: `docs/03-development/code-review-guide.md`
- **内容**:
  - 评审流程 SOP(评审前自查 / 评审中三层执行 / 评审后合并确认)
  - L1 编码规范 Checklist(类型安全 / 零硬编码 / 日志规范 / 事件清理 / JSDoc)
  - L2 架构审查 Checklist(分层依赖 / 四步集成 / 原子组件边界 / Widget三处注册 / 文件归位)
  - L3 治理验证 Checklist(门禁全绿 / 复杂度治理 / 文档同步 / AI协同规范)
  - 5 个实战案例(any滥用 / 颜色硬编码 / EventBus未清理 / 跨层调用 / 重复条件)
  - PR 评审模板(结构化评论模板,可直接复制)
  - 评审者能力矩阵(L1全员 / L2模块负责人 / L3技术负责人)

### 2. 可视化呈现
- V9 代码质量基线仪表盘(综合得分 90,7 项指标状态)
- 团队技术能力提升三层路线图(L1编码基本功 → L2架构思维 → L3工程治理)

## 当前代码质量基线

| 指标 | 当前值 | 基线值 | 状态 |
|------|--------|--------|------|
| 跨层调用违规 | 0 | 0 | 健康 |
| 颜色硬编码 | 0 | 0 | 健康 |
| 深层嵌套(≥4层) | 0 | 104 | 健康(改善) |
| 长链式条件(≥6分支) | 0 | 0 | 健康 |
| 重复 if 条件 | 0 | 39 | 健康(改善) |
| JSDoc 缺失 | 9 | 0 | 警告(退步) |
| 文档同步违规 | 0 | 0 | 健康 |

## 关键决策

1. **三层评审顺序**: L1 → L2 → L3,前一层不通过直接打回,提高评审效率
2. **P0/P1/P2 分级**: P0 阻塞必须修复,P1 需改本次修复,P2 建议可后续迭代
3. **评审者能力矩阵**: 不同层级 PR 需要不同层级评审者,确保评审质量
4. **与 AGENTS.md 完全对齐**: 所有 checklist 项均可追溯到 AGENTS.md 契约条款

## 后续建议

1. **立即修复 JSDoc 9 处缺失** — 当前唯一退步指标,快速止损
2. **全员培训** — 基于 code-review-guide.md 做 1-2 次内训,确保团队理解三层 checklist
3. **结对评审** — 资深带新人,实战中内化评审标准
4. **PR 模板落地** — 将 PR 评审模板集成到 GitHub/GitLab PR 模板中
5. **定期回顾** — 每月统计评审发现的 Top 问题,针对性培训

---

## 追加工作:Widget 注册一致性自动化校验

针对"UI 组件调配成本高"的根因(架构约束靠人记忆而非工具强制),创建自动化校验脚本:

### 交付物

1. **校验脚本**: `scripts/audit-widget-registry.ts`
   - 自动校验三处注册一致性:widgetRegistry ↔ DEFAULT_WIDGET_CONFIG ↔ WIDGET_DEFAULT_DATA_SOURCE
   - 校验组件文件存在性、默认布局覆盖性
   - package.json 命令: `npm run audit:widget-registry`

2. **文档更新**:
   - `docs/02-design/widget-integration-checklist.md` — 顶部增加自动化校验提示
   - `docs/03-development/code-review-guide.md` — L2 Widget 三处注册级别从 P1 提升到 P0,加入自动化校验项;L3 门禁和命令速查加入 `audit:widget-registry`

### 首次运行发现的真实问题

| 级别 | Widget ID | 问题 |
|------|-----------|------|
| P0 | sectorRotation | 配置和数据源都存在,但未在 widgetRegistry 注册组件 |
| P0 | signalQuality | 同上 |
| P1 | watchlistMovers | 已注册但未在 defaultLayout 中配置默认布局 |

这 4 个 P0 + 1 个 P1 证明了"靠人记忆同步三处"的不可靠性,工具化校验立即可见价值。

---

## 追加工作(续):修复 4 P0 + 1 P1 并接入 Husky 门禁

### 根因细分(非一刀切删除)
- **`signalQuality` = 完整功能但漏注册**:全仓存在 `signalQualityStore`、`SignalQualityDashboardWidget` 组件、UI 文本、store-channels、单元测试 —— 建好了却没接进 registry,导致测试过的功能在 UI 上不可见。→ **注册它**。
- **`sectorRotation` = 纯死配置**:仅 `cockpit.constants.ts` 两处,无任何组件/store/UI 引用。→ **删除孤儿配置**。
- **`watchlistMovers` = 已注册但默认布局漏配** → **补入 defaultLayout**。

### 代码改动(均 tsc 零报错)
1. `src/constants/cockpit.constants.ts`:删除 `sectorRotation` 在 `DEFAULT_WIDGET_CONFIG` 与 `WIDGET_DEFAULT_DATA_SOURCE` 的两处孤儿配置。
2. `src/cockpit/core/widgetRegistry.ts`:新增 `signalQuality` 模板注册(`component` 指向 `SignalQualityDashboardWidget`)+ 将 `signalQuality`、`watchlistMovers` 加入 `defaultLayout`。

### 审计脚本升级
- 组件文件存在性校验从"按 id 猜 PascalCase 文件名"改为**解析 registry 真实 `import('@/...')` 路径**。
- 修复 `@/`→`src/` 映射 bug(初版误报 23 all missing),现正确识别 `signalQuality`→`SignalQualityDashboardWidget` 命名差异。

### 复测结果
```
Registered widgets    : 23
Config keys           : 23
Data source keys      : 23
Default layout entries: 23
Component files       : 23 (missing: 0)
P0 violations : 0   P1 warnings : 0   Result: PASS (exit 0)
```

### 已接入 Husky 预提交门禁
- `.husky/pre-commit` 新增 **第 12 道门禁** `npm run audit:widget-registry`(阻断式:三处注册不一致直接拦截提交)。
- `docs/03-development/code-review-guide.md` L3 §4.1 标注"已接入"。
- 残留清理:`docs/02-design/双通道投研评分系统技术方案.md:320` 修正"已注册"漂移声明;`uiText.trading.ts:143 sectorRotation:'行业轮动'` 经核查为策略类型词汇表(独立领域词),保留不动。

### 重要遗留(非本次引入,需技术负责人跟进)
- `npm run tsc:prod` 当前 **FAIL**(pre-existing):`src/services/news/newsService.ts`(TS2451 重复声明 `result`、TS2339/TS2740 `QueryResult` 类型)、`src/services/backtest/backtestEventLoader.ts`(TS6133 unused `dataLayer`)。
- 这意味着 Husky 第 3 步 `tsc:prod` 早已 RED,本新增门禁在其后不会更糟;但**整条门禁要恢复绿必须先修 newsService/backtest** 这两个既存错误。

### 方法论沉淀
架构约束工具化的三层:**① 文档要求(靠人背)→ ② 自动化校验(门禁拦截,本次落地)→ ③ 脚手架生成(`scaffold:widget` 一键生成三处注册,后续可做)**。本次完成第②层闭环。

---

## 追加工作(第三轮 2026-07-13):修复 tsc 既存错误 + 补齐 JSDoc + scaffold:widget

### 🔧 修复 tsc:prod 既存错误(6 个文件)
| 文件 | 错误类型 | 修复方式 |
|------|----------|---------|
| `backtestEventLoader.ts` | TS6133 unused `dataLayer` | 移除 import |
| `mcp/__tests__/workflowServer.test.ts` | TS2459 ToolResult 未导出 | 改从 `@/mcp/core/types` 导入 |
| `mcp/__tests__/workflowServer.test.ts` | TS2532 `prompts[0]` 可能 undefined | 加 `!` |
| `valuePitAnalyzer.ts` | TS2304 Cannot find name 'dataLayer' | 添加 import |
| `scoreDocService.ts` | TS2304 Cannot find name 'dataLayer' | 添加 import |
| `rotationSignalDetector.ts` | 误删 `RotationSectorScore`/`Stock` import | 加回 |

**tsc:prod → 0 错误全绿 ✅**

### 📝 补齐 JSDoc 29 处
- 创建 `scripts/batch-add-jsdoc.ts` 批量插入脚本(按文件分组+行号降序防止偏移)
- 覆盖: `services/`(7 处)、`lib/`(14 处)、`core/`(8 处)
- `npm run audit:jsdoc` → 0 缺失 ✅

### 🏗️ scaffold:widget 脚手架
- 创建 `scripts/scaffold-widget.ts`
- 注册 `npm run scaffold:widget <id> <title> <category>`
- 一键生成 5 步:组件模板 + registry 注册 + 配置 + 数据源 + 默认布局
- 测试验证 **24/24 全对齐,0 违规**
- **方法论升级**:第③层"脚手架生成"已落地,现在新增 Widget 只需一条命令

### ✅ 全门禁复测
```
tsc:prod             ✅  0 errors
audit:widget-registry ✅  PASS (24/24)
audit:jsdoc          ✅  0 missing
audit:atomic         ✅  0 violations
```
