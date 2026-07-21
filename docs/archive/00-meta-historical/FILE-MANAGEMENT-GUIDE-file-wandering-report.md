---
title: file-management-guide-file-wandering-report
code_version: 2.0.0
tier: core
status: archived
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
---

# 文件流浪检查报告

> **Date**: 2026-07-20
> 检查范围: toolkit/、src/databridge/、src/utils/、outputs/、packages/、python/、plugins/、src/*/ 未定义目录
> 依据文档: [AGENTS.md](../../../../AGENTS.md) v1.4.3（2026-07-10）

## 一、检查结果汇总

| 目录 | 状态 | 判定 | 建议 |
|------|------|------|------|
| `toolkit/` | 流浪 | TypeScript 源码在 `src/` 外，且存在重复文件 | 迁移至 `src/lib/` 或 `scripts/` |
| `src/core/databridge.ts` | 归类存疑 | AGENTS.md §一 未定义，但属于 core 层扩展 | 评估是否合并至 `src/core/databridge/` |
| `src/lib/` | 部分流浪 | 与 `src/lib/utils.ts` 职责重叠 | 合并至 `src/lib/` |
| `outputs/` | 需规范 | 未在 .gitignore 中排除，文件数量膨胀 | 补充 .gitignore 规则或纳入 `temp/` 管理 |
| `packages/` | 需规范 | monorepo 子包，AGENTS.md 未提及 | 补充 monorepo 文件归位规范 |
| `python/` | 需规范 | 多语言项目，Python 源码在 `src/` 外 | 补充多语言项目规范 |
| `plugins/` | 合规（外部） | Kimi 桌面插件，非项目源码 | 无需迁移，可补充说明 |
| `src/apps/` | 归类存疑 | AGENTS.md 提及但未在 §一 目录列表定义 | 明确目录定义或在 AGENTS.md 中补全 |
| `src/blueprints/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义或合并 |
| `src/cockpit/` | 归类存疑 | AGENTS.md 在 components 描述中提及 | 确认是独立目录还是 components 子集 |
| `src/hooks/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义（可能被归为 components 层） |
| `src/i18n/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义（配置层扩展） |
| `src/mcp/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义 |
| `src/schema/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义（数据层扩展） |
| `src/showcase/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义或归档 |
| `src/devtools/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义或归档 |
| `src/fixtures/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义（测试数据层） |
| `src/generated/` | 未定义 | AGENTS.md §一 无此目录 | 补充定义或纳入 .gitignore |

---

## 二、逐项详细检查

### 2.1 `toolkit/`

- **文件列表**:
  - `../README.md`（114行）
  - `toolkit/auto-register-scripts.js`
  - `toolkit/patch-error-handling-dynamic.ts`（272行）
  - `toolkit/safeCoerce.ts`（169行）
  - `toolkit/verify.bat`
  - `toolkit/verify.sh`

- **与 `src/lib/` 对比**:
  `toolkit/safeCoerce.ts` 与 `src/lib/safeCoerce.ts` 是**完全相同的文件**（逐行比对 169 行，内容、注释、导出一字不差）。
  `toolkit/patch-error-handling-dynamic.ts`（第 149 行）在运行时执行 `path.join('src', 'lib', 'safeCoerce.ts')`，说明该脚本本身就是为 `src/lib/` 设计的。

- **重复检查**:
  | 字段 | `toolkit/safeCoerce.ts` | `src/lib/safeCoerce.ts` |
  |------|------------------------|------------------------|
  | 行数 | 169 | 169 |
  | 导出函数 | `toSafeNumber`, `toSafeNumberInRange`, `toSafeOptionalNumber`, `toSafeEnum`, `toSafeBoolean`, `toSafeArray`, `toSafeString` | 相同 |
  | 导出别名 | `getSafeString`, `getSafeNumber`, `getSafeArray` | 相同 |
  | fallback 常量 | 5 项 | 相同 |
  | 文件哈希 | 相同 | 相同 |

- **迁移建议**:
  1. `toolkit/safeCoerce.ts` → **删除**（`src/lib/safeCoerce.ts` 已存在，且为唯一真相源）
  2. `toolkit/patch-error-handling-dynamic.ts` → 迁移至 `scripts/` 目录（其本质是构建/修复脚本）
  3. `toolkit/auto-register-scripts.js` → 迁移至 `scripts/` 目录
  4. `toolkit/verify.sh` / `toolkit/verify.bat` → 迁移至 `scripts/` 目录
  5. `../README.md` → 内容合并至 `docs/03-development/` 的开发工具说明文档

- **风险评估**:
  - 风险等级：**低**
  - 主要风险：`patch-error-handling-dynamic.ts` 第 149 行硬编码了 `src/lib/safeCoerce.ts` 路径，迁移后路径不变，无影响
  - 回滚方案：保留 `toolkit/` 目录的 Git 历史，迁移后 1 周内观察无问题再删除

---

### 2.2 `src/core/databridge.ts`

- **文件列表**:
  - `../../src/showcase/index.ts`（155行）

- **内容分析**:
  该文件导出 `DataBridgeAdapter` 类（第 19 行），是对 `@/core/databridge` 的面向模块封装。
  其 import 依赖：
  - `@/core/databridge`（core 层）
  - `@/core/envelope`（core 层）
  - `@/lib/logger`（lib 层）
  - `@/lib/eventBus`（lib 层）
  - `@/types/modules/databridge.types`（types 层）

- **与 AGENTS.md 定义对比**:
  AGENTS.md §一 定义 src/core/（核心工具与类型守卫：DataBridge/ACL/Envelope/MemoryCache/EventBus），将 DataBridge 明确归为 core 层。
  但 `src/core/databridge.ts` 作为一个独立目录存在，未在 AGENTS.md 目录列表中定义。

- **迁移评估**:
  - 该目录仅 1 个文件，代码量为 155 行
  - 若迁移至 `../../src/services/workers/index.ts`，import 路径从 `@/databridge` 变为 `@/core/databridge`
  - 需要全局搜索并修改所有引用 `from '@/databridge'` 的导入语句

- **风险评估**:
  - 风险等级：**中**
  - 迁移工作量：需要全局搜索 import 引用，预计影响 5~15 个文件
  - 替代方案：保留 `src/core/databridge.ts` 作为 core 层的子目录，在 AGENTS.md 中补充定义 `src/core/databridge.ts`

---

### 2.3 `src/lib/`

- **文件列表**:
  - `src/lib/validation.ts`
  - `src/lib/validation.test.ts`
  - `src/lib/xssSanitizer.ts`
  - `src/lib/xssSanitizer.test.ts`
  - `src/lib/validation.ts`
  - `src/lib/precision.ts`
  - `src/lib/format.ts`

- **与 `src/lib/` 对比**:
  AGENTS.md §一 定义 src/lib/（库函数：logger/format/errors/utils/localStorageManager），并在 lib 基础设施白名单中列出了 `utils`（第 33 行）。
  同时 `src/lib/` 下已存在 `src/lib/utils.ts`（通用工具函数）。
  
  `src/lib/` 下的文件职责：
  | 文件 | 职责 | 是否应归 `src/lib/` |
  |------|------|-------------------|
  | `dataValidation.ts` | 数据验证工具 | 是，属于 lib 基础设施 |
  | `xssSanitizer.ts` | XSS 消毒工具 | 是，属于 lib 基础设施 |
  | `a11y.ts` | 无障碍辅助工具 | 是，属于 lib 基础设施 |
  | `precision.ts` | 精度处理工具 | 是，属于 lib 基础设施 |
  | `timeUtils.ts` | 时间工具函数 | 是，属于 lib 基础设施 |

- **重复检查**:
  `src/lib/utils.ts` 与 `src/lib/` 下的文件无直接代码重复，但职责域高度重叠，存在功能分散风险。

- **迁移建议**:
  1. 将 `src/utils/*.ts` 迁移至 `src/lib/utils/` 子目录（避免与 `src/lib/utils.ts` 冲突）
  2. 或重命名 `src/lib/utils.ts` 为 `src/lib/utils.ts`，然后将 `src/lib/` 整体迁入 `src/lib/`
  3. AGENTS.md 白名单中 `utils` 已明确属于 lib 层，迁移方向明确

- **风险评估**:
  - 风险等级：**中**
  - 迁移工作量：7 个文件 + import 路径修改，预计影响 20~40 个引用点
  - 回滚方案：使用 `git mv` 保留历史记录，修改 import 路径后运行 `npx tsc --noEmit` 验证

---

### 2.4 `outputs/`

- **文件规模**: 超过 100 个文件（Glob 结果被截断），包含子目录 `test-doc-auto-update/`（约 60+ 测试用例子目录）

- **内容分类**:
  | 类别 | 示例文件 |
  |------|---------|
  | 测试报告 | `test-doc-auto-update/t*/doc-auto-update-*.md`, `test-doc-auto-update/t*/doc-auto-update-*.json` |
  | 系统评估 | `./V9-项目健康状态总览.md`, `./V9-项目健康状态总览.md` |
  | 图表输出 | `maturity-radar-2026-07-12.svg` |
  | 工具脚本 | `test-doc-auto-updater.mjs` |
  | 治理报告 | `../archive/文件去重与整理治理方案.md`, `../archive/残留校对更新报告-2026-07-12.md` |
  | 文档输出 | `../archive/改进路线图实施计划.md`, `改进路线图实施计划.docx` |

- **.gitignore 检查**:
  .gitignore 中无专门针对 `outputs/` 的排除规则。仅匹配到注释行：
  - `# Build outputs`（第 4 行）
  - `# Script-generated outputs`（第 110 行）
  但未实际定义 `outputs/` 目录的忽略规则。

- **处理建议**:
  1. 将 `outputs/` 整体加入 .gitignore（或仅排除测试产物子目录）
  2. 重要的治理报告（如 `.md` 终稿）应迁移至 `docs/07-archive/` 或 `docs/00-meta/`
  3. `test-doc-auto-update/` 是典型的临时测试产物，必须加入 .gitignore
  4. `test-doc-auto-updater.mjs` 应迁移至 `scripts/` 目录

- **风险评估**:
  - 风险等级：**高**（.gitignore 未排除，可能导致大量临时文件被意外提交）
  - 优先处理：立即补充 .gitignore 规则

---

### 2.5 `packages/`

- **文件列表**: `packages/audit-utils/` 子包（含 `src/`, `dist/`, `node_modules/`, `package.json`）

- **内容分析**:
  这是一个独立的 npm 子包，用于审计工具逻辑复用。包含：
  - `packages/audit-utils/src/index.ts`
  - `packages/audit-utils/src/parse-output.ts`
  - `packages/audit-utils/src/test-logger.ts`
  - 构建产物 `dist/` 和 `node_modules/`

- **与 AGENTS.md 定义对比**:
  AGENTS.md §一 未定义 `packages/` 目录，项目整体也不是严格的 monorepo 结构（根目录无 `pnpm-workspace.yaml` 或 `lerna.json`）。

- **处理建议**:
  1. 评估是否真正需要 monorepo：若仅为 3 个文件的 audit-utils，建议合并回 `src/lib/audit-utils/`
  2. 若保留 monorepo，需补充：`pnpm-workspace.yaml`、根 `package.json` workspaces 字段、file-management-guide.md monorepo 规范章节
  3. `packages/*/node_modules/` 和 `packages/*/dist/` 必须加入 .gitignore

- **风险评估**:
  - 风险等级：**中**
  - 当前子包规模小（3 个源文件），独立维护成本高

---

### 2.6 `python/`

- **文件列表**:
  - `python/data_service/collect_endpoints.py`
  - `python/data_service/lib/timeout_utils.py`
  - `python/data_service/lib/dynamic_match.py`
  - `python/data_service/lib/cache_utils.py`
  - `python/data_service/lib/__init__.py`
  - `python/data_service/requirements.txt`
  - `python/data_service/__pycache__/`（缓存目录）

- **内容分析**:
  这是一个独立的 Python 数据服务端，包含 5 个 `.py` 文件和依赖配置。

- **与 AGENTS.md 定义对比**:
  AGENTS.md §一 仅定义了 `src/` 下的 TypeScript 项目分层，未涉及多语言项目规范。

- **处理建议**:
  1. `__pycache__/` 必须加入 .gitignore（Python 缓存）
  2. `.venv/` 或 `venv/` 已存在于 .gitignore（经任务 2.1 确认）
  3. 在 file-management-guide.md 中补充"多语言项目规范"小节，明确：
     - `python/` 目录为独立数据服务，不归入 `src/` 分层
     - Python 源码管理遵循独立规范（`requirements.txt`、PEP 8、`.gitignore` 追加）
  4. 考虑后续是否将 Python 服务拆分为独立子仓库

- **风险评估**:
  - 风险等级：**低**
  - Python 目录结构清晰，仅需补充规范和 .gitignore

---

### 2.7 `plugins/`

- **文件列表**: 9 个 Kimi 插件目录（`yuandian_law`, `yahoo_finance`, `world_bank_open_data`, `tianyancha`, `sec_edgar`, `scholar`, `kimi-webbridge`, `imf`, `ifind`）

- **内容分析**:
  这些是 Kimi 桌面客户端的外部插件，每个插件包含 `../../.agents/skills/feature-window-context-doc/SKILL.md`, `scripts/`, `../../README.md`, `kimi.plugin.json`, `bundle.zip`。

- **判定**:
  这些插件属于 Kimi 桌面运行时加载的外部扩展，**不属于 V9 项目源码**。`plugins/` 目录等同于 `.agents/skills/` 的性质——是 AI 助手的技能定义文件。

- **处理建议**:
  1. 无需迁移至 `src/`
  2. 在 file-management-guide.md 中补充说明：`plugins/` 为外部 AI 插件目录，非项目运行时源码
  3. `plugins/*/.bundle.zip` 和 `plugins/*/node_modules/`（若存在）应加入 .gitignore

- **风险评估**:
  - 风险等级：**低**
  - 当前无迁移必要

---

### 2.8 `src/` 下未在 AGENTS.md §一 定义的目录

AGENTS.md §一 明确定义的目录（含路径）:
```
src/config/
src/core/
src/data/
src/lib/
src/services/
src/store/
src/pages/
src/components/
src/portal/
src/constants/
```
另有未带 `src/` 前缀的定义：
```
types/
agents/
```

实际存在的 `src/` 一级子目录（文件除外）:
```
src/agents/
src/apps/
src/blueprints/
src/cockpit/
src/components/
src/config/
src/constants/
src/core/
src/data/
src/databridge/      ← AGENTS.md §一 未定义
src/devtools/
src/fixtures/
src/generated/
src/hooks/
src/i18n/
src/lib/
src/mcp/
src/pages/
src/portal/
src/schema/
src/services/
src/showcase/
src/store/
src/types/
src/utils/           ← AGENTS.md §一 未定义
```

#### 未定义目录逐项说明

| 目录 | 实际用途 | AGENTS.md 提及情况 | 建议 |
|------|---------|-------------------|------|
| `src/core/databridge.ts` | DataBridge 适配层 | 未定义（core 层扩展） | 补充定义或合并至 `src/core/databridge/` |
| `src/lib/` | 工具函数集合 | 白名单提及 `utils`（第 33 行），但目录未定义 | 迁移至 `src/lib/` |
| `src/apps/` | App 分发器（React.lazy 加载页面） | 依赖方向规则中提及 `apps/`（第 35 行），但目录列表未定义 | 补充定义 |
| `src/agents/` | AI Agent 运行时模块 | 定义 `agents/`（无前缀，第 40 行），但实际在 `src/agents/` | 明确路径 |
| `src/blueprints/` | 蓝图/模板 | 未提及 | 补充定义或归档 |
| `src/cockpit/` | 驾驶舱组件 | 在 components 描述中提及 `cockpit/`（第 23 行） | 明确是独立目录还是 components 子集 |
| `src/devtools/` | 开发工具 | 未提及 | 补充定义或归档 |
| `src/fixtures/` | 测试夹具/模拟数据 | 未提及 | 补充定义（测试数据层） |
| `src/generated/` | 生成代码 | 未提及 | 补充定义或纳入 .gitignore |
| `src/hooks/` | React Hooks | 未提及 | 补充定义（可能被归为 components 层） |
| `src/i18n/` | 国际化配置 | 未提及 | 补充定义（配置层扩展） |
| `src/mcp/` | MCP（Model Context Protocol） | 未提及 | 补充定义 |
| `src/schema/` | 数据 Schema | 未提及 | 补充定义（数据层扩展） |
| `src/showcase/` | 展示/示例页面 | 未提及 | 补充定义或归档 |
| `src/types/` | TypeScript 类型定义 | 定义 `types/`（无前缀，第 39 行） | 明确路径 |

---

## 三、优先处理建议

| 优先级 | 目录/任务 | 操作 | 预期工时 | 依赖 |
|--------|----------|------|---------|------|
| **P0** | `outputs/` → .gitignore | 补充 `.gitignore` 规则，排除 `outputs/` 或 `outputs/test-doc-auto-update/` | 15 min | 无 |
| **P0** | `toolkit/safeCoerce.ts` | 删除（与 `src/lib/safeCoerce.ts` 重复） | 5 min | 无 |
| **P1** | `src/lib/` → `src/lib/` | 合并目录，修改全局 import 路径 | 2~4 h | 需先明确命名方案 |
| **P1** | `toolkit/` 其余文件 | 迁移 `patch-error-handling-dynamic.ts`、`auto-register-scripts.js`、`verify.*` 至 `scripts/` | 1 h | 无 |
| **P1** | `packages/audit-utils/` | 评估是否合并回 `src/lib/audit-utils/` | 1~2 h | 无 |
| **P2** | `src/core/databridge.ts` | 评估合并至 `src/core/databridge/` 或在 AGENTS.md 中补充定义 | 1~2 h | 需评估 import 影响面 |
| **P2** | AGENTS.md 目录定义补全 | 在 §一 补充 `src/apps/`、`src/hooks/`、`src/i18n/` 等缺失目录 | 1 h | 需架构确认 |
| **P2** | `python/` → 规范 | 补充多语言项目规范、追加 `__pycache__/` 至 .gitignore | 30 min | 无 |
| **P3** | `src/blueprints/`、`src/devtools/`、`src/showcase/` | 评估是否废弃或补充定义 | 1 h | 需业务确认 |
| **P3** | `plugins/` | 在 file-management-guide.md 中补充外部插件目录说明 | 15 min | 无 |

---

## 四、后续行动检查清单

- [ ] P0: 修改 `.gitignore`，排除 `outputs/`、`__pycache__/`、`packages/*/dist/`、`packages/*/node_modules/`
- [ ] P0: 删除 `toolkit/safeCoerce.ts`（确认 `src/lib/safeCoerce.ts` 存在且内容一致）
- [ ] P1: 制定 `src/lib/` → `src/lib/` 的迁移方案（命名冲突解决策略）
- [ ] P1: 迁移 `toolkit/` 非重复文件至 `scripts/`
- [ ] P1: 评估 `packages/audit-utils/` 的去留
- [ ] P2: 在 AGENTS.md §一 补充缺失目录定义（需架构评审）
- [ ] P2: 在 file-management-guide.md 中补充 monorepo/多语言/外部插件目录规范
- [ ] P3: 清理 `outputs/` 中过期的临时测试产物

---

## 五、引用与依据

| 文档 | 路径 | 引用内容 |
|------|------|---------|
| AGENTS.md | `../../../../AGENTS.md` | §一 项目分层规则（第 13~47 行） |
| AGENTS.md | `../../../../AGENTS.md` | lib 基础设施白名单（第 33 行） |
| safeCoerce.ts | `../../src/lib/safeCoerce.ts` | 169 行，与 `toolkit/safeCoerce.ts` 逐行一致 |
| patch-error-handling-dynamic.ts | `../../toolkit/patch-error-handling-dynamic.ts` | 第 149 行硬编码 `src/lib/safeCoerce.ts` 路径 |
| DataBridgeAdapter | `../../src/databridge/index.ts` | 第 19 行 `class DataBridgeAdapter` |
