---
name: "v9-constant-migration"
description: "迁移跨层重复常量（如股票池 RESEARCH_STATUS / DEFAULT_POOL_GROUP），将业务常量归位到 src/constants/，消除 config 层与 constants 层的重复定义，并批量修复导入路径、测试 mock 与文档注释。Invoke when user asks to migrate constants between layers, eliminate duplicate constant definitions, move business constants from src/config to src/constants, or clean up stockpool constant duplication."
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# 跨层常量迁移与重复定义清理 — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-13 | **校验基准**: V9 v2.0.0
> **任务性质**: 代码重构，只允许修改导入路径与重复定义，禁止修改业务逻辑
> **输出格式**: 变更清单 + 验证结果 + 反模式教训

---

## 一、触发条件（Invoke When）

- 用户要求清理跨层重复常量定义
- 用户要求将 `src/config/` 中的业务常量迁移到 `src/constants/`
- 用户提到 "RESEARCH_STATUS 重复定义"、"DEFAULT_POOL_GROUP 重复"、"双层存储不一致"
- 发现同一常量在 `src/config/dbConfig.ts` 与 `src/constants/*.ts` 同时存在

---

## 二、执行前检查清单

1. **定位重复定义源**: 确认常量当前在哪些文件定义（如 `src/config/dbConfig.ts` 与 `src/constants/stockpool.constants.ts`）。
2. **确定权威位置**: 按 AGENTS.md 分层规则，业务常量应放入 `src/constants/`，`src/config/` 只保留配置/枚举（如 `DB_VERSION`、`ENVELOPE_ACTION`、`STORE_NAME`）。
3. **扫描所有导入点**: 使用 Grep 找出所有从旧路径导入的文件（包括 `import type` 与 `vi.mock`）。
4. **检查测试 mock**: 特别检查 `*.test.ts` 中的 `vi.mock('@/config/dbConfig', ...)`，被迁移常量必须在新模块 mock。
5. **检查文档注释**: 搜索包含旧路径名的注释（如 "与 dbConfig ResearchStatus 保持一致"）并同步更新。

---

## 三、迁移 SOP

### 步骤 1：保留单一真相源

- 在 `src/constants/` 的对应文件中确保常量已正确定义。
- 从 `src/config/dbConfig.ts` 删除重复定义。
- 若 `src/config/dbConfig.ts` 的测试用例依赖被删除的常量，改为从 `src/constants/` 导入。

### 步骤 2：批量迁移导入路径

优先使用脚本，但**必须采用防跨越正则**:

```js
// ✅ 正确：import body 不能包含大括号，防止跨越无关 import
const importRegex = /import\s+(type\s+)?\{[^{}]*\}\s+from\s+['"]@\/config\/dbConfig['"]\s*;?\r?\n?/gs

// ❌ 错误：\[\s\S\]*? 会从第一个 { 跨越到目标 from，误删其它 import
const badRegex = /import\s+(type\s+)?\{[\s\S]*?\}\s+from\s+['"]@\/config\/dbConfig['"]/g
```

脚本完成后，必须人工抽查 3~5 个文件的 import 区域，确认没有发生行拼接或符号丢失。

### 步骤 3：修复测试 mock

对于 `*.test.ts` 中的 `vi.mock('@/config/dbConfig', ...)`:

- 将被迁移常量从该 mock 中移除。
- 新增 `vi.mock('@/constants/stockpool.constants', () => ({ ... }))`。
- 若测试硬编码了 mock 值（如 `DEFAULT_POOL_GROUP: 'default'`），保持 mock 值不变，避免破坏测试断言。

### 步骤 4：同步文档注释

搜索并替换以下旧表述:

- `与 dbConfig ResearchStatus 保持一致` → `与 stockpool.constants ResearchStatus 保持一致`
- `DEFAULT_POOL_GROUP（见 dbConfig）` → `DEFAULT_POOL_GROUP（见 stockpool.constants）`

### 步骤 5：运行四级验证

| 级别 | 命令 | 通过标准 |
|------|------|---------|
| L1 类型 | `./node_modules/.bin/tsc --noEmit` | 0 errors |
| L2 架构 | `npm.cmd run audit:layers` | 0 violations |
| L3 单元 | `./node_modules/.bin/vitest run <相关测试文件>` | 全部通过 |
| L4 构建 | `npm.cmd run build` | 成功且无新增错误 |

---

## 四、常见反模式与教训

### 教训 1：迁移脚本必须使用防跨越正则

**现象**: 使用 `[\s\S]*?` 的正则会从文件中的第一个 `{` 开始匹配，直到遇到目标 `from '@/config/dbConfig'`，导致中间无关的 import 被吞并或拼接到一行。

**后果**: `import { create } from 'zustand'` 等合法 import 被错误改写，TypeScript 编译失败。

**对策**: 使用 `[^{}]*` 限制 import body，并吞掉尾部换行符，避免多个替换结果拼接在同一行。

### 教训 2：测试 mock 必须同步迁移

**现象**: 只修改了生产代码的 import，未修改 `vi.mock('@/config/dbConfig', ...)`。

**后果**: 测试运行时仍从旧 mock 取值，而被测模块已从 `src/constants/` 导入，导致默认值与测试断言不一致（如 `DEFAULT_POOL_GROUP` 为 `'默认分组'` 但测试期望 `'default'`）。

**对策**: 在迁移脚本中单独处理 `vi.mock` 语句，或全局搜索 `vi.mock` 中是否出现目标常量名。

### 教训 3：config 层不应承载业务常量

**现象**: `RESEARCH_STATUS`、`DEFAULT_POOL_GROUP` 等业务语义常量放在 `src/config/dbConfig.ts`。

**后果**: 违反 AGENTS.md 分层规则，导致 services/components 不得不依赖 config 层获取业务常量，形成跨层调用风险。

**对策**: 业务语义常量统一归位到 `src/constants/`；`src/config/` 仅保留基础设施配置（DB、路由、信封目标/动作等）。

### 教训 4：文档注释是隐藏的耦合点

**现象**: 代码中的 JSDoc/行注释仍引用 `dbConfig` 作为类型来源。

**后果**: 新开发者按注释查找来源时产生困惑，维护成本增加。

**对策**: 迁移后全局搜索旧路径名/模块名在注释中的出现，并同步更新。

---

## 五、变更后审查清单

- [ ] `src/config/dbConfig.ts` 不再包含已迁移的业务常量
- [ ] 所有生产代码从 `src/constants/` 导入目标常量
- [ ] 所有 `vi.mock` 已同步到新模块
- [ ] 相关测试文件通过
- [ ] `tsc --noEmit` 0 错误
- [ ] `audit:layers` 0 violations
- [ ] `npm run build` 成功
- [ ] 文档注释已同步更新

---

## 六、相关参考

- `AGENTS.md` §一（项目分层规则）
- `src/constants/stockpool.constants.ts`
- `docs/03-development/unified-pool-storage-spec.md`
