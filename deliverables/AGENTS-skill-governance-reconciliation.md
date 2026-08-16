# AGENTS.md 技能治理对账报告（2026-08-16，方案B + P2 已闭环）

> 触发：本轮"腾讯自选股 MCP 整合"收尾时，`Skill(v9-collection-pipeline-testing)` 报 "Can not find skill"。
> 经两轮核查与对齐，**根因已厘清并完成治理**：真正的错位只有一处——**AGENTS.md 的 L1 索引把"平台虚拟技能（`v9-*`）"谎称为"项目物理技能"**；而 `skill-registry.json` 从一开始就是准确的（物理自然名 / 虚拟 v9-* 分层）。

## 1. 三层真相源最终快照（2026-08-16 对齐后）

| 层 | 位置 | 实际内容（对齐后） |
|---|---|---|
| **A. 声明（索引/路由表）** | `AGENTS.md` §项目级 SKILL 索引 + 技能路由表；`.trae/skills/skill-registry.json` | `skill-registry.json` 为单一真相源：**projectPhysical 18 项（自然 slug）**、**externalPlugin 9 项**、**virtualPlatform 19 项（v9-*，无本地 SKILL.md）**，合计 46。AGENTS.md L1 索引已重写为与 registry 一致。 |
| **B. 物理落盘** | `.agents/skills/*/SKILL.md` | **18 个** 自然名物理技能（含本轮由 `v9-collection-pipeline-testing` 改名而来的 `collection-pipeline-testing`）。 |
| **C. WorkBuddy 可加载** | `{workspace}/.workbuddy/skills/`（项目级）+ `~/.workbuddy/skills/`（用户级） | 18 个 L1 物理技能已镜像至 `.workbuddy/skills/`（P2），WorkBuddy 现可经 `Skill()` 加载；用户级仍仅 `v9-color-token-remediation` 等。 |

## 2. 关键纠偏（与初版报告的本质差异）

- **初版误判**：报告初稿称"14 个物理技能未声明、11+ 个声明 v9-* 物理缺失"。这是把 `skill-registry.json` 的 **virtualPlatform（v9-*）** 误读为"缺失"。实际：
  - `virtualPlatformSkills`（现 19 项）中的 `v9-*` 技能是 **TRAE CN 平台虚拟技能**，按设计就**没有本地 SKILL.md**——并非"缺失"，而是"虚拟"。
  - `projectPhysicalSkills`（现 18 项）早已用**自然名**声明了全部 18 个本地技能。AGENTS.md 的 L1 索引才把 v9-* 错写成"物理"。
- **所以初版的"方案 A（补装 11+ v9-*）"是错误方向**——那会制造 11+ 个冗余虚拟技能的物理副本。正确的治理是**方案B（反向对齐）+ P2**。

## 3. 缺口分析（真实）

- **唯一真实的物理缺失**：`collection-pipeline-testing`（数据采集链路 mandatory 门禁）。初版用 `v9-collection-pipeline-testing` 命名补装，后又确认它本属 virtual 命名空间——最终以**自然名 `collection-pipeline-testing` 落为 L1 物理**（mandatory、data-flow），并在 registry 中由 `virtualPlatform` 迁移到 `projectPhysical`。
- **AGENTS.md L1 索引谎言**：把 19 个虚拟 `v9-*` 技能写成 16 个"L1 物理"，并把 18 个真实物理技能的自然名漏列。已重写为 18 自然名物理技能（按 registry `categoriesStats` 分类、按 `mandatory` 标记）。
- **加载器路径错位**（结构性）：WorkBuddy 仅扫 `.workbuddy/skills/`，不扫 `.agents/skills/`——已用 P2 镜像解决本环境可加载性问题。
- **frontmatter 声明失真**（已于 2026-08-16 续轮纠正）：AGENTS.md 路由表曾声称 SKILL.md frontmatter 含 `triggers`/`gates`/`mandatory` 机器可读字段为"单一真相源"，但实测全部 18 个物理 SKILL.md 仅用 `name`/`description`/`version`/`last_updated`/`change_log`，**无此三字段**；`triggers`/`gates`/`mandatory` 实际仅存于 registry 的 JSON 条目。已在 AGENTS.md L65 纠正指向 registry（机器可读真相源），未改写 18 个 SKILL.md。

## 4. 对齐方案与执行（全部完成）

- **P0 — 补齐关键缺失**：以自然名落地 `collection-pipeline-testing`（数据采集 mandatory 门禁），消除"声明强制却无法加载"。✅
- **方案B — 反向对齐（核心）**：
  - 撤销上一轮误加的 `v9-` 前缀重命名：`v9-constant-migration`→`constant-migration`、`v9-databridge-migration`→`databridge-migration`（含 `name:` 字段回退）。✅
  - `v9-collection-pipeline-testing`→`collection-pipeline-testing`（自然名）+ `name:` 字段同步。✅
  - `skill-registry.json`：`collection-pipeline-testing` 由 `virtualPlatform`（20）迁移到 `projectPhysical`（18）；`total` 维持 46；`summary`/`_comment`/`categoriesStats`/`mandatoryCount` 重算一致（mandatory 物理项：constant-migration、databridge-migration、doc-freshness-governance、collection-pipeline-testing）。✅
  - `AGENTS.md` L1 索引重写为 18 自然名物理技能（十一类）；`禁止混加计数` L1(18)+L2(9)+L3(19)=46；路由表采集行改用 `collection-pipeline-testing`。✅
- **P2 — 加载器对齐**：将 18 个 L1 物理技能镜像至 `D:\FinSightV9\.workbuddy\skills\`。⚠️ Windows 不支持 symlink，采用 `cp -r` 拷贝（已校验每目录含 SKILL.md 且 `name` 字段与目录一致）。✅ 漂移代价已通过 `npm run skill:mirror`（`scripts/skill-mirror.cjs`，覆盖式镜像 + 清理孤儿目录）自愈，且 `.gitignore` 已忽略该镜像目录（D:\FinSightV9\.gitignore 行 132）。

## 5. 最终一致性校验（2026-08-16）

| 校验项 | 结果 |
|---|---|
| 磁盘 `.agents/skills/` 18 目录 ⊆ registry.projectPhysical | ✅ 完全一致（含 README.md 不计） |
| registry.projectPhysical（18）= 磁盘 | ✅ |
| AGENTS.md L1 索引引用的 18 个自然名 ⊆ registry.projectPhysical | ✅（索引内"无 `v9-` 前缀"说明文字非技能引用，已排除误报） |
| `.workbuddy/skills/` 镜像 = 磁盘 18 | ✅ |
| virtualPlatform 不再含 `v9-collection-pipeline-testing` | ✅ |
| `collection-pipeline-testing` ∈ projectPhysical | ✅ |

## 6. 残留与建议（2026-08-16 续轮已全部闭环）

1. **拷贝漂移风险（P2 代价）** — ✅ 已解决：新增 `npm run skill:mirror`（`scripts/skill-mirror.cjs`），覆盖式镜像 `.agents/skills/*` → `.workbuddy/skills/` 并清理孤儿目录；`.gitignore` 已忽略镜像目录防重复提交。后续 `.agents/skills/` 变更后跑一次 `npm run skill:mirror` 即可自愈。
2. **frontmatter 声明失真** — ✅ 已解决：AGENTS.md L65 已纠正——`triggers`/`gates`/`mandatory` 机器可读真相源明确指向 `skill-registry.json`，SKILL.md frontmatter 仅承载人类可读元数据（`name`/`description`/`version`/`last_updated`/`change_log`）；L60 勘误块同步标注"已纠正"。未改写 18 个 SKILL.md（避免引入格式风险）。
3. **L3 虚拟索引段锚点漂移** — ✅ 已解决：AGENTS.md L54 原引用不存在的"§平台内置虚拟 SKILL 索引（L38-L43）"已改为指向 `.trae/skills/skill-registry.json` 的 `virtualPlatformSkills`（本索引仅计项数，不重复枚举）。

> 结论：技能治理的结构性错位（声明谎称物理、加载器不扫项目目录）与三项非阻塞遗留（拷贝漂移、frontmatter 失真、锚点漂移）均已闭环。最终态：registry 为唯一真相源（物理 18 / 虚拟 19 / 插件 9 = 46），磁盘与镜像一致，AGENTS.md 索引/路由/勘误三处声明与 registry 对齐，WorkBuddy 可经 `Skill()` 加载全部 18 个 L1 物理技能。
