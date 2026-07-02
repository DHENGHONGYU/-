# V9 文件管理规范

> **版本**: v1.0.0 | **日期**: 2026-07-02
> **适用范围**: 智能投研复盘系统V9 全体开发者及 AI 辅助工具

---

## 一、文件归位规则

| 文件类型 | 存放目录 | 说明 |
|---|---|---|
| 源代码 | `src/` | 按分层规则放入 `core/`、`data/`、`services/`、`store/`、`pages/`、`components/` |
| 单元测试 | `tests/` 或 `src/**/*.test.ts` | 与源文件同目录的测试需以 `.test.ts`/`.test.tsx` 结尾 |
| E2E 测试 | `e2e/` | Playwright `.spec.ts` 文件 |
| 脚本工具 | `scripts/` | 构建、审计、数据迁移脚本 |
| 文档规范 | `docs/` | 需求、架构、数据字典、实现文档 |
| 审计报告 | `docs/audit/` | 质量审计、架构扫描报告 |
| 临时输出 | `temp/` | 已在 `.gitignore` 中忽略 |
| AI Skill | `.agents/skills/` | AI 辅助技能定义 |
| CI/CD | `.github/workflows/` | GitHub Actions 工作流 |

### 禁止事项

- **禁止**在仓库根目录直接创建 `.ts`、`.tsx`、`.ps1`、`.py` 脚本文件
- **禁止**在仓库根目录直接创建报告文件（`.md`、`.json`、`.txt`）
- **禁止**将工具运行输出（`tsc`/`eslint`/`vitest`）重定向到仓库根目录

---

## 二、`.gitignore` 维护规则

### 2.1 新增忽略规则

当引入新的工具或生成新的产物类别时，必须同步更新 `.gitignore`：

1. 在 `.gitignore` 中添加对应的忽略规则
2. 根目录规则必须带前导 `/`（如 `/tsc_errors.txt`），避免误伤子目录同名文件
3. 添加分组注释说明忽略类别

### 2.2 已配置的忽略类别

| 类别 | 规则示例 | 说明 |
|---|---|---|
| 依赖 | `node_modules/` | npm 依赖 |
| 构建产物 | `dist/` | Vite 构建输出 |
| 环境配置 | `.env`, `.env.local` | 含敏感信息的本地配置 |
| IDE 产物 | `.vscode/`, `.idea/`, `.trae/` | 本地 IDE 配置 |
| 日志 | `*.log`, `logs/` | 运行日志 |
| 测试覆盖 | `coverage/` | 测试覆盖率报告 |
| Playwright | `/playwright-report/`, `.playwright-mcp/` | E2E 测试产物 |
| 临时目录 | `temp/` | 临时文件 |
| 根目录报告 | `/tsc_*.txt`, `/*_report.json` | 质量工具输出 |
| HTML 报告包 | `/v9-*-report/` | 生成式自包含报告 |
| 根目录脚本 | `/run-*.ps1`, `/test_*.py` | 一次性调试脚本 |

---

## 三、提交前检查清单

每次提交前必须通过以下三项验证：

```powershell
# 1. TypeScript 类型检查（0 errors）
npx tsc --noEmit

# 2. ESLint 检查（0 errors，warnings 可接受）
npm run lint

# 3. 架构分层审计（0 violations, 0 warnings）
npm run audit:layers
```

### 提交规范

- 遵循 Conventional Commits 格式：`<type>[scope]: <description>`
- type 可选：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`
- description 使用祈使句（英文）或动宾短语（中文），不超过 72 字符

---

## 四、定期审计

### 4.1 未跟踪文件检查

每月执行一次：

```powershell
git status --short | Select-String -Pattern '^\?\?'
```

若结果非空，需分析未跟踪文件来源并按本规范处置。

### 4.2 `.gitignore` 有效性检查

每季度执行一次：

```powershell
# 检查是否有已跟踪文件应被忽略
git ls-files | ForEach-Object { git check-ignore -q $_ }
```

---

## 五、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0.0 | 2026-07-02 | 初始版本：文件归位、.gitignore 维护、提交前检查、定期审计 |
