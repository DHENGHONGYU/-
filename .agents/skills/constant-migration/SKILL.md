---
name: "constant-migration"
description: "迁移跨层重复常量（如股票池 RESEARCH_STATUS / DEFAULT_POOL_GROUP），将业务常量归位到 src/constants/，消除 config 层与 constants 层的重复定义，并批量修复导入路径、测试 mock 与文档注释。Invoke when user asks to migrate constants between layers, eliminate duplicate constant definitions, move business constants from src/config to src/constants, audit:layers 报 config 层与 constants 层存在同一业务常量双份定义，或 Grep 硬编码报出 /src/config.*RESEARCH_STATUS/ 这类业务常量泄漏模式。"
version: "v1.0.2"
last_updated: "2026-08-21"
change_log:
  - version: v1.0.2
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥5，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 5 段自定义标题重映射为标准一~五段；§二前置检查表格化（7 项）；§三迁移 SOP 拆 5 个 Phase；§四扩展至 8 条教训（后果+规避双字段）；§五交付物≥10 项+必要且充分条件声明；补 mandatory 字段对齐 registry。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: true
---

# 跨层常量迁移与重复定义清理 — v1.0.2

> **版本**: v1.0.2 | **日期**: 2026-08-21 | **校验基准**: V9 v2.0.0 / AGENTS.md 分层规则
> **任务性质**: 代码重构，只允许修改导入路径与重复定义，禁止修改业务逻辑
> **输出格式**: 变更清单 + 四级验证结果 + 反模式教训 + 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求清理跨层重复常量定义、将 `src/config/` 中的业务常量迁移到 `src/constants/`、消除 stockpool 常量双层存储不一致
- **显式触发 2**：怀疑某枚举/常量在 config 层承载了业务语义、或文档注释/JSDoc 仍引用 dbConfig 作为类型来源，导致维护者困惑；或同一常量在 config 层 + constants 层同时存在，services/components 不得不跨层取
- **脚本/审计触发 3**：`npm run audit:layers` 报出 config 层与 constants 层存在同一业务常量的双份定义；或 `npm run audit:hardcode` / Grep 硬编码扫描报出 `/src/config.*RESEARCH_STATUS/`、`/src/config.*DEFAULT_POOL_GROUP/` 这类业务常量泄漏模式
- **脚本/审计触发 4**：`npm run tsc:prod` 报出同名常量双源歧义、或 vitest 中 `vi.mock` 导入路径错配（从 config 层取到旧值而 constants 层是新值）
- **设计/协议触发 5**：AGENTS.md 分层规则更新、config/constants 边界重申、或新模块评审要求常量归位后，对存量代码做一次性归一；命名契约（枚举值、状态机）版本变更后存量术语同步归位

**不触发场景 · 减少误激活**：
- 纯配置项（如 `DB_VERSION`、`VITE_*`、`ENVELOPE_ACTION`、`STORE_NAME`）在 config 层的合理存在；
- 仅新增一个常量、未涉及跨层重复的单次开发。

**协作 Skill / 链式调用**：
- 审计发现→先跑 `architecture-cleanup`（跨层调用违规识别）做前置扫描；
- 迁移后验证→`v9-code-quality-audit`（分层与依赖方向复核）+ `v9-module-sync-checklist`（十域同步校对）；
- 若伴随 dataLayer 直访问违规→`databridge-migration`。

---

## 二、前置检查

> **铁律: 先扫后改，禁止跳过 Step-1 全局 Grep 与迁移前快照**。未完成下表 1-7 项前，不得对 `src/config/*.ts` / `src/constants/*.ts` 做任何写入性编辑；迁移脚本必须用防跨越正则，禁止用 `[\s\S]*?`。

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 定位重复定义源 | Grep `RESEARCH_STATUS\|DEFAULT_POOL_GROUP\|<target_constant>` 全仓，确认常量在哪些文件同时定义 | 至少列出 2 处文件（config 层 + constants 层） |
| 2 | 确定权威位置 | 读 AGENTS.md §一分层规则 + `src/constants/README`（若存在） | 业务常量权威位置 = `src/constants/`；config 层仅保留基础设施配置（DB、路由、信封动作） |
| 3 | 扫描所有导入点 | Grep `from ['"]@/config/dbConfig['"]`（或目标文件），覆盖 `import` / `import type` / `require` | 列出全部导入文件路径清单（含 `*.test.ts` 与 `*.test-utils.ts`） |
| 4 | 检查测试 mock | Grep `vi.mock\('@/config/dbConfig'` 或 `vi.mock\(` + 目标常量名 | 列出所有被 mock 的常量 key，迁移后必须从旧 mock 移除、迁移到新模块 mock |
| 5 | 检查文档注释 | Grep `dbConfig\|与 dbConfig.*保持一致\|（见 dbConfig）` 在 JSDoc/行注释中出现 | 列出所有需同步替换的注释位置清单 |
| 6 | 迁移前快照 | `git status --short > outputs/constant-mig-before.txt`；备份 `tsc --noEmit` 既有错误 | 有审计前磁盘状态快照 + 历史残差清单，避免归因混淆 |
| 7 | 正则安全确认 | 人工审查迁移脚本正则 body 是否只含 `[^{}]*`（大括号内不允许 `{}`/换行/嵌套），尾部是否吞 `\r?\n?` | 无 `[\s\S]*?`、`.` 不加 DOTALL 等越界贪婪模式 |

---

## 三、阶段化 SOP

按 5 个 Phase 顺序执行，禁止跳过 Phase 4 四级验证：

### **目标**：把「config + constants 双层重复」归零，把「import 拼行 / mock 不同步 / 注释残留」三类回归在提交前拦截。

### Phase 1 · 保留单一真相源

**交付物**: 权威定义确认清单 + 旧定义删除 diff

1. 在 `src/constants/` 的对应文件（如 `stockpool.constants.ts`）中确保目标常量已正确定义（值、注释、类型与旧定义一致）。
2. 从 `src/config/dbConfig.ts`（或旧位置）删除重复定义；若删除后当前文件 TS 报错，改为从 `src/constants/` 导入。
3. 运行一次 `tsc --noEmit`，确认删除本身未引入编译错误（仅报导入缺失，用于后续 Phase 修复）。

### Phase 2 · 批量迁移导入路径

**交付物**: 迁移脚本 + 人工抽查 5 文件报告

```js
// ✅ 正确：import body 不能包含大括号，防止跨越无关 import
const importRegex = /import\s+(type\s+)?\{[^{}]*\}\s+from\s+['"]@\/config\/dbConfig['"]\s*;?\r?\n?/gs

// ❌ 错误：\[\s\S\]*? 会从第一个 { 跨越到目标 from，误删其它 import
const badRegex = /import\s+(type\s+)?\{[\s\S]*?\}\s+from\s+['"]@\/config\/dbConfig['"]/g
```

脚本完成后，**必须人工抽查 3~5 个文件**的 import 区域，确认：
- 未发生跨 import 行拼接；
- 未丢失 `type` 关键字；
- 未把合法第三方 import（如 `zustand`）误改。

### Phase 3 · 修复测试 mock

**交付物**: 迁移前后 mock key 对照表 + 测试初跑结果

对于 `*.test.ts` 中的 `vi.mock('@/config/dbConfig', ...)`：
1. 将被迁移常量从旧 mock 中移除（key 删除或注释保留兼容，按需）。
2. 新增 `vi.mock('@/constants/stockpool.constants', () => ({ ... }))`，值与原 mock 保持一致，避免破坏断言。
3. 对 `vi.mock` 的工厂函数中若存在 `importActual`，同步调整路径。

### Phase 4 · 同步文档注释

**交付物**: 注释替换清单 + Grep 清零验证

全局搜索并替换以下旧表述（按常量实际名称调整）：
- `与 dbConfig ResearchStatus 保持一致` → `与 stockpool.constants ResearchStatus 保持一致`
- `DEFAULT_POOL_GROUP（见 dbConfig）` → `DEFAULT_POOL_GROUP（见 stockpool.constants）`
- JSDoc `@see dbConfig.ts` → `@see src/constants/stockpool.constants.ts`

完成后重新 Grep 一次旧关键字，确认 0 命中（除非有意保留兼容说明）。

### Phase 5 · 四级验证 + 快照

**交付物**: 四级验证全绿报告 + 迁移后快照

| 级别 | 命令 | 通过标准 |
|------|------|---------|
| L1 类型 | `./node_modules/.bin/tsc --noEmit` | 0 errors（历史残差不计入本次） |
| L2 架构 | `npm.cmd run audit:layers` | 0 violations（尤其 config 层常量泄漏清零） |
| L3 单元 | `./node_modules/.bin/vitest run <相关测试文件列表>` | 全部通过；若迁移常量 >3 个，至少跑涉及 mock 的 3+ 测试 |
| L4 构建 | `npm.cmd run build` | 成功且无新增错误日志 |

---

## 四、陷阱与经验教训

| # | 教训 | 后果 | 规避方法 |
|---|------|------|---------|
| 1 | 迁移脚本必须使用防跨越正则 | `import { create } from 'zustand'` 等合法 import 被错误吞并或拼接到一行，TypeScript 编译失败 | import body 限定为 `[^{}]*`，尾部吞 `\r?\n?`；脚本跑后必人工抽查 5 个文件 |
| 2 | 测试 mock 必须同步迁移 | 生产代码从 `src/constants/` 导入但测试仍从旧 mock 取值，默认值与断言不一致（如 `DEFAULT_POOL_GROUP` 期望 `'default'` vs 实际 `'默认分组'`） | 在迁移脚本中单独处理 `vi.mock` 语句；全局 Grep 目标常量名出现在哪些 `vi.mock` 工厂 |
| 3 | config 层不应承载业务常量 | 违反 AGENTS.md 分层，services/components 被迫依赖 config 层取业务常量，形成跨层调用风险；后续 audit:layers 永久亮红灯 | 业务语义常量统一归位 `src/constants/`；config 层仅保留 DB_VERSION / ENVELOPE_ACTION / STORE_NAME 等基础设施项 |
| 4 | 文档注释是隐藏的耦合点 | 新开发者按注释去 dbConfig 找来源时找不到，维护成本指数上升 | 迁移后全局搜索旧路径名/模块名在 JSDoc/行注释中的出现并同步；Grep 清零验证 |
| 5 | 仅改生产代码不改 type 导入 | `import type { ResearchStatus }` 等类型导入残留，导致同一常量在编译后仍被两处引用、bundle 体积隐性增加 | 正则同时匹配 `import\s+(type\s+)?`；用 tsc --noEmit + vite build source-map 比对是否仍引用旧路径 |
| 6 | 同一常量在 3+ 文件重复定义 | 仅处理 config + constants，遗漏 `src/store/*.ts` / `*.test-utils.ts` 中的第三份拷贝，后续 audit:hardcode 仍亮红灯 | Phase 1 必须全仓 Grep 目标常量所有出现，按 定义点 / 导入点 / mock 点 / 注释点 四类分别列出清单，确保全部覆盖 |
| 7 | 迁移后未跑 audit:layers | 跨层调用违规从显式 → 隐性（如 components 仍通过 re-export 链间接依赖 config），靠肉眼无法发现 | Phase 5 L2 必跑 audit:layers，对 config 层常量泄漏模式做定向 FAIL 判定 |
| 8 | 批量替换但不做分批提交 | 一次 commit 混合 50+ 文件改动 + 其它功能代码，review 困难且回滚困难 | 每个常量独立 commit（`git commit --only <paths>`），commit message 用 `refactor(constants): migrate <NAME> from config to constants` |

---

## 五、完成交付物清单

### 5.1 交付物清单（≥10 项 · 完成打勾）

- [x] **1. 重复定义源清单**：config 层 + constants 层至少 2 处，按 Phase 1 输出的文件路径列表
- [x] **2. 权威位置确认记录**：AGENTS.md 分层规则摘录 + `src/constants/` 对应文件路径
- [ ] **3. 全仓导入点清单**：所有从旧路径导入的生产/测试文件路径
- [ ] **4. 测试 mock 对照表**：旧 mock key → 新模块 mock key，迁移前后值保持一致
- [ ] **5. 文档注释替换清单**：JSDoc/行注释中旧路径 → 新路径的替换位置
- [ ] **6. 迁移前磁盘状态快照**：`outputs/constant-mig-before.txt`
- [ ] **7. 迁移脚本文件**（若使用）：带防跨越正则，附人工抽查 5 文件确认记录
- [ ] **8. Phase 1 删除旧定义 diff**：`git diff -- src/config/dbConfig.ts`（或对应文件）
- [ ] **9. L1 类型验证报告**：`tsc --noEmit` 0 errors（含历史残差排除说明）
- [ ] **10. L2 架构验证报告**：`audit:layers` 0 violations，config 层常量泄漏模式清零
- [ ] **11. L3 单元测试报告**：至少 3 个涉及 mock 的测试文件通过
- [ ] **12. L4 构建验证报告**：`npm run build` 成功，无新增错误日志
- [ ] **13. 迁移后快照**：`git status --short > outputs/constant-mig-after.txt`，确认未越权修改无关文件
- [ ] **14. 四端一致性同步**（若 FM/描述有变更）：skill-registry.json / README 导航表 / AGENTS.md 索引同步更新

### 5.2 必要且充分条件

> **当且仅当**以下 4 条**同时成立**，方可声称本次常量迁移完成并允许关闭对应 Issue / PR：
> 1. `src/config/dbConfig.ts`（或旧位置）**不再**包含任一被迁移的业务常量；
> 2. 所有生产代码 + 测试代码 + `vi.mock` + 类型导入 均从 `src/constants/` 权威位置导入（旧路径 Grep 0 命中 定义/导入 点，注释点允许保留 1 条兼容说明）；
> 3. Phase 5 **四级验证全绿**（L1 tsc / L2 audit:layers / L3 相关测试 / L4 build 无 FAIL）；
> 4. 本次提交范围严格限定在目标常量相关文件（通过 `git commit --only <paths>` 强制隔离，不得与其它功能代码混合）。

---

## 六、相关参考

- AGENTS.md §一（项目分层规则）
- `src/constants/stockpool.constants.ts`（权威位置样例）
- `docs/03-development/unified-pool-storage-spec.md`（股票池统一存储规范）
- `npm run audit:layers` / `npm run audit:hardcode`（跨层违规 / 硬编码扫描门禁）
