---
skill_id: V9-SKILL-INTELLIGENT-SCORE
name: "intelligent-score"
description: "智能评分技能：执行个股综合智能评分，整合多维度因子输出智能评分结果。Invoke when 用户在个股智能评分页面点击开始、stocks基础数据变化、上传新补充资料或行业报告、距上次评分超过3.5天需要刷新时。"
version: v1.0.7
last_updated: 2026-08-23
change_log:
  - version: v1.0.7
    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 8 条压缩为 2 条，保留 5 段式骨架模板 信号",
    date: 2026-08-23
  - version: v1.0.6
    changes: "基准校对(2026-08-23)：A类双轨(fm v1.0.5 / 正文 v1.0.4) → 取真值 max=1.0.5 → PATCH++ 对齐 frontmatter/正文/change_log 三轨",
    date: 2026-08-23
  - version: v1.0.0
    changes: "初始版本（历史 6 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕",
    date: 2026-06-24
mandatory: false
---

# 智能投研评分 Skill（V6 个股智能评分） — v1.0.7

> **版本**: v1.0.7 | **日期**: 2026-08-21 | **校验基准**: FinSightV9 code_version 2.0.0-rc.1
> **任务性质**: SOP 执行（个股九维智能评分编排），允许写入 intelligent_scores Store，禁止给缺失维度填默认值、禁止 LLM 返回 overallScore，禁止绕过 JSON schema 校验
> **输出格式**: 阶段化 SOP 矩阵 + 九维评分 JSON（dimensions/summary/missingFields）+ 版本记录持久化确认

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确要求「智能评分」「V6智能评分」「个股九维评分」「intelligent-score」「开始智能评分」；或用户在 V6 个股智能评分页面（`/analysis/intelligent-score`）选择/输入标的并点击「开始智能评分」
- **显式触发 2**：用户上传新的补充资料（txt/md/json）或行业分析报告；或距上次评分超过 3.5 天（每周至少更新两次）需要刷新评分
- **脚本/审计触发 3**：已录入 `stocks` 表的标的基础数据（price/pe/pb/roe/marketCap 等）发生变化触发重算；或 `npm run audit:skill-coverage` 报评分注册表漂移
- **脚本/审计触发 4**：`v6-stock-analysis-model` 需九维评分结果作为分层模型量化参考时上游触发；或 vitest 中九维评分快照断言不通过
- **设计/协议触发 5**：九维评分权重/维度定义版本变更后存量分数重评；V6 模型层次结构调整时，九维评分作为量化参考的接口契约变更；评分 JSON Schema 版本升级需要回填兼容

**不触发场景**（减少误激活，至少 2 条）：
- 行业层面的七维评分（走 `industry-score`）
- 完整 V6 L-1~L8 分层递进式深度分析（走 `v6-stock-analysis-model`）

**协作 Skill（链式调用，至少 1~3 个）**：
- `v6-stock-analysis-model`：九维评分的各维度映射来源（V6 L0~L8 模型）
- `industry-score-mapping`：九维「行业」维度的行业评分自动注入
- `valuation-financial-analysis`：九维「估值/盈利/质量」财务维度的计算参考
- `audit:skill-coverage`：完成后核验注册完整性

---

## 二、前置检查清单（先扫后改，**先通过再动手**，按表格列出）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | stocks 基础数据就绪 | `DataBridge.query(STORE.stocks, symbol)` 取回 price/pe/pb/roe/marketCap | 必填字段（至少 price/pe/marketCap）非空；缺失项进入 missingFields |
| 2 | 评分 Service 就绪 | 检查 `src/services/scoring/intelligentScoreService.ts` | 导出 `runIntelligentScore()` 且文件可读 |
| 3 | LLM 配置有效性 | 查看 llmConfig.baseURL / apiKey / model | 三字段均不为空，或前端页面已配置 |
| 4 | Store 持久化就绪 | 检查 `src/store/intelligentScoreStore.ts` 与 DataBridge ENVELOPE_ACTION | intelligent_scores store 存在且有写入处理器 |
| 5 | 注册表四端一致 | 运行 `npm run audit:skill-coverage` | intelligent-score 不出现 Missing/Duplicate |

> **铁律**：上表任一项未通过 → 先修复前置问题，再推进。禁止跳过检查直接调用 LLM。

---

## 三、阶段化 SOP（按 Phase 0~N 组织，**每阶段必写目标 + 交付物清单 + 代码/文档模板**）

### Phase 0 — 三源输入读取与缺失标记

**目标**：加载 stocks 基础数据 + 用户上传补充文件 + 行业报告文本三源，逐项标记有效/缺失。

**交付物**：
1. **输入快照对象**：
   ```typescript
   interface IntelligentScoreInput {
     symbol: string;                   // 600519.SH 等
     baseData: Partial<Stock>;         // stocks 表基础数据（含缺失）
     files: File[];                    // txt/md/json 补充文件
     reportText: string;               // 行业分析/研报文本
     missingBaseFields: string[];      // ['roe', 'marketCap'] 等
   }
   ```
2. **V6 模型映射关系表**（提示 LLM 如何对齐 V6 L-1~L8）：
   ```
   估值 ← L3财务/估值   成长 ← L1护城河/L7第二曲线/L2竞品
   盈利 ← L3财务        质量 ← L3财务/L1护城河
   动量 ← L8筹码        波动 ← L8筹码
   流动性 ← L8筹码      行业 ← L-1行业评分/L0宏观
   情绪 ← L0宏观/L6 Hype Cycle
   ```

### Phase 1 — Prompt 构建与 LLM 推理

**目标**：按九维评分 Rubric 组装 Prompt，调用 LLM 并强制返回 JSON。

**交付物**：
1. **九维评分 Rubric**（1-5 分标准，每维含评分指引）：
   ```
   估值: PEG<0.5→5分, 0.5-0.75→4分, 0.75-1.25→3分, >1.5→≤2分
   成长: 营收增速>30%→高分, ROE持续→加分, 第二曲线→加分
   盈利: ROE>15%→高分, 经营现金流/净利>120%→健康
   质量: 资产负债表健康→加分, 应收账款恶化→减分
   动量/波动/流动性: 均线/成交量等技术信号（基础数据计算辅助）
   行业: 行业景气+政策支持+竞争格局+国产替代（来自industry-score-mapping）
   情绪: 资金流向+事件催化+Hype位置
   ```
2. **LLM 输出 Schema**（九维齐全，null 维度必须含缺失说明）：
   ```typescript
   interface IntelligentScoreOutput {
     dimensions: Array<{
       name: '估值'|'成长'|'盈利'|'质量'|'动量'|'波动'|'流动性'|'行业'|'情绪';
       score: number | null;   // 1-5 或 null，禁止中性默认值
       rationale: string;
       evidence: string[];
     }>;
     summary: string;
     basis: string;
     missingFields: string[];
   }
   ```

### Phase 2 — 结果校验与版本保存

**目标**：校验九维完整性、证据链非空、禁止 overallScore 字段，通过 DataBridge.forward 持久化。

**交付物**：
1. **校验打勾表**：
   - [ ] 九个维度齐全（名称严格匹配 9 个枚举值）
   - [ ] null 维度 rationale 含「数据缺失，未参与评分」
   - [ ] 有效维度 score ∈ [1, 5]
   - [ ] 每个有效维度 evidence ≥1 条，前缀（基础数据:/文件:/报告:）
   - [ ] **无 overallScore 字段**（综合分调用方计算）
2. **保存代码模板**（强制 DataBridge）：
   ```typescript
   await DataBridge.forward({
     action: ENVELOPE_ACTION.INTELLIGENT_SCORE_PUT,
     payload: { symbol, dimensions, summary, basis, missingFields, timestamp },
     meta: { source: 'intelligent-score skill v1.0.2' }
   });
   ```

### Phase 3 — 综合分计算与结果返回

**目标**：调用方对有效维度等权平均，返回评分对象供页面展示或下游消费。

**交付物**：
1. **综合分公式**（null 维度不计入分母）：
   ```
   overallScore = Σ(有效维度.score) / 有效维度数量
   有效维度 = dimensions.filter(d => d.score !== null).length
   ```

---

## 四、陷阱与经验教训（**至少 6 条，基于实战提炼，禁止空话**）

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 基础数据缺失时给 3 分中性默认值 | 评分无依据，误导投资决策 | **强制 null 策略**：缺数据维度 score=null + rationale 标注缺失；综合分只对有效维度等权平均 |
| 2 | LLM 返回 overallScore 字段 | 与调用方计算结果冲突，双重标准 | Prompt 明确「LLM 只返回各维度分和总结，不返回 overallScore」；Phase 2 校验时检测到 overallScore 即 FAIL 重试 |
| 3 | evidence 为空或笼统 | 置信度降级，无法溯源 | Phase 2 校验：每个有效评分维度 evidence ≥1 条，且必须带 基础数据:/文件:/报告: 前缀之一 |
| 4 | 行业维度直接用 industry-score 结果不做个股校准 | 个股与行业偏离（核心标的/边缘标的） | 注入 industry-score-mapping 的关联度校准结果，边缘标的行业维度自动降权 |
| 5 | 直接操作 dataLayer.intelligent_scores.put | ACL 拒绝 + audit:layers 违规 | Phase 2 强制走 DataBridge.forward，禁止裸 dataLayer 访问 |
| 6 | 缺少时效性校验（3.5 天刷新） | 评分过时仍被消费 | §一触发条件内置时效检查；读取时校验 timestamp 距今天数 |
| 7 | 估值/盈利/质量 维度不参考 V6 确定性层计算 | LLM 主观估值偏离程序直算 | 先由 `valuation-financial-analysis` 程序直算 PEG/ROE/现金流等确定性指标，再塞给 LLM 作为强参考（不得偏离 >1 分） |
| 8 | 9 维评分中有效维度 < 70%（缺 >3 维）仍输出综合分 | 仅少数维度决定总分，综合分严重偏斜，投资决策参考性极低，置信度判为 N/D | Phase 2 综合分前加关卡：若有效维度 < 70%，综合分强制 null，读取方自动保留上次有效评分结果并在界面显示「本项数据覆盖严重不足，建议先补充基础数据或行业/个股资料」 |

---

## 五、完成交付物清单（**必要且充分条件，少一项 = 未完成**）

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 九维评分 JSON（估值/成长/盈利/质量/动量/波动/流动性/行业/情绪，共 9 维） | LLM 响应 / intelligent_scores store | 9 维齐全；null 维度含缺失说明；无 overallScore 字段 |
| 2 | 证据链完整（每个有效维度 ≥1 条 evidence） | dimensions[].evidence | Grep 前缀覆盖 基础数据:/文件:/报告: 三类 |
| 3 | 版本记录已持久化 | intelligent_scores store 最新行 | id/symbol/timestamp 三字段匹配，timestamp 为本次评分时间 |
| 4 | SKILL.md Frontmatter 升版 | [SKILL.md](file:///d:/FinSightV9/.agents/skills/intelligent-score/SKILL.md) | version=v1.0.2 / last_updated=2026-08-21 / change_log 含「5 段式骨架模板」信号 |
| 5 | skill-registry.json description 同步 | [skill-registry.json](file:///d:/FinSightV9/.trae/skills/skill-registry.json) | description 含 4 条具体触发条件摘要 |
| 6 | 生产类型检查通过 | `npm run tsc:prod` | 0 error |
| 7 | 架构审计通过 | `npm run audit:layers` + `npm run audit:skill-coverage` | 0 ERROR 0 WARN |
| 8 | 综合分可复算 | 调用方代码 | Σ(有效)/有效数量 = expected |
| 9 | 确定性维度校验 | 估值/盈利 维度与 valuation-financial-analysis 直算分差 | |分差| ≤ 1.0 |
