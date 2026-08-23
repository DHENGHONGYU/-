---
title: "外部数据源插件参考索引"
domain: project
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v1.0.0
summary: "8 个 Kimi 插件数据源精简索引：简介 + 使用场景 + 脚本入口。完整 SKILL 文档见 plugins/*/SKILL.md"
tags: [data-source, plugins, reference]
---

# 外部数据源插件参考索引

> 本文档合并自原 ifind/imf/scholar/sec_edgar/tianyancha/world_bank_open_data/yahoo_finance/yuandian_law 8 个独立文件。
> 完整 SKILL 文档见 [`plugins/*/SKILL.md`](../../plugins/)。

## 通用调用约定

所有插件共享统一接口：

```bash
# 环境准备（一次性）
python3 -c "import agent_gw" || python3 -m pip install "$(curl -s https://cdn.kimi.com/agentgw/pysdk/manifest.json | python3 -c "import json,sys; print(json.load(sys.stdin)['latest']['url'])")"

# 查看数据能力
cd plugins/<plugin-name>
python3 scripts/<plugin-name>_tool.py describe

# 调用具体 API
python3 scripts/<plugin-name>_tool.py call \
  --api-name "<api name>" \
  --params-json '{"required_param":"value"}'

# API Key 优先级：命令行参数 > 环境变量 KIMI_API_KEY > ~/.kimi/agent-gw.json
```

**统一响应格式**：`{ is_success, result: {user, assistant} | None, error, files[] }` — 优先使用 `result.assistant`。

## 插件速查表

| 插件 | 数据域 | 核心能力 | 脚本入口 |
|------|--------|---------|---------|
| **iFinD** | 同花顺金融数据（A股/港股/美股） | 股票画像、财务报表、业务板块、价格数据、公告、股东、分析师预测、智能选股 | `plugins/ifind/scripts/ifind_tool.py` |
| **IMF** | 国际货币基金组织全球宏观数据 | GDP/通胀/失业率/政府债务/贸易平衡、WEO 预测、COFER 储备货币 | `plugins/imf/scripts/imf_tool.py` |
| **Scholar** | 学术文献检索（Google Scholar 风格） | 论文搜索、引文分析、作者画像（h-index/i10-index）、文献综述 | `plugins/scholar/scripts/scholar_tool.py` |
| **SEC EDGAR** | 美国 SEC 证券交易委员会 | 上市公司财报（10-K/10-Q/8-K）、内部人交易、机构持仓、共同基金 | `plugins/sec_edgar/scripts/sec_edgar_tool.py` |
| **Tianyancha** | 天眼查企业工商数据 | 企业基本信息、股东、高管、变更记录、对外投资、知识产权 | `plugins/tianyancha/scripts/tianyancha_tool.py` |
| **World Bank** | 世界银行开放数据 | 全球发展指标（GDP/人口/教育/健康/环境）、跨国比较 | `plugins/world_bank_open_data/scripts/world_bank_tool.py` |
| **Yahoo Finance** | 雅虎金融全球市场 | 股票报价、历史价格、财务报表、公司概览、推荐趋势 | `plugins/yahoo_finance/scripts/yahoo_finance_tool.py` |
| **原点法律** | 中国法律法规数据库 | 法律条文、司法解释、裁判文书、行政处罚 | `plugins/yuandian_law/scripts/yuandian_law_tool.py` |

## 免费/付费分级

| 分级 | 插件 | 说明 |
|------|------|------|
| **免费** | Scholar、World Bank、Yahoo Finance、SEC EDGAR | 无需 API Key 或免费额度充足 |
| **需 Key** | iFinD、Tianyancha、原点法律 | 需商业授权或注册获取 API Key |
| **免费+注册** | IMF | 免费注册即可获取 API Key |
