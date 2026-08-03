---
doc_id: V9-DOC-GOV-003
title: V9 文档维护规范 — 创建、链接、检查、更新全生命周期管理
status: active
version: v1.0.0
last_updated: 2026-08-03
code_version: 2.0.0
category: governance
tier: mandatory
maintainer: V9 Dev Team
tags: [governance, documentation, maintenance, broken-links, quality-gate]
related_docs: [V9-DOC-GOV-001, V9-DOC-GOV-002]
summary: "基于 2026-08-03 文档治理工作提炼的全面文档维护规范，覆盖创建标准、链接管理、定期检查、更新流程、版本控制、质量审核、断链预防、违规处理与持续改进。"
---

# V9 文档维护规范 — 创建、链接、检查、更新全生命周期管理

> **适用范围**: FinSightV9 项目 `docs/` 目录下所有 Markdown 文档
> **强制等级**: mandatory（违规将阻断提交）
> **关联文档**: [breaking-changes-report-2026-08-03.md](breaking-changes-report-2026-08-03.md) | [governance-summary-2026-08-03.md](governance-summary-2026-08-03.md)

---

## 1. 文档创建标准

### 1.1 Frontmatter 必备字段

所有新建文档必须包含完整的 YAML Frontmatter：

```yaml
---
doc_id: V9-DOC-<CATEGORY>-<NNN>       # 唯一标识，分类编码见 §1.2
title: <文档标题>                       # 完整中文标题
status: active | draft | deprecated    # 文档状态
version: v<MAJOR>.<MINOR>.<PATCH>      # 语义化版本
last_updated: YYYY-MM-DD              # 最后更新日期
code_version: <项目版本>               # 关联代码版本
category: <分类>                       # 见 §1.2
tier: mandatory | standard | advisory # 强制等级
maintainer: <维护人>                   # 维护责任人
tags: [tag1, tag2]                     # 标签数组
related_docs: [DOC-ID-1, DOC-ID-2]    # 关联文档 ID 列表
summary: "<一句话摘要>"                # 50 字以内
---
```

### 1.2 分类编码体系

| 编码前缀 | 分类 | 说明 | 存放目录 |
|----------|------|------|----------|
| V9-DOC-ARCH | 架构文档 | 架构标准、设计文档 | docs/ 根目录或 architecture/ |
| V9-DOC-REQ | 需求文档 | 产品需求、用户场景 | specs/requirements/ |
| V9-DOC-PROD | 产品文档 | 产品规格、竞品分析 | specs/product/ |
| V9-DOC-DESIGN | 设计文档 | 系统设计、UI 设计 | specs/design/ |
| V9-DOC-GOV | 治理文档 | 治理报告、规范文档 | governance/ |
| V9-DOC-OPS | 运维文档 | 部署指南、配置说明 | ops/ |
| V9-DOC-API | API 文档 | 接口文档、数据定义 | docs/ 根目录 |
| V9-DOC-TEST | 测试文档 | 测试策略、测试计划 | 04-testing/ |
| V9-DOC-PROJ | 项目管理 | 治理报告、文件结构 | 06-project-management/ |
| V9-DOC-META | 元文档 | 审计工作表、索引 | meta/ |

### 1.3 命名规范

- **英文文件名**: 所有新建文档必须使用英文文件名（kebab-case）
- **历史中文文件名**: 已存在的中文文件名文档（如 `V9数据宪法.md`）保持现状，但新建文档禁止使用中文文件名
- **编号前缀**: 根目录核心文档使用 `01-` 至 `10-` 编号前缀
- **日期后缀**: 治理报告类文档使用 `-YYYY-MM-DD` 日期后缀
- **三段式命名**: `<ID>-<主题>-<版本>.md`（如 `doc-maintenance-specification-v1.md`）

### 1.4 存放位置规则

| 文档类型 | 存放位置 | 说明 |
|----------|----------|------|
| 核心概述文档 | docs/ 根目录 | 项目愿景、功能规格、架构标准等 01-10 系列 |
| 操作指南 | docs/guides/how-to/ | 如何做类文档 |
| 参考文档 | docs/reference/ | API 参考、数据字典 |
| 教程文档 | docs/guides/tutorials/ | 入门教程 |
| 解释性文档 | docs/explanation/ | 设计决策解释 |
| 治理文档 | docs/reports/governance/ | 治理报告、维护规范 |
| 运维文档 | docs/reports/ops/ | 部署、配置、监控 |
| 归档文档 | docs/archive/ | 历史归档，不再更新 |

---

## 2. 链接管理规则

### 2.1 链接格式标准

#### 允许的链接格式

```markdown
<!-- ✅ 相对路径（推荐） -->
[文档标题](./sibling-doc.md)
[架构标准](../03-architecture-standards.md)
[源码引用](../../src/config/dbConfig.ts)

<!-- ✅ 文档内锚点 -->
[章节标题](#章节标题)

<!-- ✅ 外部 URL -->
[MDN 文档](https://developer.mozilla.org/)
```

#### 禁止的链接格式

```markdown
<!-- ❌ file:/// 绝对路径（跨用户断链） -->
[文档](file:///c:/Users/<user>/Documents/.../docs/doc.md)
[文档](file:///g:/FinSightV9/docs/doc.md)

<!-- ❌ file://// 格式 -->
[源码](file:////src/lib/logger.ts)

<!-- ❌ computer:// 格式 -->
[文件](computer://xxx)

<!-- ❌ 带盘符的绝对路径 -->
[文档](C:/Users/<user>/docs/doc.md)
[文档](G:/FinSightV9/src/lib/logger.ts)
```

### 2.2 链接计算规则

相对路径计算基于**当前文件所在目录**：

| 当前文件位置 | 目标文件位置 | 相对路径前缀 |
|-------------|-------------|-------------|
| docs/ 根目录 | docs/ 根目录 | `./` |
| docs/ 根目录 | src/ | `../src/` |
| docs/ 根目录 | 项目根目录 | `../` |
| docs/sub/ | docs/ 根目录 | `../` |
| docs/sub/sub/ | src/ | `../../../src/` |
| docs/sub/ | docs/sub/ | `./` |

### 2.3 链接验证要求

- **新建文档**: 所有链接必须经 Grep 验证目标文件存在
- **移动文件**: 移动后必须更新所有指向该文件的链接
- **删除文件**: 删除前必须确认无活跃文档引用（archive/ 除外）
- **批量重命名**: 重命名后必须运行 `audit:docs` 检查引用完整性

---

## 3. 定期检查机制

### 3.1 检查周期

| 检查项 | 频率 | 命令 | 阻断等级 |
|--------|------|------|----------|
| file:/// 绝对路径扫描 | 每次提交 | Grep `file:///[a-z]:/` | P0 阻断 |
| 文档同步审计 | 每次提交 | `npm run audit:docs` | P1 阻断 |
| 文档门禁检查 | 每次提交 | `npm run doc:gate` | P1 阻断 |
| 文档-代码双向完整性 | 每周 | `npm run audit:doc-integrity` | P2 告警 |
| 文档目录-内容匹配 | 每周 | `npm run audit:path-match` | P2 告警 |
| 文档保鲜度评分 | 每月 | `npm run doc:freshness` | P3 提示 |
| 归档目录清理审计 | 每季度 | 人工审核 | P3 提示 |
| 重定向映射审计 | 每季度 | 人工审核 `_redirect-map.json` | P3 提示 |

### 3.2 检查脚本

```bash
# 快速断链扫描（pre-commit 已内置）
grep -rn "file:///[a-z]:/" docs/ --include="*.md" | grep -v "docs/archive/"

# 完整文档审计
npm run audit:docs
npm run audit:doc-integrity
npm run doc:gate

# 保鲜度评分
npm run doc:freshness
```

### 3.3 检查结果处置

| 结果 | 处置 |
|------|------|
| P0 阻断 | 立即修复，否则提交被拦截 |
| P1 阻断 | 立即修复，否则提交被拦截 |
| P2 告警 | 7 个工作日内修复 |
| P3 提示 | 下次迭代修复 |

---

## 4. 文档更新流程

### 4.1 标准更新流程

```
1. 创建分支  →  2. 修改文档  →  3. 更新 frontmatter  →  4. 验证链接  →  5. 提交门禁  →  6. 合并
```

#### 详细步骤

1. **创建分支**: `git checkout -b docs/update-<主题>`
2. **修改文档**: 编辑 Markdown 文件内容
3. **更新 frontmatter**:
   - `last_updated` 更新为当前日期
   - `version` 按语义化版本递增
   - 如状态变更，更新 `status` 字段
4. **验证链接**:
   - 运行 `grep -rn "file:///[a-z]:/" docs/` 确认无绝对路径
   - 运行 `npm run audit:docs` 检查文档同步
5. **提交门禁**: pre-commit 钩子自动运行 env-path-guard + audit:secrets + tsc:prod + audit:layers
6. **合并**: PR 审查通过后合并到主分支

### 4.2 紧急修复流程

对于需要立即修复的断链或错误：

1. 直接在主分支创建修复提交
2. 提交信息前缀: `fix(docs):`
3. 修复后立即运行完整文档审计
4. 通知团队相关变更

### 4.3 批量更新流程

对于涉及多个文件的批量更新（如目录重构）：

1. 创建专项分支: `git checkout -b docs/batch-<主题>`
2. 按批次提交（每批不超过 20 个文件）
3. 每批提交后运行 `npm run audit:docs`
4. 全部完成后运行 `npm run audit:doc-integrity`
5. 更新 `_redirect-map.json` 添加路径重定向

---

## 5. 版本控制要求

### 5.1 文档版本号

采用语义化版本（SemVer）：

| 版本类型 | 触发条件 | 示例 |
|----------|----------|------|
| MAJOR | 文档结构重大变更、内容重构 | v1.0.0 → v2.0.0 |
| MINOR | 新增章节、新增内容 | v1.0.0 → v1.1.0 |
| PATCH | 修正错误、更新链接、微调 | v1.0.0 → v1.0.1 |

### 5.2 提交信息规范

```
<type>(docs): <简要描述>

## 变更范围

<详细说明变更内容>

## 修复明细

| 文件 | 修改数 | 修改内容 |
|------|--------|----------|
| ... | ... | ... |

## 验证结果

- <验证项>: <结果>
```

**类型 (type)**:
- `docs`: 新增或更新文档
- `fix(docs)`: 修复文档错误（断链、错别字等）
- `refactor(docs)`: 文档重构（目录调整、合并等）
- `chore(docs)`: 文档治理（归档、清理等）

### 5.3 变更日志

- 治理类文档在文末维护"变更日志"表格
- 核心文档变更需同步更新 `docs/CHANGELOG.md`
- 每次变更在表格中记录：日期、版本、变更内容、变更人

---

## 6. 质量审核标准

### 6.1 文档质量检查清单

| 检查项 | 标准 | 验证方法 |
|--------|------|----------|
| Frontmatter 完整性 | 所有必备字段齐全 | `npm run doc:gate` |
| 链接有效性 | 无 file:/// 绝对路径 | Grep 扫描 |
| 链接可达性 | 相对路径指向的文件存在 | `npm run audit:doc-integrity` |
| 目录归属正确 | 文档在正确的分类目录 | `npm run audit:path-match` |
| 命名规范 | 英文文件名、kebab-case | `npm run file:check` |
| 内容同步 | 文档与代码一致 | `npm run audit:docs` |
| 无重复定义 | 无重复文档 | `npm run audit:doc-integrity` |
| 归档及时 | 过期文档已归档 | 每季度人工审核 |

### 6.2 质量等级

| 等级 | 标准 | 适用范围 |
|------|------|----------|
| A 级 | 全部检查项通过 | 核心文档（01-10 系列） |
| B 级 | P0/P1 检查项通过 | 活跃文档 |
| C 级 | P0 检查项通过 | 归档文档 |

### 6.3 审核流程

1. **自审**: 作者提交前自行对照检查清单
2. **门禁**: pre-commit 钩子自动检查
3. **同行评审**: PR 审查时复核
4. **定期审计**: 每月运行 `npm run audit` 全面审计

---

## 7. 断链预防措施

### 7.1 技术防护

#### 7.1.1 Pre-commit 钩子

```bash
# .husky/pre-commit 已内置
# env-path-guard: 拦截 file:/// 绝对路径
# audit:secrets: 拦截敏感信息
# audit:docs: 文档同步检查
```

#### 7.1.2 断链扫描脚本

```bash
# 快速扫描（CI 内置）
grep -rn "file:///[a-z]:/" docs/ --include="*.md" | grep -v "docs/archive/"

# 深度扫描（含锚点验证）
npm run audit:doc-integrity
```

#### 7.1.3 IDE 配置

- VS Code 安装 Markdown Link Check 扩展
- 配置 `cspell.json` 检查文档拼写
- 启用 Markdown 预览实时验证链接

### 7.2 流程防护

#### 7.2.1 文件移动 SOP

```
1. 搜索引用  →  2. 记录引用清单  →  3. 移动文件  →  4. 更新引用  →  5. 添加重定向  →  6. 验证
```

```bash
# 步骤 1: 搜索引用
grep -rn "old-path" docs/ --include="*.md"

# 步骤 5: 添加重定向到 _redirect-map.json
{
  "old-path/doc.md": "new-path/doc.md"
}

# 步骤 6: 验证
npm run audit:doc-integrity
```

#### 7.2.2 文件删除 SOP

```
1. 搜索引用  →  2. 确认无活跃引用  →  3. 归档或删除  →  4. 更新索引  →  5. 验证
```

#### 7.2.3 目录重构 SOP

```
1. 制定重构计划  →  2. 搜索受影响引用  →  3. 批量更新（每批≤20文件）
→  4. 更新 _redirect-map.json  →  5. 运行完整审计  →  6. 提交破坏性变更报告
```

### 7.3 最佳实践

1. **新建文档时**: 直接使用相对路径，绝不使用 file:/// 绝对路径
2. **复制文档时**: 检查复制后的链接是否在新位置有效
3. **移动文档后**: 立即更新所有引用，不拖延
4. **删除文档前**: 必须确认无活跃引用
5. **批量操作时**: 分批提交，每批验证
6. **使用工具**: 优先使用 `npm run audit:docs` 而非手动检查
7. **归档而非删除**: 过期文档归档到 `docs/archive/`，不直接删除

---

## 8. 违规处理机制

### 8.1 违规分级

| 级别 | 违规行为 | 处理措施 |
|------|----------|----------|
| P0 | 提交含 file:/// 绝对路径的文档 | 门禁阻断，立即修复 |
| P0 | 提交含硬编码密钥的文档 | 门禁阻断，立即修复 |
| P1 | 文档无 Frontmatter | 门禁阻断，补全后提交 |
| P1 | 文档同步审计失败 | 门禁阻断，修复后提交 |
| P2 | 文档目录归属错误 | 7 个工作日内修正 |
| P2 | 链接指向不存在的文件 | 7 个工作日内修复 |
| P3 | 文档命名不规范 | 下次迭代修正 |
| P3 | 过期文档未归档 | 下次季度审计处理 |

### 8.2 处理流程

```
检测违规  →  分级定级  →  通知作者  →  限期修复  →  验证通过  →  记录归档
```

1. **检测违规**: 门禁检查或定期审计发现
2. **分级定级**: 按 §8.1 确定违规级别
3. **通知作者**: 通过 PR 评论或 issue 通知
4. **限期修复**: P0 立即修复，P1 当日修复，P2 7 个工作日，P3 下次迭代
5. **验证通过**: 修复后重新运行门禁检查
6. **记录归档**: 在治理报告中记录违规与修复情况

### 8.3 累犯处理

| 累犯次数 | 处理措施 |
|----------|----------|
| 第 1 次 | 通知提醒 |
| 第 2 次 | PR 审查升级（需 2 人批准） |
| 第 3 次 | 纳入技术债务清单，限期集中治理 |
| 第 4 次以上 | 上报项目负责人 |

---

## 9. 持续改进方法

### 9.1 度量指标

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 活跃文档断链数 | 0 | Grep 扫描 |
| 文档同步审计通过率 | ≥ 95% | `audit:docs` |
| 文档门禁通过率 | ≥ 90% | `doc:gate` |
| 文档保鲜度评分 | ≥ 80 分 | `doc:freshness` |
| 文档-代码引用覆盖率 | ≥ 95% | `audit:doc-integrity` |
| 平均修复时间（P0） | < 1 小时 | 门禁日志 |

### 9.2 改进循环

```
Plan（计划）→ Do（执行）→ Check（检查）→ Act（行动）
     ↑                                      ↓
     └──────────────────────────────────────┘
```

#### Plan（计划）
- 每月分析审计报告，识别高频违规模式
- 制定改进计划，明确目标和期限

#### Do（执行）
- 实施改进措施（更新规范、优化工具、培训团队）
- 记录实施过程

#### Check（检查）
- 对比改进前后的度量指标
- 评估改进效果

#### Act（行动）
- 有效措施标准化（纳入本规范）
- 无效措施调整或废弃
- 遗留问题转入下一循环

### 9.3 反馈机制

1. **月度审计报告**: 每月生成文档审计报告，包含指标趋势
2. **季度回顾会议**: 季度文档治理回顾，评估规范有效性
3. **规范版本更新**: 根据实践反馈每季度更新本规范
4. **知识沉淀**: 将常见问题与解决方案沉淀到 `docs/guides/how-to/` 目录

### 9.4 自动化目标

| 自动化项 | 当前状态 | 目标状态 |
|----------|----------|----------|
| file:/// 断链扫描 | ✅ pre-commit 内置 | 维持 |
| 文档同步审计 | ✅ pre-commit 内置 | 维持 |
| 文档门禁 | ✅ pre-commit 内置 | 维持 |
| 链接可达性验证 | ⚠️ 手动运行 | CI 流水线自动运行 |
| 文档保鲜度评分 | ⚠️ 手动运行 | 月度自动报告 |
| 归档目录审计 | ❌ 人工审核 | 季度自动报告 |
| 重定向映射审计 | ❌ 人工审核 | 季度自动报告 |

---

## 10. 附录

### 10.1 常见问题

**Q: 发现 file:/// 断链如何修复？**

A: 将 `file:///c:/Users/<user>/.../项目根目录/` 替换为相对路径。计算规则见 §2.2。运行 `grep -rn "file:///[a-z]:/" docs/` 确认修复完成。

**Q: 文档移动后如何更新引用？**

A: 按 §7.2.1 文件移动 SOP 执行。搜索引用 → 移动文件 → 更新引用 → 添加重定向 → 验证。

**Q: 归档文档中的断链需要修复吗？**

A: 不需要。`docs/archive/` 目录下的历史文档保留原样，不修改 file:/// 链接（归档原则）。

**Q: 新建文档应该放在哪个目录？**

A: 按 §1.4 存放位置规则选择目录。核心概述文档放 docs/ 根目录，功能文档放对应子目录。

### 10.2 工具命令速查

```bash
# 断链扫描
grep -rn "file:///[a-z]:/" docs/ --include="*.md" | grep -v "docs/archive/"

# 文档审计
npm run audit:docs
npm run audit:doc-integrity
npm run doc:gate

# 保鲜度
npm run doc:freshness

# 完整审计
npm run audit

# 文档规范检查
npm run file:check
```

### 10.3 变更日志

| 日期 | 版本 | 变更内容 | 变更人 |
|:---|:---|:---|:---|
| 2026-08-03 | v1.0.0 | 初始版本：基于 2026-08-03 文档治理工作制定 | V9 Dev Team |
