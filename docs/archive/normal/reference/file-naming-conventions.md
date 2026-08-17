---
title: file-naming-conventions
type: reference
domain: project
phase: development
tier: important
status: active
maintainer: V9 Architecture Team
summary: "统一项目中所有文件和目录的命名规则，确保代码库的一致性和可维护性。"
tags: [spec, standards, reference, project, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-PROJ-093
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 文件命名规范（File Naming Conventions）

> **定位**：统一项目中所有文件和目录的命名规则，确保代码库的一致性和可维护性。
> **状态**：? P0 正式规范
> **生效日期**：2026-07-14

---

## 1. 通用规则

### 1.1 基本原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **小写优先** | 文件名全部使用小写字母 | ? `user-store.ts` |
| **连字符分隔** | 多单词用连字符 `-` 分隔 | ? `stock-score-card.tsx` |
| **禁止空格** | 不使用空格或下划线 | ? `stock_score_card.tsx` |
| **语义清晰** | 文件名应反映文件内容和用途 | ? `fetch-stock-data.ts` |
| **避免缩写** | 使用完整单词，除非是通用缩写 | ? `configuration.ts` ? `config.ts` |

### 1.2 文件扩展名

| 类型 | 扩展名 | 示例 |
|------|--------|------|
| TypeScript | `.ts` | `user-service.ts` |
| TypeScript React | `.tsx` | `stock-card.tsx` |
| JavaScript | `.js` | `config.js` |
| JavaScript React | `.jsx` | `app.jsx` |
| CSS | `.css` | `styles.css` |
| SCSS | `.scss` | `theme.scss` |
| Markdown | `.md` | `README.md` |
| JSON | `.json` | `package.json` |
| Python | `.py` | `data-processor.py` |

---

## 2. 文件类型命名规则

### 2.1 组件文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 原子组件 | `<component-name>.tsx` | `button.tsx`, `input.tsx` |
| 复合组件 | `<component-name>-<part>.tsx` | `stock-card-header.tsx`, `stock-card-body.tsx` |
| 页面组件 | `<page-name>.page.tsx` | `dashboard.page.tsx` |
| 布局组件 | `<layout-name>.layout.tsx` | `main-layout.layout.tsx` |
| 高阶组件 | `with-<enhancement>.tsx` | `with-auth.tsx` |
| Hook | `use-<hook-name>.ts` | `use-stock-data.ts`, `use-auth.ts` |

### 2.2 数据层文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| Store | `<domain>-store.ts` | `user-store.ts`, `stock-store.ts` |
| Service | `<domain>-service.ts` | `stock-service.ts`, `api-service.ts` |
| 类型定义 | `<domain>-types.ts` | `stock-types.ts`, `user-types.ts` |
| 常量 | `<domain>-constants.ts` | `stock-constants.ts`, `api-constants.ts` |
| 工具函数 | `<domain>-utils.ts` | `stock-utils.ts`, `date-utils.ts` |

### 2.3 脚本文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 审计脚本 | `audit-<topic>.ts` | `audit-layer-calls.ts`, `audit-hardcode.ts` |
| 验证脚本 | `verify-<topic>.ts` | `verify-all-routes.ts`, `verify-design-tokens.ts` |
| 生成脚本 | `generate-<output>.ts` | `generate-tokens.ts`, `generate-store-graph.ts` |
| 修复脚本 | `fix-<issue>.ts` | `fix-layer-violations.ts`, `fix-doc-refs.ts` |
| 构建脚本 | `build-<artifact>.ts` | `build-health-report.ts`, `build-ai-memory-index.ts` |

### 2.4 文档文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 说明文档 | `README.md` | `README.md` |
| 规范文档 | `<topic>-conventions.md` | `file-naming-conventions.md` |
| 技术决策 | `adr-<number>-<topic>.md` | `../explanation/adr-001-pure-frontend-architecture.md` |
| 报告文档 | `<topic>-report.md` | `../reports/audit/code-quality-audit-report.md` |
| 规范文档 | `<topic>-spec.md` | `data-flow-spec.md` |

---

## 3. 目录命名规则

### 3.1 通用目录

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 功能模块 | 小写连字符 | `stock-analysis`, `data-collection` |
| 工具目录 | `utils`, `helpers`, `lib` | `utils/`, `helpers/` |
| 测试目录 | `__tests__`, `tests` | `__tests__/`, `tests/` |
| 配置目录 | `config`, `constants` | `config/`, `constants/` |
| 文档目录 | `docs` | `docs/` |

### 3.2 特殊目录

| 目录名 | 用途 | 说明 |
|--------|------|------|
| `_debug/` | 调试工具 | 以下划线开头表示内部使用 |
| `_mocks/` | Mock 数据 | 以下划线开头表示内部使用 |
| `_templates/` | 模板文件 | 以下划线开头表示内部使用 |
| `archive/` | 归档文件 | 存放历史版本或废弃文件 |
| `assets/` | 静态资源 | 存放图片、图标、字体等 |

---

## 4. 文件序号命名规范

### 4.1 序号格式

文件序号采用 **两位数字** 前缀，格式为 `XX-<filename>`。

### 4.2 序号使用场景

| 场景 | 示例 | 说明 |
|------|------|------|
| 文档章节 | `../../README.md`, `../team-handbook/02-architecture.md` | 按逻辑顺序编号 |
| 阶段成果 | `../00-meta/development-log.md`, `../00-meta/development-log.md` | 按阶段编号 |
| 版本管理 | `./release-notes.md` | 按版本编号 |

### 4.3 序号规则

1. **连续编号**：同一目录下的序号应连续，不得跳号
2. **保持顺序**：序号应反映文档的逻辑顺序
3. **动态调整**：新增文件时按逻辑位置插入，后续序号自动调整
4. **避免重复**：同一目录下不得有重复序号

### 4.4 序号规范检查表

| 检查项 | 要求 | 示例 |
|--------|------|------|
| 序号位数 | 统一使用两位数字 | ? `01-` ? `1-` |
| 序号分隔 | 使用连字符 `-` 分隔 | ? `../../README.md` ? `../../README.md` |
| 序号连续性 | 同一目录下序号连续 | ? `01-`, `02-`, `03-` ? `01-`, `03-` |
| 序号唯一性 | 同一目录下序号唯一 | ? 每个序号只出现一次 |

---

## 5. 特殊命名约定

### 5.1 私有/内部文件

以下划线 `_` 开头的文件表示内部使用，不应被外部模块直接导入。

| 类型 | 示例 | 说明 |
|------|------|------|
| 内部工具 | `_utils.ts`, `_constants.ts` | 仅在模块内部使用 |
| 测试辅助 | `_test-helpers.ts` | 仅用于测试 |
| 配置文件 | `_config.ts` | 仅在模块内部使用 |

### 5.2 环境相关文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 环境配置 | `.env.<environment>` | `.env.development`, `.env.production` |
| 环境变量 | `env-<environment>.ts` | `env-development.ts`, `env-production.ts` |

### 5.3 测试文件

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 单元测试 | `<filename>.test.ts` | `user-service.test.ts` |
| 集成测试 | `<filename>.spec.ts` | `stock-score.spec.ts` |
| 类型测试 | `<filename>.types.test.ts` | `user-types.types.test.ts` |

---

## 6. 命名检查清单

### 6.1 文件创建前检查

- [ ] 文件名是否符合小写连字符规则？
- [ ] 文件扩展名是否正确？
- [ ] 文件名是否语义清晰？
- [ ] 是否避免了不必要的缩写？

### 6.2 目录创建前检查

- [ ] 目录名是否符合小写连字符规则？
- [ ] 是否符合现有目录结构？
- [ ] 是否需要序号前缀？

### 6.3 序号使用检查

- [ ] 序号位数是否统一（两位数字）？
- [ ] 序号是否连续？
- [ ] 序号是否唯一？
- [ ] 序号是否反映逻辑顺序？

---

## 7. 自动化检查

### 7.1 命名检查脚本

项目提供以下脚本检查命名规范：

```bash
# 检查文件命名规范
npm run audit:naming

# 检查文档序号规范
npm run audit:doc-numbers
```

### 7.2 CI/CD 集成

命名规范检查应集成到 CI/CD 流水线中，确保所有提交的代码符合命名规范。

---

## 8. 规范演进

### 8.1 版本管理

本规范采用版本管理，版本号格式为 `vX.Y.Z`：

- **X**：重大变更（不兼容的规则变更）
- **Y**：新增规则（向后兼容）
- **Z**：规则修订（向后兼容）

### 8.2 变更流程

1. 提出变更建议（PR 或 Issue）
2. 团队讨论并达成共识
3. 更新规范文档
4. 更新相关自动化检查脚本
5. 通知团队成员

---

## 附录：命名规范对照表

### 错误 vs 正确示例

| 错误命名 | 正确命名 | 说明 |
|----------|----------|------|
| `UserStore.ts` | `user-store.ts` | 应为小写连字符 |
| `stockScoreCard.tsx` | `stock-score-card.tsx` | 应为小写连字符 |
| `config.js` | `configuration.js` | 避免缩写 |
| `my_component.jsx` | `my-component.jsx` | 使用连字符而非下划线 |
| `../../README.md` | `0../../README.md` | 序号应为两位数字 |
| `../../README.md` | `../../README.md` | 序号后使用连字符 |

### 文件名长度建议

| 文件类型 | 建议最大长度 | 说明 |
|----------|--------------|------|
| 组件文件 | 50 字符 | 过长的文件名难以阅读 |
| 数据层文件 | 60 字符 | 可适当长于组件文件 |
| 脚本文件 | 70 字符 | 脚本文件名可能包含多个单词 |
| 文档文件 | 80 字符 | 文档文件名可包含描述性内容 |

---

_规范冲突时以 `../../AGENTS.md` 为准；本文随规范演进持续更新。_
