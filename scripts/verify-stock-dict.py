#!/usr/bin/env python3
"""校验 stockDictionary.ts 的四交易所完整性与代码规则

新增 --sw-coverage flag：校验 A 股申万行业覆盖率 ≥ 90%，
并断言港股行业字段全部为空。
"""
import argparse
import re
import sys
from collections import Counter

DICT_PATH = "src/services/stock/stockDictionary.ts"
SW_PATH = "src/services/stock/swIndustryMap.ts"


def parse_stock_dict(path: str) -> list[tuple[str, str, str]]:
    """解析 stockDictionary.ts，返回 [(symbol, name, market), ...]"""
    txt = open(path, encoding="utf-8").read()
    pat = re.compile(r"symbol: '(\d+)', name: '((?:[^\"\\']|\\.)*)', market: '(\w+)'")
    return pat.findall(txt)


def parse_sw_map(path: str) -> dict[str, dict[str, str]]:
    """解析 swIndustryMap.ts，返回 {symbol: {swL1, swL2, swL3}}"""
    txt = open(path, encoding="utf-8").read()
    pat = re.compile(
        r"'(\d+)':\s*\{\s*swL1:\s*'([^']*)',\s*swL2:\s*'([^']*)',\s*swL3:\s*'([^']*)'\s*\}"
    )
    result = {}
    for m in pat.findall(txt):
        result[m[0]] = {"swL1": m[1], "swL2": m[2], "swL3": m[3]}
    return result


def verify_basic(items: list[tuple[str, str, str]]) -> bool:
    """基础校验：四交易所规则"""
    c = Counter(m for _, _, m in items)
    print("总条目:", len(items), "| 市场分布:", dict(c))

    sh = [s for s, _, m in items if m == "SH"]
    sz = [s for s, _, m in items if m == "SZ"]
    bj = [s for s, _, m in items if m == "BJ"]
    hk = [s for s, _, m in items if m == "HK"]

    errors = []

    # SH 规则：6xxxxx 或 900xxx
    bad_sh = [s for s in sh if not s.startswith(("6", "900"))]
    if bad_sh:
        errors.append(f"SH 规则违规: {bad_sh[:10]}")

    # SZ 规则：0xxxxx 或 3xxxxx 或 200xxx
    bad_sz = [s for s in sz if not s.startswith(("0", "3", "200"))]
    if bad_sz:
        errors.append(f"SZ 规则违规: {bad_sz[:10]}")

    # BJ 规则：8xxxxx 或 4xxxxx 或 920xxx
    bad_bj = [s for s in bj if not s.startswith(("8", "4", "920"))]
    if bad_bj:
        errors.append(f"BJ 规则违规: {bad_bj[:10]}")

    # HK 规则：5 位数字
    bad_hk = [s for s in hk if len(s) != 5]
    if bad_hk:
        errors.append(f"HK 长度违规: {bad_hk[:10]}")

    symset = set(s for s, _, _ in items)
    dup = len(items) - len(symset)
    if dup > 0:
        errors.append(f"symbol 重复: {dup} 条")

    print("symbol 唯一性:", len(items) == len(symset), "| 重复数:", dup)
    print("SH 样本:", sh[:2], sh[-2:] if len(sh) >= 2 else "")
    print("SZ 样本:", sz[:2], sz[-2:] if len(sz) >= 2 else "")
    print("BJ 样本:", bj[:3] if bj else "(空)")
    if hk:
        print("HK 样本:", hk[:3], "| 最大/最小:", max(hk), min(hk))

    if errors:
        print("\n❌ 基础校验失败:")
        for e in errors:
            print(f"  - {e}")
        return False

    print("基础校验通过 ✅")
    return True


def verify_sw_coverage(
    items: list[tuple[str, str, str]],
    sw_map: dict[str, dict[str, str]],
) -> bool:
    """申万行业覆盖率校验"""
    # 分离 A 股和港股
    a_shares = [(s, n, m) for s, n, m in items if m in ("SH", "SZ", "BJ")]
    hk_shares = [(s, n, m) for s, n, m in items if m == "HK"]

    # A 股覆盖率
    a_total = len(a_shares)
    a_hit = sum(1 for s, _, _ in a_shares if s in sw_map)
    a_coverage = (a_hit / a_total * 100) if a_total > 0 else 0.0
    status = "✅" if a_coverage >= 90.0 else "❌"

    print(f"\n申万覆盖率校验:")
    print(f"  A 股命中: {a_hit}/{a_total} = {a_coverage:.1f}% {status}")
    print(f"  SW 映射表条目数: {len(sw_map)}")

    # 港股行业字段应全部为空（不在 SW_INDUSTRY_MAP 中）
    hk_in_sw = [s for s, _, _ in hk_shares if s in sw_map]
    if hk_in_sw:
        print(f"  ❌ 港股意外命中 SW 映射: {hk_in_sw[:10]}（共 {len(hk_in_sw)} 只）")
        return False
    else:
        print(f"  港股 SW 命中: 0/{len(hk_shares)} ✅（符合预期）")

    # 断言覆盖率 ≥ 90%
    if a_coverage < 90.0:
        print(f"\n❌ A 股申万覆盖率 {a_coverage:.1f}% < 90%，不满足门禁阈值")
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="校验 stockDictionary.ts")
    parser.add_argument(
        "--sw-coverage",
        action="store_true",
        help="校验 A 股申万行业覆盖率（≥ 90%）及港股行业字段全为空",
    )
    args = parser.parse_args()

    items = parse_stock_dict(DICT_PATH)
    print("解析条目数:", len(items))

    ok = verify_basic(items)

    if args.sw_coverage:
        try:
            sw_map = parse_sw_map(SW_PATH)
            sw_ok = verify_sw_coverage(items, sw_map)
            ok = ok and sw_ok
        except FileNotFoundError:
            print(f"\n❌ {SW_PATH} 不存在，请先运行 npm run build:sw-industry")
            sys.exit(1)

    if ok:
        print("\n全部校验通过 ✅")
        sys.exit(0)
    else:
        print("\n校验失败 ❌")
        sys.exit(1)


if __name__ == "__main__":
    main()
