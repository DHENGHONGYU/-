#!/usr/bin/env python3
"""从 doc-manifest.csv 重建 registry-index.md（可点击链接 + 类目 + 关注点 + 交叉引用）"""
import csv, os
from pathlib import Path

ROOT = str(Path(__file__).resolve().parent.parent)
csv_path = os.path.join(ROOT, "docs/00-meta/doc-manifest.csv")
out_path = os.path.join(ROOT, "docs/00-meta/registry-index.md")

rows = []
with open(csv_path, encoding="utf-8") as fp:
    for row in csv.DictReader(fp):
        rows.append(row)

# 类目中文名
cat_names = {
    "GOV": "治理", "ARC": "架构", "DAT": "数据", "API": "契约",
    "GUIDE": "指南", "SPEC": "规格", "ADR": "决策", "RPT": "报告",
    "LOG": "日志", "SEC": "安全", "PERF": "性能", "DESIGN": "设计",
    "UI": "界面", "TEST": "测试", "AI": "AI", "MCP": "MCP",
    "MIGR": "迁移", "MISC": "其他",
}

md = "---\n"
md += "title: 文档注册索引\ntype: meta\ndomain: project\nphase: development\ntier: important\nstatus: active\nversion: v1.0.0\nlast_updated: " + __import__('datetime').date.today().isoformat() + "\ncode_version: 2.0.0\nmaintainer: V9 Architecture Team\n---\n\n"
md += "# 文档注册索引\n\n"
md += "> 本索引由 `doc-manifest.csv` 派生。编号仅用于查阅/审计，文档间引用请用 slug（文件名）。\n"
md += "> 改编号只改 CSV 1 份文件，零文档影响。`npm run doc:manifest` 可重建。\n\n"
md += "## 编号规则\n\n"
md += "| 层级 | 前缀 | 序号 | 示例 | 说明 |\n"
md += "|------|------|------|------|------|\n"
md += "| 核心 | C | 2位 | C-01 | 治理/契约/事实源，变更需评审 |\n"
md += "| 重要 | I | 2位 | I-01 | 开发规范/指南，变更需 review |\n"
md += "| 参考 | R | 3位 | R-001 | 历史报告/ADR，只读归档 |\n\n"
md += "## 类目\n\n"
md += "| 代码 | 含义 | 代码 | 含义 |\n|------|------|------|------|\n"
for i in range(0, len(cat_names), 2):
    items_list = list(cat_names.items())
    k1, v1 = items_list[i]
    if i + 1 < len(items_list):
        k2, v2 = items_list[i + 1]
        md += "| %s | %s | %s | %s |\n" % (k1, v1, k2, v2)
    else:
        md += "| %s | %s | | |\n" % (k1, v1)
md += "\n"

for tier, label, emoji in [("core", "核心（必读，变更需评审）", "🔴"), ("important", "重要（开发查阅）", "🟡"), ("reference", "参考（只读归档）", "🔵")]:
    tier_rows = [r for r in rows if r["tier"] == tier]
    md += "## %s %s（%d 份）\n\n" % (emoji, label, len(tier_rows))
    md += "| 编号 | 类目 | 标题 | 关注点 | 引用→ | 被引用← | 文档链接 |\n"
    md += "|------|------|------|--------|-------|---------|----------|\n"
    for r in tier_rows:
        title = r["title"][:40]
        focus = r["focus"][:40] if r["focus"] else "-"
        cat = r["category"]
        links_to = r["links_to"][:30] if r["links_to"] != "-" else "-"
        linked_by = r["linked_by"][:30] if r["linked_by"] != "-" else "-"
        link = "[%s](../%s)" % (r["slug"], r["path"])
        md += "| %s | %s | %s | %s | %s | %s | %s |\n" % (r["num"], cat, title, focus, links_to, linked_by, link)
    md += "\n"

with open(out_path, "w", encoding="utf-8") as fp:
    fp.write(md)
print("重建 %s: %d 条" % (out_path, len(rows)))
