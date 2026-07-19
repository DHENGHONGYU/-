#!/usr/bin/env python3
"""生成富化 doc-manifest.csv（含类目/关注点/交叉引用/反向引用）"""
import os, re, csv
from collections import Counter

ROOT = "G:/FinSightV9"

# 1. 收集所有 MD 元数据
docs = {}
for dp, dn, fn in os.walk(os.path.join(ROOT, "docs")):
    if "node_modules" in dp: continue
    for f in fn:
        if not f.lower().endswith(".md"): continue
        p = os.path.join(dp, f)
        try:
            with open(p, encoding="utf-8", errors="replace") as fp: content = fp.read()
        except: continue
        rel = p.replace("\\", "/").split("/docs/", 1)[1] if "/docs/" in p.replace("\\", "/") else os.path.basename(p)
        # tier
        tier_m = re.search(r'^tier\s*:\s*(\w+)', content, re.MULTILINE)
        tier = tier_m.group(1) if tier_m else "reference"
        # 人类可读标题
        title = f[:-3]
        h1_m = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if h1_m:
            title = h1_m.group(1).strip()
        else:
            t_m = re.search(r'^title\s*:\s*(.+)$', content, re.MULTILINE)
            if t_m and not t_m.group(1).strip().startswith("docs/"):
                title = t_m.group(1).strip()
        # 关注点：第一个 blockquote
        focus = ""
        bq_m = re.search(r'^>\s*\*?\*?(.+)$', content, re.MULTILINE)
        if bq_m:
            focus = bq_m.group(1).strip()[:80]
        # 类目
        category = "MISC"
        pl = rel.lower()
        cats = [
            (["governance","directory-structure","doc-trigger","registry-index","cleanup","migration-plan","file-management"], "GOV"),
            (["architecture","system-arch","v10-arch","v6-v9-arch","v9-arch","v9-strategy","v9-rectif","v9-current"], "ARC"),
            (["data-dictionary","data-definition","data-asset","data-relationship","data-timeline","data-blueprint","data-blood","dataflow","data-layer","data-collection","data-interaction"], "DAT"),
            (["api-contract","contract","interface","endpoint","databridge","functional-module"], "API"),
            (["guide","how-to","tutorial","workflow","sop","runbook","checklist"], "GUIDE"),
            (["spec","engine-spec","routing","quality-gate","functional","ui-ux","operation","vision","glossary","experience","scoring","backtest","seven-dim","multi-factor","risk","news","ai-center"], "SPEC"),
            (["adr-"], "ADR"),
            (["report","audit","review","remediation","rectification","acceptance","retrospective","timeline","assessment","kanban","scorecard"], "RPT"),
            (["changelog","change-log","weekly-task","monthly","release-note"], "LOG"),
            (["security","rbac","vulnerability","penetration"], "SEC"),
            (["performance","stress","baseline","optimization-summary"], "PERF"),
            (["token","design-system","ui-design","a11y","spacing","song-aesthetic","ui-remediation","ui-only","color"], "DESIGN"),
            (["hook","component","widget","cockpit","cabin","portal","atomic","stock-pool"], "UI"),
            (["test","regression","coverage","test-case","completeness"], "TEST"),
            (["ai-","agent","llm","prompt","memory-layer","feedback-loop","autonomous"], "AI"),
            (["mcp","server-lifecycle"], "MCP"),
            (["migration","db-migration","v6-to-v9","refactor-impact"], "MIGR"),
        ]
        for keywords, cat in cats:
            if any(k in pl for k in keywords):
                category = cat
                break
        # 交叉引用
        links = set()
        for lm in re.finditer(r'\[[^\]]*\]\(([^)]+\.md[^)]*)\)', content):
            link = lm.group(1).split('#')[0].split(' ')[0]
            if link.startswith('http') or link.startswith('file:'): continue
            target = os.path.normpath(os.path.join(dp, link))
            if os.path.exists(target):
                trel = target.replace("\\", "/").split("/docs/", 1)[1] if "/docs/" in target.replace("\\", "/") else os.path.basename(target)
                links.add(trel)
        docs[rel] = {"tier": tier, "slug": f, "path": rel, "title": title,
                      "focus": focus, "category": category, "links": links}

# 2. 修复误分类
for rel, d in docs.items():
    if d["category"] in ("LOG", "ADR") and d["tier"] == "core":
        d["tier"] = "reference"

# 3. 分配编号
tier_order = {"core": 0, "important": 1, "reference": 2, "archive": 3}
items = sorted(docs.values(), key=lambda d: (tier_order.get(d["tier"], 9), d["category"], d["title"].lower()))
prefix_map = {"core": "C", "important": "I", "reference": "R", "archive": "A"}
counters = {"core": 0, "important": 0, "reference": 0, "archive": 0}
for d in items:
    t = d["tier"]
    counters[t] += 1
    if t == "reference":
        d["num"] = "R-%03d" % counters[t]
    else:
        d["num"] = "%s-%02d" % (prefix_map[t], counters[t])

# 4. 交叉引用映射
path_to_num = {d["path"]: d["num"] for d in items}
for d in items:
    nums = sorted(set(path_to_num[l] for l in d["links"] if l in path_to_num))
    d["links_to"] = ",".join(nums) if nums else "-"

linked_by = {d["num"]: [] for d in items}
for d in items:
    for l in d["links"]:
        if l in path_to_num:
            linked_by[path_to_num[l]].append(d["num"])
for d in items:
    nums = sorted(set(linked_by[d["num"]]))
    d["linked_by"] = ",".join(nums) if nums else "-"

# 5. 输出 CSV
csv_path = os.path.join(ROOT, "docs/00-meta/doc-manifest.csv")
with open(csv_path, "w", encoding="utf-8", newline="") as fp:
    w = csv.writer(fp)
    w.writerow(["num", "tier", "category", "slug", "path", "title", "focus", "links_to", "linked_by"])
    for d in items:
        w.writerow([d["num"], d["tier"], d["category"], d["slug"], d["path"],
                    d["title"], d["focus"], d["links_to"], d["linked_by"]])

print("生成 %s: %d 条" % (csv_path, len(items)))
print("  core: %d / important: %d / reference: %d" % (counters["core"], counters["important"], counters["reference"]))
cat_dist = Counter(d["category"] for d in items)
print("  类目分布: %s" % dict(cat_dist.most_common()))
print("\n核心文档前15行:")
for d in items[:15]:
    print("  %s [%s] %s -> %s" % (d["num"], d["category"], d["title"][:30], d["links_to"][:50]))
