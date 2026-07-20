#!/usr/bin/env python3
"""生成申万宏源 3 级行业分类映射表 (src/services/stock/swIndustryMap.ts)

数据源 (akshare)：
  - ak.sw_index_third_info()  → 获取全部三级行业代码
  - ak.sw_index_third_cons(symbol) → 获取成分股及其申万 1/2/3 级分类

流程：
  1. 获取全部三级行业代码
  2. 遍历每个行业代码，获取成分股
  3. 按 stock_code 去重汇总为 {code: {swL1, swL2, swL3}} 映射
  4. 写入 swIndustryMap.ts（TypeScript 格式）

输出覆盖率统计（A 股命中数/总数）。

用法：
  npm run build:sw-industry
"""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_TS = os.path.join(ROOT, "src", "services", "stock", "swIndustryMap.ts")

try:
    import akshare as ak
except Exception as e:
    print(f"[FATAL] akshare 不可用: {e}")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):
        print(f"[WARN] tqdm not installed, progress bar disabled")
        return iterable

try:
    from tenacity import retry, stop_after_attempt, wait_exponential
    HAS_TENACITY = True
except ImportError:
    HAS_TENACITY = False
    print("[WARN] tenacity not installed, retry disabled")


def _fetch_with_retry(func, *args, **kwargs):
    """带重试的抓取包装器"""
    if HAS_TENACITY:
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            reraise=True,
        )
        def _inner():
            return func(*args, **kwargs)
        try:
            return _inner()
        except Exception:
            return None
    else:
        try:
            return func(*args, **kwargs)
        except Exception:
            return None


def fetch_industry_indices():
    """获取全部三级行业代码列表"""
    print("[INFO] 获取申万三级行业索引列表...")
    df = ak.sw_index_third_info()
    # 尝试多种可能的列名
    possible_code_cols = ["行业代码", "index_code", "sw_index_code", "code"]
    code_col = None
    for col in possible_code_cols:
        if col in df.columns:
            code_col = col
            break
    if code_col is None:
        print(f"[WARN] 未知的列名: {list(df.columns)}，使用第0列")
        code_col = df.columns[0]

    codes = [str(c).strip() for c in df[code_col].tolist()]
    print(f"[INFO] 获取到 {len(codes)} 个三级行业代码")
    return codes


def fetch_constituents(index_code: str):
    """获取某个三级行业的成分股列表，返回 {stock_code: {swL1, swL2, swL3}}"""
    df = _fetch_with_retry(ak.sw_index_third_cons, symbol=index_code)
    if df is None or df.empty:
        return {}

    result = {}
    # 列名映射：尝试多种可能的列名
    col_map = _detect_columns(df)

    for _, row in df.iterrows():
        stock_code = str(row[col_map["stock_code"]]).strip()
        if not stock_code:
            continue

        sw_l1 = str(row.get(col_map.get("swL1", ""), "")).strip() if col_map.get("swL1") else ""
        sw_l2 = str(row.get(col_map.get("swL2", ""), "")).strip() if col_map.get("swL2") else ""
        sw_l3 = str(row.get(col_map.get("swL3", ""), "")).strip() if col_map.get("swL3") else ""

        # 去重：同 stock_code 首次出现的行业分类为准
        if stock_code not in result:
            result[stock_code] = {
                "swL1": sw_l1,
                "swL2": sw_l2,
                "swL3": sw_l3,
            }

    return result


def _detect_columns(df):
    """自动检测列名映射"""
    cols = list(df.columns)
    col_map = {}

    # stock_code 列
    code_candidates = ["stock_code", "股票代码", "code", "证券代码", "symbol"]
    for c in code_candidates:
        if c in cols:
            col_map["stock_code"] = c
            break
    if "stock_code" not in col_map:
        # 兜底：找包含 'code' 或 '代码' 的列
        for c in cols:
            if "code" in c.lower() or "代码" in c:
                col_map["stock_code"] = c
                break
    if "stock_code" not in col_map:
        col_map["stock_code"] = cols[0]  # 最后兜底

    # 申万 L1/L2/L3 列
    l1_candidates = ["sw_l1_name", "一级行业名称", "l1_name", "sw_l1", "industry_l1"]
    l2_candidates = ["sw_l2_name", "二级行业名称", "l2_name", "sw_l2", "industry_l2"]
    l3_candidates = ["sw_l3_name", "三级行业名称", "l3_name", "sw_l3", "industry_l3"]

    for key, candidates in [("swL1", l1_candidates), ("swL2", l2_candidates), ("swL3", l3_candidates)]:
        for c in candidates:
            if c in cols:
                col_map[key] = c
                break

    return col_map


def build():
    """主构建流程"""
    codes = fetch_industry_indices()
    if not codes:
        print("[FATAL] 未获取到任何三级行业代码")
        sys.exit(1)

    sw_map: dict[str, dict[str, str]] = {}
    failed_count = 0

    for code in tqdm(codes, desc="获取成分股"):
        try:
            constituents = fetch_constituents(code)
            for stock_code, ind in constituents.items():
                if stock_code not in sw_map:
                    sw_map[stock_code] = ind
            time.sleep(1)  # akshare 请求间隔保护
        except Exception as e:
            failed_count += 1
            if failed_count <= 5:
                print(f"[WARN] 获取行业 {code} 成分股失败: {e}")

    print(f"[INFO] 汇总: {len(sw_map)} 只 A 股, 失败行业数: {failed_count}/{len(codes)}")
    return sw_map


def render(sw_map: dict[str, dict[str, str]]) -> str:
    """渲染 TypeScript 文件内容"""
    lines = []
    lines.append("/**")
    lines.append(" * 申万宏源 3 级行业分类映射表")
    lines.append(" *")
    lines.append(" * @description")
    lines.append(" * 提供 A 股 stock_code → {swL1, swL2, swL3} 的 O(1) 查表能力。")
    lines.append(" * 港股不在该映射中出现，enrich 时未命中返回 undefined。")
    lines.append(" *")
    lines.append(" * 更新方式：")
    lines.append(" * ```bash")
    lines.append(" * npm run build:sw-industry")
    lines.append(" * ```")
    lines.append(" *")
    lines.append(" * @module services/stock/swIndustryMap")
    lines.append(" */")
    lines.append("")
    lines.append("export interface SwIndustry {")
    lines.append("  swL1: string")
    lines.append("  swL2: string")
    lines.append("  swL3: string")
    lines.append("}")
    lines.append("")
    lines.append("export const SW_INDUSTRY_MAP: Record<string, SwIndustry> = {")

    for code in sorted(sw_map.keys()):
        ind = sw_map[code]
        # 转义单引号和反斜杠
        l1 = ind.get("swL1", "").replace("\\", "\\\\").replace("'", "\\'")
        l2 = ind.get("swL2", "").replace("\\", "\\\\").replace("'", "\\'")
        l3 = ind.get("swL3", "").replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"  '{code}': {{ swL1: '{l1}', swL2: '{l2}', swL3: '{l3}' }},")

    lines.append("}")
    lines.append("")

    return "\n".join(lines)


def compute_coverage(sw_map: dict, dict_path: str) -> tuple[int, int, float]:
    """计算 A 股覆盖率"""
    import re
    try:
        txt = open(dict_path, encoding="utf-8").read()
    except FileNotFoundError:
        print("[WARN] stockDictionary.ts 不存在，跳过覆盖率计算")
        return 0, 0, 0.0

    # 提取所有非港股 symbol
    pat = re.compile(r"symbol: '(\d+)', name: '([^']*)', market: '(SH|SZ|BJ)'")
    a_share_codes = [m[0] for m in pat.findall(txt)]
    total = len(a_share_codes)
    hit = sum(1 for c in a_share_codes if c in sw_map)
    coverage = (hit / total * 100) if total > 0 else 0.0
    return hit, total, coverage


def main():
    sw_map = build()
    ts_content = render(sw_map)

    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"[OK] 写入 {OUT_TS}，共 {len(sw_map)} 条记录")

    # 覆盖率统计
    dict_path = os.path.join(ROOT, "src", "services", "stock", "stockDictionary.ts")
    hit, total, coverage = compute_coverage(sw_map, dict_path)
    if total > 0:
        status = "✅" if coverage >= 90.0 else "⚠️"
        print(f"[COVERAGE] {status} A 股申万覆盖率: {hit}/{total} = {coverage:.1f}%")


if __name__ == "__main__":
    main()
