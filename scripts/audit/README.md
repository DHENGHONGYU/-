# scripts/audit/ — 审计脚本分类

## 概述

本目录包含所有审计类脚本，用于对代码质量、架构规范、文档完整性等进行自动化检测。

## 分类说明

### 架构审计
- `audit-layer-calls.ts` — 跨层调用检测
- `audit-mapping-integrity.ts` — 路由/Store/组件映射完整性
- `audit-execution-paths.ts` — 执行路径审计
- `audit-split-quality.ts` — 代码拆分质量审计
- `audit-reserved-stores.ts` — 保留 Store 名称审计

### 代码质量审计
- `audit-hardcode.ts` — 硬编码值扫描
- `audit-dead-code.ts` — 死代码检测
- `audit-atomic.ts` — 组件/Store 原子规范
- `audit-component-usage.ts` — 组件使用审计
- `audit-dependencies.ts` — 依赖审计
- `audit-quality-enhanced.ts` — 增强型静态分析（潜在缺陷/代码异味/安全漏洞/性能隐患，基于 AST 上下文感知，支持整项目扫描）

### audit-quality-enhanced v1.4 能力矩阵
基于 TypeScript 编译器 API 的 AST 上下文感知检测，复用 `_audit-pipeline` 管道（stdout JSON / stderr 报告 / 持久化 `docs/reports/audit/`）。规则分六类（潜在缺陷 / 代码异味 / 安全漏洞 / 性能隐患 / 架构健康 / 规范），共 41 条。

**v1.4 迭代要点（六类检测规则扩展）**：为六大类别各新增 AST 检测规则，覆盖此前空白的「规范」类，并补强潜在缺陷/安全/性能/架构：
- **潜在缺陷 +2**：`defect:unreachable-code`（return/throw 后的死代码）、`defect:switch-fallthrough`（case 未以 break/return 结束的穿透）。
- **代码异味 +3**：`smell:nested-ternary`（嵌套三元，解包括号误报）、`smell:boolean-param`（≥3 个布尔位置参数）、`smell:todo-fixme`（注释中的 TODO/FIXME/XXX/HACK）。
- **安全漏洞 +2**：`sec:open-redirect`（location.href/replace/assign 接收非字面量，开放重定向）、`sec:regex-injection`（new RegExp(非字面量)，ReDoS）。
- **性能隐患 +2**：`perf:array-method-chain`（.filter().map() 等链式产生中间数组）、`perf:string-concat-in-loop`（循环内 += 拼接字符串，O(n²)，基于字符串累加器作用域降低误报）。
- **架构健康 +2**：`arch:deep-import`（上溯 ≥3 层或 internal 路径导入，破坏封装）、`arch:god-module`（导出 >25 符号或 >800 行的上帝模块；阈值可配）。
- **规范（新类）+2**：`norm:interface-prefix`（接口 I 前缀，不符 TS 惯用命名）、`norm:var-keyword`（使用 var 声明）。

**v1.3 迭代要点（基于二次审查 S1–S8 建议）**
- **S1 可维护性**：`walk()` 拆分为 `checkLooseEquality/checkExplicitAny/checkCallExpression/checkNewFunction/checkXss/checkSwitchNoDefault/checkSecretNode/checkNestedLoops/checkDeepNesting/checkLongFn` 等独立 `checkX` 函数，圈复杂度显著下降。
- **S2/S3 参数化与复用**：`scan()` 改为 `scan(options?)` 参数驱动（移除 `TARGET` 全局）；单文件与跨文件分析复用同一 `ParsedFile`（建树一次）。
- **S4 精确定位**：`arch:unused-export` / `arch:circular-dep` 的发现定位到具体导出/导入声明节点的行/列（不再一律第 1 行）。
- **S5 建模增强**：默认导出 `export default` 与默认导入 `import Foo from` 以 `'default'` 哨兵配对，降低漏报；barrel 再导出（`export { X } from`）纳入依赖边，避免误报孤儿。
- **S6 性能与覆盖**：`findCycles` 改为显式栈迭代 DFS（去除了原 1500 节点上限），可覆盖整项目级依赖图而不爆栈。
- **S7 文档化**：`scan/formatReport/main/makeFinding/add/walk/analyzeUnused/analyzeCrossFile/findCycles/runAggregate` 等补充 JSDoc。
- **S8 噪音收敛**：配置新增 `arch.allowUnusedExportsPrefixes`（默认 `src/types`、`src/constants`），匹配前缀不报 `arch:unused-export`。

**跨文件精度关键修复（v1.3）**：`resolveImport` 新增对 `@/` 路径别名（`tsconfig` `paths` `@/* → src/*`）的解析；此前仅解析相对导入，导致别名导入的引用边丢失、海量 `arch:unused-export` 与 `arch:orphan-module` 误报。修复后循环依赖可被真实检出。

| 类别 | ruleId | 严重度 | 说明 |
|------|--------|--------|------|
| 潜在缺陷 | `defect:loose-equality` `defect:empty-catch` `defect:assign-in-cond` `defect:switch-no-default` `defect:parseint-no-radix` `defect:unreachable-code` `defect:switch-fallthrough` | Major/Warning | 宽松相等 / 吞异常 / 条件赋值 / 缺default / parseInt / 不可达代码 / switch 穿透 |
| 代码异味 | `smell:explicit-any` `smell:debug-log` `smell:long-fn` `smell:deep-nesting` `smell:commented-code` `smell:unused-import` `smell:unused-var` `smell:unused-fn` `smell:hooks-missing-deps` `smell:nested-ternary` `smell:boolean-param` `smell:todo-fixme` | Warning | 显式any / 调试日志 / 长函数 / 深嵌套 / 注释代码 / 未用导入·变量·函数 / Hooks 依赖遗漏 / 嵌套三元 / 布尔参数过多 / 待办标记 |
| 安全漏洞 | `sec:hardcoded-secret` `sec:eval` `sec:new-function` `sec:inner-html` `sec:dangerous-html` `sec:command-injection` `sec:sql-injection` `sec:open-redirect` `sec:regex-injection` | Critical | 硬编码凭证 / eval / new Function / XSS / 命令注入 / SQL 注入 / 开放重定向 / 正则注入(ReDoS) |
| 性能隐患 | `perf:sync-in-loop` `perf:json-in-loop` `perf:await-in-loop` `perf:nested-loops` `perf:array-method-chain` `perf:string-concat-in-loop` | Major/Warning | 同步IO / JSON / await / 嵌套循环 / 数组链式中间分配 / 循环内字符串拼接 |
| 架构健康 | `arch:circular-dep` `arch:unused-export` `arch:orphan-module` `arch:deep-import` `arch:god-module` | Warning/Minor | 循环依赖 / 未用导出 / 孤儿模块 / 深层导入 / 上帝模块（需 `--cross-file`） |
| 规范 | `norm:interface-prefix` `norm:var-keyword` | Minor/Warning | 接口 I 前缀 / 使用 var 声明 |

**命令与选项**
```bash
npm run audit:quality                         # 整项目扫描（默认 src）
npm run audit:quality -- --root src/core     # 指定子目录
npm run audit:quality -- --format sarif       # 输出 SARIF 2.1.0（接入 CI 安全门禁）
npm run audit:quality -- --cross-file         # 跨文件架构健康分析（循环依赖/未用导出/孤儿模块）
npm run audit:quality -- --baseline save      # 保存当前违规指纹为基线
npm run audit:quality -- --baseline check     # 仅阻断"新增违规"，存量渐进收敛
npm run audit:quality -- --aggregate          # 聚合 docs/reports/audit/*.json → health-dashboard.json
npm run audit:quality -- --config my.json     # 指定规则配置
```
**规则配置**：`scripts/audit-quality.config.json`（规则开关 `rules` / 阈值 `thresholds`：`fnLenWarn`、`fnLenMajor`、`maxNesting`、`godModuleExports`、`godModuleLines`、`deepImportUpLevels` / 按目录 `directories` 覆盖 / `arch.allowUnusedExportsPrefixes` 跨文件未用导出白名单前缀）。

> **噪音说明（cross-file）**：`arch:unused-export` 仍可能偏高——它仅统计"项目内 import 引用"，不覆盖测试文件、动态/字符串导入、以及仅被非扫描目录消费的导出；可用 `arch.allowUnusedExportsPrefixes` 按业务前缀收敛。`arch:circular-dep` 与 `arch:orphan-module` 为更具行动价值的信号。

**退出码**：0=无阻断性违规（或基线无新增）；1=有阻断性违规（Major/Critical 或基线新增阻断）；2=执行错误。Warning 类不阻断。

### 文档审计
- `audit-doc-sync.ts` — 文档同步状态审计
- `audit-doc-integrity.ts` — 文档完整性审计
- `audit-version-drift.ts` — 版本漂移检测
- `diagnose-docs.ts` — 文档诊断
- `directory-audit.ts` — 目录结构审计

### UI/视觉审计
- `audit-typography.ts` — 排版规范审计
- `audit-inline-colors.ts` — 内联颜色审计
- `audit-color-tokens.ts` — 颜色令牌合规审计
- `audit-spacing.ts` — 间距规范审计
- `audit-visual.ts` — 视觉回归审计

### 测试与质量审计
- `audit-tests.ts` — 测试质量审计
- `audit-trend-monitor.ts` — 趋势监控审计
- `audit-jsdoc.ts` — JSDoc 覆盖审计

### 安全与 MCP 审计
- `audit-mcp.ts` — MCP 安全性审计
- `audit-mcp-tool-usage.ts` — MCP 工具使用审计

### 评估工具
- `assess-file-system.ts` — 文件系统全面评估

## 使用方式

```bash
# 运行单个审计
tsx scripts/audit/audit-layer-calls.ts

# 通过 npm 脚本运行（推荐）
npm run audit:layers
```

## 注意事项

> ⚠️ **重要**: 本目录中的脚本为逻辑分类，实际执行脚本位于 `scripts/` 根目录。根目录脚本包含内部相对路径引用（如 `../src/config/routes.ts`、`./_debug/_audit-pipeline`），移动脚本会导致路径失效。

如需新增审计脚本，请在 `scripts/` 根目录创建文件，并在此 README 中添加条目。
