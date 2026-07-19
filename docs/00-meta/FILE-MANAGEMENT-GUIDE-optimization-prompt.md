---
title: file-management-guide.md 体系优化提示�?
type: meta
domain: ai
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "用�? 嵌入 AI 系统提示词，防止文件管理规范漂移 版本: v1.0.0 依据:..."
tags: [ai, optimization, management]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-AI-030
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# file-management-guide.md 体系优化提示�?
> 用�? 嵌入 AI 系统提示词，防止文件管理规范漂移
> 版本: v1.0.0
> 依据: `../reports/audit/file-management-guide-test-report.md`�?026-07-20，综合评�?4.55/10�?
---

## 一、前置检查清单（AI 执行任何文件操作前必须完成）

### 1.1 目录映射检�?- [ ] **读取 `../../AGENTS.md` §一**：确认当前项目定义的 `src/` 子目录完整列表（13 个核心目录：`config/`、`core/`、`data/`、`lib/`、`services/`、`store/`、`pages/`、`components/`、`portal/`、`constants/`、`types/`、`apps/`、`cockpit/`�?- [ ] **核对文件归位规则�?*：确�?`../how-to/file-management-guide.md` �?1 节的 `src/` 说明列已覆盖全部 13 个目录，遗漏率必须为 0%
- [ ] **检�?`agents/` 命名空间**：区�?`src/agents/`（AI 行为扩展，core 层扩展）�?`.agents/skills/`（AI 技能定义文件），禁止混�?- [ ] **检�?`prompts/` 目录**：如项目存在 `prompts/` 目录，文件归位规则表必须包含对应�?- [ ] **检查非规范目录**：确认不创建 `src/core/databridge.ts`（应归入 `src/core/`）、`src/lib/`（应归入 `src/lib/`）、`toolkit/`（源码不得在 `src/` 外）

> **证据**: 测试报告 2.1 问题1-7（Major），`src/` 目录映射遗漏率高�?42%，直接导�?AI 生成文件时放错位置�?
### 1.2 .gitignore 同步检�?- [ ] **读取根目�?`.gitignore`**：确认当前实际配置的所有规则类�?- [ ] **核对文档 2.2 �?*：确�?`.gitignore` 中每个已配置规则类别在文档中都有对应表格行（依赖、构建产物、环境配置、IDE 产物、日志、测试覆盖、Playwright、临时目录、根目录报告、HTML 报告包、根目录脚本、ESLint 缓存、OS 文件、Python 环境、Vite 产物�?- [ ] **格式一致性检�?*：确认文档规则示例与 `.gitignore` 实际格式一致（尾部斜杠、前�?`/`�?- [ ] **新规则预�?*：如引入新工�?产物，必须同时在 `.gitignore` 和文�?2.2 节中预置规则

> **证据**: 测试报告 2.2 问题1（Major），`.gitignore` 167 行规则中超过 60% 未被文档记录，导致文档权威性丧失�?
### 1.3 文档一致性检�?- [ ] **引用 AGENTS.md**：确认文件归位规则表后添加引用：`详细分层规则参见 [AGENTS.md](../../AGENTS.md) 第一节`
- [ ] **索引收录检�?*：确认新�?修订的文档已�?`../reference/README.md` 的文档索引收�?- [ ] **版本号对�?*：确认文档头部版本号与项目体系版本一致（�?`README.md v2.5.0`），自身修订号独立递增
- [ ] **docs 分层检�?*：确认文档放入正确的 `docs/00-07/` 子目录（00-meta/运维�?1-requirements/需求�?2-design/设计�?3-development/开发�?4-testing/测试�?5-deployment/部署�?6-project-management/项目管理�?7-archive/归档�?- [ ] **命名规范检�?*：确认新增文�?目录命名遵循 `../../AGENTS.md` §四（kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE�?- [ ] **验证命令完整�?*：确认提交前检查清单包含全�?7 项验证命令（`tsc --noEmit`、`npm run lint`、`npm test -- --run`、`npm run build`、`audit:layers`、`audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token`�?
> **证据**: 测试报告 2.4 缺失�?（Major）命名规范缺失，2.4 缺失�?（Major）docs 分层缺失�?.5 问题1-2（Major）信息孤岛�?
### 1.4 防流浪检�?- [ ] **源码目录边界**：禁止在 `src/` 外创�?TypeScript 源码目录（如 `toolkit/`、`src/core/databridge.ts`�?- [ ] **职责边界检�?*：禁止创建与已有目录职责重复的目录（�?`src/lib/` �?`src/lib/` 并存�?- [ ] **根目录禁止清�?*：禁止在根目录直接创�?`.ts`/`.tsx`/`.ps1`/`.py` 脚本、报告文件（`.md`/`.json`/`.txt`），但标准项目配置文件（`package.json`、`tsconfig.*.json`）和根级文档（`../../README.md`、`../../AGENTS.md`）除�?
> **证据**: 测试报告 2.3 问题2（Major）`toolkit/` 文件流浪�?.3 问题4（Major）`src/core/databridge.ts` �?`src/core/` 冲突�?.3 问题7（Minor）`src/lib/` �?`src/lib/` 边界不清�?
---

## 二、约束规则（不可违背�?
### 规则 1: 目录完整性约�?**适用场景**: AI 生成新文件、修订文件管理规范、创建新目录
**规则内容**: `../how-to/file-management-guide.md` 文件归位规则表的 `src/` 说明列必�?100% 包含 `../../AGENTS.md` §一 定义�?13 个核心目录。任何目录新增或变更必须在两个文件中同步更新�?**违规后果**: 文件放置错误 �?架构漂移 �?跨层调用违规 �?`audit:layers` 失败
**自验证方�?*: `npx tsc --noEmit && npm run audit:layers`

> **证据**: 测试报告 2.1 问题1-6（Major），遗漏 `portal/`、`constants/`、`config/`、`lib/`、`types/`、`apps/`�?
### 规则 2: 命名规范约束
**适用场景**: AI 创建新文件、组件、Store、常�?**规则内容**:
- 文件名：kebab-case（如 `data-bridge.ts`）或 PascalCase（如 `DataBridge.ts`�?- 组件：PascalCase（如 `CockpitShell.tsx`�?- Store：camelCase + `Store` 后缀（如 `analysisStore.ts`�?- 常量：UPPER_SNAKE_CASE（如 `ROUTE_REGISTRY`�?- 类型：PascalCase + `Interface`（如 `interface StockData`�?- UI 组件 import 路径大小写必须一致（`Card` 而非 `card`�?**违规后果**: 命名不一�?�?路径错误 �?构建失败 �?认知负荷增加
**自验证方�?*: `npm run lint`（ESLint 命名规则�? 人工扫描新增文件�?
> **证据**: 测试报告 2.4 缺失�?（Major），file-management-guide.md 完全缺失命名规范章节�?
### 规则 3: .gitignore 双向同步约束
**适用场景**: AI 修改 `.gitignore` 或修订文件管理规范的忽略规则章节
**规则内容**:
- �?`.gitignore` 新增/修改/删除规则 �?必须同步修改 `../how-to/file-management-guide.md` 2.2 节表�?- 在文�?2.2 节新增类�?�?必须确认 `.gitignore` 已配置对应规�?- 根目录规则必须带前导 `/`（如 `/tsc_errors.txt`�?- 类别分组注释必须清晰
**违规后果**: 文档与实际脱�?�?开发者无法通过文档理解忽略规则 �?重复提交不该提交的文�?**自验证方�?*: 逐行对比 `.gitignore` 与文�?2.2 节表格，确认类别覆盖�?100%

> **证据**: 测试报告 2.2 问题1（Major），167 行规则中 60%+ 未在文档中记录；2.2 问题2（Minor），尾部斜杠格式不一致�?
### 规则 4: 禁止文件流浪
**适用场景**: AI 生成/迁移/重构文件
**规则内容**:
- 禁止�?`src/` 外创�?TypeScript 源码目录（如 `toolkit/`、`python/` 中的业务逻辑�?- 禁止创建�?`src/core/` 职责冲突的独立目录（�?`src/core/databridge.ts`�?- 禁止创建�?`src/lib/` 重复�?`src/lib/` 目录，如已存在须合并或明确边�?- 禁止�?`src/` 外创建与 `src/` 内文件功能重复的文件（如 `toolkit/safeCoerce.ts` vs `src/lib/safeCoerce.ts`�?- 源码文件必须�?`src/` �?`tests/` �?`e2e/` �?`scripts/` �?**违规后果**: 文件重复 �?维护成本倍增 �?架构分层混乱 �?无法通过 `audit:layers`
**自验证方�?*: `git status --short | grep '^\?\?'` 检查未跟踪文件位置；`find . -name '*.ts' -not -path './src/*' -not -path './tests/*' -not -path './e2e/*' -not -path './scripts/*'`

> **证据**: 测试报告 2.3 问题2（Major）`toolkit/safeCoerce.ts` 流浪�?.3 问题4（Major）`src/core/databridge.ts` 独立�?.3 问题7（Minor）`src/lib/` �?`src/lib/` 并存�?
### 规则 5: 跨文档引用约�?**适用场景**: AI 编写/修订任何项目文档
**规则内容**:
- 文件管理规范必须引用 `../../AGENTS.md`（分层规则、命名规范、验证命令）
- 新增文档必须�?`../reference/README.md` 文档索引收录
- 相关主题文档必须互相引用（如文件管理规范�?trae-file-management-review.md�?- 版本号变更时，所有引用文档的版本号必须同步审�?**违规后果**: 信息孤岛 �?文档体系失效 �?AI 和开发者无法发现相关规�?�?重复犯错
**自验证方�?*: 检查文档末尾是否包�?"参见" �?"引用" 段落；检�?`../reference/README.md` 是否包含本文档条�?
> **证据**: 测试报告 2.5 问题1（Major）未引用 `../../AGENTS.md`�?.5 问题2（Major）未�?`../../README.md` 索引�?
### 规则 6: 验证命令完整性约�?**适用场景**: AI 修订提交前检查清单或验证命令列表
**规则内容**: 提交前检查清单必须包含以下全部命令（�?`../../AGENTS.md` §�?100% 一致）�?1. `npx tsc --noEmit`（类型检查）
2. `npm run lint`（ESLint�?3. `npm test -- --run`（单元测试）
4. `npm run build`（生产构建）
5. `npm run audit:layers`（分层审计）
6. `npm run audit:hardcode`（硬编码扫描�?7. `npm run audit:deadcode`（死代码扫描�?8. `npm run audit:docs`（文档同步）
9. `npm run audit:token`（Token 消耗检测）
**违规后果**: 遗漏关键检�?�?未捕获的架构违规或硬编码问题 �?技术债务积累
**自验证方�?*: 对比 `../../AGENTS.md` §�?命令列表与文档第 3 节，确保 100% 一�?
> **证据**: 测试报告 2.4 缺失�?（Minor），`audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token` 全部缺失�?
### 规则 7: Schema 变更文件同步约束
**适用场景**: AI 修改 IndexedDB schema、新�?store、新�?ENVELOPE_ACTION
**规则内容**:
- 修改 `src/config/dbConfig.ts` �?必须递增 `DB_VERSION`
- 新增 store �?必须�?`STORE_NAME` 中注�?- 新增 store �?必须�?`ACL_MATRIX` 中添�?read/write 白名�?- 新增 store 创建逻辑 �?基线 store 放在 `src/data/db-schema.ts` �?`createSchema`，增�?store 放在 `src/data/db-migrations.ts`（或 `src/data/migrations/`）的对应 `Migration.up()`
- 禁止�?`createSchema` �?`Migration.up()` 中同时添加同一 store 的创建逻辑（违�?DRY�?- 新增 `ENVELOPE_ACTION` �?必须�?`DataBridge.routeToDB()` 中添加对�?case
**违规后果**: 数据层版本不一�?�?运行时崩�?�?权限绕过 �?数据丢失
**自验证方�?*: `npx tsc --noEmit` + `npm run audit:layers` + 人工检�?`DB_VERSION` 是否递增

> **证据**: 测试报告 2.4 缺失�?（Major），数据�?Schema 变更与文件管理关系完全缺失�?
---

## 三、自检流程（操作完成后必须执行�?
```
Step 1: 目录完整性检�?  - 读取 AGENTS.md §一，提取所�?src/ 子目录名
  - 读取 file-management-guide.md �?1 节，提取文件归位规则表中的目录名
  - 对比两组目录，确�?100% 一�?  - 检查是否存�?src/ 外的源码文件（流浪检查）
  - 输出: [PASS/FAIL] 目录完整�?
Step 2: 命名规范检�?  - 扫描本次新增/修改的所有文件名
  - 检查是否遵�?kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE
  - 检�?import 路径大小写一致�?  - 输出: [PASS/FAIL] 命名规范

Step 3: .gitignore 同步检�?  - 读取 .gitignore 所有规则行
  - 读取 file-management-guide.md 2.2 节表格所有行
  - 逐类别对比，确认覆盖�?100%
  - 检查格式一致性（尾部斜杠、前�?/�?  - 输出: [PASS/FAIL] .gitignore 同步

Step 4: 文档引用检�?  - 检�?file-management-guide.md 是否引用 AGENTS.md
  - 检�?docs/01-requirements/README.md 是否收录本文�?  - 检查版本号是否与项目体系版本一�?  - 输出: [PASS/FAIL] 文档引用

Step 5: 验证命令检�?  - 确认提交前检查清单包含全�?9 条命�?  - 确认命令�?AGENTS.md §�?100% 一�?  - 输出: [PASS/FAIL] 验证命令完整�?
Step 6: 运行最小验证套�?  - npx tsc --noEmit
  - npm run audit:layers
  - 输出: [PASS/FAIL] 类型安全与架构合�?
Step 7: 汇总决�?  - 若全�?PASS �?提交完成，可继续下一任务
  - 若任一 FAIL �?停止提交，修复后重新执行自检流程
```

---

## 四、常见错误模式（基于历史审计报告�?
### 错误模式 1: 目录遗漏综合�?- **症状**: `src/` 文件归位规则表只列出部分目录，遗�?`portal/`、`constants/`、`config/`、`lib/`、`types/`、`apps/` �?- **根因**: AI 只凭记忆或旧上下文编写文档，未主动读�?`../../AGENTS.md` 最新版本；文件归位规则表缺乏与架构契约的自动同步机�?- **预防**: 每次生成/修改文件前，强制读取 `../../AGENTS.md` §一；文件归位规则表必须�?../../AGENTS.md 目录�?100% 一�?- **证据**: 测试报告 2.1 问题1-6（Major），遗漏 6 个核心目�?
### 错误模式 2: Agents 目录混淆
- **症状**: �?`src/agents/` �?`.agents/skills/` 混为一谈，或只提其中一�?- **根因**: 两个目录名称相似但职责不同，AI 上下文理解不足，未区�?"运行时模�? �?"技能定义文�?
- **预防**: 文件归位规则表必须同时包含两行，且说明差异：`src/agents/` = AI 行为扩展（core 层扩展）；`.agents/skills/` = AI 辅助技能定义文�?- **证据**: 测试报告 2.1 问题7（Major），2.3 问题3（Major�?
### 错误模式 3: .gitignore 文档脱节
- **症状**: `.gitignore` 已配�?167 行规则，但文�?2.2 节只记录 11 个类别，大量规则（OS 文件、Python 环境、Vite 产物、Playwright 截图等）未提�?- **根因**: 开发者认�?`.gitignore` �?自动维护�?，文档无需同步；AI 生成 .gitignore 规则时未同时更新文档
- **预防**: �?`.gitignore` 与文�?2.2 节的同步作为**同一次变�?*处理，禁止只修改其一；新增规则时先在文档中预置类别说�?- **证据**: 测试报告 2.2 问题1（Major），规则覆盖率不�?40%

### 错误模式 4: 文件流浪（Out-of-Source�?- **症状**: TypeScript 源码出现�?`src/` 外（�?`toolkit/safeCoerce.ts`）；创建�?`src/core/` 冲突�?`src/core/databridge.ts`；`src/lib/` �?`src/lib/` 并存
- **根因**: AI 未理解项目分层架构，按通用习惯创建 `utils/` 目录；迁移代码时未清理旧位置；目录职责边界不清导致重复创�?- **预防**: 强制规则：所�?`.ts` 文件必须�?`src/`/`tests/`/`e2e/`/`scripts/` 内；新建目录前检查是否已存在同类目录；迁移时执行全文件类型扫描（.tsx/.ts/.md/.json/.mjs/.cjs/.yaml/.yml/.sh�?- **证据**: 测试报告 2.3 问题2（Major）`toolkit/` 流浪�?.3 问题4（Major）`src/core/databridge.ts`�?.3 问题7（Minor）`src/lib/` �?`src/lib/` 重复

### 错误模式 5: 命名规范缺失
- **症状**: 文档中完全没有文件命名规范章节，AI 生成文件时随意命�?- **根因**: 文档作者认为命名规范是"编码规范"而非"文件管理规范"，将其排除在文档范围�?- **预防**: 文件管理规范必须包含命名规范（文件名 kebab-case/PascalCase、组�?PascalCase、Store camelCase+Store、常�?UPPER_SNAKE_CASE）；直接复刻 `../../AGENTS.md` §�?的命名约定，不引入新规则
- **证据**: 测试报告 2.4 缺失�?（Major），命名规范完全缺失

### 错误模式 6: 信息孤岛
- **症状**: 文件管理规范不引�?`../../AGENTS.md`，不�?`../../README.md` 索引，与其他文档无交叉引用；版本号与项目体系不一�?- **根因**: 文档被孤立编写，未纳入文档体系管理；AI 生成文档时未检查已有文档体系结�?- **预防**: 每份新文档必须回答三个问题：引用哪些文档？被哪些文档引用？版本号与谁对齐？强制在文档头部和末尾添加引用段�?- **证据**: 测试报告 2.5 问题1-2（Major），未引�?`../../AGENTS.md` 且未被索引；2.5 问题4（Minor）版本号不一�?
### 错误模式 7: 验证命令不完�?- **症状**: 提交前检查只包含 `tsc`、`lint`、`audit:layers`，遗�?`audit:hardcode`、`audit:deadcode`、`audit:docs`、`audit:token`
- **根因**: 文档基于旧版�?`../../AGENTS.md` 编写，后续新增验证命令未同步更新；AI 复制粘贴旧检查清�?- **预防**: 每次修改检查清单时，必须与 `../../AGENTS.md` §�?的命令列表逐行对比；以 `../../AGENTS.md` 为单一真相�?- **证据**: 测试报告 2.4 缺失�?（Minor），遗漏 4 项验证命�?
---

## 五、快速参考卡（适合放入 AI context window�?
| 检查项 | 检查命�?方法 | 通过标准 | 失败后果 |
|--------|-------------|---------|---------|
| 目录完整�?| 对比 AGENTS.md §一 vs 文件归位规则�?| 13 个目�?100% 一�?| 文件放错位置，架构漂�?|
| 命名规范 | 扫描新增文件�?| kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE | 构建失败，认知负荷增�?|
| .gitignore 同步 | 逐行对比 `.gitignore` vs 文档 2.2 �?| 类别覆盖�?100%，格式一�?| 文档权威性丧失，重复提交 |
| 文件流浪 | `git status --short` + `find . -name '*.ts'` | �?src/ 外源码，无重复目�?| 维护成本倍增，audit:layers 失败 |
| 文档引用 | 检查文档末尾引�?+ README.md 索引 | 引用 AGENTS.md，被 README 收录 | 信息孤岛，无法发现相关规�?|
| 版本号对�?| 对比文档头部 vs 项目体系版本 | 双版本号一致（项目�?文档级） | 版本混乱，难以追踪变�?|
| 验证命令完整�?| 对比文档检查清�?vs AGENTS.md §�?| 9 条命�?100% 一�?| 遗漏关键检查，技术债务积累 |
| Schema 变更同步 | 检�?DB_VERSION + STORE_NAME + ACL + Migration | 全部同步更新 | 运行时崩溃，数据丢失 |
| docs 分层 | 确认文件放入 00-07 正确子目�?| 编号体系一�?| 文档无法导航，检索困�?|
| 禁止事项例外 | 检查根目录新增文件 | 标准配置文件/根级文档除外 | 根目录混乱，文件难以管理 |

---

## 六、按场景速查

### 场景 A: AI 生成新文�?�?确保正确目录
```
1. 读取 AGENTS.md §一，确定文件应放入哪个 src/ 子目�?2. 检查文件归位规则表是否包含该目录（若无，先补文档）
3. 按命名规范确定文件名（kebab-case/PascalCase/camelCase+Store/UPPER_SNAKE_CASE�?4. 确认不创建在 src/ 外的独立目录
5. 确认不创建与已有目录重复的职责目�?```

### 场景 B: AI 修改 .gitignore �?确保同步文档
```
1. �?.gitignore 新增规则的同时，在文�?2.2 节新增对应类别行
2. 确认类别分组注释清晰
3. 确认格式一致（尾部斜杠、前�?/�?4. 禁止只修�?.gitignore 而不修改文档
5. 禁止只修改文档而不修改 .gitignore
```

### 场景 C: AI 编写文档 �?确保�?AGENTS.md 一�?```
1. 读取 AGENTS.md 最新版本，确认目录�?100% 一�?2. 在文档中引用 AGENTS.md 相关章节（如 §一分层、§四命名�?3. 确认文档�?docs/01-requirements/README.md 索引收录
4. 确认版本号与项目体系版本一�?5. 确认提交前检查清单与 AGENTS.md §�?100% 一�?```

### 场景 D: AI 代码迁移 �?防止文件流浪
```
1. 迁移前确认目标目录已在文件归位规则表中定�?2. 迁移后执行全文件类型扫描（不�?.tsx/.ts，还包括 .md/.json/.mjs/.cjs/.yaml/.yml/.sh�?3. 检查旧路径是否有残留（文件内容�?import 路径�?4. 检�?AGENTS.md 中的目录结构描述是否引用旧路径（如引用旧目录会导�?AI 生成错误代码�?5. 运行 npm run audit:layers 确认无新增跨层违�?```

---

> **溯源**: 本提示词基于 `../reports/audit/file-management-guide-test-report.md`�?026-07-20）的 19 个主要问题提炼，覆盖 5 个维度（架构一致性�?gitignore 合规性、实际文件分布、完整性、跨文档引用）和 16 项改进行动计划。每次项目架构变更时，应同步审查本提示词的有效性�?