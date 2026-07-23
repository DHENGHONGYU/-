#!/usr/bin/env python3
"""生成申万宏源 3 级行业分类映射表 (src/services/stock/swIndustryMap.ts)

数据源 (akshare)：
  - ak.sw_index_third_info()  → 获取全部三级行业代码 + 名称 + 上级行业(L2)
  - ak.sw_index_second_info() → 获取全部二级行业名称 + 上级行业(L1)
  - ak.sw_index_third_cons(symbol) → 获取某三级行业的成分股（仅含 申万3级 名称）

注意（2026-07-22 上游结构变更修复）：
  乐咕乐股成分股表头被 JSON-LD 元数据污染（18 列，且不再含 申万1/2 级列），
  导致 akshare 原生 sw_index_third_cons 因「17 硬编码列名 ≠ 18 实际列」崩溃。
  同时其 sw_index_third_info / sw_index_second_info 使用 akshare 内置 UA 会被反爬
  拦截为 1607 字节壳页（level*Items 缺失），原生分类树接口已不可靠。
  本脚本：
    1) monkeypatch sw_index_third_cons：清洗污染列名、兼容 18 列、用浏览器 UA；
    2) 自实现 fetch_industry_taxonomy：浏览器 UA 直连总览页，解析 level2/level3
       容器的 parent-industry-name 反推 L3→L2→L1 分类树（绕开 akshare 原生接口）。

流程：
  1. 构建 L3→L2、L2→L1 分类映射
  2. 遍历每个三级行业代码，获取成分股（仅 L3 名）
  3. 按 stock_code 去重，反推补全 {swL1, swL2, swL3}
  4. 写入 swIndustryMap.ts（TypeScript 格式）

输出覆盖率统计（A 股命中数/总数）。

用法：
  npm run build:sw-industry
"""
import os
import re
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

import pandas as pd
from io import StringIO
import requests
from bs4 import BeautifulSoup

# --- 修复 akshare sw_index_third_cons 因上游结构变更导致的崩溃 ---
# 上游成分股表头现含 JSON-LD 元数据污染且列数增至 18、不再含 申万1/2 级列。
_LEGULEGU_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://legulegu.com/stockdata/sw-industry-overview",
}

# 持久会话：复用 cookie jar，降低被反爬按会话拦截的概率
_SESSION = requests.Session()
_SESSION.headers.update(_LEGULEGU_HEADERS)


def _is_throttled(text: str) -> bool:
    """识别乐咕乐股的反爬/限流响应（壳页或挑战页）。"""
    low = (text or "").lower()
    markers = [
        "访问频繁", "访问过于频繁", "请求过于频繁", "验证码",
        "too many requests", "access denied", "robot", "just a moment",
    ]
    return any(m in low for m in markers)


def _patched_sw_index_third_cons(symbol: str = "801120.SI") -> pd.DataFrame:
    """乐咕乐股-申万三级-行业成份（兼容上游表头结构变更 + 反爬限流）。

    原生 akshare 实现写死 17 个列名，但上游现返回 18 列且 <th> 混入 JSON-LD
    元数据，导致 `temp_df.columns = [...]` 抛 Length mismatch。此处清洗列名
    并兼容任意列数，仅保留我们关心的 股票代码 / 申万3级。
    同时：检测限流壳页/挑战页并抛错，交由重试逻辑退避后重抓。
    """
    url = f"https://legulegu.com/stockdata/index-composition?industryCode={symbol}"
    r = _SESSION.get(url, timeout=30)
    if r.status_code != 200 or _is_throttled(r.text) or len(r.text) < 3000:
        raise RuntimeError(
            f"throttled/blocked for {symbol} (status={r.status_code}, len={len(r.text)})"
        )
    df = pd.read_html(StringIO(r.text))[0]
    # 清洗污染列名：截掉首个 '{'（JSON-LD 起始）之前的部分
    df.columns = [str(c).split("{")[0].strip() for c in df.columns]
    if df.empty:
        raise RuntimeError(f"empty constituents table for {symbol}")
    return df


# 替换 akshare 原生（损坏）实现
ak.sw_index_third_cons = _patched_sw_index_third_cons

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):
        print("[WARN] tqdm not installed, progress bar disabled")
        return iterable


def _fetch_with_retry(func, *args, max_attempts: int = 5, **kwargs):
    """带重试的抓取包装器（不依赖 tenacity，自实现指数退避）。

    对异常 / None / 空 DataFrame 结果均重试，避免乐咕乐股限流导致整行业静默丢失。
    """
    last = None
    for attempt in range(max_attempts):
        try:
            res = func(*args, **kwargs)
            if res is not None and not (hasattr(res, "empty") and res.empty):
                return res
            last = "empty/None result"
        except Exception as e:  # noqa: BLE001
            last = e
        if attempt < max_attempts - 1:
            backoff = 3 + attempt * 4  # 3,7,11,15 秒
            print(f"[WARN] 重试({attempt + 1}/{max_attempts}) {func.__name__}: {last}（{backoff}s 后）", flush=True)
            time.sleep(backoff)
    return None


def _fetch_overview_html():
    """抓取乐咕乐股申万行业总览页（含 L1/L2/L3 三级分类树）。

    注意：akshare 原生 sw_index_*_info 使用 akshare.utils.cons.headers，
    该 UA 会被乐咕乐股识别为机器人并返回 1607 字节的拦截壳（level*Items 缺失）。
    此处改用浏览器 UA（持久会话）直连，并对偶发拦截做重试退避。
    """
    url = "https://legulegu.com/stockdata/sw-industry-overview"
    for attempt in range(4):
        try:
            r = _SESSION.get(url, timeout=30)
            if (
                r.status_code == 200
                and not _is_throttled(r.text)
                and "level3Items" in r.text
                and "level2Items" in r.text
            ):
                return r.text
            print(f"[WARN] overview 第 {attempt + 1} 次返回不完整/被拦截（len={len(r.text)}），重试", flush=True)
        except Exception as e:
            print(f"[WARN] overview 第 {attempt + 1} 次请求失败: {e}", flush=True)
        time.sleep(2 + attempt * 3)
    return None


def _extract_items(soup, div_id):
    """从指定 level*Items 容器提取 (code, name, parent_name) 三元组列表。

    - code: lg-industries-item-chinese-title（如 '850111.SI'）
    - name: lg-industries-item-number 中 '(' 前的行业名（如 '种子'）
    - parent_name: parent-industry-name 去括号后的上级行业名（如 '种植业'）
    """
    container = soup.find("div", attrs={"id": div_id})
    if container is None:
        return []
    items = []
    for item in container.find_all("div", class_="lg-industries-item"):
        title = item.find("div", class_="lg-industries-item-chinese-title")
        num = item.find("div", class_="lg-industries-item-number")
        parent = item.find("span", class_="parent-industry-name")
        if title is None or num is None:
            continue
        code = title.get_text().strip()
        name = num.get_text().split("(")[0].strip()
        parent_name = parent.get_text().strip("[]").strip() if parent else ""
        items.append((code, name, parent_name))
    return items


def fetch_industry_taxonomy():
    """构建 L3→L2、L2→L1 分类映射，并返回三级行业代码列表。

    直接解析乐咕乐股总览页的分类树（L2 的上级=申万1级，L3 的上级=申万2级），
    绕过 akshare 原生接口（已被上游结构变更 + 反爬拦截破坏）。
    """
    html = _fetch_overview_html()
    if not html:
        print("[ERROR] 无法获取申万行业总览页，L1/L2 将留空（L3 仍可用）", flush=True)
        return {}, {}, []

    soup = BeautifulSoup(html, features="html.parser")

    # L2 → L1
    l2_to_l1: dict[str, str] = {}
    for _code, l2, l1 in _extract_items(soup, "level2Items"):
        if l2:
            l2_to_l1[l2] = l1
    print(f"[INFO] 二级行业 {len(l2_to_l1)} 个，L2→L1 映射就绪", flush=True)

    # L3 → L2 + 三级行业代码
    l3_to_l2: dict[str, str] = {}
    codes: list[str] = []
    for code, l3, l2 in _extract_items(soup, "level3Items"):
        if l3:
            l3_to_l2[l3] = l2
        if code:
            codes.append(code)
    print(f"[INFO] 三级行业 {len(codes)} 个，L3→L2 映射就绪", flush=True)

    return l3_to_l2, l2_to_l1, codes


def fetch_constituents(index_code: str, l3_to_l2: dict, l2_to_l1: dict):
    """获取某个三级行业的成分股列表，反推补全 {stock_code: {swL1, swL2, swL3}}。

    成分股表仅含 申万3级 名称；L1/L2 经分类树反推。
    """
    df = _fetch_with_retry(ak.sw_index_third_cons, symbol=index_code)
    if df is None or df.empty:
        return {}

    # 定位关键列
    code_col = "股票代码" if "股票代码" in df.columns else df.columns[1]
    l3_col = None
    for c in df.columns:
        if c == "申万3级" or "3级" in c:
            l3_col = c
            break
    if l3_col is None:
        return {}

    result: dict[str, dict[str, str]] = {}
    for _, row in df.iterrows():
        stock_code = str(row[code_col]).strip()
        # 去掉交易所后缀（如 .SH/.SZ/.BJ），与 stockDictionary 的裸代码对齐
        stock_code = re.sub(r"\.(SH|SZ|BJ|HK)$", "", stock_code, flags=re.IGNORECASE)
        if not stock_code:
            continue

        sw_l3 = str(row[l3_col]).strip()
        sw_l2 = l3_to_l2.get(sw_l3, "")
        sw_l1 = l2_to_l1.get(sw_l2, "") if sw_l2 else ""

        # 去重：同 stock_code 首次出现的行业分类为准
        if stock_code not in result:
            result[stock_code] = {
                "swL1": sw_l1,
                "swL2": sw_l2,
                "swL3": sw_l3,
            }

    return result


def build():
    """主构建流程"""
    l3_to_l2, l2_to_l1, codes = fetch_industry_taxonomy()
    if not codes:
        print("[FATAL] 未获取到任何三级行业代码")
        sys.exit(1)

    sw_map: dict[str, dict[str, str]] = {}
    failed_count = 0

    for code in tqdm(codes, desc="获取成分股"):
        try:
            constituents = fetch_constituents(code, l3_to_l2, l2_to_l1)
            for stock_code, ind in constituents.items():
                if stock_code not in sw_map:
                    sw_map[stock_code] = ind
            # 限速保护：延长间隔 + 轻微抖动，避免触发乐咕乐股限流壳页
            time.sleep(2.5 + (hash(code) % 10) * 0.1)
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


def compute_coverage(sw_map: dict, dict_path: str):
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
