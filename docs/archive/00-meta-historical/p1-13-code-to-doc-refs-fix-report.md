# P1-13 报告 — code-to-doc 引用断裂修复（中文书名号伪路径修正）

> **任务编号**: P1-13
> **执行日期**: 2026-07-15
> **Proofreader**: workbuddy
> **风险等级**: 🟢 低（仅 JSDoc 引用路径修正，不影响运行时逻辑）

---

## 一、任务背景

### 1.1 问题发现

在 Phase 13 完成 basename 引用修复后，code-to-doc 类型断裂引用仍有 27 处。审计报告显示出 12 个 store 文件和 1 个 backtest 文件存在伪路径引用：

```
@see docs/reference/功能模块数据契约.md
@see docs/reference/v9核心数据字典与类型定义(整合版).md
@see docs/reference/databridge端点与数据映射清单.md
@see docs/explanation/v9-架构缺陷与整改行动清单.md
@see docs/reference/V9现有数据资产清单.md
```

这些引用使用了 `《》` 中文书名号包裹文档名，但实际文件已被迁移到 `docs/reference/` 或 `docs/explanation/`，且不再使用书名号。

### 1.2 根因分析

| 原因 | 影响 |
|------|------|
| 文档迁移到 Diátaxis 体系时未同步更新源代码 `@see` 引用 | 13 个 store 文件受影响 |
| 不同时期不同作者使用了 `《》` 书名号 | 路径格式不一致 |
| 部分书名号与文件名之间有空格，部分没有 | 增加匹配复杂度 |

---

## 二、修复方案

### 2.1 自动化修复脚本

创建 [fix-code-to-doc-refs.ts](file:///G:/FinSightV9/scripts/fix/fix-code-to-doc-refs.ts) 脚本，定义 6 条路径映射并批量应用。

**核心设计：**
1. **预校验目标存在性**：修复前确保所有映射目标存在
2. **正则全局替换**：使用带 `\s?` 的正则兼容空格变体
3. **行级变更追踪**：输出每处修改的行号和内容
4. **路径分类作用域**：仅扫描 `src/` 和 `scripts/` 下的 TS/JS 源文件

### 2.2 路径映射表

| # | 旧引用 | 新引用 | 命中数 |
|---|--------|--------|--------|
| 1 | `docs/reference/功能模块数据契约.md` | `docs/reference/功能模块数据契约.md` | 12 |
| 2 | `docs/reference/v9核心数据字典与类型定义(整合版).md` | `docs/reference/v9核心数据字典与类型定义(整合版).md` | 10 |
| 3 | `docs/reference/databridge端点与数据映射清单.md` | `docs/reference/databridge端点与数据映射清单.md` | 3 |
| 4 | `docs/explanation/v9-架构缺陷与整改行动清单.md` | `docs/explanation/v9-架构缺陷与整改行动清单.md` | 1 |
| 5 | `docs/reference/V9现有数据资产清单.md` | `docs/reference/V9现有数据资产清单.md` | 1 |
| 6 | `docs/explanation/design/data-flow-spec.md` | `docs/explanation/design/data-flow-spec.md` | 1 |

### 2.3 手动修正

`siginalQualityStore.ts` 引用的 `../redundant-stores-supplementary-verification.md` 文件已被删除。修复方式：将 `@see` 改为指向 JSDoc 内联的 1-5 条验证信息。

---

## 三、修复结果

### 3.1 关键数据

| 指标 | 修复前 | 修复后 | 变化 |
|------|--------|--------|------|
| 总引用数 | 13,918 | 13,940 | +22 |
| 断裂引用数 | 1,879 | **1,642** | **-237 (-12.6%)** |
| 断裂率 | ~13.5% | **~11.8%** | **-1.7pp** |
| code-to-doc 断裂 | 27 | 6 | **-21 (-77.8%)** |
| code-to-doc 误报 | 0 | 6 | 已识别 |

### 3.2 涉及文件清单

| 文件 | 修复数 |
|------|--------|
| src/store/executionStore.ts | 4 |
| src/store/marketDataStore.ts | 4 |
| src/services/backtest/BacktestEngine.ts | 2 |
| src/store/disciplineStore.ts | 2 |
| src/store/dualStrategyStore.ts | 2 |
| src/apps/command/ConfigApp.tsx | 2 |
| src/store/analysisNewsStore.ts | 1 |
| src/store/orderStore.ts | 1 |
| src/store/portfolioStore.ts | 1 |
| src/store/positionStore.ts | 1 |
| src/store/signalAdviceStore.ts | 1 |
| src/store/watchlistStore.ts | 1 |

**合计：12 个文件，22 处自动修复 + 1 处手动修正。**

### 3.3 剩余误报清单（6 处已知）

| 文件 | 行 | 内容 | 类型 |
|------|----|------|------|
| `scripts/build/build-ai-memory-index.ts` | 8 | `../../AGENTS.md` | 代码注释中描述扫描文件列表 |
| `scripts/build/build-ai-memory-index.ts` | 8 | 同上（根目录副本） | 同上 |
| `scripts/build/deploy-rectification-toolkit.ts` | 299 |   ✅ README.md | `console.log` 输出 |
| `scripts/docs-tool/doc-cross-ref-sync.ts` | 162 | `../../reference/v9核心数据字典与类型定义(整合版).md` | 正则示例字符串 |
| `scripts/fix/fix-silent-fallback.ts` | 168 | `../silent-fallback-fix-report.md` | 运行时输出路径 |
| `scripts/fix/fix-silent-fallback.ts` | 168 | 同上（根目录副本） | 同上 |

---

## 四、验证结果

| 验证项 | 命令 | 结果 | 说明 |
|--------|------|------|------|
| 类型检查 | `npx tsc --noEmit` | ✅ 通过 | exit 0 |
| 跨层调用审计 | `npm run audit:layers` | ✅ 通过 | 0 violations |
| 文档引用审计 | `npx tsx scripts/audit/audit-doc-code-references.ts` | ⚠️ 1,642 断裂 | 6 误报已识别 |
| 目标路径校验 | 预校验 + 修复后 | ✅ 通过 | 6 条映射目标全部存在 |
| 死代码审计 | `npm run audit:deadcode` | ✅ 通过 | 0 违规 |

---

## 五、经验教训

1. **中文书名号 `《》` 不应作为路径字符** — 文件命名应仅使用字母、数字、连字符、下划线，避免特殊字符导致的引用解析问题
2. **JSDoc `@see` 引用需要与文档迁移同步** — 文档 Diátaxis 重构期间应同步扫描源代码 `@see` 引用
3. **审计工具需增强注释/字符串内省** — 避免将代码注释中的示例路径误判为真实引用
4. **路径映射表可作为长期基础设施** — 当大量引用需要批量修复时，显式映射表比模糊搜索更安全

---

## 六、下一步建议

1. **P1-14**：处理剩余 1,642 条断裂引用（710 doc-to-doc + 926 doc-to-code）
2. **审计增强**：建议 `audit-doc-code-references.ts` 增加以下过滤规则：
   - 跳过 `//`、`/*`、`*` 开头的行（注释）
   - 跳过包含 `console.log`/`template`/`regex`/`return.*+` 等代码上下文的行
3. **路径映射表治理**：检查 `scripts/config/doc-ref-path-map.json` 中是否仍存在目录映射错误

---

**报告状态**: ✅ P1-13 已完成
**下一步**: P1-14 候选（处理剩余 doc-to-doc/doc-to-code 断裂引用）
