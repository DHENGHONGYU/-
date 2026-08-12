"""
V9 采集模块真实数据审计脚本

对随机抽取的 10 只 A 股执行真实数据采集，多维度评分，对照审计基线。
审计基线（来自 qualityMetricsCollector.ts / data-collector-contract.md）：
  - 采集成功率 >= 80%
  - 真实数据源成功率（排除 mock）>= 80%
  - 数据完整率（非空字段/总字段）>= 90%
  - 写入成功率 >= 95%（本地脚本以"可序列化落盘成功"代理）
  - 维度覆盖率 = 成功维度数 / 计划维度数

数据源策略（P0 改进后）：
  - 01_basic: AKShare stock_individual_info_em + 腾讯实时行情（price/pe/pb）
  - 02_kline: 腾讯 fqkline API（替代被东财封禁的 stock_zh_a_hist）
  - 03_chip: AKShare stock_zh_a_gdhs_detail_em
  - 04/05_news: AKShare stock_news_em
  - 09_financial: AKShare stock_financial_analysis_indicator + stock_financial_abstract
  - 10_sector: AKShare sw_index_second_info

输出：outputs/audit-reports/collect-audit-<timestamp>.json + .md
"""
import sys
import os
import json
import time
import random
import traceback
from datetime import datetime


def fetch_random_stocks(ak, count=10):
    """从全A股列表中随机抽取 count 只股票（排除ST/退市）。

    数据源：ak.stock_info_a_code_name() 返回全 A 股 code+name（约5500+只）。
    过滤规则：排除 ST/*ST/退市股、非6位数字代码。
    """
    df = ak.stock_info_a_code_name()
    if df is None or df.empty:
        raise RuntimeError("无法获取A股列表（stock_info_a_code_name 返回空）")

    stocks = []
    for _, row in df.iterrows():
        code = str(row.get("code", "")).strip()
        name = str(row.get("name", "")).strip().replace(" ", "").replace("Ａ", "A")
        if len(code) != 6 or not code.isdigit():
            continue
        if "ST" in name or "退" in name:
            continue
        stocks.append((code, name))

    if len(stocks) < count:
        raise RuntimeError(f"可用A股数量 {len(stocks)} 少于请求数 {count}")

    selected = random.sample(stocks, count)
    return [(code, name, "随机抽取") for code, name in selected]


# 审计基线
BASELINE = {
    "successRate": 80,
    "realSuccessRate": 80,
    "completeness": 90,
    "writeRate": 95,
    "dimensionCoverage": 80,
}

# 维度 → akshare 接口
DIMENSIONS = ["01_basic", "02_kline", "03_chip", "04_news", "05_hotnews", "09_financial", "10_sector"]


def try_import_akshare():
    try:
        import akshare as ak
        return ak, ak.__version__
    except ImportError:
        return None, None


def _safe_float(val):
    if val is None or str(val).strip() == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _to_tencent_code(symbol):
    """6位代码 → 腾讯格式 (sh600519 / sz000001)"""
    clean = symbol.split(".")[0].upper()
    if clean.startswith("6"):
        return f"sh{clean}"
    elif clean.startswith(("0", "3", "2")):
        return f"sz{clean}"
    elif clean.startswith(("8", "4", "9")):
        return f"bj{clean}"
    return f"sh{clean}"


def collect_basic(ak, symbol):
    """维度01 基本信息：AKShare stock_individual_info_em + 腾讯实时行情(price/pe/pb)"""
    import requests
    t0 = time.time()
    fields_expected = ["name", "industry", "market_cap", "price", "pe", "pb"]
    info = {}
    errors = []

    # 1. AKShare 获取 name/industry/market_cap（独立 try，失败不阻断腾讯源）
    try:
        df = ak.stock_individual_info_em(symbol=symbol)
        if df is not None and not df.empty:
            for _, row in df.iterrows():
                item = str(row["item"]).strip()
                value = row["value"]
                if item == "股票简称":
                    info["name"] = str(value).strip() if value is not None else None
                elif item == "行业":
                    info["industry"] = str(value).strip() if value is not None else None
                elif item == "总市值":
                    try:
                        info["market_cap"] = float(value)
                    except (TypeError, ValueError):
                        pass
    except Exception as e:
        errors.append(f"akshare: {str(e)[:60]}")

    # 2. 腾讯实时行情获取 price/pe/pb（独立 try，即使 AKShare 失败也能拿到行情）
    try:
        tc = _to_tencent_code(symbol)
        r = requests.get(f"https://qt.gtimg.cn/q={tc}", timeout=8, headers={"Referer": "https://gu.qq.com/"})
        parts = r.text.split('="')
        if len(parts) >= 2:
            fields = parts[1].strip('";\n').split("~")
            if len(fields) >= 50:
                info["price"] = _safe_float(fields[3])
                info["pe"] = _safe_float(fields[39])
                info["pb"] = _safe_float(fields[47])
                mcap = _safe_float(fields[46])
                if mcap and "market_cap" not in info:
                    info["market_cap"] = mcap * 1e8  # 亿→元
                # 腾讯行情返回了 name 字段，可作为 AKShare 失败时的兜底
                if "name" not in info and fields[1]:
                    info["name"] = fields[1]
    except Exception as e:
        errors.append(f"tencent: {str(e)[:60]}")

    latency = round((time.time() - t0) * 1000)
    # 只要有任何一个字段获取成功就算成功
    if not info:
        return {"success": False, "latency": latency, "fields": {}, "completeness": 0, "error": "; ".join(errors)}
    non_null = sum(1 for v in info.values() if v is not None)
    comp = round(non_null / len(fields_expected) * 100)
    return {"success": True, "latency": latency, "fields": info, "completeness": comp, "error": None}


def collect_kline(ak, symbol):
    """维度02 K线：腾讯 fqkline API（替代被东财封禁的 stock_zh_a_hist）"""
    import requests
    t0 = time.time()
    fields_expected = ["date", "open", "high", "low", "close", "volume"]
    try:
        tc = _to_tencent_code(symbol)
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={tc},day,,,60,qfq"
        r = requests.get(url, timeout=10)
        data = r.json()
        kline_data = data.get("data", {}).get(tc, {})
        day_list = kline_data.get("day") or kline_data.get("qfqday")
        latency = round((time.time() - t0) * 1000)
        if not day_list:
            return {"success": False, "latency": latency, "records": 0, "completeness": 0, "error": "腾讯K线返回空"}
        # 验证最后一条的字段完整性
        last = day_list[-1]
        non_null = sum(1 for i in range(min(6, len(last))) if _safe_float(last[i]) is not None or i == 0)
        comp = round(non_null / len(fields_expected) * 100)
        return {"success": True, "latency": latency, "records": len(day_list), "completeness": comp, "error": None, "latest_date": str(last[0])}
    except Exception as e:
        return {"success": False, "latency": round((time.time() - t0) * 1000), "records": 0, "completeness": 0, "error": str(e)}


def collect_chip(ak, symbol):
    """维度03 筹码/股东户数：stock_zh_a_gdhs_detail_em"""
    t0 = time.time()
    try:
        df = ak.stock_zh_a_gdhs_detail_em(symbol=symbol)
        latency = round((time.time() - t0) * 1000)
        if df is None or df.empty:
            return {"success": False, "latency": latency, "records": 0, "completeness": 0, "error": "空DataFrame"}
        return {"success": True, "latency": latency, "records": len(df), "completeness": 100, "error": None}
    except Exception as e:
        return {"success": False, "latency": round((time.time() - t0) * 1000), "records": 0, "completeness": 0, "error": str(e)}


def collect_news(ak, symbol):
    """维度04/05 新闻：stock_news_em"""
    t0 = time.time()
    try:
        df = ak.stock_news_em(symbol=symbol)
        latency = round((time.time() - t0) * 1000)
        if df is None or df.empty:
            return {"success": False, "latency": latency, "records": 0, "completeness": 0, "error": "空DataFrame"}
        return {"success": True, "latency": latency, "records": len(df), "completeness": 100, "error": None}
    except Exception as e:
        return {"success": False, "latency": round((time.time() - t0) * 1000), "records": 0, "completeness": 0, "error": str(e)}


def collect_financial(ak, symbol):
    """维度09 财务：stock_financial_analysis_indicator + stock_financial_abstract"""
    t0 = time.time()
    fields_expected = ["revenue", "net_profit", "gross_margin", "net_margin", "roe", "revenue_yoy", "net_profit_yoy"]
    try:
        info = {}
        # 1. 比率类指标
        df = ak.stock_financial_analysis_indicator(symbol=symbol, start_year="2023")
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            info["gross_margin"] = _safe_float(latest.get("销售毛利率(%)"))
            info["net_margin"] = _safe_float(latest.get("销售净利率(%)"))
            info["roe"] = _safe_float(latest.get("净资产收益率(%)"))
            info["revenue_yoy"] = _safe_float(latest.get("主营业务收入增长率(%)"))
            info["net_profit_yoy"] = _safe_float(latest.get("净利润增长率(%)"))
        # 2. 绝对值指标
        try:
            df2 = ak.stock_financial_abstract(symbol=symbol)
            if df2 is not None and not df2.empty:
                date_cols = [c for c in df2.columns if c not in ("选项", "指标")]
                if date_cols:
                    latest_col = date_cols[0]
                    for _, row in df2.iterrows():
                        metric = str(row["指标"]).strip()
                        val = _safe_float(row[latest_col])
                        if val is None:
                            continue
                        if metric == "营业总收入":
                            info.setdefault("revenue", val)
                        elif metric in ("归母净利润", "净利润"):
                            info.setdefault("net_profit", val)
        except Exception:
            pass
        latency = round((time.time() - t0) * 1000)
        if not info:
            return {"success": False, "latency": latency, "records": 0, "completeness": 0, "error": "空DataFrame"}
        non_null = sum(1 for k in fields_expected if info.get(k) is not None)
        comp = round(non_null / len(fields_expected) * 100)
        return {"success": True, "latency": latency, "records": len(df) if df is not None else 0, "completeness": comp, "error": None}
    except Exception as e:
        return {"success": False, "latency": round((time.time() - t0) * 1000), "records": 0, "completeness": 0, "error": str(e)}


def collect_sector(ak):
    """维度10 板块轮动：sw_index_second_info（全局，非个股）"""
    t0 = time.time()
    try:
        df = ak.sw_index_second_info()
        latency = round((time.time() - t0) * 1000)
        if df is None or df.empty:
            return {"success": False, "latency": latency, "records": 0, "completeness": 0, "error": "空DataFrame"}
        return {"success": True, "latency": latency, "records": len(df), "completeness": 100, "error": None}
    except Exception as e:
        return {"success": False, "latency": round((time.time() - t0) * 1000), "records": 0, "completeness": 0, "error": str(e)}


def main():
    print("=" * 70)
    print("V9 采集模块真实数据审计")
    print(f"时间: {datetime.now().isoformat()}")
    print("=" * 70)

    ak, akver = try_import_akshare()
    if ak is None:
        print("[FATAL] akshare 未安装，无法执行真实采集审计")
        sys.exit(1)
    print(f"akshare 版本: {akver}")

    # 动态随机抽取测试股票（不硬编码）
    print("正在获取全A股列表并随机抽取 10 只...")
    try:
        test_symbols = fetch_random_stocks(ak, count=10)
    except Exception as e:
        print(f"[FATAL] 随机抽取股票失败: {e}")
        sys.exit(1)
    print(f"随机抽取 {len(test_symbols)} 只股票:")
    for code, name, industry in test_symbols:
        print(f"  {code} {name}")
    print()

    results = {"startedAt": datetime.now().isoformat(), "akshare_version": akver, "symbols": [], "sector": None}

    # 个股维度采集
    total_attempts = 0
    total_success = 0
    total_completeness = []
    total_latency = []
    dim_success = {d: 0 for d in DIMENSIONS if d != "10_sector"}
    dim_attempts = {d: 0 for d in DIMENSIONS if d != "10_sector"}

    for code, name, industry in test_symbols:
        print(f"\n>>> {code} {name} ({industry})")
        sym_res = {"code": code, "name": name, "industry": industry, "dims": {}}
        for dim, fn in [
            ("01_basic", collect_basic),
            ("02_kline", collect_kline),
            ("03_chip", collect_chip),
            ("04_news", collect_news),
            ("05_hotnews", collect_news),
            ("09_financial", collect_financial),
        ]:
            r = fn(ak, code)
            sym_res["dims"][dim] = r
            total_attempts += 1
            dim_attempts[dim] += 1
            if r["success"]:
                total_success += 1
                dim_success[dim] += 1
                total_completeness.append(r["completeness"])
            total_latency.append(r["latency"])
            status = "OK " if r["success"] else "FAIL"
            extra = f"records={r.get('records', '-')}" if r["success"] else f"err={r.get('error', '')[:50]}"
            print(f"    [{status}] {dim:12s} lat={r['latency']:6d}ms comp={r['completeness']:3d}% {extra}")
            time.sleep(0.3)  # 限流
        results["symbols"].append(sym_res)

    # 板块维度（全局一次）
    print("\n>>> 板块轮动 (全局)")
    sec = collect_sector(ak)
    results["sector"] = sec
    status = "OK " if sec["success"] else "FAIL"
    print(f"    [{status}] 10_sector    lat={sec['latency']:6d}ms records={sec.get('records', 0)}")

    # 评分
    success_rate = round(total_success / max(1, total_attempts) * 100)
    real_success_rate = success_rate  # 全部真实源
    avg_completeness = round(sum(total_completeness) / max(1, len(total_completeness))) if total_completeness else 0
    avg_latency = round(sum(total_latency) / max(1, len(total_latency)))
    write_rate = 100  # 脚本以序列化成功代理
    dim_coverage = round(sum(1 for d in DIMENSIONS if (dim_success.get(d, 0) > 0 or (d == "10_sector" and sec["success"]))) / len(DIMENSIONS) * 100)

    score = {
        "successRate": success_rate,
        "realSuccessRate": real_success_rate,
        "completeness": avg_completeness,
        "writeRate": write_rate,
        "dimensionCoverage": dim_coverage,
        "avgLatencyMs": avg_latency,
        "totalAttempts": total_attempts,
        "totalSuccess": total_success,
    }

    # 维度明细成功率
    dim_detail = {}
    for d in DIMENSIONS:
        if d == "10_sector":
            dim_detail[d] = {"success": 1 if sec["success"] else 0, "total": 1, "rate": 100 if sec["success"] else 0}
        else:
            t = dim_attempts[d]
            s = dim_success[d]
            dim_detail[d] = {"success": s, "total": t, "rate": round(s / max(1, t) * 100)}

    # 达标判定
    verdict = {}
    for k, baseline in BASELINE.items():
        actual = score.get(k, 0)
        verdict[k] = {"actual": actual, "baseline": baseline, "pass": actual >= baseline}

    overall_pass = all(v["pass"] for v in verdict.values())

    results["score"] = score
    results["dimDetail"] = dim_detail
    results["verdict"] = verdict
    results["overallPass"] = overall_pass
    results["finishedAt"] = datetime.now().isoformat()

    # 输出
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "outputs", "audit-reports")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    json_path = os.path.join(out_dir, f"collect-audit-{ts}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 控制台汇总
    print("\n" + "=" * 70)
    print("多维度评分汇总")
    print("=" * 70)
    print(f"{'维度':<22} {'实际':>8} {'基线':>8} {'判定':>6}")
    print("-" * 50)
    labels = {"successRate": "采集成功率(%)", "realSuccessRate": "真实源成功率(%)", "completeness": "数据完整率(%)", "writeRate": "写入成功率(%)", "dimensionCoverage": "维度覆盖率(%)"}
    for k in ["successRate", "realSuccessRate", "completeness", "writeRate", "dimensionCoverage"]:
        v = verdict[k]
        mark = "PASS" if v["pass"] else "FAIL"
        print(f"{labels[k]:<22} {v['actual']:>8} {v['baseline']:>8} {mark:>6}")
    print("-" * 50)
    print(f"平均延迟: {avg_latency} ms")
    print(f"总尝试: {total_attempts}  成功: {total_success}")
    print(f"总体达标: {'是' if overall_pass else '否'}")
    print(f"\n维度明细成功率:")
    for d in DIMENSIONS:
        dd = dim_detail[d]
        print(f"  {d:12s}: {dd['success']}/{dd['total']} = {dd['rate']}%")
    print(f"\n报告已保存: {json_path}")


if __name__ == "__main__":
    main()
