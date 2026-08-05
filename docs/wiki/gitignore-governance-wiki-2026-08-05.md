# .gitignore 治理团队 Wiki

> **版本**: v1.0 | **日期**: 2026-08-05
> **适用范围**: V9 智能投研复盘系统全体开发者及 AI 辅助工具
> **关联文档**: [FILE-MANAGEMENT-GUIDE.md §2.2](../guides/how-to/FILE-MANAGEMENT-GUIDE.md#L117-L146) | [变更对比报告](../reports/gitignore-governance-diff-report-2026-08-05.md)

---

## 一、治理背景

### 1.1 问题发现

在 2026-08-05 上线封装前体系化梳理中，发现仓库存在以下问题：

1. **IDE 部署文件被追踪**：`.workbuddy/`（5 个 PowerShell 自动推送模块）、`.trae-cn/work/`（1 个会话临时脚本）、`.codebuddy/settings.local.json`（IDE 私有配置）、`.cursorrules`（Cursor IDE 规则）共 8 个 IDE 私有文件被 Git 追踪，污染了版本库
2. **.gitignore 规则不完整**：缺少 `.codebuddy/`、`.cursorrules`、`.workbuddy/`、`.trae-cn/` 等规则，导致新增 IDE 文件可被意外提交
3. **死文档残留**：`git-auto-push-operation-guide.md`（模块已不追踪但文档残留）、`v2.6.0-changelog-draft.md`（已被正式条目取代且含失效引用）
4. **CI Job 依赖断裂**：`ci.yml` 中的 `git-autopush-test` Job 依赖已不追踪的 `.workbuddy/tests/GitAutoPush.Tests.ps1`，路径缺失会导致 CI 失败
5. **缺乏自动化拦截**：无机制防止未来新增 IDE 文件被意外提交

### 1.2 治理目标

- **仅保留 `.trae/` 被 Git 追踪**（团队 SKILL 体系），其他 IDE/环境部署文件全部移除追踪
- **建立自动化拦截机制**：pre-commit 钩子自动检查 IDE 文件，未来新增可被自动拦截
- **文档同步**：治理规则同步到团队共享文档，回归测试确保持续有效

---

## 二、实施步骤

### 2.1 第一阶段：追踪移除（commit `d8cf7d38`）

```bash
# 1. 从 Git 追踪移除 8 个 IDE 文件（工作区文件保留）
git rm --cached ".workbuddy/scripts/GitAutoPush.psm1" \
                ".workbuddy/scripts/auto-push-on-network.ps1" \
                ".workbuddy/scripts/schedule-auto-push.ps1" \
                ".workbuddy/scripts/GitAutoPush-Deploy-Guide.md" \
                ".workbuddy/tests/GitAutoPush.Tests.ps1" \
                ".trae-cn/work/6a43e703deccb368f0f3650f/update-mocks.ps1" \
                ".codebuddy/settings.local.json" \
                ".cursorrules"

# 2. 验证移除结果
git ls-files | findstr /i "^\.workbuddy/ ^\.trae-cn/ ^\.codebuddy/ ^\.cursorrules"
# 期望：无匹配（exit 1）
```

### 2.2 第二阶段：CI 与死文档清理（commit `1c6d3b20`）

```bash
# 1. 删除依赖已不追踪路径的 CI Job
# 编辑 .github/workflows/ci.yml，删除 git-autopush-test Job（33 行）

# 2. 删除失效文档
# - git-auto-push-operation-guide.md（模块已不追踪，文档失效）
# - v2.6.0-changelog-draft.md（已被 CHANGELOG.md v2.6.0 取代 + 含失效引用）
```

### 2.3 第三阶段：自动化治理体系（commit `64754be9`）

```bash
# 1. 创建审计脚本
# scripts/audit/audit-gitignore-coverage.sh — 3 项 BLOCK 检查

# 2. 创建回归测试
# tests/__tests__/scripts/gitignore-coverage.test.ts — 14 个用例

# 3. 集成到 pre-commit 钩子
# .husky/pre-commit 新增 §2.5 步骤

# 4. 更新团队文档
# docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md §三 重构
```

---

## 三、关键发现

### 3.1 `.trae/` 与 `.trae-cn/` 的区别

| 目录 | 用途 | 追踪状态 | 说明 |
|------|------|---------|------|
| `.trae/` | 团队 SKILL 体系 | ✅ 保留追踪 | 包含 SKILL.md / skill-registry.json / INDEX.md，团队共享 |
| `.trae-cn/` | TRAE CN 会话临时产物 | ❌ 忽略 | `work/` 子目录下的临时脚本，会话级别产物 |

**教训**：命名相似的目录可能有完全不同的用途，治理时必须逐个确认。

### 3.2 `git rm --cached` vs `git rm`

- `git rm --cached <file>`：仅从 Git 追踪移除，**保留工作区文件** �️（本次使用）
- `git rm <file>`：同时移除追踪和工作区文件 ❌（会丢失本地配置）

**教训**：移除 IDE 文件追踪时务必使用 `--cached`，避免删除开发者本地配置。

### 3.3 `docs/reports/` 规则的精度问题

**原规则**（过宽）：
```
docs/reports/
```
会忽略整个 `docs/reports/` 目录，导致手写 `.md` 文档无法入 VCS。

**修正后规则**（精准）：
```
docs/reports/audit/*.json
docs/reports/_generated/
docs/reports/**/*.html
docs/reports/automation-pipeline/*.json
```
仅忽略自动生成的 JSON/HTML 产物，手写 `.md` 文档正常入 VCS。

**教训**：忽略规则应精确到文件类型/子目录，避免一刀切导致误伤。

### 3.4 pre-commit 钩子的环境差异

钩子中 `tsc:prod` 偶发报错 `TS1005: '}' expected`，但手动运行退出码 0。根因是**未追踪文件** `cloudEmbeddingService.ts` 被外部进程实时修改，导致 hook 运行时偶发语法错误。

**教训**：hook 运行时会编译所有 `src/` 下的 `.ts` 文件（包括未追踪的），未追踪文件的语法错误会阻断提交。需定期清理未追踪的源码文件。

---

## 四、最佳实践建议

### 4.1 新增 IDE 工具时的检查清单

1. **添加 .gitignore 规则**：在 `.gitignore` 的「IDE/工具私有配置」段落添加新规则
2. **更新团队文档**：同步更新 `FILE-MANAGEMENT-GUIDE.md §2.2` 的路径表
3. **更新审计脚本**：在 `audit-gitignore-coverage.sh` 的 `IGNORE_PATHS` 列表添加新路径
4. **更新回归测试**：在 `gitignore-coverage.test.ts` 的 `MUST_IGNORE_PATHS` 添加测试用例
5. **运行验证**：`sh scripts/audit/audit-gitignore-coverage.sh` 确认退出码 0

### 4.2 .gitignore 规则编写规范

1. **目录规则带尾部 `/`**：`.vscode/` 而非 `.vscode`（明确匹配目录）
2. **文件规则不带尾部 `/`**：`.cursorrules` 而非 `.cursorrules/`
3. **根目录规则带前导 `/`**：`/tsc_errors.txt` 而非 `tsc_errors.txt`（避免误伤子目录同名文件）
4. **添加分组注释**：每段规则前用 `# --- 日期 描述 ---` 标注
5. **避免过宽规则**：不用 `docs/reports/`，用 `docs/reports/audit/*.json` 精确到子目录和类型

### 4.3 提交前自查

```powershell
# 1. 确认暂存区无 IDE 文件
git diff --cached --name-only | findstr /i "^\.workbuddy/ ^\.trae-cn/ ^\.codebuddy/ ^\.cursorrules ^\.vscode/ ^\.idea/"

# 2. 运行 .gitignore 覆盖率审计
sh scripts/audit/audit-gitignore-coverage.sh

# 3. 运行回归测试
npx vitest run tests/__tests__/scripts/gitignore-coverage.test.ts
```

---

## 五、常见误操作及排查解决指南

### 5.1 误操作：使用 `git add -A` 导致 IDE 文件被暂存

**现象**：执行 `git add -A` 后，`.vscode/settings.json` 等文件出现在暂存区。

**排查**：
```bash
git diff --cached --name-only | findstr /i "^\.vscode/ ^\.idea/ ^\.workbuddy/"
```

**解决**：
```bash
git reset HEAD .vscode/ .idea/ .workbuddy/
# 或精准移除单个文件
git rm --cached .vscode/settings.json
```

**预防**：禁止使用 `git add -A`，改用 `git add <具体文件路径>` 或 `git commit --only <paths>`。

### 5.2 误操作：.gitignore 规则不生效

**现象**：已在 .gitignore 添加 `.vscode/`，但 `git status` 仍显示 `.vscode/settings.json` 为修改状态。

**根因**：文件已被 Git 追踪，.gitignore 只对未追踪文件生效。

**排查**：
```bash
git ls-files .vscode/
# 如果有输出，说明文件仍在追踪中
```

**解决**：
```bash
git rm --cached .vscode/settings.json
git commit -m "chore: 移除 .vscode/ 追踪"
# 此后 .gitignore 规则生效
```

### 5.3 误操作：`.trae/` 被误加入 .gitignore

**现象**：`.trae/skills/skill-registry.json` 无法被 `git add` 追踪。

**排查**：
```bash
git check-ignore -v .trae/skills/skill-registry.json
# 输出 .gitignore:XX:.trae/ 说明被误忽略
```

**解决**：
1. 从 .gitignore 移除 `.trae/` 或 `.trae` 规则
2. 如果是注释行 `# .trae/` 旁边的规则误匹配，检查上下文
3. 确认 `.trae/` 是团队共享资产，必须保留追踪

**验证**：
```bash
git check-ignore -v .trae/skills/skill-registry.json
# 期望 exit 1（未被忽略）
```

### 5.4 误操作：pre-commit 钩子 BLOCK 但不知原因

**现象**：`git commit` 时出现 `❌ .gitignore 覆盖率审计失败`。

**排查**：查看钩子输出的具体检查项：
```
[1/3] 检查暂存区是否包含 IDE 私有路径文件...  ← 看这步是否 ❌
[2/3] 检查 .gitignore 覆盖率...                ← 或这步
[3/3] 检查保留追踪路径未被误忽略...             ← 或这步
```

**解决**：
- **检查 1 失败**：暂存区有 IDE 文件 → `git rm --cached <file>`
- **检查 2 失败**：.gitignore 缺少规则 → 在 line 263-268 段添加对应规则
- **检查 3 失败**：.trae/ 被误忽略 → 从 .gitignore 移除 .trae/ 相关规则

### 5.5 误操作：`git rm` 误删工作区文件

**现象**：执行 `git rm .vscode/settings.json`（未加 `--cached`）后，工作区文件被删除。

**排查**：
```bash
git status .vscode/settings.json
# 显示 deleted: .vscode/settings.json
```

**解决**：
```bash
# 从最近一次提交恢复文件
git checkout HEAD -- .vscode/settings.json
# 如果从未提交过，从 IDE 重新生成配置
```

**预防**：移除追踪时务必使用 `git rm --cached`，保留工作区文件。

### 5.6 误操作：.gitignore 规则顺序导致覆盖

**现象**：添加了 `!src/important.config.json` 取反规则，但文件仍被忽略。

**根因**：.gitignore 规则按顺序匹配，如果父目录被忽略，子文件的取反规则无效。

**示例**：
```
src/              # 忽略整个 src 目录
!src/important.config.json  # ❌ 无效，父目录已被忽略
```

**解决**：精确到文件级别，避免忽略整个目录：
```
src/*.log           # 只忽略 src 下的 .log 文件
!src/important.config.json  # ✅ 有效
```

### 5.7 误操作：全局 .gitignore 与项目 .gitignore 冲突

**现象**：同事的 `git status` 不显示某些文件，但你的显示。

**排查**：
```bash
git config --get core.excludesfile
# 查看全局 .gitignore 路径
```

**解决**：
1. 确认全局 .gitignore 不包含项目需要追踪的文件
2. 项目级 .gitignore 优先级高于全局
3. 团队统一使用项目级 .gitignore，不依赖全局配置

---

## 六、治理效果与持续维护

### 6.1 治理效果指标

| 指标 | 治理前 | 治理后 |
|------|--------|--------|
| 被追踪的 IDE 文件 | 8 个 | 0 个 |
| .gitignore IDE 规则 | 2 条 | 8 条 |
| 自动化拦截机制 | 无 | 3 项 BLOCK 检查 |
| 回归测试 | 0 | 14 用例 |
| 团队文档 | 无 IDE 治理段 | §2.2 完整段落 |

### 6.2 持续维护要求

1. **新增 IDE 工具时**：按 §4.1 检查清单执行
2. **每月审计**：运行 `sh scripts/audit/audit-gitignore-coverage.sh` 确认规则完整
3. **CI 集成**：pre-commit 钩子已自动运行，无需额外配置
4. **回归测试**：`npx vitest run tests/__tests__/scripts/gitignore-coverage.test.ts` 确认 14 用例通过

### 6.3 关联资源

| 资源 | 路径 | 用途 |
|------|------|------|
| 审计脚本 | [scripts/audit/audit-gitignore-coverage.sh](../../scripts/audit/audit-gitignore-coverage.sh) | pre-commit 集成，3 项 BLOCK 检查 |
| 回归测试 | [tests/__tests__/scripts/gitignore-coverage.test.ts](../../tests/__tests__/scripts/gitignore-coverage.test.ts) | 14 用例验证规则持续有效 |
| 团队文档 | [docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md §2.2](../guides/how-to/FILE-MANAGEMENT-GUIDE.md#L117-L146) | IDE 追踪治理规范 |
| 变更报告 | [docs/reports/gitignore-governance-diff-report-2026-08-05.md](../reports/gitignore-governance-diff-report-2026-08-05.md) | 治理前后对比详情 |
| pre-commit 钩子 | [.husky/pre-commit §2.5](../../.husky/pre-commit) | BLOCK 步骤集成 |
| push 排查指南 | [docs/wiki/git-push-failure-troubleshooting-guide-2026-08-05.md](git-push-failure-troubleshooting-guide-2026-08-05.md) | 网络错误分类与重试策略 |

---

## 七、Push 实战经验（2026-08-05）

### 7.1 故障复盘

本次治理 commit `64754be9` 提交后，连续 3 次 push 失败：

| # | 时间 | 错误 | 根因 |
|---|------|------|------|
| 1 | 22:16 | `Connection was reset` | 连接建立后被重置（GFW 干扰） |
| 2 | 22:17 | `Connection was reset` | 同上，重试无效 |
| 3 | 22:39 | `Failed to connect to github.com:443 after 21053ms` | 连接阶段就超时（封锁加深） |

**诊断**：`Test-NetConnection github.com -Port 443` → `False`，确认 github.com:443 不可达。

### 7.2 关键教训

1. **commit 与 push 解耦**：`git commit` 成功后提交内容在本地安全保存，push 失败不会丢失工作。治理提交 `64754be9` 已在本地，待网络恢复后 `git push` 即可。
2. **工作流可重入**：根据 project_memory 约束，提交工作流必须可重入和幂等。push 可多次重试，不会产生重复提交。
3. **网络诊断先行**：push 失败时先用 `Test-NetConnection` 诊断，区分网络问题 vs 认证问题 vs 钩子问题。
4. **代理配置**：github.com 在部分网络环境下需要配置 HTTP 代理（`git config --global http.proxy http://127.0.0.1:7890`）。

### 7.3 推荐的 push 前预检

```powershell
# 快速检测 GitHub 连通性（5 秒）
Test-NetConnection github.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
# True → 可以 push
# False → 需配置代理，详见 push 排查指南
```

### 7.4 详细排查资源

完整的 push 失败排查流程、5 类错误分类、3 种重试策略，详见：
→ [Git Push 失败排查指南](git-push-failure-troubleshooting-guide-2026-08-05.md)
