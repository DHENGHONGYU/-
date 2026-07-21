---
title: file-management-guide-cleanup-decisions
code_version: 2.0.0
tier: core
status: archived
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
---

# FILE-MANAGEMENT-GUIDE 代码清理决策报告

> **Date**: 2026-07-20  
> **依据评估**: `docs/00-meta/src-directories-evaluation-report.md`、`docs/00-meta/outputs-and-undefined-src-evaluation-report.md`、toolkit/ 现场评估  
> **处理原则**: 不轻易删除任何文件；仅对完全符合条件者执行删除；存在疑虑者先评估后决策

---

## 一、已执行操作（确认安全）

### 1.1 删除 `toolkit/safeCoerce.ts`

| 项目 | 内容 |
|------|------|
| **决策** | ✅ **删除** |
| **依据** | 1. `diff toolkit/safeCoerce.ts src/lib/safeCoerce.ts` 输出为空 → **逐行完全相同**<br>2. 全局搜索 `toolkit/safeCoerce` 无匹配 → **无任何引用**<br>3. `../README.md` 第39行明确说明"将 safeCoerce.ts 复制到项目的 src/lib/ 目录" → 该文件为**模板副本**，非生产代码<br>4. `src/lib/safeCoerce.ts` 为 AGENTS.md 白名单定义的唯一真相源 |
| **风险等级** | **零风险** |
| **执行状态** | ✅ 已完成（2026-07-20） |
| **验证** | `ls toolkit/` 确认 safeCoerce.ts 已不存在 |

### 1.2 `.gitignore` 补充 `/outputs/`

| 项目 | 内容 |
|------|------|
| **决策** | ✅ **添加忽略规则** |
| **依据** | 1. `outputs/` 目录含 **596 个文件**（303 JSON + 289 MD + 其他），全部为工作产物/测试输出<br>2. 源码层（`src/`）**零引用**<br>3. 文件类型分布确认：自动化测试产物、治理报告、性能测试输出，非生产代码<br>4. 敏感信息扫描：未发现 API Key 或密码 |
| **风险等级** | **零风险**（不修改任何代码，仅新增忽略规则） |
| **执行状态** | ✅ 已完成（2026-07-20） |
| **验证** | `.gitignore` 第48行确认 `/outputs/` 已添加 |

---

## 二、建议执行但需确认的操作

### 2.1 迁移 `src/blueprints/`

| 项目 | 内容 |
|------|------|
| **决策** | 🟡 **迁移至 `tests/blueprints/`**（建议执行，但需确认） |
| **依据** | 1. `src/blueprints/` 仅含 1 个文件：`__tests__/dataRelationship.test.ts`<br>2. 全局搜索零生产代码引用<br>3. `src/blueprints/` 不在 AGENTS.md §一 目录列表中<br>4. 测试文件应统一存放于 `tests/` 目录（符合 file-management-guide.md 文件归位规则） |
| **风险等级** | **低** |
| **执行建议** | 1. `mkdir -p tests/blueprints/`<br>2. `mv src/blueprints/__tests__/dataRelationship.test.ts tests/blueprints/`<br>3. `rmdir src/blueprints/__tests__ src/blueprints`（如为空）<br>4. 检查该测试文件是否有内部引用需要更新（如相对路径） |
| **执行状态** | ⏳ 待执行 |

### 2.2 删除 `../../src/showcase/index.ts` + 迁移测试文件

| 项目 | 内容 |
|------|------|
| **决策** | 🟡 **删除 src/databridge/ 目录**（建议执行，但需更新测试） |
| **依据** | 1. `../../src/services/workers/index.ts` 为 `src/core/databridge.ts` 的薄包装适配器（155行）<br>2. **零生产代码引用**（60+ 文件直接引用 `src/core/databridge` 而非 `src/core/databridge.ts`）<br>3. 仅 `tests/databridgeAdapter.test.ts` 依赖此文件<br>4. AGENTS.md 未定义 `src/core/databridge.ts/` 目录 |
| **风险等级** | **低**（但需修改测试文件） |
| **执行建议** | 1. 将 `DataBridgeAdapter` 类合并至 `src/core/databridge.ts` 末尾，或新建 `src/core/databridgeAdapter.ts`<br>2. 更新 `tests/databridgeAdapter.test.ts` 的导入路径（`@/databridge` → `@/core/databridge` 或 `@/core/databridgeAdapter`）<br>3. 运行 `npm test -- --run` 确认测试通过<br>4. 删除 `src/core/databridge.ts` 空目录 |
| **执行状态** | ⏳ 待执行 |

### 2.3 迁移 `src/lib/` 活跃文件至 `src/lib/`

| 项目 | 内容 |
|------|------|
| **决策** | 🟡 **分步迁移**（建议执行，但影响 17 个 import 路径） |
| **依据** | 1. `src/lib/` 不在 AGENTS.md §一 目录列表中，AGENTS.md 白名单已定义 `utils` 属于 `lib/` 层<br>2. `src/lib/utils.ts`（单文件，58+ 引用）与 `src/lib/`（目录，5 文件，~17 引用）并存，命名冲突<br>3. 活跃文件：dataValidation.ts (~11引用)、xssSanitizer.ts (2引用)、precision.ts (4引用) |
| **风险等级** | **中**（需修改约 17 个文件的 import 路径） |
| **执行建议** | **方案 A（推荐）：逐个迁移，按功能重命名**<br>1. `src/lib/validation.ts` → `src/lib/validation.ts`<br>2. `src/lib/xssSanitizer.ts` → `src/lib/xssSanitizer.ts`<br>3. `src/lib/precision.ts` → `src/lib/format.ts`<br>4. 全局替换 `from '@/utils/...'` → `from '@/lib/...'`<br>5. 同步迁移对应测试文件<br>6. 运行 `npx tsc --noEmit` + `npm test -- --run` 验证 |
| **执行状态** | ⏳ 待执行 |

### 2.4 确认并处理 `src/lib/validation.ts` 和 `src/lib/format.ts`

| 项目 | 内容 |
|------|------|
| **决策** | 🟡 **需进一步确认**（疑似死代码，但文件完整） |
| **依据** | 1. `a11y.ts`（185行）和 `timeUtils.ts`（113行）**零引用**（全局搜索 `@/utils/a11y` 和 `@/utils/timeUtils` 无匹配）<br>2. 文件内容完整、JSDoc 齐全，可能是预留模块<br>3. 搜索函数名（`generateId`、`formatTime` 等）发现 18/12 个文件使用类似函数名，但**均非从 `@/utils/a11y` 或 `@/utils/timeUtils` 导入** |
| **风险等级** | **低** |
| **执行建议** | 1. 检查提交历史：`git log -- src/utils/a11y.ts src/utils/timeUtils.ts`<br>2. 如确认为旧遗留（无近期提交）：安全删除或归档至 `docs/00-meta/archive/`<br>3. 如为近期添加的预留模块：保留但标记 `@deprecated` 注释 |
| **执行状态** | ⏳ 待确认后执行 |

---

## 三、建议保留的操作

### 3.1 `toolkit/` 目录其他文件（5 个文件）

| 项目 | 内容 |
|------|------|
| **决策** | ✅ **保留** |
| **依据** | 1. `../README.md` 明确说明："本工具包包含整改过程中使用的补丁脚本和验证命令，可在新项目中直接复用"<br>2. `patch-error-handling-dynamic.ts`：272行补丁脚本，用于新项目修复静默回退模式<br>3. `auto-register-scripts.js`：215行脚本注册工具，用于新项目自动注册 package.json 脚本<br>4. `verify.bat` / `verify.sh`：验证脚本，用于新项目快速验证整改效果<br>5. 这些文件有明确用途，不属于 V9 项目本身的代码，而是**可复用的整改工具包** |
| **风险等级** | **无风险** |
| **备注** | 建议在 file-management-guide.md 中补充 `toolkit/` 的说明："整改工具包（用于新项目复用，非 V9 生产代码）" |

### 3.2 `src/hooks/`、`src/devtools/`、`src/fixtures/`、`src/i18n/`

| 目录 | 文件数 | 引用数 | 决策 | 依据 |
|------|--------|--------|------|------|
| `src/hooks/` | 11 | **26**（22 文件） | ✅ 保留并补充 AGENTS.md 定义 | 深度集成，大量引用 |
| `src/devtools/` | 1 | 0（DEV 注入） | ✅ 保留并补充定义 | 开发调试工具，无害 |
| `src/fixtures/` | 1 | 1 | ✅ 保留并补充定义 | Mock 数据供给 |
| `src/i18n/` | 2 | 0 | ✅ 保留（P2 占位） | 国际化预留，文件少 |

---

## 四、需进一步确认的未定义目录

| 目录 | 文件数 | 状态 | 需确认内容 |
|------|--------|------|-----------|
| `src/schema/` | 6 | ⚠️ 需确认 | 搜索 `zod`/`ajv`/`yup` 在 src/ 中的使用情况 |
| `src/showcase/` | 8 | ⚠️ 需确认 | 搜索 `routes.ts` 是否有 `/showcase` 路由 |
| `src/generated/` | 2 | ⚠️ 需确认 | 确认 `tokens.css` 是否被 `index.css` 引用 |

---

## 五、执行优先级矩阵

| 优先级 | 工作项 | 风险 | 影响文件数 | 预计工时 | 状态 |
|--------|--------|------|-----------|---------|------|
| **P0** | 删除 `toolkit/safeCoerce.ts` | 零 | 0 | 1 min | ✅ 已完成 |
| **P0** | `.gitignore` 补充 `/outputs/` | 零 | 0 | 1 min | ✅ 已完成 |
| **P1** | 迁移 `src/blueprints/` → `tests/` | 低 | 1 | 15 min | ⏳ 待执行 |
| **P1** | 删除 `src/core/databridge.ts` + 更新测试 | 低 | 2 | 30 min | ⏳ 待执行 |
| **P2** | 迁移 `src/lib/` 活跃文件 → `src/lib/` | 中 | ~17 | 2-4 h | ⏳ 待执行 |
| **P2** | 确认并处理 `a11y.ts` + `timeUtils.ts` | 低 | 2 | 15 min | ⏳ 待确认 |
| **P3** | 补充 AGENTS.md 未定义目录定义 | 低 | — | 1 h | ⏳ 待执行 |

---

## 六、验证清单（每次操作后执行）

```powershell
# 1. 类型检查
npx tsc --noEmit

# 2. 架构分层审计
npm run audit:layers

# 3. 单元测试
npm test -- --run

# 4. 死代码检查
npm run audit:deadcode
```

> 任何操作导致上述检查新增违规，立即回滚并重新评估。

---

## 七、决策依据总结

| 决策类型 | 数量 | 说明 |
|---------|------|------|
| ✅ 已执行（零风险） | 2 项 | 完全重复副本删除、.gitignore 补充 |
| 🟡 建议执行（需确认） | 4 项 | 涉及文件移动/import 路径变更 |
| ✅ 建议保留 | 4 项 | 有明确用途，非冗余 |
| ⚠️ 需进一步确认 | 3 项 | 用途不明，需额外调查 |

---

> **报告完成**: 2026-07-20  
> **下次复查建议**: 当 P1/P2 操作执行完成后，重新运行 `npm run audit:deadcode` 和文件流浪扫描，确认无新增问题
