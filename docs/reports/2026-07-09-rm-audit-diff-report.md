# RM整改方案 — 全量审计差异清单

> 生成时间：2026-07-09 10:03 | 审计基准：文档 v.s. 代码实跑状态
> 分支：`refactor/pr-6-module-split` | 最新提交：`22a7115`

---

## 审计方法

对 `RM剩余任务全量盘点与整改方案_2026-07-08.md` 中所有 P0-P3 任务逐条执行：
- **方向A**：文档声明状态 → 代码实跑验证（tsc/audit/vitest/git log）
- **方向B**：代码仓库实际变更 → 回查文档是否已登记
- **方向C**：门禁脚本实际输出 → 核对文档中记录的退出码

---

## 差异清单（按P0→P3排序）

| 任务编号 | 任务描述 | 文档记录状态 | 实际检索状态 | 差异类型 | 备注 |
|:---------|:---------|:-----------|:-----------|:-------|:-----|
| **P0-1** | tsc:prod 2处类型错误修复 | ❌ 未修复（正文§一） / ✅ exit 0（§★ 摘要） | ✅ exit 0 — tsc 无错误 | **文档不同步** | 正文与摘要矛盾。agentRuntime.ts + v6ScoreService.ts 已修复（`0533006`） |
| **P0-2** | audit:hardcode 退出码逻辑回归 | ✅ PASS（§★ 摘要） | ❌ exit 1 — 5处Fatal硬编码 | **实际未完成** | 摘要标记已完成但门禁仍失败。根因已变：原59条Warning假阳性已修复，新5条Fatal来自并行会话config层硬编码股票代码 |
| **P0-3** | lint:colors脚本单引号bug | ✅ PASS（§★ 摘要） | ✅ exit 0 — 双引号已转义，脚本可执行 | ✅ 一致 | `package.json:13` 已修正，lint:colors正常执行 |
| **P0-4** | audit:tokens脚本接线 | ✅ PASS（§★ 摘要） | ✅ 已注册 — audit链包含audit:tokens | ✅ 一致 | 脚本可执行（812文件扫描，37违规非阻塞） |
| **P1-1** | 本会话hardcode修复提交 | ⏳ 已改未提交（正文）/ ✅（§★） | ✅ 已提交 `68c7ca3` | **文档不同步** | uiPlaceholders.ts + SectorRotationHeatmap + audit-hardcode.ts 均已提交 |
| **P1-2** | reserved-stores analysisStore处置 | ✅ PASS（§★ 摘要） | ⚠️ 部分完成 | **范围变化** | analysisStore的@reserved已移除✅，但reserved-stores审计现报4处新违规(chatStore/marketDataStore等) — 非原P1-2范围 |
| **P1-3** | docs/templates/ 缺失 | ✅ PASS（§★ 摘要） | ✅ 2文件存在 | ✅ 一致 | task-graph-template.md + regression-suite.md 均已创建 |
| **P1-4** | 审计报告JSON归集 | ✅ PASS（§★ 摘要） | ✅ .gitignore已添加规则 | ✅ 一致 | `docs/reports/audit/*.json` 不再跟踪 |
| **P2-1** | 数据采集A组(批量导入4任务) | ✅ 已完成 `b35598d` | ✅ 4文件存在 + 8/8测试 | ✅ 一致 | A-1~A-4全部实现，Button交互已在`22a7115`对标标准APP重设计 |
| **P2-2** | 数据采集B组(真实采集4任务) | ✅ 已完成 `b35598d` | ✅ 3文件存在 + 7/7测试 | ✅ 一致 | directDataAPI + dataSourceOrchestrator + qualityMetricsCollector |
| **P2-3** | 并行会话DataBridge整改 | ✅ 已完成 `cf2d060` | ✅ 28文件已提交 | ✅ 一致 | BulkEnvelope/QueryEnvelope/rbac/MCP ACL/Migration UI |
| **P2-4** | 并行会话集成测试 | ✅ 已完成 `13d7d18` | ✅ 5套集成测试文件存在 | ✅ 一致 | mcp-servers/stockpool-acl/mcp-acl-scenarios/llmEnhancer/walkthroughScoreDoc |
| **P3-1** | C组UI/UX优化(C-1~C-4) | ✅ 已完成 `0533006` | ✅ 5文件2059行 | ✅ 一致 | C1~C4全部合规，6处硬编码已修复 |
| **P3-2** | E/F/G/H规格任务(10任务) | ✅ 已完成 `2117de3` `9c0c834` | ✅ 15/15测试 + G-3已创建 | ✅ 一致 | F1~F3已有实现，G1~G2已映射，H1~H2已集成 |
| **P3-3** | git提交者身份规范化 | ✅ 已完成 | ✅ V9 Dev <dev@v9.local> | ✅ 一致 | 已配置 |

---

## 重点差异详解（P0/P1）

### 差异-01：P0-1 文档正文与摘要矛盾

| 字段 | 值 |
|:-----|:-----|
| **文档正文位置** | §一 P0表格第1行 |
| **文档记录状态** | `❌ 未修复` |
| **文档摘要位置** | §★ 门禁最终状态 |
| **摘要记录状态** | `tsc:prod ✅ exit 0` |
| **实际状态** | tsc exit 0，无任何类型错误 |
| **根因** | 2026-07-09补充工作时更新了摘要表但未同步更新正文P0表格。acl.test.ts + v6ScoreService.ts 已于`0533006`修复 |
| **建议** | 同步更新正文§一 P0-1状态为✅ |

### 差异-02：P0-2 audit:hardcode 假阳性已修复但新Fatal出现

| 字段 | 值 |
|:-----|:-----|
| **文档摘要记录** | `npm run audit ✅ exit 0` |
| **当前实际退出码** | exit 1 |
| **根因变化** | 原问题（59条Warning退出码误判）已在`68c7ca3`修复✅。新问题：并行会话修改的config/files中出现5条Fatal级硬编码股票代码（600519.SH/000858.SZ/300750.SZ/688001.SH等），这些是**数据文件中的示例数据**，非UI层硬编码 |
| **是否本会话可修** | 否 — Fatal违规文件属并行会话修改域（config层），需协调处理 |
| **建议** | 若示例数据为必须，可将Fatal降级为Warning或添加@audit-ignore注释 |

### 差异-03：P1-2 reserved-stores 范围扩展

| 字段 | 值 |
|:-----|:-----|
| **原任务范围** | 仅 analysisStore 的@reserved标记 |
| **原任务状态** | ✅ 已完成 — analysisStore标记已移除 |
| **当前审计结果** | 4处新违规 — chatStore、marketDataStore 等Store的@reserved标记也有已验证引用 |
| **差异性质** | 任务范围扩大 — 原P1-2仅针对analysisStore，但同类问题在多个Store中复现 |
| **建议** | 新增P1-2b任务：批量清理所有过时@reserved标记 |

---

## 遗漏未记录的任务

以下工作在代码中已完成但RM方案文档中未作为独立任务登记：

| 编号 | 描述 | 实际状态 | 关联提交 | 文件 |
|:-----|:-----|:------|:-----|:-----|
| **M-01** | PortalShell 宋韵美学重设计 | ✅ 已完成 | `fe02867` | PortalShell.tsx 390行重写 |
| **M-02** | 信号链路修复（3条死信号→poolStore自动刷新） | ✅ 已完成 | `ddf8497` | batchImportExecutor + v6ScoreService + poolStore |
| **M-03** | GaugeChart 宋韵SVG仪表盘组件 | ✅ 已完成 | `8312154` | GaugeChart.tsx 170行 + index.ts导出 |
| **M-04** | BulkImportPanel 按钮交互对标标准APP重设计 | ✅ 已完成 | `22a7115` | BulkImportPanel.tsx 527行重写 |
| **M-05** | FactorHeatmap 补导出到 chart/index.ts | ✅ 已完成 | `8312154` | chart/index.ts |

---

## 审计结论

| 维度 | 计数 | 说明 |
|:-----|:----:|:-----|
| ✅ 一致（文档=实际） | 10/16 | P0-3/4、P1-3/4、P2-1/2/3/4、P3-1/2/3 |
| ⚠️ 文档不同步 | 3/16 | P0-1（正文/摘要矛盾）、P1-1（正文标记"未提交"）、P0-2（摘要标记"已完成"但实际exit 1） |
| ⚠️ 部分完成/范围变化 | 2/16 | P0-2（根因从Warning变为Fatal）、P1-2（同模式其他Store未覆盖） |
| 📝 遗漏未登记 | 5项 | PortalShell/信号修复/GaugeChart/按钮重设计/FactorHeatmap导出 |
| 🔴 实际未完成 | 1/16 | P0-2 audit:hardcode仍exit 1（新Fatal违规，非本会话范围） |

**总体结论**：RM整改方案的主体工作已全部完成（15/16任务代码实现完毕），但文档存在3处未同步更新和1处过期摘要。建议优先修复P0-2的Fatal违规（需与并行会话协调），同步更新文档正文至最新状态。
