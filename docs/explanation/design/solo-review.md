---
title: solo-review
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "## 一、单人开发审查策�? ### 1.1 核心原则"
tags: [project, plan, review, architecture, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-168
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# solo-review.md �?单人开发代码审查指�?
> **Version**: v1.0.0 | **日期**: 2026-07-05
> **适用场景**: 单人开发、测试、部署的全流�?> **核心思路**: 自动化检�?+ 自查清单 + Git 提交规范

---

## 一、单人开发审查策�?
### 1.1 核心原则

**问题**: 单人开发没有同事审查代码，如何保证质量�?
**解决方案**: 
1. **强化自动化检�?*（ESLint + TypeScript + 测试 + 架构审计�?2. **严格的自查清�?*（提交前必须逐项检查）
3. **Git 提交规范**（清晰的 commit message，便于回溯）
4. **定期代码复盘**（每周回顾，持续改进�?
### 1.2 单人审查流程

```
┌──────────────────────────────────────────────────────────�?�?Step 1: 开发完�?                                         �?├──────────────────────────────────────────────────────────�?�?1. 完成功能开�? Bug 修复                                �?�?2. 编写单元测试（覆盖率 > 80%�?                        �?�?3. 更新相关文档（如需要）                                �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 2: 自动化检查（强制�?                               �?├──────────────────────────────────────────────────────────�?�?1. 运行一键检�?                                         �?�?   npm run pre-review                                    �?�?2. 修复所�?P0 问题（自动化检查失败，禁止提交�?         �?�?3. 确认所有检查通过                                      �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 3: 自查清单（强制）                                  �?├──────────────────────────────────────────────────────────�?�?1. 打开自查清单（�?�?                                   �?�?2. 逐项检查并打勾                                        �?�?3. 记录检查结果（提交时附带）                            �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 4: Git 提交（规范）                                 �?├──────────────────────────────────────────────────────────�?�?1. 暂存代码                                              �?�?   git add .                                             �?�?2. 提交（使用规�?commit message�?                       �?�?   npm run commit  # 使用 Commitizen                     �?�?3. 推�?                                                 �?�?   git push origin branch-name                            �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 5: 定期复盘（每周）                                  �?├──────────────────────────────────────────────────────────�?�?1. 回顾本周提交                                            �?�?   git log --since="1 week ago" --oneline               �?�?2. 检查是否有 P0 问题遗漏                                �?�?3. 总结经验，更新自查清�?                               �?└──────────────────────────────────────────────────────────�?```

---

## 二、自查清单（提交前必须完成）

### 2.1 架构合规性（P0 - 必须检查）

- [ ] **分层规则**: 运行 `npm run audit:layers`，确�?0 violations
- [ ] **依赖方向**: 检�?import 路径，符�?AGENTS.md §1 规则
- [ ] **四步集成**: 如新增模块，确认按类�?�?Store �?Service �?UI 顺序
- [ ] **路由注册**: 如新增页面，确认三处同步（routes.ts + App + docs�?
**快速检查命�?*:
```powershell
npm run audit:layers
# 期望输出: �?0 violations, 0 warnings
```

### 2.2 类型安全（P0 - 必须检查）

- [ ] **�?any 类型**: 搜索代码�?`any`，确认无使用（或已加 `@ts-expect-error`�?- [ ] **�?ts-ignore**: 搜索 `@ts-ignore`，确认已改为 `@ts-expect-error` + 注释
- [ ] **Interface 定义**: 确认所有数据结构有 TypeScript Interface
- [ ] **TypeScript 检�?*: 运行 `npx tsc --noEmit`，确�?0 错误

**快速检查命�?*:
```powershell
npx tsc --noEmit
# 期望输出: 无错�?
# 搜索 any 类型（排除测试文件）
Select-String -Path "src/**/*.ts", "src/**/*.tsx" -Pattern ": any" | Where-Object { $_ -notmatch "test" }
```

### 2.3 零硬编码（P0 - 必须检查）

- [ ] **颜色令牌**: 运行 `npm run audit:hardcode`，确�?0 violations
- [ ] **魔法数字**: 检查代码中是否有硬编码数字�? 位以上），已提取�?const
- [ ] **配置注入**: 检查引擎层参数是否�?`config.ts` 注入

**快速检查命�?*:
```powershell
npm run audit:hardcode
# 期望输出: �?0 violations

# 搜索魔法数字（示例：查找硬编码的阈值）
Select-String -Path "src/**/*.ts", "src/**/*.tsx" -Pattern "\b(85|60|30)\b" | Select-Object -First 10
```

### 2.4 功能正确性（P0 - 必须检查）

- [ ] **单元测试**: 运行 `npm test -- --run --coverage`，确认覆盖率 > 80%
- [ ] **边界处理**: 检查代码是否处�?null/undefined/empty 等边界情�?- [ ] **错误处理**: 检查异步操作是否有 try-catch 和错误日�?- [ ] **事件清理**: 检�?useEffect 中是否有 cleanup（参�?AGENTS.md §3 模板�?
**快速检查命�?*:
```powershell
npm test -- --run --coverage
# 期望输出: 覆盖�?> 80%

# 搜索未处理的 async/await
Select-String -Path "src/**/*.ts", "src/**/*.tsx" -Pattern "await.*$" | Where-Object { $_ -notmatch "try" }
```

### 2.5 代码质量（P1 - 强烈建议�?
- [ ] **命名规范**: 检查变�?函数/组件命名是否清晰、符合约�?- [ ] **函数长度**: 检查是否有函数超过 50 行（考虑拆分�?- [ ] **文件长度**: 检查是否有文件超过 300 行（考虑拆分�?- [ ] **重复代码**: 检查是否有复制粘贴代码（提取为公共函数�?
**快速检查命�?*:
```powershell
# 查找超过 50 行的函数（简单启发式�?Select-String -Path "src/**/*.ts", "src/**/*.tsx" -Pattern "^function |^const .* = \(" | ForEach-Object {
  $file = $_.Filename
  $line = $_.LineNumber
  # 简化检查：实际应使�?AST 分析
  Write-Host "$file : $line"
}
```

### 2.6 文档与测试（P1 - 强烈建议�?
- [ ] **文档同步**: 如类型定义变更，确认 `../../reference/06-routing-specs.md` 或数据字典已更新
- [ ] **CHANGELOG 更新**: 确认 `../../../CHANGELOG.md` 已记录本次变�?- [ ] **测试覆盖**: 确认新增代码有对应单元测�?
**快速检查命�?*:
```powershell
# 检查是否更新了 CHANGELOG
git diff --name-only
# 确认输出中包�?CHANGELOG.md

# 检查测试文件是否存�?Get-ChildItem -Path "tests" -Filter "*.test.ts" | Select-Object Name
```

---

## 三、Git 提交规范

### 3.1 Commit Message 格式

使用 **Conventional Commits** 规范�?
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type�?*:
- `feat`: 新功�?- `fix`: Bug 修复
- `refactor`: 重构（不改变功能的代码整理）
- `docs`: 文档更新
- `style`: 代码格式（不影响功能的改动）
- `test`: 测试相关
- `chore`: 构建/工具/依赖更新

**范围（scope�?*: 可选，表示影响的模块（�?`store`, `services`, `components`�?
**主题（subject�?*: 简短描述（< 50 字符�?
**正文（body�?*: 可选，详细描述（为什么需要这个变更？如何解决的？�?
**页脚（footer�?*: 可选，关联 Issue（如 `Closes #123`�?
### 3.2 Commit Message 示例

```bash
# 示例 1: 新功�?feat(fund-flow): 新增资金流向模块

- 实现资金流向数据获取接口
- 实现资金流向可视化组�?- 添加单元测试（覆盖率 85%�?
Closes #123

# 示例 2: Bug 修复
fix(scoring-engine): 修复评分引擎边界处理错误

当输入数据为空数组时，评分引擎抛�?TypeError�?添加边界检查后，返回默认�?0�?
# 示例 3: 重构
refactor(data-layer): 重构数据层架�?
将数据层从直接调�?IndexedDB 改为通过 DataBridge 转发�?符合 AGENTS.md §1 分层规则�?
BREAKING CHANGE: 数据层接口签名变更，需要同步更新所有调用方�?```

### 3.3 使用 Commitizen（推荐）

**安装**:
```powershell
npm install -g commitizen
npm install --save-dev cz-conventional-changelog
```

**配置** (`package.json`):
```json
{
  "config": {
    "commitizen": {
      "path": "cz-conventional-changelog"
    }
  }
}
```

**使用**:
```powershell
# 暂存代码
git add .

# 使用 Commitizen 提交（交互式问答�?npm run commit
# �?npx cz
```

**交互式问�?*:
```
? Select the type of change that you're committing: (Use arrow keys)
  �?feat:     A new feature
    fix:      A bug fix
    docs:     Documentation only changes
    style:    Changes that do not affect the meaning of the code
    refactor: A code change that neither fixes a bug nor adds a feature
    perf:     A code change that improves performance
    test:     Adding missing tests or correcting existing tests

? What is the scope of this change (e.g. component or file name): (press enter to skip)
  fund-flow

? Write a short, imperative mood description of the change (max 50 chars):
  Add fund flow data fetching API

? Provide a longer description of the change: (press enter to skip)
  Implement fund flow data fetching from Sina Finance API.
  Add error handling and retry logic.

? Are there any breaking changes? (y/N)
  N

? Does this change affect any open issues? (y/N)
  y
  ? If issues are closed, the commit cannot be published.
  ? Enter issue numbers (e.g. "fix #123", "re #123"):
    Closes #123
```

---

## 四、定期代码复�?
### 4.1 每周复盘（建议周五下午）

**目标**: 回顾本周代码，发现改进点，防止技术债累�?
**流程**:
```
┌──────────────────────────────────────────────────────────�?�?Step 1: 查看本周提交                                      �?├──────────────────────────────────────────────────────────�?�?git log --since="1 week ago" --oneline                  �?�?git diff HEAD~10..HEAD  # 查看最�?10 次提交的差异    �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 2: 检查代码质�?                                     �?├──────────────────────────────────────────────────────────�?�?1. 运行完整检�?                                          �?�?   npm run pre-review                                    �?�?2. 检查是否有 P0 问题遗漏                                �?�?3. 检查是否有代码异味（重复代码、过长函数等�?           �?└──────────────────────────────────────────────────────────�?                          �?┌──────────────────────────────────────────────────────────�?�?Step 3: 总结经验                                          �?├──────────────────────────────────────────────────────────�?�?1. 记录本周学到的经验（docs/CHANGELOG.md�?              �?�?2. 更新自查清单（本文档 §2�?                            �?�?3. 规划下周改进�?                                       �?└──────────────────────────────────────────────────────────�?```

### 4.2 每月深度复盘（建议月末）

**目标**: 深入审查架构、性能、安全�?
**检查项**:
- [ ] **架构审查**: 运行 `npm run audit:layers`，确认无新增违规
- [ ] **性能分析**: 使用 Chrome DevTools 分析首屏加载时间、组件渲染性能
- [ ] **安全审查**: 检查是否有敏感信息泄露（API Key、密码等�?- [ ] **依赖更新**: 检查是否有过期依赖（`npm outdated`�?- [ ] **技术债清�?*: 检�?`TODO`/`FIXME` 注释，规划清理计�?
**输出**:
- 月度复盘报告（`docs/changelogs/YYYY-MM/monthly-review.md`�?- 下月改进计划（更新到 `../../../CHANGELOG.md` �?Issue�?
---

## 五、常见问题与解决方案

### 5.1 如何提高单人开发的代码质量�?
**策略**:
1. **自动化优�?*: 配置完善�?ESLint + TypeScript + 测试 + 架构审计
2. **自查清单**: 提交前必须逐项检查（不跳过）
3. **提交规范**: 清晰�?commit message，便于回溯和问题定位
4. **定期复盘**: 每周/每月回顾，持续改�?
**工具推荐**:
- **Husky + lint-staged**: 提交前自动运行检�?- **Commitizen**: 规范 commit message
- **Chrome DevTools**: 性能分析
- **GitHub Insights**: 查看提交历史、代码统�?
### 5.2 如何管理技术债？

**定义**: 技术债是暂时妥协的方案，需要在后续迭代中修�?
**管理流程**:
```
发现技术�?   �?记录�?Issue（标�?`tech-debt` 标签�?   �?评估优先级（P0/P1/P2�?   �?规划到后续迭�?   �?定期清理（每月至少清�?1 �?P1 技术债）
```

**技术债模�?*（`./tech-debt.md`�?
```markdown
# 技术债清�?
## P0: 必须修复（影响功�?安全�?
### [TD-001] 评分引擎性能问题
- **发现日期**: 2026-07-05
- **问题描述**: 评分引擎处理 10000+ 数据时耗时 > 5s
- **根因**: 使用嵌套循环，时间复杂度 O(n²)
- **解决方案**: 优化为哈希表，时间复杂度 O(n)
- **计划完成**: 2026-07-12
- **状�?*: 🟡 进行�?
## P1: 强烈建议（影响可维护性）

### [TD-002] 重复代码：数据验证逻辑
- **发现日期**: 2026-07-05
- **问题描述**: 多个模块都有相同的数据验证逻辑
- **根因**: 未提取为公共函数
- **解决方案**: 提取�?`src/lib/validation.ts`
- **计划完成**: 2026-07-19
- **状�?*: �?待规�?
## P2: 可选改进（不影响功能）

### [TD-003] 注释不完�?- **发现日期**: 2026-07-05
- **问题描述**: 部分复杂函数缺少 JSDoc 注释
- **根因**: 开发时未及时添加注�?- **解决方案**: 补充 JSDoc 注释
- **计划完成**: 2026-07-26
- **状�?*: �?待规�?```

### 5.3 如何保证测试覆盖率？

**策略**:
1. **强制 coverage 阈�?*: 配置 Jest `coverageThreshold`
2. **新增代码必须测试**: 提交前检查测试覆盖率
3. **定期补充测试**: 每月复盘时补充缺失的测试

**配置示例** (`package.json`):
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "src/core/": {
        "branches": 90,
        "functions": 90,
        "lines": 90,
        "statements": 90
      },
      "src/services/": {
        "branches": 85,
        "functions": 85,
        "lines": 85,
        "statements": 85
      }
    }
  }
}
```

**检查命�?*:
```powershell
# 检查测试覆盖率
npm test -- --run --coverage

# 检查未测试的文�?npm test -- --run --coverage --collectCoverageFrom="src/**/*.ts"
```

---

## 六、工具配�?
### 6.1 Husky + lint-staged（提交前自动检查）

**安装**:
```powershell
npm install --save-dev husky lint-staged
npx husky install
```

**配置** (`.husky/pre-commit`):
```bash
#!/bin/sh
npx lint-staged
```

**配置** (`package.json`):
```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "npm run lint -- --fix",
      "npx tsc --noEmit",
      "npm test -- --run --findRelatedTests"
    ],
    "src/**/*.test.{ts,tsx}": [
      "npm run lint -- --fix"
    ]
  }
}
```

**效果**:
- 提交前自动运�?ESLint 修复 + TypeScript 检�?+ 相关测试
- 检查失败，自动阻止提交

### 6.2 VS Code 插件推荐

**必备插件**:
- **ESLint**: 实时显示 ESLint 错误
- **Error Lens**: 在代码行内显示错�?警告
- **GitLens**: 查看代码历史、Blame、对比分�?- **Code Spell Checker**: 拼写检查（避免变量名拼错）

**配置** (`settings.json`):
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "typescript",
    "typescriptreact"
  ],
  "git.enableSmartCommit": true,
  "git.confirmSync": false
}
```

---

## 七、快速参�?
### 7.1 提交前检查命�?
```powershell
# 完整检查（推荐�?npm run pre-review

# 或手动执�?npm run lint              # ESLint 检�?npx tsc --noEmit         # TypeScript 类型检�?npm test -- --run         # 单元测试
npm run build             # 生产构建
npm run audit:layers      # 分层调用检�?npm run audit:hardcode    # 硬编码检�?npm run audit:deadcode    # 死代码检�?npm run audit:docs        # 文档同步检�?```

### 7.2 Git 提交命令

```powershell
# 暂存代码
git add .

# 使用 Commitizen 提交（推荐）
npm run commit

# 或手动提交（遵循 Conventional Commits 规范�?git commit -m "feat(fund-flow): 新增资金流向模块"

# 推�?git push origin branch-name
```

### 7.3 每周复盘命令

```powershell
# 查看本周提交
git log --since="1 week ago" --oneline

# 查看最�?10 次提交的差异
git diff HEAD~10..HEAD

# 运行完整检�?npm run pre-review

# 查看技术�?Get-Content docs/tech-debt.md
```

---

## 八、总结

### 单人开发审查核心要�?
1. **自动化检查优�?*: 配置完善的工具链（ESLint + TypeScript + 测试 + 架构审计�?2. **严格的自查清�?*: 提交前必须逐项检查（不跳过）
3. **规范�?Git 提交**: 清晰�?commit message，便于回�?4. **定期代码复盘**: 每周/每月回顾，持续改�?
### 与团队开发的区别

| 方面 | 团队开�?| 单人开�?|
|------|----------|----------|
| **审查�?* | 同事审查 | 自查 + 自动化检�?|
| **审查流程** | PR + 审查意见 | 提交前检�?+ 规范提交 |
| **质量保证** | 多人把关 | 工具 + 自律 |
| **知识共享** | 审查过程共享知识 | 文档 + Changelog |

### 下一步行�?
- [ ] 安装 Husky + lint-staged（提交前自动检查）
- [ ] 配置 Commitizen（规�?commit message�?- [ ] 创建技术债清单（`./tech-debt.md`�?- [ ] 设置每周复盘提醒（日�?待办�?
---

**文档维护**: 本文档由开发者维护，根据实际使用反馈持续优化�?
**反馈**: 如有疑问或改进建议，请更新本文档或创�?Issue�?