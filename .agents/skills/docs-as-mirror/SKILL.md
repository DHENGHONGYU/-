---
name: "docs-as-mirror"
description: "指导 AI 编写与仓库实际状态严格一致的文档。核心原则：Truth-First（先读取真相源再编写）、Scan-Before-Write（编写前扫描实际文件系统）、Exhaustiveness（穷尽性原则覆盖所有文件归属）、Bidirectional Linking（双向引用防止信息孤岛）、Version Pinning（版本锁定确保兼容性）。Invoke when user asks to write or update any technical documentation, directory mapping guide, .gitignore documentation, file management spec, or architecture description."
---

# 文档镜像技能 (Docs-as-Mirror Skill) — v1.0.0

> **版本**: v1.0.0 | **日期**: 2026-07-20 | **校验基准**: V9 AGENTS.md v1.4.5 + FILE-MANAGEMENT-GUIDE-RCA-report.md
> **适用性质**: 文档编写与维护的 AI 行为约束
> **输出格式**: 编写前检查清单 + 编写后验证命令 + 变更文件清单

---

## 一、触发条件（Invoke When）

- 用户要求编写或更新任何**技术文档**（文件管理规范、编码规范、API 规范、数据规范）
- 用户要求编写或更新**目录映射说明**、`.gitignore` 文档、架构描述
- `audit:docs` 报告文档与实际不一致
- `audit:directory` 报告目录映射遗漏
- 新增目录/文件后需要同步更新相关文档

---

## 二、五大核心原则（Truth-First, Scan, Exhaustiveness, Linking, Versioning）

### 原则 1：Truth-First Principle（真相优先）

> 文档编写的第一步永远是读取实际文件，而非凭记忆或模板。

**禁止行为**：
- ❌ 凭记忆写目录结构："源代码放在 `src/` 下，按 `core/`、`data/`、`services/` 等分层"
- ❌ 凭模板写 `.gitignore` 说明："通常包含 `node_modules/`、`dist/`、`.env`"
- ❌ 引用旧版本架构契约：文档依据 `AGENTS.md v1.0.0` 编写，而项目实际使用 `v1.4.5`

**强制行为**：
- ✅ 编写前必须打开并阅读架构契约的**当前版本**（`AGENTS.md`、`ARCHITECTURE.md`）
- ✅ 必须逐条对比架构契约中的**每一项定义**（目录、命名规则、验证命令），确保文档覆盖 100%
- ✅ 当架构契约与文档冲突时，以架构契约为准修改文档

### 原则 2：Scan-Before-Write Checklist（编写前扫描清单）

> 编写任何文件管理相关文档前，必须扫描实际文件系统。

| 扫描目标 | 命令 | 目的 |
|---------|------|------|
| 架构契约目录定义 | `grep -E '^\s*(src/|\.agents/|packages/|docs/)' AGENTS.md` | 提取所有目录定义，确保文档覆盖 100% |
| 实际目录结构 | `find . -maxdepth 2 -type d \| sort` | 确认所有非标准目录都有说明 |
| `.gitignore` 规则 | `cat .gitignore \| grep -v '^#' \| grep -v '^$' \| sort` | 逐行分类后写入文档 |
| 验证命令清单 | `grep -E 'npm run audit\|npx tsc\|npm test' AGENTS.md` | 确保文档列出所有验证命令 |
| 版本号体系 | 检查文档头部 vs 项目体系版本 | 确保双版本号一致 |

### 原则 3：Exhaustiveness Rule（穷尽性原则）

> 复杂架构项目中的文件管理规范必须是穷尽性的，不允许"最小化原则"。

**文件管理规范必须包含的 8 个章节**：
1. **目录映射表** — 每个目录的职责、依赖方向、与相似目录的区别
2. **命名规范** — kebab-case / PascalCase / camelCase+Store / UPPER_SNAKE_CASE
3. **`.gitignore` 规则说明** — 基于实际 `.gitignore` 文件逐行分类
4. **提交前检查清单** — 完整列出所有验证命令（`tsc`、`lint`、`audit:*`）
5. **定期审计策略** — 未跟踪文件审计、架构合规审计
6. **生命周期管理** — 入（创建）、移（迁移）、出（清理/归档）
7. **交叉引用** — 引用 `AGENTS.md`，被文档索引收录
8. **变更日志** — 版本同步关系、修订记录

**反例**：
- ❌ 凭经验写："文件放在 `src/` 下，测试放在 `tests/` 下，其他按常识处理"
- ❌ 采用最小化原则：只写最确定的规则，灰色地带留给"开发者自行判断"

### 原则 4：Bidirectional Linking（双向引用）

> 任何文档必须同时建立"被索引收录"和"引用相关文档"两个方向的链接。

**三步骤完成定义（DoD）**：
1. **注册**：新文档必须注册到文档索引（`docs/README.md` 或 `REGISTRY_INDEX.md`），包含标题、路径、一句话描述、版本号
2. **引用**：新文档必须引用所有相关文档（如文件管理规范必须引用 `AGENTS.md`）
3. **反向**：在相关文档中反向建立引用（如 `AGENTS.md` 引用文件管理规范）

**禁止行为**：
- ❌ 文档写完直接存到 `docs/01-requirements/`，未更新索引
- ❌ 文档引用了 `AGENTS.md`，但 `AGENTS.md` 中没有任何地方引用该文档（单向引用）

### 原则 5：Version Pinning（版本锁定）

> 文档必须明确标注其基于的架构契约版本号，当架构契约升级时自动触发文档审查。

**双版本号体系**：
- **项目级版本**（如 `v2.5.0`）：标识文档体系兼容性
- **文档修订号**（如 `rev.3`）：标识该文档自身的修订次数

**文档头部必须包含**：
```markdown
> 文档体系版本: v2.5.0 | 本文档修订: rev.1 | 兼容 AGENTS.md v1.4.5+
```

---

## 三、编写前检查清单（强制执行）

### 3.1 真相源读取

- [ ] 打开 `AGENTS.md` 并记录其版本号（当前 v1.4.5）
- [ ] 提取 `AGENTS.md` §一 的所有目录定义（22 个 `src/` 子目录 + `.agents/` 等）
- [ ] 提取 `AGENTS.md` §七 的所有验证命令（9 条）
- [ ] 提取 `AGENTS.md` §四 的命名约定规则
- [ ] 确认 `FILE-MANAGEMENT-GUIDE.md` 当前版本和变更日志

### 3.2 实际文件系统扫描

- [ ] 运行 `find . -maxdepth 2 -type d | sort`，记录所有非标准目录
- [ ] 运行 `cat .gitignore | grep -v '^#' | grep -v '^$' | sort`，记录规则数量
- [ ] 运行 `git status --short`，确认无未跟踪的流浪文件
- [ ] 检查 `src/` 外是否存在独立源码目录（如 `toolkit/`）

### 3.3 相似目录区分

- [ ] 检查是否存在 `agents/` 与 `.agents/skills/` — 必须相邻排列并附注职责差异
- [ ] 检查是否存在 `src/utils/` 与 `src/lib/` — 废弃目录必须标注
- [ ] 检查是否存在 `src/databridge/` 与 `src/core/` — 冲突目录必须说明

---

## 四、编写后验证清单（强制执行）

### 4.1 目录覆盖度验证

```powershell
# 提取 AGENTS.md 中的目录定义
node -e "const fs=require('fs'); const t=fs.readFileSync('AGENTS.md','utf8'); const m=t.match(/^src\/\w+|^\.agents/g); console.log(m ? [...new Set(m)].sort().join('\n') : 'none')"

# 提取文档中的目录定义（假设文档名为 FILE-MANAGEMENT-GUIDE.md）
node -e "const fs=require('fs'); const t=fs.readFileSync('docs/01-requirements/FILE-MANAGEMENT-GUIDE.md','utf8'); const m=t.match(/^src\/\w+|^\.agents/g); console.log(m ? [...new Set(m)].sort().join('\n') : 'none')"

# 对比两者差异（目标：0% 遗漏）
```

### 4.2 实际一致性验证

- [ ] `.gitignore` 文档覆盖率 ≥ 95%（未覆盖规则比例 < 5%）
- [ ] 文档中描述的每个目录在实际文件系统中存在
- [ ] 实际文件系统中的每个非标准目录在文档中有说明
- [ ] 格式一致性：尾部斜杠、前导 `/` 与 `.gitignore` 实际一致

### 4.3 交叉引用验证

- [ ] 文档索引中搜索新文档的文件名，确认已被收录
- [ ] 新文档中搜索所有相关文档的引用链接（如 `[AGENTS.md]`）
- [ ] `AGENTS.md` 中搜索新文档的引用，确认双向引用完整

### 4.4 版本号验证

- [ ] 文档头部包含版本号声明和版本号体系说明
- [ ] 文档索引中记录的版本号与文档实际版本号一致
- [ ] 相关文档间的版本号无冲突

---

## 五、常见陷阱与解决方案

| 陷阱 | 现象 | 解决方案 |
|------|------|----------|
| 凭记忆编写 | 遗漏 `src/portal/`、`src/apps/`、`src/constants/` 等目录 | 使用 `grep` 从 AGENTS.md 提取完整目录列表，逐条复制 |
| 最小化原则 | 只写"文件放在 src/ 下"，遗漏命名规范、Schema SOP、temp 清理策略 | 使用 8 章节模板 Checklist，逐项勾选 |
| 单向引用 | 文档引用了 AGENTS.md，但 AGENTS.md 未引用该文档 | 编写完成后，同时在 AGENTS.md 附录/引用区添加反向链接 |
| 版本号不一致 | 文档 v1.0.0，README v2.5.0，AGENTS.md v1.4.5 | 采用"项目级版本 + 文档修订号"双版本号体系 |
| .gitignore 脱节 | 文档描述 11 个类别，实际 .gitignore 有 167 行规则 | 先扫描再编写：`cat .gitignore` 获取实际规则列表后分类写入 |
| 文件流浪 | `toolkit/`、`src/databridge/`、`src/utils/` 等未在文档中说明 | 执行 `find` 扫描，对所有非标准目录在文档中补充说明或标注废弃 |
| 生命周期缺失 | 只定义"新文件放哪里"，未定义迁移/清理策略 | 补充"入-移-出"全生命周期管理章节 |

---

## 六、验证命令速查

```powershell
# 目录结构审计（v1.4.5 新增）
npm run audit:directory
# 期望：0 violations, 22/22 匹配

# 文档同步审计
npm run audit:docs
# 期望：0 inconsistencies

# 架构分层审计
npm run audit:layers
# 期望：0 violations

# 全量审计
npm run audit
```

---

## 七、与已有 SKILL 的协同关系

| 已有 SKILL | 协同点 |
|-----------|--------|
| `architecture-radar-scan` | 文档编写前调用，确认架构无漂移；文档编写后调用，验证目录映射 100% 覆盖 |
| `type-safety-contract` | 文档涉及类型定义修改时，确保不破坏现有类型约束 |
| `databridge-migration` | 文件迁移后同步更新文档，确保新旧路径都有说明 |

---

## 八、版本记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-20 | 初始版本：基于 FILE-MANAGEMENT-GUIDE-RCA-report.md 的 7 条教训和 5 条核心原则提炼，覆盖 Truth-First、Scan-Before-Write、Exhaustiveness、Bidirectional Linking、Version Pinning 五大原则 |
