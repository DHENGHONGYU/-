---
skill_id: V9-SKILL-5SEG-MIGRATION
name: skill-5seg-migration
description: "执行 Skill S 级 5 段式骨架迁移的 7 步统一 SOP（三批次策略 · 标题重映射矩阵 · 15 子项速补模板）。Invoke when 需要把现有 L1 物理 Skill 从 0/1/3 段迁移到标准 5 段式、或批量多 Skill 迁移、或 RULE-TPL 报告缺段 FAIL/内容子项 WARN 时加载。"
version: v1.1.3
last_updated: 2026-08-23
mandatory: false
triggers:
  keywords: ["5 段式迁移", "RULE-TPL 缺段", "骨架模板迁移", "Skill 格式统一", "批次迁移策略"]
  files: [".agents/skills/**/SKILL.md", ".agents/skills/_SKILL-TEMPLATE.md"]
  events: []
gates: ["npm run audit:skill-coverage"]
change_log:
  - version: v1.1.3
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 4 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.1.2
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.1.1 / 正文 v1.1.0) → 取真值 max=1.1.1 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 2 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-08-21
---

# Skill 5 段式骨架迁移 SOP（S 级模板推广 · 7 步统一流程）

> **版本**: v1.1.3 | **校验基准**: 所有项目级 Skill 强制推广 RULE-TPL 门禁 1.1+
> **任务性质**: 可复用迁移 SOP，允许复制模板/重映射标题/补齐子项/四端同步/修改 Frontmatter，**禁止**删除原 Skill 的业务事实内容（如原有 6 Phase SOP 正文、参数阈值表格、附录案例）
> **输出格式**: 三批次迁移策略勾选 + 标题重映射对照表 + 7 步逐 Skill 完成勾表 + RULE-TPL 全绿验证 + skill:mirror 报告

---

## 一、触发条件（Invoke When · 5 条可判定规则）

触发任一条即应加载本 Skill：

- **显式触发 1**：`audit:skill-coverage` RULE-TPL 段 FAIL（exit 1），报告某 Skill 缺 §一~§五任一大段标题
- **显式触发 2**：项目推广决议要求把现有 Skill 全部迁到标准 5 段式骨架模板（含"新 Skill 强制使用"规则落地）
- **显式触发 3**：批量迁移 ≥ 2 个 Skill，需要三批次策略自动分类（0 段清零 / 1 段补齐 / P1→P2 打磨）
- **脚本/审计触发 4**：`audit:skill-coverage` 报告内容子项 WARN（如"触发条件可判定规则<4 条""交付物 <10 项""缺必要且充分条件声明"）
- **设计/协议触发 5**：新建 Skill 后被 RULE-TPL 阻断，或现有 Skill change_log 缺"5 段式骨架模板"信号词导致被审计误判为存量

**不触发场景**（减少误激活，至少 2 条）：
- 只改 Skill 业务正文内容（阈值/案例编号/SOP 措辞），不涉及 5 段骨架结构调整
- 新建 Skill 时已经按 `_SKILL-TEMPLATE.md` 复制生成，结构已合规

**协作 Skill（链式调用，至少 3 个）**：
- `v9-code-quality-audit`：迁移前后检查导入违规/any/硬编码等代码质量
- `cross-index-governance`：若 Skill 被 AGENTS.md/README 引用，需同步文档交叉索引
- `stale-path-reference-audit`：迁移后校验原文档路径链接不失效
- `type-safety-contract`：若迁移时改了 TS 类型定义，强制 6 步契约

---

## 二、前置检查清单（先扫后改，必须先通过再动手，表格化 7 项）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 模板文件存在 | `ls .agents/skills/_SKILL-TEMPLATE.md` | 文件存在且含五段标准标题（一~五），可作为复制骨架来源 |
| 2 | RULE-TPL 门禁脚本存在 | `grep "RULE-TPL" package.json` + `ls scripts/audit/audit-skill-coverage.cjs` | 审计脚本路径存在且 package.json 有 `audit:skill-coverage` 命令 |
| 3 | skill-registry 存在 | `ls .trae/skills/skill-registry.json` | mandatory 默认值/路径/slug 信息可核对，作为 Frontmatter 对齐真相源 |
| 4 | 镜像加载器存在 | `grep "skill:mirror" package.json` | 有 `npm run skill:mirror` 命令，用于收尾同步 .workbuddy 加载器 |
| 5 | 基线审计结果保存 | 运行 `npm run audit:skill-coverage > baseline-before.log` 并 grep `ERROR` 数量 | 记录「N ERROR / M WARN」作为迁移后清零对照 |
| 6 | 基线分类打分 | 运行打分脚本（若项目有 `tmp_skill_migration_score.cjs` 则用），或手动判定每个 Skill：段数命中数（0/1/3/5）+ FM 缺字段数 + 子项缺口数 | 生成「0段 / 1段 / P1-P2」三类候选，用于 Batch-A/B/C 自动划分 |
| 7 | .bak 备份安全确认 | `ls .agents/skills/**/*.bak` | 迁移前残留 .bak = 0，避免与本次生成的 .bak 混淆

> **铁律**：上表任一项未通过 → 先修复前置问题再推进。尤其 #5 基线审计 ERROR 数必须迁移后清零或减少（ERROR≠0 = 重构没闭环）。

---

## 三、阶段化 SOP（5 Phase · 三批次策略 + 标题重映射矩阵 + 7 步统一流程 + 15 子项速补片段）

### Phase 0 — 三批次策略自动划分（批量迁移前必做）

**目标**：按 Skill 当前状态自动落到 Batch-A/B/C，避免用同一种方式处理 0 段 Skill 和 5 段长文 Skill（后者丢失业务内容）。

**交付物**：
1. **批次划分矩阵（按表勾选每个 Skill）**：
   ```
   □ Batch-A P0 0 段清零（段命中 0~1 段或 FM 缺 3+ 字段）：
     直接 cp _SKILL-TEMPLATE.md 覆盖 SKILL.md；业务内容从 .bak 对照回填。
   □ Batch-B P0 1 段补齐（段命中 1~4 段 / FM 4~5 字段）：
     保留原 5+ 段正文，用【标题重映射矩阵】把自定义长标题 → 标准 5 段标题（§一~§五），不丢失业务事实。
   □ Batch-C P1→P2 打磨（FM 6/6 + 5/5 段命中，但内容子项 <15 / 缺信号词 / 7 步勾表未全勾）：
     不需要重写结构，只补内容子项缺口（§二→7 项、§五→12+ 项、末尾加声明段）+ last_updated 升版 + change_log 加信号词。
   ```
2. **【标题重映射矩阵】（Batch-B/C 必用，避免误删业务段）**：

   | 原自定义标题示例（正则宽松匹配） | 重映射为标准 5 段标题 |
   |------------------------------|-------------------|
   | 适用场景 / 为什么需要 / Invoke When / 判断规则 / 触发条件 * | → **一、触发条件** |
   | 前置检查 / 启动前必过 / 核心概念 / 场景铁律 / 基线锚定 / 真相源 / 清单 * | → **二、前置检查清单（先扫后改，必须先通过再动手）** |
   | SOP 正文 / 流程 / 6 步法 / 执行 / 实施 / 阶段化 / Phase 0~N * | → **三、阶段化 SOP** |
   | 陷阱 / 经验教训 / 踩坑 / 反模式 / 决策陷阱 / 常见误区 * | → **四、陷阱与经验教训** |
   | 完成交付物 / 交付清单 / 验收标准 / 收尾 / 必要且充分条件 * | → **五、完成交付物清单** |
   | 附录 / 案例 / 速查表 / 参数表 / 规格附录 | → **保留为 §五 后面的附录段（不改变段号，附在末尾），不可删除！** |

3. **每 Skill 7 步统一 SOP（Batch-A/B/C 通用，逐项打勾）**：

   | Step | 动作 | Batch-A（0段） | Batch-B（1段重映射） | Batch-C（P1→P2打磨） |
   |------|-----|--------------|------------------|------------------|
   | 1 | **备份**：`cp <slug>/SKILL.md <slug>/SKILL.md.bak` | ✅ 必做（回填业务对照） | ✅ 必做 | ✅ 必做 |
   | 2 | **结构调整**：从 _SKILL-TEMPLATE.md 复制骨架 or 标题重映射 | ✅ cp 覆盖后回填 | ✅ 矩阵重映射，不删正文 | ✅ 不动结构，只改 FM/段落内容 |
   | 3 | **Frontmatter 6/6 对齐**：name/description/version↑/last_updated↑ (今日) / change_log[] 增条目（含"5 段式骨架模板"信号词激活 RULE-TPL）/ mandatory 与 registry 三端一致 | ✅ 缺字段从 registry 回填 | ✅ 升版+信号词+对齐 | ✅ 升版+信号词+确认对齐 |
   | 4 | **15 内容子项速补**（用下方【15 子项速补片段】快速补齐常见缺口） | ✅ 全部子项补一遍 | ✅ 检查是否 ≥70% | ✅ 只补缺口 1~2 项 |
   | 5 | **四端同步**：若目录 slug 未变通常只需 README 描述更新；若 mandatory 改变，同步 skill-registry.json + AGENTS.md 技能索引 | ✅ registry 对齐 | ✅ registry 对齐 | ✅ 检查 registry/AGENTS 已同步 |
   | 6 | **RULE-TPL 门禁**：`npm run audit:skill-coverage`（0 ERROR 才继续；19 条"触发条件<4 条"WARN 不阻断） | ✅ 必跑 | ✅ 必跑 | ✅ 必跑 |
   | 7 | **skill:mirror + cleanup**：`npm run skill:mirror` → 确认 0 drift → `rm *.bak` | ✅ 必跑 | ✅ 必跑 | ✅ 必跑 |

### Phase 1 — 【15 子项速补片段】（针对常见缺项，复制粘贴即达标，内容合规不丢业务事实）

**目标**：批量迁移时，常见缺口（如 §二只有 4 项、§五只有 10 项、缺 E2 必要且充分条件声明），用下方模板速补，不影响 Skill 原有业务内容。

**交付物**：速补片段库（按需插入对应段末尾）：

- **【B1-B3 速补 2-3 行】**（若 §二 表格化检查项 < 7 行，追加 2-3 行通用占位检查）：
  ```
  | 6 | 注册表与镜像一致性 | `npm run audit:skill-coverage` | 0 Missing / 0 Duplicate / 0 Path Not Exist |
  | 7 | 场景/目标版本占位 | 明确本 Skill 本轮改动的场景与版本号 | 禁止无明确场景就改配置/阈值/接口签名，作为 §三 Phase 5 收尾对照 |
  > **铁律**：上表任一项未通过 → 先修复前置问题再推进。禁止跳过检查直接改代码。
  ```

- **【D1-D2 教训速补 2-4 条】**（若 §四 教训条目 < 8 条，从 FinSightV9 通用库复制粘贴）：
  ```
  | # | 陷阱 | 后果 | 规避 |
  |---|------|-----|-----|
  | N | 改完后不跑 audit:skill-coverage 直接提交 | RULE-TPL 强审 FAIL（缺段/缺信号词），husky 阻断 commit | Step 6 强制跑 `npm run audit:skill-coverage` 0 ERROR 再提交 |
  | N+1 | 只改 Frontmatter last_updated，不改 change_log 信号词 | 存量技能误判为"未迁移"，审计持续产生 WARN（或下次推广批重复迁移） | FM 升版时 change_log 新增条目必须包含「基于 S 级 5 段式骨架模板」字面量 8 个字 |
  | N+2 | 复制模板骨架时误删原 Skill 业务附录（如模型规格、6 Phase SOP） | 内容质量骤降；团队原有业务 SOP 事实丢失 | Batch-B/C 强制用【标题重映射矩阵】不删附录；Batch-A 从 .bak 回填附录到 §五之后 |
  | N+3 | mandatory=false/true 与 skill-registry.json 不一致 | RULE-TPL 报"frontmatter ↔ registry 漂移"；批量推广后持续 WARN | Step 3 必核对 registry 中该 slug 的 mandatory 值；不一致立刻修 Skill FM |
  ```

- **【E1-E2 速补 3 项+声明段】**（若 §五 < 12 项交付物，追加通用项；缺 E2 末尾声明直接复制）：
  ```
  | N | skill-registry mandatory 与 frontmatter 对齐检查 | `.trae/skills/skill-registry.json` 中 `mandatory=<X>` 与本 Skill FM `mandatory=<X>` | grep 两者值完全一致 |
  | N+1 | 镜像同步 skill:mirror 完成 + audit:skill-coverage 通过 | `.workbuddy/skills/<slug>/SKILL.md` 存在 | `npm run audit:skill-coverage` 0 Missing/Duplicate/NotExist |
  | N+2 | 7 步迁移勾表全部勾选 | 交付文件/最终回复中的 7 步表 | 7 ☑ 全绿 = 迁移完成
  
  > **必要且充分条件声明**：仅当上述全部交付项满足，才算本 Skill 5 段式骨架迁移**完整交付**；任一不满足 = 「迁移未完成」，不允许标记为交付结束。
  ```

### Phase 2 — 逐 Skill 执行（按 Phase 0 划分的批次顺序）

**目标**：每迁完 1 个 Skill 立刻跑 Step 6+Step 7（audit + mirror），避免批量迁完后一次性报错不知道哪一个引入。

**标准顺序**：Batch-A 7项 × 7 Step → Batch-B 12项 × 7 Step → Batch-C 2项 × 7 Step。每批结束后汇总 RULE-TPL 结果。

### Phase 3 — 批量迁移清单回写（项目级报告必做）

**交付物**：
1. 更新迁移检查清单头部汇总（段数/FM/子项/达标率/优先级分布/批次进度 6 行）
2. 更新 §1 打分表（对应 Skill 的 7 步勾表改为 ☑，综合分从旧→新）
3. 更新 §2 对应 Batch 表格的「缺失要点」→「迁移要点」
4. 更新 §4 批次验证表（计划/实际/audit 结果/mirror/完成标记 5 列）
5. 更新 §6 变更记录（新增本批次条目，含版本号/日期/综合分变化/P0-P1 清零情况）

### Phase 4 — 全量门禁验证 + 收尾（最后必跑，不允许跳过）

**交付物打勾表**：
- [ ] **全量 RULE-TPL**：`npm run audit:skill-coverage` 输出 ERROR=0；WARN 只能是"触发条件可判定规则<4 条"内容质量建议（不阻断 exit 0）
- [ ] **全量镜像**：`npm run skill:mirror` 输出「联接复用」（junction 物理单份，无漂移）
- [ ] **无残留 .bak**：`ls .agents/skills/**/*.bak` 返回空
- [ ] **mandatory 21/21 对齐**：`diff <(jq '.skills[] | {slug, mandatory}' .trae/skills/skill-registry.json | sort) <(grep -E "^name:|mandatory:" .agents/skills/*/SKILL.md | sort)` 输出无差异
- [ ] **迁移检查清单 7 步勾表 21 Skill 全 ☑**：清单 §1 第 7 列 0 □

---

## 四、陷阱与经验教训（8 条，基于 FinSightV9 21 项 Skill × 三批次实战踩坑）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 把所有 Skill 统一 cp _SKILL-TEMPLATE.md 覆盖（不分 Batch-A/B/C） | 原 5+ 段长文的业务内容丢失（如 6 Phase 架构 SOP、模型规格附录、16 条实战教训）→ 内容质量骤降 | **强制 Phase 0 批次划分**：0 段 Skill 才 cp 覆盖；1+ 段 Skill 用【标题重映射矩阵】重映射不删正文 |
| 2 | 升版 last_updated 但 change_log 条目不含「5 段式骨架模板」8 个字符 | RULE-TPL 判定为"存量未迁移"只给 WARN（弱检查），下次批量推广时被再次加入候选池，团队重复劳动 | **Step 3 铁律**：每次 migration 升版 change_log 条目必须字面量包含「基于 S 级 5 段式骨架模板」；复制粘贴本条目模板避免拼写差异 |
| 3 | mandatory 字段只改 Skill 不改 registry / 只改 registry 不改 Skill | RULE-TPL 报"frontmatter ↔ registry 漂移"ERROR 或持续 WARN；husky 阻断或下次推广重复改 | Step 3 必打开 `.trae/skills/skill-registry.json` 搜索该 slug 的 mandatory 字段值；Skill FM 与之一致；FinSightV9 21 项迁移实战中共修复 constant-migration false→true 1 例 |
| 4 | 迁移完成后不清理 .bak 备份文件 | 项目仓库中 .bak 与 SKILL.md 并存，下次推广时被 Glob 扫到，人/脚本误判为"迁移未完成"；代码评审时被质疑版本 | Step 7 最后 `rm .agents/skills/<slug>/SKILL.md.bak`；批量迁移后用 `ls **/*.bak` 确认 0 残留 |
| 5 | 审计脚本 RULE-TPL 的「强 FAIL」对存量 Skill 一刀切（只看 last_updated ≥ 日期） | 迁移过程中所有存量 Skill 被误判为 ERROR，husky 阻断，正常开发无法提交 | RULE-TPL 规则要用「双维度判断」：change_log 含「5 段式骨架模板」信号词 → 强 FAIL（缺段 exit 1）；只 last_updated ≥ 日期但无信号词 → 弱 WARN（不阻断），给存量留缓冲窗口 |
| 6 | 迁移前不保存 baseline-before.log 基线违规数 | 迁完后无法判断 ERROR/WARN 数量是清零了还是越迁越多 → 「比基线更多」时不能及时回滚 | Phase 0 Step 5 必保存 `audit:skill-coverage > baseline-before.log`；收尾后 diff baseline-after.log vs before，确保 ERROR→0 或减少 |
| 7 | 只改单个 Skill 不跑 skill:mirror | `.agents/skills/` 目录改完但 `.workbuddy/skills/` 加载器镜像仍为旧版 → 实际运行时加载错位的 SKILL.md；团队成员看到的是旧版 | Step 7 强制 `npm run skill:mirror`；输出含「清理孤儿 X 个」时需要人工核对孤儿是旧 Skill 残留还是真误删 |
| 8 | collection-pipeline-governance 类 "已接近 P2 只差 1 子项缺口" 被归入 Batch-A 做全盘 cp | 原有 8 条触发规则/6 大场景模板/8 条 P0 教训全部丢失 → 重写耗时+业务事实出错 | **P2 近合规 Skill（FM 6/6 + 5/5 段命中）一律归入 Batch-C 打磨**：只补 §二 2 行检查项 / §五 1-2 项交付物 + 末尾声明段，绝不破坏原有结构 |

---

## 五、完成交付物清单（必要且充分条件 · 7 项 · 少一项 = 迁移未完成）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 所有目标 Skill 的 Frontmatter 6/6 对齐 + 信号词生效 | `.agents/skills/<slug>/SKILL.md` Frontmatter | grep 每个 Skill 的 mandatory/change_log 信号词/last_updated 与 registry 一致 |
| 2 | 所有目标 Skill 的 5 段标题 5/5 命中（RULE-TPL 正则） | 同上文件 §一~§五 标题 | `npm run audit:skill-coverage` 输出 RULE-TPL ERROR=0 |
| 3 | 内容子项 15 条 ≥ 80% 平均通过（批量迁移完成目标） | 同上文件 §一~§五 结构 | 打分脚本 21 Skill 平均 ≥ 12/15；P2 Skill ≥ 11/15 |
| 4 | 迁移检查清单（md 交付文件）回写完成 | 清单文件 §1 全部 7 ☑ + §4 批次表 完成 21/21 + §6 有变更条目 | grep "□" 数量=0（除待下阶段外所有勾表为 ☑） |
| 5 | 三批次 RULE-TPL 强审 exit 0 报告保存 | `deliverables/YYYY-MM-DD-skill-migration-report.md` 或交付日志 | exit code 0；ERROR 计数 0；WARN 分类记录为后续优化 |
| 6 | skill:mirror 21/21 同步 + 0 孤儿 .bak | `.workbuddy/skills/` 目录与 `.agents/skills/` 一一对应 | ls 输出一致；`ls **/*.bak` = 0 |
| 7 | 本次迁移 SOP 已沉淀为 Skill（即本 Skill 存在） | `.agents/skills/skill-5seg-migration/SKILL.md` | 文件存在且 frontmatter/5 段结构合规 |

> **必要且充分条件声明**：仅当上述 7 项全部满足，才算 Skill S 级 5 段式骨架迁移**项目级完整交付**；任一不满足 = 「迁移未完成闭环」，不允许标记为交付结束。
