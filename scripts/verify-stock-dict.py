#!/usr/bin/env python3
"""校验 stockDictionary.ts 的四交易所完整性与代码规则"""
import re
from collections import Counter

TXT = open("src/services/stock/stockDictionary.ts", encoding="utf-8").read()
# 容错：name 内允许转义引号 \'
pat = re.compile(r"symbol: '(\d+)', name: '((?:[^\"\\']|\\.)*)', market: '(\w+)'")
items = pat.findall(TXT)
print("解析条目数:", len(items))

c = Counter(m for _, _, m in items)
print("总条目:", len(items), "| 市场分布:", dict(c))

sh = [s for s, _, m in items if m == "SH"]
sz = [s for s, _, m in items if m == "SZ"]
bj = [s for s, _, m in items if m == "BJ"]
hk = [s for s, _, m in items if m == "HK"]

assert all(s.startswith(("6", "900")) for s in sh), "SH 规则违规"
assert all(s.startswith(("0", "3", "200")) for s in sz), "SZ 规则违规"
assert all(s.startswith(("8", "4", "920")) for s in bj), "BJ 规则违规"
assert all(len(s) == 5 for s in hk), "HK 长度违规"

symset = set(s for s, _, _ in items)
print("symbol 唯一性:", len(items) == len(symset), "| 重复数:", len(items) - len(symset))
print("SH 样本:", sh[:2], sh[-2:])
print("SZ 样本:", sz[:2], sz[-2:])
print("BJ 样本:", bj[:3])
print("HK 样本:", hk[:3], "| 最大/最小:", max(hk), min(hk))
print("校验通过 ✅")
