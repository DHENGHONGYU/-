---
title: 发文就绪卡 · 腾讯云开发者社区
type: reference
domain: project
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "两篇文章已通过质检，以下为发布前可直接套用的元数据与操作清单。"
tags: [article, publication, reference, project]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-302
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 发文就绪卡 · 腾讯云开发者社区

> 两篇文章已通过质检，以下为发布前可直接套用的元数据与操作清单。

---

## 一、文章元数据

### 第一篇（教程 · 冲精选 3000 积分）

| 项 | 内容 |
|---|---|
| **标题** | 我用 WorkBuddy 给审计团队搭了 20 个"分身"：一个审计合伙人的 AI 工作流改造实录 #WorkBuddy |
| **摘要** | 资深审计合伙人用 WorkBuddy 的记忆层、Skills、专家中心、自动化任务，把"一人复核"改造成"4 指挥官 × 20 分身"的并行工作流。含架构设计、四步实操、六周时间分配对比与三条避坑提醒。 |
| **字数** | 约 2000 字 ?（≥800） |
| **配图** | 4 张（fig1 架构 / fig2 记忆层 / fig3 专家配置 / fig4 时间对比） |
| **建议标签** | WorkBuddy、AI 办公、审计、效率工具、自动化 |

### 第二篇（心得 · 保底 500 积分）

| 项 | 内容 |
|---|---|
| **标题** | 审计场景下 WorkBuddy 的 5 个真实踩坑与解法 #WorkBuddy |
| **摘要** | 用 WorkBuddy 改造审计工作流三个月，挑 5 个最典型的坑——人格漂移、Skills 触发不灵、MCP 串数据、时区错乱、Plan 模式过度规划，每个都给出现象、根因、解法。 |
| **字数** | 约 1100 字 ?（≥800） |
| **配图** | 2 张（fig5 踩坑概览 / fig6 决策流） |
| **建议标签** | WorkBuddy、AI 办公、审计、踩坑记录、效率 |

---

## 二、发布顺序与节奏

| 顺序 | 文章 | 建议发布时间 | 目标 |
|---|---|---|---|
| 1 | 教程篇 | 今天 | 冲精选 3000 |
| 2 | 心得篇 | 教程篇发布 3 天后 | 补 500 |

间隔 3 天的原因：避免同账号短时连发被限流；留出教程篇的精选审核时间；两篇主题相关但独立，分开发可各拿一次基础积分。

---

## 三、配图上传对照

发文时把 Markdown 里的 SVG 引用替换为上传后的 PNG：

**教程篇**
- `![图1...](images/fig1-architecture.svg)` → 上传 `fig1-architecture.png`
- `![图2...](images/fig2-memory-layer.svg)` → 上传 `fig2-memory-layer.png`
- `![图3...](images/fig3-expert-center.svg)` → 上传 `fig3-expert-center.png`
- `![图4...](images/fig4-comparison.svg)` → 上传 `fig4-comparison.png`

**心得篇**
- `![图5...](images/fig5-pitfalls-overview.svg)` → 上传 `fig5-pitfalls-overview.png`
- `![图6...](images/fig6-solution-flow.svg)` → 上传 `fig6-solution-flow.png`

PNG 获取：打开 `convert.html`（本地 http://localhost:8848/convert.html）→「全部下载」。

---

## 四、质检结论

- ? 两篇标题均含 `#WorkBuddy` 标签
- ? 两篇字数均 ≥ 800
- ? 配图 3-6 张区间内（教程 4 / 心得 2）
- ? 功能描述基于 WorkBuddy 官方能力，无编造
- ? 已修正第二篇坑四时区段落的逻辑矛盾
- ? 文末均附"个人实践，不代表机构立场"声明

---

## 五、发布前请确认

- [ ] 发文账号与 WorkBuddy 账号一致（否则不计积分）
- [ ] 标题末尾的 `#WorkBuddy` 保留
- [ ] 社区标签栏同步选上"WorkBuddy"话题标签（如有）
- [ ] 教程篇中"差点出事""客户信息隔离是红线"等表述，按你所在机构口径判断是否需要软化
- [ ] 两篇中的"我团队""让我团队里"等口语，如需更正式可改为"我的团队"
- [ ] 配图上传后检查清晰度（SVG 转 PNG 为 2 倍高清，应无问题）

---

## 六、发布后运营动作（可选，提升精选率）

1. **首发 1 小时内**：在 WorkBuddy 用户群/朋友圈分享链接，冲初始阅读量
2. **发布当天**：回复评论区前 3 条互动，提升互动率
3. **发布次日**：观察是否进入"精选"候选，若未精选可补充 1-2 张实操截图到文章
4. **心得篇发布时**：在文末加一句"上一篇教程见 [链接]"，形成系列互导

---

*就绪卡生成于 2026-07-11 · 配合 articles/ 目录下的文章与配图使用*
