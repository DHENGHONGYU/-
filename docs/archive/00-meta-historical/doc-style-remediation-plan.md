---
title: doc-style-remediation-plan
code_version: 2.0.0
tier: core
source: 文档风格统一整改方案（基于 doc-style-standard）
generated: 2026-07-16
status: archived
---

# V9 文档风格整改方案（doc-style-remediation-plan）

> **标准依据**：`doc-style-standard.md`（v1.0.0，core）
> **目标**：消除多模型校对导致的风格割裂，使 694 份 docs/.md 100% 符合统一标准。
> **原则**：单一事实源、先标准后执行、自动化优先、分批低风险、可回滚。

---

## 0. 现状基线（二次检索实测）

| 问题 | 数量 | 证据 |
|------|------|------|
| 含 frontmatter 的 `.md` | 675 / 694 | — |
| **重复 frontmatter 块**（双/三块） | **585** | README 双块 tier 冲突；cleanup-schedule 短名/全路径并存 |
| 署名标签种类 | 12+ | Kimi Code CLI / AI Assistant GLM-5.2 / AI 辅助开发流程… |
| 元数据键种类 | 6 | 执行人/校对人员/报告生成人/报告作者/日志生成工具/测试执行人 |
| 术语异词 | 多组 | 数据字典/数据定义、智能体/Agent/代理 |
| 日期格式 | 4+ | 曾含错年 `registry-index.md` 的 `2025-07-12`（已于 P0-2 修复） |
| emoji 体系 | 混乱 | 🟢🔵🟡⭐🔶📘📊📋✅🔴⚠️ℹ️ 混用 |
| manifest 缺口 | 98 | docs 实际 693 vs 登记 595 |

---

## 1. 执行步骤（P0–P3）

### P0 · 零风险自动化（✅ 已执行 2026-07-16）
| 动作 | 方法 | 产出 |
|------|------|------|
| 清理 585 个重复 frontmatter 块 | 脚本：保留第一段；若块2 仅含 title 全路径则丢弃；若块2 含独有 `status` 等则合并入块1 | 0 重复块 |
| title 全路径名 → 短名 slug | 脚本正则提取 basename | 统一短名 |
| 修复错年 `2025` → `2026` | 脚本针对 `registry-index.md` 等 | 0 错年 |
| 重建 manifest 补 98 缺口 | `npm run doc:manifest` | 索引 0 漂移 |

### P1 · 半自动归一（✅ 已执行 2026-07-16）
| 动作 | 方法 | 产出 |
|------|------|------|
| 元数据键归一（中文→英文） | 脚本映射：版本→Version 等 6 种 | 100% 英文键 |
| 署名归一（12+→受控枚举） | 脚本映射表 → `Proofreader:`/`Generator:` | 100% 受控枚举 |
| 术语替换（正文） | 脚本：`数据定义`→`数据字典`（仅 B/C 类正文，不动代码标识符/文件名） | 术语 100% 合规 |

### P2 · 人工 + 工具复核（✅ 已执行 2026-07-16）
| 动作 | 方法 | 产出 |
|------|------|------|
| 标题装饰 emoji 清理 | 脚本去 `## 📊` 类前缀，保留状态 emoji | 标题 0 装饰 emoji |
| 日期格式统一 `YYYY-MM-DD` | 脚本归一 4 种格式 | 100% 标准日期 |
| 抽样人工复核 | 每目录抽 3 份 diff 复核 | 误改率 < 1% |

### P3 · 长效门禁（✅ 已执行 2026-07-16）
| 动作 | 方法 | 产出 |
|------|------|------|
| 接入 `doc:proofread` 的 `style` 维度 | 扩展 `scripts/docs-tool/`，实现第 9 节检查项 | 自动 style 检查 |
| 接入 `doc:gate` | 先 warning 后 blocking | CI 阻断新违规 |
| 本标准登记为 core 文档 | 入 `doc-manifest.csv` + `registry-index.md` | 单一正源可检索 |

---

## 2. 工具脚本建议

| 脚本 | 职责 | 关键逻辑 |
|------|------|----------|
| `scripts/docs-tool/normalize-frontmatter.ts` | 去重块、统一键、短名 title | 解析首个 `---` 块，丢弃后续块，合并独有字段 |
| `scripts/docs-tool/normalize-style.ts` | 术语/日期/emoji/署名归一 | 正则 + 映射表，逐项替换 |
| `scripts/docs-tool/style-lint.ts` | `style` 维度检查器 | 输出 findings，对接 `doc:gate` |

---

## 3. 验收标准（2026-07-16 实测）

| 验收项 | 目标 | 实测 | 状态 |
|--------|------|------|------|
| 重复 frontmatter 块 | 0 | 0（归档 9 处已补折叠） | ✅ |
| 英文键 frontmatter | 100% | 100%（中文键 0、中文 frontmatter 键 0） | ✅ |
| 受控枚举署名 | 100% | 元数据署名 100%（正文/表格署名留待人工） | ✅* |
| 术语合规(§5) | 100% | 数据定义/部件 0 违例（治理文档豁免） | ✅ |
| 日期格式 | 100% `YYYY-MM-DD` | 0 非标准（含错年 0） | ✅ |
| 标题装饰 emoji | 0 | 0（状态 emoji 保留） | ✅ |
| 标题单一 `#`/不跳级 | 连续 | 跳级 168 项（warning，不阻断） | ⚠️ 待清理 |
| `doc:gate` style 维度 | 全绿 | 7/7 通过（warning） | ✅ |

> `* ` 受控枚举署名：元数据块（`> **Proofreader/Generator**:`）已 100% 归一；散落在正文/表格中的署名标签（如「架构组」「V9 Quality Audit Team」）属内容语义，未强制归一，由 `style-lint` 的 `unnormalized-author` 仅对元数据键值校验。

---

## 4. 风险与回滚

- **分批执行**：每批 ≤ 50 文件，避免触发 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。
- **先提交后改**：每阶段前 `git commit` 当前态，批量改后 `git diff` 复核。
- **误改回滚**：术语替换仅正文，若误伤代码标识符，从 git 恢复单文件。
- **中文文件名**：git 比对用 `git -c core.quotepath=false`（既有教训）。

---

## 5. 建议启动顺序

```
P0（今日可执行，零风险）→ P1（半自动）→ P2（人工复核）→ P3（门禁长效）
```

> **执行结论（2026-07-16）**：P0–P3 已全部执行完成。详见 `doc-style-standard.md` §11 与执行日志 `doc-style-remediation-log.md`。剩余 `heading-skip` 168 项（warning 级）与正文/表格署名归一列为后续人工清理项；`style-lint` 当前为 warning 级接入 `doc:gate`，待 backlog 清理后翻 `blocking`。
