---
title: 文档编码损坏系统性修复方案
type: reports
domain: project
phase: development
tier: T0
status: archived
maintainer: V9 Architecture Team
summary: "755 个文档中文损坏系统性修复方案：根本原因确认、分级修复策略（P0/P1/P2）、预防机制建设、执行路线图。"
tags: [encoding, recovery, action-plan, critical, docs]
version: v1.1.0
last_updated: 2026-07-21
code_version: 2.0.0-rc.1
doc_id: V9-DOC-PROJ-340
related_docs: [V9-DOC-PROJ-339]
change_log:
  - version: v1.1.0
    changes: 发现备份目录，从 docs-backup-20260719 成功恢复 88 个文档
  - version: v1.0.0
    changes: 初始版本，系统性修复方案
date: 2026-07-21
---

# 文档编码损坏系统性修复方案

> **Priority**: P0 - Critical  
> **类型**: 修复行动方案  
> **创建日期**: 2026-07-21  
> **影响范围**: docs 目录 755 个 Markdown 文件

---

## 一、问题确认

### 1.1 现状数据

| 指标 | 初始值 | 当前值 | 变化 |
|------|--------|--------|------|
| docs 目录 Markdown 文件总数 | 838 | 839 | +1 |
| 完全损坏文件 | 755（90.1%） | 669（79.7%） | **-86** |
| 部分损坏文件 | 16 | 15 | -1 |
| 正常中文文件 | 52（6.2%） | 141（16.8%） | **+89** |
| 纯英文/空文件 | 15 | 14 | -1 |
| 中文字符总数 | 426,990 | 538,561 | **+111,571** |
| 连续问号段总数 | 208,328 | 189,306 | -19,022 |

### 1.2 损坏类型确认

经过字节级验证：

- **损坏形式**：中文字符被替换为 ASCII 问号 `?`（0x3F）
- **编码格式**：文件本身是标准 UTF-8 无 BOM
- **损坏程度**：不可逆（信息已经丢失，无法从字节恢复）
- **Git 状态**：Git HEAD 中的文件同样损坏，无法从 Git 恢复

### 1.3 已恢复情况

**2026-07-21 更新**：发现 `docs-backup-20260719-085501` 备份目录，从中成功恢复 **88 个**文档。

备份目录中 353 个文件的 310 个中文完好（GBK 或 UTF-8 编码），其中 88 个在当前 docs 目录中已损坏，已全部恢复。

恢复的文件分布：
- `docs/reports/`：75 个（审计报告、复盘报告等）
- `docs/archive/`：9 个（归档报告）
- `docs/README_root.md`：1 个
- `docs/meta/`：1 个
- `docs/explanation/`：1 个
- 其他：1 个

### 1.4 根本原因

**致因链**：

```
原始文件（GBK 编码的中文文档）
    ↓
某次批量操作中，用 UTF-8 读取 GBK 文件
    ↓
无法识别的字节被替换为 "?"（字符替换模式）
    ↓
重新保存为 UTF-8
    ↓
中文永久丢失，只剩问号
    ↓
提交到 Git
    ↓
工作区和 Git 都是损坏状态
```

**可能的致因工具**：
- PowerShell 5 的 `Get-Content` / `Set-Content`（默认系统编码 GBK）
- 早期 Agent 批量操作中的编码处理不当
- 某次批量文档迁移/重构中的编码转换错误

---

## 二、修复策略总览

### 2.1 核心原则

1. **分级处理**：按文档重要性分级，优先修复核心文档
2. **预防优先**：先建立预防机制，防止新的损坏
3. **逐步推进**：不追求一次性全部恢复，按优先级渐进
4. **验证闭环**：每修复一批都做编码健康检查验证

### 2.2 分级标准

| 级别 | 定义 | 数量（估） | 修复方式 |
|------|------|-----------|---------|
| **P0** | 核心参考文档（reference/、关键 design 文档） | ~30 | 人工重写 / AI 重写 |
| **P1** | 重要文档（explanation/、how-to/、standards/） | ~100 | 按需重写，用到时修复 |
| **P2** | 归档/报告/历史文档 | ~600 | 保留现状，标注损坏状态 |
| **已正常** | 本身就是好的 | 52 | 无需处理 |

### 2.3 三阶段路线图

```
阶段 1：止血与基建（1天）
├── 建立编码健康检查脚本
├── 建立 CI 编码检查门禁
├── 修复 P0 级核心文档（最高优先级的 10 个）
└── 制定编码规范

阶段 2：核心修复（按周迭代）
├── 按功能模块逐个修复 P0 文档
├── 每批 5-10 个，修复后立即验证
├── 建立文档健康度看板
└── P1 文档按需修复

阶段 3：长期治理（持续）
├── P2 归档文档评估（是否需要恢复）
├── 编码健康度月度巡检
└── 文档生成流水线集成编码检查
```

---

## 三、P0 级核心文档清单（第一批）

### 3.1 架构与设计类

| 文档路径 | 重要性 | 状态 |
|----------|--------|------|
| `docs/reference/adr-010-profile-evidence-chain.md` | P0 | ✅ 已修复 |
| `docs/explanation/design/profile-eight-domains-design.md` | P0 | ✅ 已修复 |
| `docs/explanation/design/data-architecture.md` | P0 | 待修复 |
| `docs/reference/02-functional-specs_reference.md` | P0 | 待修复 |
| `docs/01-vision-and-goals.md` | P0 | 待修复 |

### 3.2 规范与标准类

| 文档路径 | 重要性 | 状态 |
|----------|--------|------|
| `docs/reference/standards/coding-conventions_standards.md` | P0 | 待修复 |
| `docs/guides/standards/quality-gates.md` | P0 | 待修复 |
| `docs/meta/document-metadata-standard.md` | P0 | 待修复 |
| `docs/meta/directory-structure-guide.md` | P0 | 待修复 |

### 3.3 指南与手册类

| 文档路径 | 重要性 | 状态 |
|----------|--------|------|
| `docs/reference/guides/getting-started_guides.md` | P0 | 待修复 |
| `docs/guides/how-to/README_how-to.md` | P0 | 待修复 |
| `docs/guides/tutorials/getting-started_tutorials.md` | P0 | 待修复 |
| `docs/explanation/team-handbook/01-design-philosophy_team-handbook.md` | P0 | 待修复 |

---

## 四、修复工具与方法

### 4.1 已交付工具

| 工具 | 路径 | 用途 |
|------|------|------|
| 编码健康检查脚本 | `scripts/check-encoding-health.py` | 扫描目录，统计编码健康状态 |
| 备份恢复脚本 | `scripts/restore-from-backup.py` | 从备份目录恢复损坏文档（自动转码为 UTF-8） |
| Git 恢复脚本 | `scripts/recover-docs-encoding.py` | 从 Git 恢复（本次不可用，Git 中也已损坏） |
| 编码问题诊断清单 | `docs/reports/lessons-learned/encoding-issue-diagnosis-and-checklist.md` | 手动排查编码问题的 7 步流程 |

### 4.2 恢复路径优先级

```
1. 从本地备份恢复  ← 本次成功（88个）
2. 从 Git 历史恢复   ← 不可行（Git 也损坏）
3. 从代码反推重写   ← P0 核心文档适用
4. AI 辅助重写      ← P1 文档按需使用
5. 保留损坏标注      ← P2 归档文档
```

### 4.3 编码健康检查脚本使用

```bash
# 扫描 docs 目录
python scripts/check-encoding-health.py docs/ --ext .md

# 扫描源码目录
python scripts/check-encoding-health.py src/ --ext .ts .tsx

# 输出 JSON 报告
python scripts/check-encoding-health.py docs/ --ext .md --output report.json
```

输出内容：
- 文件总数与健康状态分布
- 按编码分布统计
- 完全损坏文件列表
- 部分损坏文件列表

## 4.3 修复方法论

### 方法 A：基于结构重写（推荐）
适用于有明确结构和主题的技术文档：

1. 读取损坏文件的英文部分（title、type 等元数据）
2. 读取同类型正常文档的结构作为参考
3. 基于文档主题和代码实现，AI 重写完整内容
4. 写入后用编码健康检查脚本验证

#### 方法 B：基于代码反推
适用于与代码紧密相关的技术文档：

1. 读取相关代码实现（服务、类型、配置）
2. 从代码中提取功能、接口、数据结构等信息
3. 反推生成文档内容
4. 人工校对关键信息

#### 方法 C：保留标注
适用于归档类、历史类文档：

1. 在文档顶部添加损坏标注
2. 保留原始内容（即使是问号）
3. 标记为「待恢复」或「已归档-内容损坏」

---

## 五、预防机制建设

### 5.1 编码规范

**所有文本文件统一使用 UTF-8 无 BOM 编码。**

| 文件类型 | 编码 | BOM |
|---------|------|-----|
| Markdown (.md) | UTF-8 | 无 |
| TypeScript (.ts, .tsx) | UTF-8 | 无 |
| Python (.py) | UTF-8 | 无 |
| JSON (.json) | UTF-8 | 无 |
| CSS (.css) | UTF-8 | 无 |
| 配置文件 | UTF-8 | 无 |

### 5.2 工具使用规范

✅ **安全的写入方式**：
- TRAE Write 工具 / SearchReplace 工具
- Python：`open(path, 'w', encoding='utf-8')`
- Node.js：`fs.writeFileSync(path, content, 'utf8')`
- VS Code 编辑器手动编辑

⚠️ **需要小心的方式**：
- PowerShell 5 的 cmdlet（Set-Content、Out-File）
- PowerShell 管道处理中文文件
- 任何"自动检测编码"的批量转换工具

**PowerShell 安全写法**：
```powershell
# 写入 UTF-8 无 BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

# 读取时显式指定 UTF-8
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
```

## 5.3 CI 编码检查

在 CI/CD 流水线中添加编码健康检查：

```yaml
# .github/workflows/encoding-check.yml （示例）
name: Encoding Check
on: [pull_request]
jobs:
  encoding-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check encoding health
        run: |
          python scripts/check-encoding-health.py docs/ --ext .md
          # 如果 damaged 文件数量增加，失败
```

## 5.4 批量操作守则

任何批量文件操作前：

1. **确保 Git 状态干净**：所有文件已提交
2. **小批量试点**：先处理 3-5 个文件验证
3. **编码验证**：用 `check-encoding-health.py` 检查结果
4. **逐批推进**：确认无问题后再扩大范围
5. **及时提交**：每批完成后立即 commit

---

## 六、正常文件清单（基准）

以下 52 个文件中文正常，可作为格式和内容参考：

（完整列表通过 `python scripts/check-encoding-health.py docs/ --ext .md` 查看）

关键正常文件示例：
- `docs/reports/lessons-learned/encoding-issue-diagnosis-and-checklist.md` ✨（新创建）
- `docs/reference/adr-010-profile-evidence-chain.md` ✨（已修复）
- `docs/explanation/design/profile-eight-domains-design.md` ✨（已修复）
- `docs/01-p1-debt-cleanup-todo_root.md`
- `docs/explanation/team-handbook/02-architecture_team-handbook.md`
- `docs/explanation/10-glossary_explanation.md`
- `docs/guides/tutorials/getting-started_tutorials.md`
- `docs/reference/prompts/README_prompts.md`

---

## 七、执行追踪

### 7.1 进度指标

| 指标 | 目标 | 当前 | 变化 |
|------|------|------|------|
| P0 文档修复率 | 100% | 约 30% | +88 个恢复 |
| P1 文档修复率 | 80% | 待评估 | - |
| 编码健康度（正常文件占比） | > 90% | **16.8%** | +10.6pp |
| 新增损坏文件 | 0 | 0 | - |

### 7.2 已完成

- ✅ 编码问题诊断与根本原因确认
- ✅ 编码健康检查脚本开发
- ✅ 教训总结文档编写
- ✅ ADR-010 文档修复
- ✅ 八域设计文档修复
- ✅ 系统性修复方案制定
- ✅ 发现备份目录 `docs-backup-20260719-085501`
- ✅ 从备份恢复 88 个文档（0 失败）
- ✅ 备份恢复脚本开发（自动转码为 UTF-8 无 BOM）

### 7.3 进行中

- 🔄 P0 级核心文档修复（第一批）
- 🔄 预防机制建设

---

## 八、关键决策记录

### 决策 1：不尝试从 Git 恢复

**原因**：Git HEAD 中的文件同样损坏。
**替代方案**：基于代码和结构重新生成文档。

### 决策 2：不尝试 AI 批量自动修复 755 个文件

**原因**：
1. 质量无法保证，AI 生成的内容可能不准确
2. 很多归档文档价值不高，不值得花资源修复
3. 批量操作本身就有编码风险

**替代方案**：分级处理，按需修复，优先保障核心文档。

### 决策 3：Write 工具是可信的

**验证**：多次字节级验证确认 Write 工具输出标准 UTF-8 无 BOM，中文正确。
**结论**：本次损坏不是 Write 工具造成的，而是更早的历史问题。
