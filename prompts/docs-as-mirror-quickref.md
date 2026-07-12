# V9 智能投研复盘系统 — 文档编写快速参考卡

> **版本**: v1.0.0 | **日期**: 2026-07-20 | **关联**: AGENTS.md v1.4.5, docs-as-mirror Skill v1.0.0
> **用途**: AI 辅助开发编写任何技术文档前，强制执行的 10 行极简检查清单

---

## 10 行快速检查清单（编写任何文档前逐行确认）

```
1. [ ] 已读取 AGENTS.md 当前版本，记录版本号（当前 v1.4.5）
2. [ ] 已提取 AGENTS.md §一 全部目录定义（22 个 src/ 子目录 + 扩展目录）
3. [ ] 已扫描实际文件系统（find . -maxdepth 2 -type d），所有非标准目录有说明
4. [ ] 已读取实际 .gitignore（cat .gitignore），文档覆盖率 ≥ 95%
5. [ ] 已区分相似目录（agents/ vs .agents/skills/，utils/ vs lib/ 等）
6. [ ] 文档包含 8 个必含章节（目录映射、命名、.gitignore、提交前检查、定期审计、生命周期、交叉引用、变更日志）
7. [ ] 已注册到文档索引（docs/README.md 或 REGISTRY_INDEX.md）
8. [ ] 已建立双向引用（文档引用 AGENTS.md，AGENTS.md 反向引用本文档）
9. [ ] 文档头部声明版本号体系（项目级版本 + 文档修订号 + 兼容 AGENTS.md 版本）
10. [ ] 已运行 npm run audit:directory && npm run audit:docs，结果 0 违规
```

---

## 一键扫描命令（复制即用）

```powershell
# 提取 AGENTS.md 目录定义（22 个目录）
grep -E '^\s*(src/|\.agents/|packages/|docs/)' AGENTS.md | sort

# 提取实际目录结构
tree -d -L 2

# 提取 .gitignore 有效规则
cat .gitignore | grep -v '^#' | grep -v '^$' | sort

# 全量审计验证
npm run audit:directory && npm run audit:docs && npm run audit:layers
```

---

## 决策速查：文档是否已完成？

| 检查项 | 未完成 = 草稿（DRAFT） | 已完成 |
|--------|---------------------|--------|
| 是否读取 AGENTS.md 当前版本？ | ❌ 未读取 → 可能引用旧版 | ✅ 已读取并记录版本号 |
| 目录覆盖率？ | ❌ 遗漏 > 0% → 架构漂移风险 | ✅ 22/22 匹配 |
| .gitignore 文档覆盖率？ | ❌ < 95% → 文档与实际脱节 | ✅ ≥ 95% |
| 是否被索引收录？ | ❌ 未收录 → 信息孤岛 | ✅ 已注册到 docs/README.md |
| 是否双向引用？ | ❌ 单向引用 → 链路断裂 | ✅ AGENTS.md ↔ 本文档 |
| 版本号是否声明？ | ❌ 无版本号 → 无法追踪 | ✅ 双版本号 + 兼容性声明 |
| 审计是否通过？ | ❌ 有违规 → 需修复 | ✅ 0 违规 |

> **规则**：以上 7 项检查中，任何一项未通过，文档状态必须为 **DRAFT**，不得发布。

---

## 5 大核心原则（一句话记忆）

1. **Truth-First**：先读 AGENTS.md，再写文档，不凭记忆
2. **Scan-Before-Write**：先扫 find/cat，再写描述，不用模板
3. **Exhaustiveness**：8 个章节缺一不可，不允许"最小化"
4. **Bidirectional Linking**：注册 + 引用 + 反向引用，三步骤缺一不可
5. **Version Pinning**：文档头部必须声明兼容的 AGENTS.md 版本号
