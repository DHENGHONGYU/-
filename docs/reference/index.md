---
title: index
type: reference
domain: project
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "原始 Kimi 安装路径（system prompt 硬编码，每次对话自动注入）："
tags: [project, registry, reference, governance, documentation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-097
related_docs: [V9-DOC-PROJ-219, V9-DOC-PROJ-220, V9-DOC-FRONT-045, V9-DOC-PROJ-206, V9-DOC-PROJ-208, V9-DOC-PROJ-201, V9-DOC-DATA-040, V9-DOC-PROJ-196, V9-DOC-PROJ-190]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 插件技能文档索引

> **Date**: 2026-07-12  
> **Source**: `plugins/` 目录（从 Kimi 自动安装位置同步）  
> **用途**: 项目团队内部查阅，无需依赖外部安装路径

---

## 已同步插件清单（9 个）

### 路径对照表（推荐直接使用「扁平化路径」）

| 插件名称 | 数据域 | 本地整理文档 | 扁平化 SKILL 路径（推荐） | 原始嵌套 SKILL 路径 |
|---------|--------|------------|------------------------|-------------------|
| **ifind** | 同花顺金融数据（A股/港股/美股） | [ifind.md](ifind.md) | [`plugins/ifind/SKILL.md`](../../plugins/ifind/SKILL.md) | [`plugins/ifind/skills/ifind/SKILL.md`](../../plugins/ifind/skills/ifind/SKILL.md) |
| **imf** | IMF 全球宏观经济数据 | [imf.md](imf.md) | [`plugins/imf/SKILL.md`](../../plugins/imf/SKILL.md) | [`plugins/imf/skills/imf/SKILL.md`](../../plugins/imf/skills/imf/SKILL.md) |
| **kimi-webbridge** | 浏览器自动化控制 | [kimi-webbridge.md](../explanation/kimi-webbridge.md) | [`plugins/kimi-webbridge/SKILL.md`](../../plugins/kimi-webbridge/SKILL.md) | [`plugins/kimi-webbridge/skills/kimi-webbridge/SKILL.md`](../../plugins/kimi-webbridge/skills/kimi-webbridge/SKILL.md) |
| **scholar** | 学术文献检索 | [scholar.md](scholar.md) | [`plugins/scholar/SKILL.md`](../../plugins/scholar/SKILL.md) | [`plugins/scholar/skills/scholar/SKILL.md`](../../plugins/scholar/skills/scholar/SKILL.md) |
| **sec_edgar** | 美国 SEC 上市公司财报 | [sec_edgar.md](sec_edgar.md) | [`plugins/sec_edgar/SKILL.md`](../../plugins/sec_edgar/SKILL.md) | [`plugins/sec_edgar/skills/sec_edgar/SKILL.md`](../../plugins/sec_edgar/skills/sec_edgar/SKILL.md) |
| **tianyancha** | 天眼查企业数据库 | [tianyancha.md](tianyancha.md) | [`plugins/tianyancha/SKILL.md`](../../plugins/tianyancha/SKILL.md) | [`plugins/tianyancha/skills/tianyancha/SKILL.md`](../../plugins/tianyancha/skills/tianyancha/SKILL.md) |
| **world_bank_open_data** | 世界银行开放数据 | [world_bank_open_data.md](world_bank_open_data.md) | [`plugins/world_bank_open_data/SKILL.md`](../../plugins/world_bank_open_data/SKILL.md) | [`plugins/world_bank_open_data/skills/world_bank_open_data/SKILL.md`](../../plugins/world_bank_open_data/skills/world_bank_open_data/SKILL.md) |
| **yahoo_finance** | Yahoo Finance 股票数据 | [yahoo_finance.md](yahoo_finance.md) | [`plugins/yahoo_finance/SKILL.md`](../../plugins/yahoo_finance/SKILL.md) | [`plugins/yahoo_finance/skills/yahoo_finance/SKILL.md`](../../plugins/yahoo_finance/skills/yahoo_finance/SKILL.md) |
| **yuandian_law** | 元典法律数据库 | [yuandian_law.md](yuandian_law.md) | [`plugins/yuandian_law/SKILL.md`](../../plugins/yuandian_law/SKILL.md) | [`plugins/yuandian_law/skills/yuandian_law/SKILL.md`](../../plugins/yuandian_law/skills/yuandian_law/SKILL.md) |

---

## 路径问题说明

### 为什么会出现"找不到路径"

**原始 Kimi 安装路径**（system prompt 硬编码，每次对话自动注入）：
```
C:\Users\huawei\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\kimi-code\home\plugins\managed\<plugin>\skills\<plugin>\SKILL.md
```
此路径位于 C 盘，与您的 E 盘工作目录隔离，**无法在工作目录中直接打开**。

**原始嵌套路径**（复制后保留的插件规范结构）：
```
plugins/ifind/skills/ifind/SKILL.md  ← ifind 重复出现，层级太深
```
这种 `plugins/<name>/skills/<name>/SKILL.md` 的重复嵌套结构容易在路径导航时造成混淆。

### 解决方案

1. **消除重复嵌套**：将 `../../.agents/skills/feature-window-context-doc/SKILL.md` 复制到插件根目录，路径简化为 [`plugins/ifind/../../.agents/skills/feature-window-context-doc/SKILL.md`](../../plugins/ifind/../../.agents/skills/feature-window-context-doc/SKILL.md)
2. **创建整理文档**：在 `docs/plugins/` 下为每个插件编写中文整理版，含使用场景、工作流和脚本示例
3. **保留原始结构**：`skills/<name>/SKILL.md` 仍保留，以兼容插件规范

### 推荐访问顺序

1. **快速查阅** → 当前文件 [`./index.md`](index.md)
2. **了解用法** → [`docs/plugins/<plugin>.md`](ifind.md)（中文整理版，含示例）
3. **查看原文** → [`plugins/<plugin>/SKILL.md`](../../plugins/ifind/SKILL.md)（扁平化后的原始文件）
4. **脚本调用** → [`plugins/<plugin>/scripts/<plugin>_tool.py`](../../plugins/ifind/scripts/ifind_tool.py)

---

## 按使用场景分类

### 金融数据类
- **ifind** — 中国 A 股、港股、美股市场数据，财务报表、智能选股
- **yahoo_finance** — 全球股票行情、财务指标、分析师覆盖
- **sec_edgar** — 美国上市公司 SEC 申报文件、XBRL 数据、内幕交易

### 宏观经济类
- **imf** — GDP、通胀、失业率、政府债务、COFER 储备货币
- **world_bank_open_data** — 29,000+ 国家发展指标，涵盖经济、社会、环境

### 企业/法律类
- **tianyancha** — 企业注册、经营、风险、司法、知识产权、投资关系
- **yuandian_law** — 中国法律法规、司法解释、行政规章、法院案例

### 工具/研究类
- **kimi-webbridge** — 浏览器自动化、网页截图、PDF 保存、表单填写
- **scholar** — 学术论文搜索、引文分析、作者画像

---

## 通用使用规范

### 1. 环境准备

所有数据源插件（除 kimi-webbridge 外）均依赖 `agent-gw` Python SDK：

```bash
python3 -c "import agent_gw" || python3 -m pip install "$(curl -s https://cdn.kimi.com/agentgw/pysdk/manifest.json | python3 -c "import json,sys; print(json.load(sys.stdin)['latest']['url'])")"
```

API Key 配置优先级：
1. 命令行参数 `api_key=...`
2. 环境变量 `KIMI_API_KEY`
3. 配置文件 `~/.kimi/agent-gw.json`

### 2. 标准调用流程

```
describe → 选 API → 建参数 → call → 处理结果
```

```bash
# 第 1 步：查看数据能力
python3 scripts/<plugin>_tool.py describe

# 第 2 步：调用具体 API
python3 scripts/<plugin>_tool.py call \
  --api-name "<api name>" \
  --params-json '{"required_param":"value"}'
```

### 3. 响应结构

```python
{
    "is_success": bool,
    "result": {"user": [str], "assistant": [str]} | None,
    "error": {"user": [str], "assistant": [str]} | None,
    "files": [{"name": str, "content": str}],
}
```

**使用原则**：优先使用 `result.assistant`，仅在需要展示内容时参考 `result.user`。

---

## 维护说明

- 本文档与 `plugins/` 目录下的原始 SKILL.md 同步，更新时请同时修改两者
- 新增插件时，请在此索引中补充条目并创建对应的独立文档
- 所有插件脚本均位于各自目录的 `scripts/` 子目录中

---

*本索引由 AI 自动同步生成，如有遗漏请以 `plugins/` 目录下的原始 SKILL.md 为准。*
