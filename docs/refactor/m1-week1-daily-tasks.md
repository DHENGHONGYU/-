# M1 里程碑 — 第 1 周每日开发任务清单

| 字段 | 值 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-08-04 |
| 里程碑 | M1：规范与门禁就位 |
| 时间范围 | 第 1 周（5 个工作日，每天 2 工时） |
| 上游方案 | [p0-refactor-plan.md](./p0-refactor-plan.md) §四 |
| 关联 Issue | Issue #1, Issue #2（部分） |
| 完成标志 | A1-A9 + B8-B9 全部完成，端到端验证通过 |

---

## 一、M1 里程碑范围回顾

| 任务组 | 任务编号 | 描述 | 工时 |
|--------|---------|------|------|
| A 组（类型契约同步） | A1-A9 | 规范文档化 + Pre-commit Hook + CI Job | 9h |
| B 组（ESLint 升级，部分） | B8-B9 | 规则升级为 error + lint 脚本收紧 | 1h |
| **合计** | 11 个原子任务 | | **10h** |

---

## 二、每日任务清单

### Day 1（周一）— 规范文档化

**目标**：完成 A1-A3，建立类型契约三方同步规范的文档基础。

| 时段 | 任务 ID | 任务 | 产出物 | 验收 |
|------|---------|------|--------|------|
| 09:00-10:00 | A1 | 在 `CONTRIBUTING.md` 新增 §3.4 "类型变更三同步规则"章节 | CONTRIBUTING.md 更新 | 章节包含三方定义、同步要求、违规示例 |
| 10:00-10:30 | A2 | 修改 PR 模板添加同步 checkbox | `.github/pull_request_template.md` | 新增 checkbox："✅ 已确认类型变更三方同步" |
| 10:30-11:00 | A3 | 编写类型契约治理 wiki | `docs/guides/type-contract-governance.md` | 包含规范、案例、FAQ |

**当日工时**：2h
**提交规范**：`docs(governance): 新增类型契约三方同步规范`

**当日验收 checklist**：
- [ ] CONTRIBUTING.md §3.4 章节合并至主分支
- [ ] PR 模板含 checkbox
- [ ] wiki 文档可访问

---

### Day 2（周二）— Pre-commit Hook 增强

**目标**：完成 A4-A6，本地 pre-commit hook 检测类型变更并触发 tsc:test。

| 时段 | 任务 ID | 任务 | 产出物 | 验收 |
|------|---------|------|--------|------|
| 09:00-10:30 | A4 | 修改 `.husky/pre-commit` 添加类型变更检测逻辑 | .husky/pre-commit 更新 | 检测 `src/types/**/*.ts` 变更时触发 `npm run tsc:test` |
| 10:30-11:00 | A5 | 配置 lint-staged 对 `src/types/**` 触发 tsc:prod | `.lintstagedrc` 或 package.json | lint-staged 配置含 types 路径规则 |
| 11:00-11:30 | A6 | 本地验证 pre-commit 阻断效果 | 验证记录 | 故意制造类型漂移，提交被阻断 |
| 11:30-12:00 | - | 缓冲 / 文档化 | `docs/guides/pre-commit-types-check.md` | 记录机制原理与故障排查 |

**当日工时**：2h（含 0.5h 缓冲）
**提交规范**：`chore(husky): pre-commit 增强类型变更检测`

**A4 实现要点**：
```bash
# .husky/pre-commit 新增片段
TYPE_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "^src/types/.*\.ts$" || true)
if [ -n "$TYPE_FILES" ]; then
  echo "[pre-commit] 检测到类型定义变更，触发 tsc:test ..."
  npm run tsc:test || { echo "[pre-commit] ❌ tsc:test 失败，类型契约可能漂移"; exit 1; }
  echo "[pre-commit] ✅ tsc:test 通过"
fi
```

**当日验收 checklist**：
- [ ] pre-commit 脚本含类型变更检测
- [ ] 修改 `src/types/**/*.ts` 后提交，自动触发 tsc:test
- [ ] 测试用例类型不匹配时，提交被阻断
- [ ] 故意制造漂移的验证记录文档化

---

### Day 3（周三）— CI Job 独立化

**目标**：完成 A7-A9，GitHub Actions 新增独立的 types-check Job。

| 时段 | 任务 ID | 任务 | 产出物 | 验收 |
|------|---------|------|--------|------|
| 09:00-10:30 | A7 | 新增 GitHub Actions `types-check` Job | `.github/workflows/ci.yml` 更新 | Job 独立执行 tsc:prod + tsc:test |
| 10:30-11:00 | A8 | 配置分支保护必需状态检查 | GitHub 仓库设置 | types-check 设为必需检查 |
| 11:00-11:30 | A9 | 端到端验证：故意制造类型漂移测试 CI 阻断 | 验证 PR | PR 因 types-check 失败被阻断合并 |
| 11:30-12:00 | - | 缓冲 / CI 配置文档化 | `docs/guides/ci-types-check.md` | 记录 Job 配置与故障排查 |

**当日工时**：2h（含 0.5h 缓冲）
**提交规范**：`ci(types-check): 新增独立类型检查 Job`

**A7 实现要点**：
```yaml
# .github/workflows/ci.yml 新增 Job
types-check:
  name: TypeScript Type Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci --ignore-scripts
    - run: npm run tsc:prod
    - run: npm run tsc:test
```

**当日验收 checklist**：
- [ ] GitHub Actions types-check Job 配置完成
- [ ] Job 在 PR 上自动触发
- [ ] Job 失败时 PR 无法合并（分支保护生效）
- [ ] Job 平均执行时间 < 2 分钟
- [ ] 故意制造漂移的验证 PR 已创建并测试

---

### Day 4（周四）— ESLint 规则升级（B 组部分）

**目标**：完成 B8-B9，将 ESLint `no-unsafe-*` 系列规则升级为 error。

> **前置依赖**：B1-B7（批量修复 unsafe 用法）属于 M2 范围，本日仅升级规则配置，
> 历史违规治理在 M2 完成。**若当前 unsafe 违规数 > 50，本日任务需调整**。

| 时段 | 任务 ID | 任务 | 产出物 | 验收 |
|------|---------|------|--------|------|
| 09:00-10:00 | B8 | 升级 `eslint.config.js` 5 个 unsafe 规则为 error | eslint.config.js 更新 | 5 个规则均为 error |
| 10:00-10:30 | B9 | 修改 package.json lint 脚本为 --max-warnings 0 | package.json 更新 | lint 脚本无 --max-warnings 或为 0 |
| 10:30-11:30 | - | 评估当前 unsafe 违规数 + 制定 M2 修复计划 | `docs/reports/eslint-unsafe-baseline.md` | 报告含违规数、按目录分布、修复优先级 |
| 11:30-12:00 | - | 缓冲 / 规则文档化 | `docs/guidelines/eslint-rules.md` | 记录 5 个 unsafe 规则的使用指南 |

**当日工时**：2h（含 0.5h 缓冲）
**提交规范**：`chore(eslint): 升级 no-unsafe-* 规则为 error`

**B8 实现要点**：
```javascript
// eslint.config.js
'@typescript-eslint/no-unsafe-member-access': 'error',
'@typescript-eslint/no-unsafe-argument': 'error',
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-return': 'error',
```

**重要决策点**：
- 若 B1 基线评估显示违规数 > 50，**B8-B9 推迟到 M2 末尾**（避免阻塞团队提交）
- 替代方案：本日改为执行 B1-B2（基线评估），将 B8-B9 移至 M2 末尾

**当日验收 checklist**：
- [ ] eslint.config.js 5 个 unsafe 规则为 error（或决策推迟并记录理由）
- [ ] package.json lint 脚本收紧
- [ ] 基线报告生成（违规数 + 分布）
- [ ] M2 修复计划草案完成

---

### Day 5（周五）— M1 整体验收 + 缓冲

**目标**：M1 整体验收，处理 Day 1-4 遗留问题，准备 M2 启动。

| 时段 | 任务 | 产出物 | 验收 |
|------|------|--------|------|
| 09:00-10:00 | M1 端到端验证 | 验证报告 | 完整流程：类型变更 → pre-commit 阻断 → CI 阻断 |
| 10:00-10:30 | 处理 Day 1-4 遗留任务 | - | 所有 Day 1-4 checklist 完成 |
| 10:30-11:00 | 更新 p0-refactor-plan.md 标记 M1 完成 | plan 更新 | M1 任务标 ✅ |
| 11:00-11:30 | M2 启动准备 | M2 任务认领 | B3 修复脚本设计草案 |
| 11:30-12:00 | 团队同步会 / 知识分享 | 会议纪要 | 团队对齐 M1 成果与 M2 计划 |

**当日工时**：2h（含 0.5h 缓冲）

**M1 整体验收 checklist**：
- [ ] **规范层**：CONTRIBUTING.md §3.4 + PR 模板 + wiki 文档齐全
- [ ] **本地门禁**：pre-commit 检测类型变更并触发 tsc:test
- [ ] **CI 门禁**：types-check Job 独立运行且为必需检查
- [ ] **ESLint 门禁**：5 个 unsafe 规则为 error（或明确推迟理由）
- [ ] **端到端验证**：故意制造类型漂移，pre-commit + CI 双重阻断生效
- [ ] **文档齐全**：所有机制有对应的 docs/guides/ 文档
- [ ] **团队同步**：M1 成果分享，M2 计划对齐

---

## 三、关键交付物清单

### 3.1 代码与配置

| 文件路径 | 类型 | 关联任务 |
|---------|------|---------|
| `CONTRIBUTING.md` | 文档更新 | A1 |
| `.github/pull_request_template.md` | 模板更新 | A2 |
| `docs/guides/type-contract-governance.md` | 新建文档 | A3 |
| `.husky/pre-commit` | 脚本更新 | A4 |
| `.lintstagedrc` 或 `package.json` | 配置更新 | A5 |
| `docs/guides/pre-commit-types-check.md` | 新建文档 | A6 |
| `.github/workflows/ci.yml` | CI 配置 | A7 |
| `docs/guides/ci-types-check.md` | 新建文档 | A9 |
| `eslint.config.js` | 配置更新 | B8 |
| `package.json` | 脚本更新 | B9 |
| `docs/guidelines/eslint-rules.md` | 新建文档 | B8 |
| `docs/reports/eslint-unsafe-baseline.md` | 基线报告 | B1（Day 4 兜底） |

### 3.2 验证 PR

| PR 标题 | 目的 | 关联任务 |
|---------|------|---------|
| `test(types-check): 故意制造类型漂移验证 CI 阻断` | 验证 types-check Job | A9 |
| `test(pre-commit): 故意制造类型漂移验证本地阻断` | 验证 pre-commit（本地不提 PR） | A6 |

---

## 四、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| pre-commit 在 Windows 上执行 bash 脚本兼容性问题 | 中 | 高 | 使用 `bash` 显式调用；测试 Git Bash + WSL 两种环境 |
| GitHub Actions types-check Job 执行时间过长 | 低 | 中 | 使用 npm cache；并行执行 tsc:prod 和 tsc:test |
| 分支保护规则需要仓库管理员权限 | 中 | 高 | 提前与仓库管理员协调；准备权限申请文档 |
| ESLint unsafe 违规数过多导致 B8-B9 无法当天完成 | 中 | 中 | Day 4 改为执行 B1-B2 基线评估；B8-B9 推迟至 M2 |
| 团队对 pre-commit 阻断不适应 | 中 | 低 | Day 5 知识分享会详细讲解；提供 `--no-verify` 逃生口文档 |

---

## 五、每日 standup 模板

```markdown
## Day N Standup (YYYY-MM-DD)

### 昨日完成
- [ ] 任务 ID + 简述

### 今日计划
- [ ] 任务 ID + 简述

### 阻塞与风险
- [ ] 描述 + 需要的支持

### 验收状态
- 当日 checklist 完成度: X/Y
```

---

## 六、M1 完成后的下一步

M1 完成后立即启动 M2（ESLint unsafe 治理，第 2 周）：

| M2 任务 | 工时 | 关联 Issue |
|---------|------|-----------|
| B1-B2 基线评估（若 Day 4 未完成） | 2h | #2 |
| B3 编写 fix-unsafe-member-access.cjs | 2h | #2 |
| B4-B7 分批修复 unsafe 用法 | 6h | #2 |
| B10 处理复杂 unsafe 用例 | 4h | #2 |
| B11 端到端验证 | 1h | #2 |
| **M2 合计** | **15h** | #2 |

详细方案见 [p0-refactor-plan.md §二](./p0-refactor-plan.md#二p0-beslint-no-unsafe-member-access-升级为-error)
