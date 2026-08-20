---
name: "industry-score"
description: "行业评分技能：执行行业级别的综合评分分析，输出行业得分供个股分析模型 L-1 层使用。Invoke when 用户在行业评分页面触发评分、sectorSkillData 量化数据更新、上传新行业资料或政策研报文本、距上次评分超过 3.5 天需要刷新时。"
version: "v1.0.4"
last_updated: "2026-08-21"
change_log:
  - version: v1.0.4
    changes: "§一 触发条件 改写为 RULE-TPL 三标签格式（显式触发×2 / 脚本/审计触发×2 / 设计/协议触发×1），词命中 ≥5，满足 RULE-TPL §一 可判定规则校验。"
    date: 2026-08-21
  - version: v1.0.3
    changes: "§四 陷阱与经验教训 补齐第 8 条（有效维度<60%综合分强制null），满足 RULE-TPL 教训条目≥8 要求；RULE-TPL 审计再扫全绿。"
    date: 2026-08-21
  - version: v1.0.2
    changes: "Batch-A P0 迁移：基于 S 级 Skill 5 段式骨架模板重建，补齐 §一触发条件/§二前置检查/§三阶段化 SOP/§四陷阱教训/§五交付物清单五大段；增加 mandatory 字段。"
    date: 2026-08-21
  - version: v1.0.1
    changes: "C类日期闭环(2026-08-11)：change_log最新条目日期同步至last_updated"
    date: 2026-08-11
  - version: v1.0.1
    changes: "基准日校对(2026-08-11)：补齐 YAML frontmatter（对齐 skill-registry.json 元数据）；将硬编码绝对路径（外部 .trae/skills 目录）替换为相对引用 .agents/skills/"
    date: 2026-08-11
  - version: v1.0.0
    changes: "初始版本，基于 V6 `sectorSkillData` 与 `sector-analysis-framework` 整合。"
    date: 2026-06-24
mandatory: false
---

# 行业智能评分 Skill（V4 行业评分） — v1.0.4

> **版本**: v1.0.4 | **日期**: 2026-08-21 | **校验基准**: FinSightV9 code_version 2.0.0-rc.1
> **任务性质**: SOP 执行（行业七维评分编排），允许写入 industry_scores Store，禁止绕过 JSON schema 校验或给缺失维度填默认值
> **输出格式**: 阶段化 SOP 矩阵 + 七维评分 JSON（含 evidence/missingFields）+ 版本记录持久化确认

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「行业评分」「V4行业评分」「行业七维评分」「运行行业智能评分」；或用户在 V4 行业评分页面（`/analysis/industry-score`）选择行业/赛道并点击"运行行业智能评分"按钮
- **显式触发 2**：用户上传新的行业资料（txt/md/json）或政策/研报文本后需重算评分；或距上次评分超过 3.5 天（每周至少更新两次）的时效刷新需求
- **脚本/审计触发 3**：`src/data/sectorSkillData.ts` 中 SKILL 量化数据（planAlignment/policySupport/skillC/skillA/skillN 等）发生更新，CI/CD 触发评分刷新；或 `npm run audit:skill-coverage` 报评分注册表漂移
- **脚本/审计触发 4**：`v6-stock-analysis-model` L-1 层执行前，检查到行业评分缺失或过期触发补算；或 vitest 中行业评分快照与最新结果不一致
- **设计/协议触发 5**：`v6-stock-analysis-model` 执行 L-1 层行业评分估值注入前，需要最新行业评分；或行业评分维度/权重公式版本变更后存量分数重评；SKILL 行业分析报告目录版本更新

**不触发场景**（减少误激活，至少 2 条）：
- 个股层面的 L0-L8 评分（走 `intelligent-score` 或 `v6-stock-analysis-model`）
- 纯六维度板块轮动信号分析（走 `sector-analysis-framework`）

**协作 Skill（链式调用，至少 1~3 个）**：
- `sector-analysis-framework`：六维度板块框架（轮动信号/政策/竞争/技术/下游/基金估值）作为评分输入
- `industry-score-mapping`：将行业评分结果按个股匹配并注入 V6 L-1 层
- `v6-stock-analysis-model`：消费本 Skill 输出作为 L-1 层行业评分估值输入
- `audit:skill-coverage`：完成后核验注册完整性

---

## 二、前置检查清单（先扫后改，**先通过再动手**，按表格列出）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | SKILL 数据源存在性 | 读取 `src/data/sectorSkillData.ts` | 文件存在且含 planAlignment/policySupport/skillC/skillA/skillN 字段 |
| 2 | 行业评分 Service 就绪 | 检查 `src/services/scoring/industryScoreService.ts` | 导出 `runIndustryScore()` 且文件可读 |
| 3 | LLM 配置有效性 | 查看 llmConfig.baseURL / apiKey / model 三字段 | 三字段均不为空，或前端页面已配置 |
| 4 | Store 持久化就绪 | 检查 `src/store/industryScoreStore.ts` 与 DataBridge ENVELOPE_ACTION | industry_scores store 存在且有写入处理器 |
| 5 | 注册表四端一致 | 运行 `npm run audit:skill-coverage` | industry-score 不出现 Missing/Duplicate |

> **铁律**：上表任一项未通过 → 先修复前置问题，再推进。禁止跳过检查直接调用 LLM。

---

## 三、阶段化 SOP（按 Phase 0~N 组织，**每阶段必写目标 + 交付物清单 + 代码/文档模板**）

### Phase 0 — 输入读取与缺失项标记

**目标**：加载三源输入（SKILL 量化数据 + 用户上传文件 + 行业报告文本），标记缺失项并决定是否继续。

**交付物**：
1. **输入快照清单**（每项标注"有效/缺失/null"）：
   ```
   - sectorSkillData[行业].planAlignment  → 有效值 5.0
   - sectorSkillData[行业].scarcityValue   → 有效值 4.2
   - 用户上传文件（0/N 份）                 → 缺失
   - 行业报告文本                          → 有效（XX 字符）
   ```
2. **三源输入汇总对象**（供后续 LLM Prompt 拼接）：
   ```typescript
   interface IndustryScoreInput {
     sectorCode: string;           // 如 'AI' / 'CoWoS'
     skillData: SectorSkillEntry;  // sectorSkillData 原始条目
     files: File[];                // 用户上传的 txt/md/json
     reportText: string;           // 用户粘贴的行业分析/研报文本
   }
   ```

### Phase 1 — Prompt 构建与 LLM 推理

**目标**：按七维评分 Rubric 组装 Prompt，调用 LLM 并强制返回 JSON（禁止 markdown 代码块）。

**交付物**：
1. **Prompt 构建模板**（七维 Rubric 内嵌）：
   ```typescript
   // 维度定义与评分指引（政策契合度/稀缺性/国产替代空间/技术先进性/行业景气度/估值吸引力/情绪热度）
   // 每条 Rubric 含：利好利空阈值 + 证据引用要求
   ```
2. **LLM 输出 Schema**（严格 JSON，缺维度=null）：
   ```typescript
   interface IndustryScoreOutput {
     dimensions: Array<{
       name: string;              // 政策契合度 等七维
       score: number | null;      // 1-5 或 null（禁止填默认值）
       rationale: string;         // 必须引用 SKILL 分值/文件片段/报告片段
       evidence: string[];        // 1-3 条关键证据
     }>;
     summary: string;             // 行业整体定性评价
     basis: string;               // 评分依据说明
     missingFields: string[];     // 数据缺失项列表
   }
   ```
3. **推理完成确认**：JSON 解析成功，score 字段在 1-5 或 null 范围内。

### Phase 2 — 结果校验与版本保存

**目标**：校验七维完整性、证据链非空、禁止杜撰数据，通过 DataBridge.forward 持久化到 industry_scores。

**交付物**：
1. **校验清单打勾表**：
   - [ ] 七个维度均存在（不缺段）
   - [ ] 所有 score 为 null 的维度，rationale 含「数据缺失，未参与评分」字样
   - [ ] 每个有效 score ≥1 且 ≤5，rationale 引用了证据
   - [ ] evidence 数组每维度 ≥1 条
   - [ ] 不包含 overallScore 字段（综合分由调用方计算）
2. **版本保存代码模板**：
   ```typescript
   // 禁止直接写 dataLayer，必须走 DataBridge
   await DataBridge.forward({
     action: ENVELOPE_ACTION.INDUSTRY_SCORE_PUT,
     payload: { sectorCode, dimensions, summary, basis, missingFields, timestamp },
     meta: { source: 'industry-score skill v1.0.2' }
   });
   ```
3. **保存确认**：读取 store 最新记录，id 自增且 sectorCode 匹配。

### Phase 3 — 综合分计算与跨层传递准备

**目标**：调用方根据有效维度等权平均（null 维度不参与权重），格式化供下游消费。

**交付物**：
1. **综合分公式**：
   ```
   overallScore = Σ(有效维度.score) / 有效维度数量
   （有效维度 = dimensions.filter(d => d.score !== null).length）
   ```
2. **V6 L-1 层对接格式**：供 `industry-score-mapping` 提取 SKILL-C/SKILL-N 合成用。

---

## 四、陷阱与经验教训（**至少 6 条，基于实战提炼，禁止空话**）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 数据不足时给中性分（3分）或默认值 | 评分失真，给 L-1 层注入假信号 | **强制 null 策略**：缺数据的维度必须 score=null，rationale 标注「数据缺失，未参与评分」，综合分只对有效维度等权平均 |
| 2 | LLM 返回 markdown 代码块 ```` ```json ```` 包裹 | JSON.parse 失败，评分结果丢失 | Prompt 明确要求「严格返回 JSON，不要 markdown 代码块或额外解释」，解析失败时 fallback 二次重试 + strip ``` 包裹 |
| 3 | evidence 为空数组或泛泛而谈 | 评分无依据可追溯，置信度降级 | §二前置检查时强制每个有效评分维度 evidence ≥1 条，且必须引用具体来源前缀（SKILL:/报告:/文件:） |
| 4 | 照搬 sectorSkillData 评分不修正 | SKILL 量化是静态快照，未考虑最新政策/事件 | Prompt 明确要求「已有 SKILL 量化评分作为重要参考，但不要照搬，需结合最新资料动态修正」 |
| 5 | 直接写 dataLayer 绕过 DataBridge | ACL 拒绝、无版本审计、违反 audit:layers | Phase 2 保存时强制走 `DataBridge.forward(ENVELOPE_ACTION.INDUSTRY_SCORE_PUT)`，禁止裸操作 `dataLayer.industry_scores.put` |
| 6 | 缺少 last_updated 与时效校验 | 评分过时仍被 V6 L-1 消费 | §一触发条件内置「距上次评分 >3.5 天自动刷新」逻辑；读取时校验 timestamp 与当前日期差 |
| 7 | 行业代码（sectorCode）大小写/别名不一致 | 跨 Skill 匹配失败，L-1 层取不到评分 | 在 §一 与 `industry-score-mapping` 中维护一份统一的行业代码字典（AI/CoWoS/机器人 等标准 slug） |
| 8 | 有效维度 < 60%（7 维缺 >3 维）仍强行输出综合分 | 综合分参考性极低，误导 L-1 判断，置信度降为「N/D-严重缺失」 | Phase 2 综合分计算前加关卡：若有效维度 < 60%，综合分强制 null，并在 summary 首句标注「数据严重缺失（仅 X/7 有效），建议先补齐 SKILL 量化或最新政策资料后重试」 |

---

## 五、完成交付物清单（**必要且充分条件，少一项 = 未完成**）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 七维评分 JSON 结果（dimensions + summary + missingFields） | LLM 响应 / industry_scores store | JSON schema 校验 7 维度齐全；null 维度 rationale 含缺失说明 |
| 2 | 证据链完整（每个有效评分维度 ≥1 条 evidence） | dimensions[].evidence 数组 | Grep 每条 evidence 带 SKILL:/报告:/文件: 前缀 |
| 3 | 版本记录已持久化 | industry_scores store 最新行 | DataBridge.query 取回，确认 id/sectorCode/timestamp 三字段匹配 |
| 4 | SKILL.md Frontmatter 升版（三端同步） | [SKILL.md](file:///d:/FinSightV9/.agents/skills/industry-score/SKILL.md) | version=v1.0.2 / last_updated=2026-08-21 / change_log 含「5 段式骨架模板」信号 |
| 5 | skill-registry.json 条目描述同步（如需） | [skill-registry.json](file:///d:/FinSightV9/.trae/skills/skill-registry.json) | description 字段包含 4 条具体触发条件摘要 |
| 6 | 生产类型检查通过 | `npm run tsc:prod` | 0 error |
| 7 | 架构审计通过 | `npm run audit:layers` + `npm run audit:skill-coverage` | 0 ERROR 0 WARN（RULE-TPL 对本 Skill 命中强 FAIL） |
| 8 | 综合分计算可复算 | 调用方代码或独立脚本 | Σ(有效维度.score)/有效维度数量 = expected overallScore |

> 推广说明：本 Skill 基于 S 级 5 段式骨架模板 v1.0 创建。作为运行时特性类 Skill，Phase 段落围绕评分输入/推理/校验/保存四阶段组织；§一触发条件、§二前置检查、§四陷阱教训、§五交付物清单四段严格保留。
