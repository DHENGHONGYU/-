---
title: 跨平台 SKILL 体系统一治理报告
status: completed
date: 2026-08-23
related_contract: AGENTS.md v1.7.7
related_registry: .trae/skills/skill-registry.json（50 条：L1=22 + L2=9 + L3=19）
---

# 跨平台 SKILL 体系统一治理报告（2026-08-23）

> **目标**：统一梳理 TRAE / WorkBuddy / Qoder / VSCode / Kimi 五平台的环境配置、文档与 SKILL；保持一份体系化 SKILL 目录，统一格式，环境配置以通用为契约，防止多备份。

## 一、治理前现状（盘点结论）

| 平台 | 现状 | 问题 |
|---|---|---|
| TRAE | `.trae/skills/` = INDEX.md + skill-registry.json + usage.log + 孤儿 `skill-5seg-migration/` | INDEX.md 严重过时（仍列 19 个旧技能）；孤儿技能未登记 registry |
| WorkBuddy | `.workbuddy/skills/` 为 cp 镜像（已 gitignore） | 物理双份，`.agents/skills/` 更新后漂移 |
| Qoder | `.qoder/` 无技能目录，实际经 `.workbuddy/skills` 加载 | 与 WorkBuddy 共用镜像，无独立契约说明 |
| VSCode | `.vscode/` 不存在 | 零配置，仅能读 AGENTS.md |
| Kimi | `plugins/` 9 个插件（kimi.plugin.json 平台专属 schema） | 已登记 registry，但人类索引未体现 |

真相链：`.agents/skills/`（git 追踪）→ `scripts/skill-mirror.cjs` cp → `.workbuddy/skills/`（WorkBuddy/Qoder 共用）。

## 二、治理动作与结果

### 1. 防多备份：镜像 junction 化 ✅

- 删除 `.workbuddy/skills/` 下 21 个 cp 副本，建立目录联接 `.workbuddy/skills` → `.agents/skills`（`mklink /J`，无需管理员权限；已验证 `Get-Item` LinkType=Junction）。
- 重写 [scripts/skill-mirror.cjs](../scripts/skill-mirror.cjs) 为**幂等联接契约**：
  - 目标已是正确 junction → 输出"联接复用"后跳过；
  - junction 指向他处 → 移除后重建；
  - 目标不存在 → 优先 `mklink /J`，失败（非 Windows/权限）降级 cp 镜像并警告；
  - 目标是旧 cp 副本 → 清理后重建 junction。
- 效果：物理上只有一份技能目录，漂移风险归零；`git status` 无 `.workbuddy/skills` 条目。

### 2. 孤儿归位 ✅

- `git mv .trae/skills/skill-5seg-migration .agents/skills/skill-5seg-migration`，恢复「`.trae/skills/` 仅存索引文件」约定。
- 补全 frontmatter 六字段（`skill_id: V9-SKILL-5SEG-MIGRATION` 等），完成自身 5 段式对齐。
- 登记入 `skill-registry.json` `projectPhysicalSkills`（category=doc-governance，advisory）：
  - L1：21 → **22**；合计：49 → **50**；categoriesStats `doc-governance`：6 → **7**。

### 3. 格式统一：22 个 L1 SKILL 对齐 5 段式骨架 ✅

- 批次扫描结论：22 个技能正文在 2026-08-21 批次已完成 5 段式结构迁移（`## 一、触发条件` ~ `## 五、完成交付物清单` 全部 5/5 命中，WARN 子项全达标），本次属 Batch-C 打磨。
- 实际缺口收敛为 frontmatter 元数据：批量补全 `skill_id`（值取 registry `id`，22/22）+ version PATCH++ + `last_updated: 2026-08-23` + change_log 留痕「跨平台 SKILL 体系统一(2026-08-23)」。
- 修复 5 个文件 change_log 顶格 `- version:` 的 YAML 缩进瑕疵（architecture-cleanup / architecture-radar-scan / db-reference-audit / data-flow-integrity-audit / doc-freshness-governance）。
- 铁律遵守：只重排结构与补元数据，未删除任何业务事实内容。

### 4. 索引与注册表去重（单一真相源契约） ✅

- **机器真相源唯一**：`.trae/skills/skill-registry.json`（路径不动，`audit:skill-coverage` 依赖）。
- `.agents/skills/README.md` v2.0.0 重写为**唯一人类可读统一索引**：删除与 registry 重复的 YAML 注册表段（-308/+80 行）；新增「跨平台加载契约」表；50 项快速导航（L1 22 + L2 9 + L3 19）。
- `.trae/skills/INDEX.md` v2.0.0 降级为轻量指针（指向统一索引 + registry），删除过时 19 技能清单。

### 5. 环境配置契约与文档同频 ✅

- AGENTS.md v1.7.6 → **v1.7.7**：项目级 SKILL 索引段同步（L1=22 / 合计 50、doc-governance 3、junction 语义、VSCode 加载说明）、技能治理对齐记录 item 2 更新、change_log 留痕。
- `.gitignore` 注释更新（junction 说明）。
- 本报告归档。

## 三、跨平台加载契约（最终态）

| 平台 | 加载路径 | 契约说明 |
|---|---|---|
| TRAE | `.trae/skills/skill-registry.json` + AGENTS.md | 机器字段（triggers/gates/mandatory）唯一真相源 |
| WorkBuddy | `.workbuddy/skills/`（junction → `.agents/skills`） | 加载器不扫 `.agents/skills/`，经联接读同一物理源 |
| Qoder | 同 WorkBuddy | 本会话已验证 22 个 L1 全部可经 Skill() 加载 |
| VSCode | AGENTS.md | 零配置，无技能目录 |
| Kimi | `plugins/`（kimi.plugin.json 平台专属 schema） | 禁止镜像复制到 `.agents/skills/`，仅在统一索引登记 |

**环境搭建契约**：新克隆机器跑一次 `npm run skill:mirror` 重建联接。

## 四、门禁验证

| 验证项 | 结果 |
|---|---|
| `npm run audit:skill-coverage`（frontmatter ↔ registry ↔ AGENTS.md 三方一致 + RULE-TPL） | exit 0，RULE-TPL 22/22 全绿 |
| `npm run skill:mirror` 幂等复跑 | 输出"联接复用"，无副作用 |
| `git status` | 干净，无 `.workbuddy/skills` 条目 |
| Skill 可用性 | 本环境 Skill 列表含全部 22 个 L1（Qoder 经 junction 加载） |
| 5 段式抽查 | 正文 5 大段 + frontmatter 六字段全数达标（批量扫描 22/22） |

## 五、沉淀与后续约定

1. 新增/修改物理技能后跑 `npm run audit:skill-coverage` + `npm run skill:mirror`（后者幂等无副作用）。
2. 人类索引只改 `.agents/skills/README.md`；机器字段只改 `skill-registry.json`；禁止在其他文档重复维护技能清单。
3. Kimi 插件保持平台专属格式，不强行改造为 5 段式，仅在统一索引登记。
4. junction 若在非 Windows 环境失效，`skill:mirror` 自动降级 cp 并警告——降级态需在下一次 Windows 环境跑一次恢复联接。
