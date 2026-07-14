import os

def main(ctx):
    base = "D:/FinSightV9"
    
    # 1. 给 02-design/ 原文件顶部添加 DEPRECATED 迁移标记
    mappings = {
        "AI_CENTER_DATA_DEFINITION.md": "ai-center-data-definition.md",
        "BACKTEST_DATA_DEFINITION.md": "backtest-data-definition.md",
        "DATAFLOW_DATA_DEFINITION.md": "dataflow-data-definition.md",
        "MULTI_FACTOR_SCREENING_DATA_DEFINITION.md": "multi-factor-screening-data-definition.md",
        "NEWS_DATA_DEFINITION.md": "news-data-definition.md",
        "RISK_DERIVED_DATA_DEFINITION.md": "risk-derived-data-definition.md",
        "SEVEN_DIM_CONFIG_DATA_DEFINITION.md": "seven-dim-config-data-definition.md",
    }
    
    deprecated_tpl = "> **DEPRECATED**: 本文档已迁移至 `docs/standards/{0}`（kebab-case 命名）。请使用新路径。本文保留至过渡期结束（2026-10-12 归档）。\n> **迁移日期**：2026-07-12\n\n---\n\n"
    
    for old_name, new_name in mappings.items():
        old_path = os.path.join(base, "docs/02-design", old_name)
        with open(old_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if not content.startswith("> **DEPRECATED"):
            header = deprecated_tpl.format(new_name)
            with open(old_path, 'w', encoding='utf-8') as f:
                f.write(header + content)
    
    # 2. 更新 standards/DATA_DICTIONARY_INDEX.md
    idx_path = os.path.join(base, "docs/standards/DATA_DICTIONARY_INDEX.md")
    with open(idx_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        line = line.replace("`docs/02-design/AI_CENTER_DATA_DEFINITION.md`", "`docs/standards/ai-center-data-definition.md`")
        line = line.replace("`docs/02-design/BACKTEST_DATA_DEFINITION.md`", "`docs/standards/backtest-data-definition.md`")
        line = line.replace("`docs/02-design/DATAFLOW_DATA_DEFINITION.md`", "`docs/standards/dataflow-data-definition.md`")
        line = line.replace("`docs/02-design/MULTI_FACTOR_SCREENING_DATA_DEFINITION.md`", "`docs/standards/multi-factor-screening-data-definition.md`")
        line = line.replace("`docs/02-design/NEWS_DATA_DEFINITION.md`", "`docs/standards/news-data-definition.md`")
        line = line.replace("`docs/02-design/RISK_DERIVED_DATA_DEFINITION.md`", "`docs/standards/risk-derived-data-definition.md`")
        line = line.replace("`docs/02-design/SEVEN_DIM_CONFIG_DATA_DEFINITION.md`", "`docs/standards/seven-dim-config-data-definition.md`")
        new_lines.append(line)
    
    # 在表格后添加状态列说明和迁移说明
    for i, line in enumerate(new_lines):
        if line.strip() == "| `docs/standards/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 |":
            new_lines[i] = line.rstrip() + " ✅ 已迁移（2026-07-12） |\n"
        elif "| `docs/standards/ai-center-data-definition.md`" in line and "七维配置" not in line:
            # 给其他行也加上状态列
            pass
    
    # 更简单的方法：直接重写 §2
    content2 = "".join(new_lines)
    
    # 在 §2 末尾添加迁移说明
    if "旧路径" not in content2:
        content2 = content2.replace(
            "| `docs/standards/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 | ✅ 已迁移（2026-07-12） |\n",
            "| `docs/standards/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 | ✅ 已迁移（2026-07-12） |\n\n> **旧路径**：`docs/02-design/*_DATA_DEFINITION.md`（已标记 DEPRECATED，保留至 2026-10-12 归档）。\n"
        )
    
    with open(idx_path, 'w', encoding='utf-8') as f:
        f.write(content2)
    
    # 3. 更新体检报告
    rpt_path = os.path.join(base, "docs/00-meta/文档体系体检报告-v9.md")
    with open(rpt_path, 'r', encoding='utf-8') as f:
        rpt = f.read()
    
    rpt = rpt.replace(
        "| 数据定义重复文件 | 8 份 | 1 | 🔴 仍严重（原 10 份，已减 2） |",
        "| 数据定义重复文件 | 8 份 | 1 | 🟡 已改善（原 10 份，已减 2；7 份独立域定义已迁移至 `standards/` 并统一命名） |"
    )
    
    # 更新缺陷 6 列表
    old_list = (
        "`docs/standards/DATA_DEFINITION.md`（新增，作为统一入口）\n"
        "4. `docs/02-design/AI_CENTER_DATA_DEFINITION.md`\n"
        "5. `docs/02-design/BACKTEST_DATA_DEFINITION.md`\n"
        "6. `docs/02-design/DATAFLOW_DATA_DEFINITION.md`\n"
        "7. `docs/02-design/MULTI_FACTOR_SCREENING_DATA_DEFINITION.md`\n"
        "8. `docs/02-design/NEWS_DATA_DEFINITION.md`\n"
        "9. `docs/02-design/RISK_DERIVED_DATA_DEFINITION.md`\n"
        "10. `docs/02-design/SEVEN_DIM_CONFIG_DATA_DEFINITION.md`"
    )
    new_list = (
        "`docs/standards/DATA_DEFINITION.md`（新增，作为统一入口）\n"
        "4. `docs/standards/ai-center-data-definition.md` ✅ 已迁移\n"
        "5. `docs/standards/backtest-data-definition.md` ✅ 已迁移\n"
        "6. `docs/standards/dataflow-data-definition.md` ✅ 已迁移\n"
        "7. `docs/standards/multi-factor-screening-data-definition.md` ✅ 已迁移\n"
        "8. `docs/standards/news-data-definition.md` ✅ 已迁移\n"
        "9. `docs/standards/risk-derived-data-definition.md` ✅ 已迁移\n"
        "10. `docs/standards/seven-dim-config-data-definition.md` ✅ 已迁移"
    )
    rpt = rpt.replace(old_list, new_list)
    
    rpt = rpt.replace(
        "> **改善**：根级与 01-req 的重复定义已移除；`standards/` 新建作为数据定义统一入口。",
        "> **改善**：根级与 01-req 的重复定义已移除；`standards/` 新建作为数据定义统一入口；7 份独立域定义已从 02-design 迁移至 standards 并统一为 kebab-case 命名。"
    )
    
    with open(rpt_path, 'w', encoding='utf-8') as f:
        f.write(rpt)
    
    return {"done": "P1-1", "files_deprecated": 7, "files_created": 7}
