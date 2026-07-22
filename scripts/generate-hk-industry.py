#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
港股恒生行业分类(HSICS)抓取脚本 — 仅抓取恒生一级行业

数据源：理杏仁(Lixinger)开放 API
  POST https://open.lixinger.com/api/hk/company/industries
  参数: {"token": "...", "stockCode": "00001"}
  返回: data[] = [{name, stockCode: "H70"/"H7020"/"H702015", source: "hsi", areaCode: "hk"}, ...]

恒生行业代码即层级编码（H + 行业号 + 类别号 + 子类别号）：
  H70      -> 2 位数字 -> 一级行业 (L1)   ← 本次仅抓取此级

用法：
  LIXINGER_TOKEN=xxx python scripts/generate-hk-industry.py
  python scripts/generate-hk-industry.py --token xxx
  python scripts/generate-hk-industry.py --token xxx --limit 10   # 调试：只抓前 10 只
"""

import os
import sys
import re
import json
import time
import argparse
from typing import Optional

try:
    import requests
except ImportError:
    print("[ERROR] 缺少 requests，请先: pip install requests")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
    RETRY_OK = True
except ImportError:
    RETRY_OK = False

API_URL = "https://open.lixinger.com/api/hk/company/industries"
STOCK_DICT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "services", "stock", "stockDictionary.ts")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "services", "stock", "hkIndustryMap.ts")

REQUEST_INTERVAL = 0.3  # 秒，控制频次
REQUEST_TIMEOUT = 15


def extract_hk_symbols(limit: Optional[int] = None) -> list:
    """从 stockDictionary.ts 提取所有 market:'HK' 的 symbol（如 '00001'）。"""
    with open(STOCK_DICT_PATH, encoding="utf-8") as f:
        txt = f.read()
    pat = re.compile(r"symbol:\s*'(\d{5})'\s*,\s*name:\s*'[^']*'\s*,\s*market:\s*'HK'")
    syms = pat.findall(txt)
    syms = sorted(set(syms))
    if limit:
        syms = syms[:limit]
    return syms


def parse_hsics(data: list) -> Optional[str]:
    """从 Lixinger data[] 解析出恒生一级行业名称（H + 2 位数字）。"""
    for d in data:
        code = d.get("stockCode", "")
        if not code.startswith("H"):
            continue
        digits = code[1:]
        if len(digits) == 2 and digits.isdigit():
            return d.get("name")
    return None


def fetch_one(session, token: str, symbol: str) -> Optional[str]:
    """抓取单只港股的恒生一级行业，返回一级行业名或 None。"""
    payload = {"token": token, "stockCode": symbol}
    resp = session.post(API_URL, json=payload, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    body = resp.json()
    if body.get("code") != 1:
        # token 无效 / 限频 等业务错误
        raise RuntimeError(f"Lixinger API error for {symbol}: code={body.get('code')} msg={body.get('message')}")
    data = body.get("data") or []
    if not data:
        return None
    return parse_hsics(data)


def build_session():
    import requests
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": "FinSightV9/1.0"})
    return s


def write_map(results: dict):
    """写出 hkIndustryMap.ts（仅 swL1）。"""
    lines = []
    lines.append("/**")
    lines.append(" * 港股恒生行业分类(HSICS)映射表")
    lines.append(" *")
    lines.append(" * @description")
    lines.append(" * 提供港股 stock_code → {swL1} 的 O(1) 查表能力（仅取恒生一级行业）。")
    lines.append(" * 数据来源：理杏仁(Lixinger)开放 API 恒生行业分类(HSICS)标准。")
    lines.append(" * 港股 symbol 不带交易所后缀（如 '00001'），与 stockDictionary 中 market:'HK' 一致。")
    lines.append(" *")
    lines.append(" * 更新方式：")
    lines.append(" * ```bash")
    lines.append(" * LIXINGER_TOKEN=xxx npm run build:hk-industry")
    lines.append(" * ```")
    lines.append(" *")
    lines.append(" * @module services/stock/hkIndustryMap")
    lines.append(" */")
    lines.append("")
    lines.append("export interface HkIndustry {")
    lines.append("  swL1: string")
    lines.append("}")
    lines.append("")
    lines.append("export const HK_INDUSTRY_MAP: Record<string, HkIndustry> = {")
    for sym in sorted(results.keys()):
        l1 = results[sym]
        lines.append(f"  '{sym}': {{ swL1: {json.dumps(l1, ensure_ascii=False)} }},")
    lines.append("}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", help="Lixinger API token（也可通过环境变量 LIXINGER_TOKEN 传入）")
    ap.add_argument("--limit", type=int, default=None, help="调试：只抓前 N 只")
    args = ap.parse_args()

    token = args.token or os.environ.get("LIXINGER_TOKEN")
    if not token:
        print("[ERROR] 请提供 Lixinger token：--token xxx 或设置环境变量 LIXINGER_TOKEN")
        sys.exit(1)

    syms = extract_hk_symbols(args.limit)
    print(f"[INFO] 从 stockDictionary.ts 提取到 {len(syms)} 只港股")

    session = build_session()
    results = {}
    skipped = 0
    errors = 0

    if RETRY_OK:
        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10),
               retry=retry_if_exception_type((requests.RequestException, RuntimeError)))
        def _fetch(sym):
            return fetch_one(session, token, sym)
    else:
        def _fetch(sym):
            return fetch_one(session, token, sym)

    it = tqdm(syms, desc="抓取港股一级行业") if tqdm else syms
    for sym in it:
        try:
            r = _fetch(sym)
            if r:
                results[sym] = r
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"[WARN] {sym} 失败: {e}")
        time.sleep(REQUEST_INTERVAL)

    print(f"[INFO] 成功 {len(results)} 只，无行业数据 {skipped} 只，失败 {errors} 只")
    write_map(results)
    print(f"[INFO] 已写入 {OUTPUT_PATH}")

    # 覆盖率
    total = len(syms)
    cov = len(results) / total * 100 if total else 0
    print(f"[INFO] 港股 HSICS 一级覆盖率: {cov:.1f}% ({len(results)}/{total})")


if __name__ == "__main__":
    main()
