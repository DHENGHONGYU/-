#!/usr/bin/env python3
"""生成 A+H 股全市场股票字典 (src/services/stock/stockDictionary.ts)

数据源 (akshare，已验证可用)：
  - A 股 (沪+深全量) : stock_info_a_code_name()  -> code, name
  - 北交所           : stock_info_bj_name_code()  -> 证券代码, 证券简称
  - 港股 (主板/创业板): stock_hk_spot()           -> 代码, 中文名称

市场判定：
  - A 股代码前缀 6 -> SH(上交所)；0/3 -> SZ(深交所)
  - 北交所 -> BJ
  - 港股 -> HK (代码零填为 5 位)

输出：覆盖「上交所 + 深交所 + 北交所 + 港交所」四交易所全部上市公司，
覆盖 8331 只（SH 2308 / SZ 2892 / BJ 328 / HK 2803，四交易所完整列表）。

用法：
  npm run build:stock-dict
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_TS = os.path.join(ROOT, "src", "services", "stock", "stockDictionary.ts")

try:
    import akshare as ak
except Exception as e:  # pragma: no cover
    print(f"[FATAL] akshare 不可用: {e}")
    sys.exit(1)


def fetch_a_shares():
    """沪+深全量（含 AB 股）。返回 [(symbol, name, market)]

    代码前缀规则（A 股）：
      - 6xxxxx / 900xxx(沪B)      -> SH 上交所
      - 0xxxxx / 3xxxxx / 200xxx(深B) -> SZ 深交所
      - 8xxxxx / 4xxxxx / 920xxx(北交所) -> BJ (理论上 A 股函数不返回，兜底用)
    """
    df = ak.stock_info_a_code_name()
    out = []
    for _, r in df.iterrows():
        code = str(r["code"]).strip()
        name = str(r["name"]).strip()
        if not code or not name:
            continue
        if code.startswith("6") or code.startswith("900"):
            market = "SH"
        elif code.startswith(("0", "3")) or code.startswith("200"):
            market = "SZ"
        elif code.startswith(("8", "4")) or code.startswith("920"):
            market = "BJ"
        else:
            market = "SH"  # 兜底
        out.append((code, name, market))
    return out


def fetch_bj():
    """北交所。返回 [(symbol, name, 'BJ')]"""
    df = ak.stock_info_bj_name_code()
    out = []
    for _, r in df.iterrows():
        code = str(r["证券代码"]).strip()
        name = str(r["证券简称"]).strip()
        if not code or not name:
            continue
        out.append((code, name, "BJ"))
    return out


def fetch_hk():
    """港股。返回 [(symbol(5位零填), name, 'HK')]"""
    df = ak.stock_hk_spot()
    out = []
    for _, r in df.iterrows():
        code = str(r["代码"]).strip()
        name = str(r.get("中文名称", "")).strip()
        if not code:
            continue
        code = code.zfill(5)  # 保证 5 位，如 00001 / 00700
        if not name:
            continue
        out.append((code, name, "HK"))
    return out


def build():
    a = fetch_a_shares()
    bj = fetch_bj()
    hk = fetch_hk()
    print(f"[INFO] A股 {len(a)} | 北交所 {len(bj)} | 港股 {len(hk)}")

    # 合并去重 (symbol+market 唯一)
    seen = set()
    merged = []
    for sym, name, mkt in a + bj + hk:
        key = (sym, mkt)
        if key in seen:
            continue
        seen.add(key)
        merged.append((sym, name, mkt))

    # 排序：SH -> SZ -> BJ -> HK，组内按 symbol
    order = {"SH": 0, "SZ": 1, "BJ": 2, "HK": 3}
    merged.sort(key=lambda x: (order[x[2]], x[0]))
    return merged


def render(merged):
    # 分块避免 TS2590 (字面量联合类型爆炸)。每块 1000 条。
    CHUNK = 1000
    chunks = [merged[i : i + CHUNK] for i in range(0, len(merged), CHUNK)]

    lines = []
    lines.append("/**")
    lines.append(" * A+H 股全市场股票字典")
    lines.append(" *")
    lines.append(" * @description")
    lines.append(" * 包含 A 股（沪/深/北）和 H 股（港股）全市场股票的基本信息。")
    lines.append(" * 字典数据统一管理在此文件，为 FullMarketStockService 提供离线搜索支持。")
    lines.append(" *")
    lines.append(" * 更新方式：")
    lines.append(" * ```bash")
    lines.append(" * npm run build:stock-dict")
    lines.append(" * ```")
    lines.append(" *")
    lines.append(" * @module services/stock/stockDictionary")
    lines.append(" */")
    lines.append("")
    lines.append("export interface StockDictItem {")
    lines.append("  symbol: string")
    lines.append("  name: string")
    lines.append("  market: 'SH' | 'SZ' | 'BJ' | 'HK'")
    # swL1/swL2/swL3 = 申万一级/二级/三级行业（可选，由行业映射模块填充，不参与字典生成）
    lines.append("  swL1?: string")
    lines.append("  swL2?: string")
    lines.append("  swL3?: string")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * A+H 股全市场股票条目（四交易所完整列表，分块定义以避免 TS 联合类型爆炸）")
    lines.append(" * 含 A 股 5200 只（沪 2308 + 深 2892）、北交所 328、H 股 2803。")
    lines.append(" */")

    # 各分块
    for idx, chunk in enumerate(chunks):
        lines.append(f"const CHUNK_{idx}: StockDictItem[] = [")
        for sym, name, mkt in chunk:
            name_esc = name.replace("'", "\\'")
            lines.append(f"  {{ symbol: '{sym}', name: '{name_esc}', market: '{mkt}' }},")
        lines.append("]")
        lines.append("")

    spread = ", ".join(f"...CHUNK_{i}" for i in range(len(chunks)))
    lines.append(f"const STOCK_DICT: StockDictItem[] = [{spread}]")
    lines.append("")
    lines.append("// 单一数据源：四交易所全量合并（去重并排序）")
    lines.append("const ALL_STOCKS: StockDictItem[] = [")
    lines.append("  ...STOCK_DICT,")
    lines.append("]")
    lines.append("")
    lines.append("export default ALL_STOCKS")
    lines.append("")
    lines.append("/**")
    lines.append(" * 按股票代码快速查找（支持带交易所后缀的代码如 600519.SH）")
    lines.append(" */")
    lines.append("export function findStockBySymbol(symbol: string): StockDictItem | undefined {")
    lines.append("  const normalized = symbol.replace(/\\.(SH|SZ|BJ|HK)$/i, '').trim().toUpperCase()")
    lines.append("  return ALL_STOCKS.find((s) => s.symbol === normalized)")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * 获取股票的市场代码（用于构造交易所代码）")
    lines.append(" */")
    lines.append("export function toExchangeSymbol(symbol: string, market: 'SH' | 'SZ' | 'BJ' | 'HK'): string {")
    lines.append("  if (market === 'HK') return symbol")
    lines.append("  const prefix = market === 'SH' ? 'sh' : market === 'SZ' ? 'sz' : 'bj'")
    lines.append("  return `${prefix}${symbol}`")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main():
    merged = build()
    ts = render(merged)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(ts)
    print(f"[OK] 写入 {OUT_TS}")
    print(f"[OK] 总条目 {len(merged)}")


if __name__ == "__main__":
    main()
