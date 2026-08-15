"""
FinSightV9 E2E API Performance & Data Validation Test (Corrected)
Uses correct API schema: symbol (not code)
"""
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

HOLDINGS = [
    {"symbol": "00700", "name": "腾讯控股", "shares": 400, "avg_cost": 380.0, "market": "HK"},
    {"symbol": "00981", "name": "中芯国际", "shares": 2000, "avg_cost": 18.5, "market": "HK"},
    {"symbol": "688638", "name": "信科移动", "shares": 1000, "avg_cost": 55.0, "market": "SH"},
    {"symbol": "002466", "name": "天齐锂业", "shares": 500, "avg_cost": 42.0, "market": "SZ"},
    {"symbol": "002460", "name": "赣锋锂业", "shares": 800, "avg_cost": 38.0, "market": "SZ"},
    {"symbol": "01797", "name": "东方甄选", "shares": 300, "avg_cost": 32.0, "market": "HK"},
    {"symbol": "09988", "name": "阿里巴巴", "shares": 600, "avg_cost": 78.0, "market": "HK"},
    {"symbol": "688325", "name": "赛微微电", "shares": 1000, "avg_cost": 120.0, "market": "SH"},
    {"symbol": "600309", "name": "万华化学", "shares": 300, "avg_cost": 82.0, "market": "SH"},
]

def test_endpoint(endpoint, data, timeout=15):
    url = f"{BASE_URL}{endpoint}"
    start = time.time()
    try:
        resp = requests.post(url, json=data, timeout=timeout)
        elapsed = (time.time() - start) * 1000
        if resp.status_code == 200:
            result = resp.json()
            return {
                "success": True,
                "http_ok": True,
                "api_success": result.get("success", False),
                "time_ms": round(elapsed, 1),
                "data": result.get("data", {}),
                "symbol": result.get("symbol", data.get("symbol", "")),
                "message": result.get("message", ""),
            }
        else:
            detail = ""
            try:
                detail = resp.json().get("detail", "")
            except:
                detail = resp.text[:200]
            return {
                "success": False,
                "http_ok": False,
                "api_success": False,
                "time_ms": round(elapsed, 1),
                "data": {},
                "symbol": data.get("symbol", ""),
                "message": f"HTTP {resp.status_code}: {detail}",
            }
    except requests.exceptions.Timeout:
        return {"success": False, "http_ok": False, "api_success": False, "time_ms": round((time.time()-start)*1000, 1), "data": {}, "symbol": data.get("symbol",""), "message": "Timeout"}
    except Exception as e:
        return {"success": False, "http_ok": False, "api_success": False, "time_ms": round((time.time()-start)*1000, 1), "data": {}, "symbol": data.get("symbol",""), "message": str(e)}

def main():
    print("=" * 70)
    print("FinSightV9 E2E API Performance & Data Validation (Corrected)")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Holdings: {len(HOLDINGS)} stocks")
    print("=" * 70)

    results = {"test_time": datetime.now().isoformat(), "api_base": BASE_URL, "tests": [], "summary": {}}

    all_times = []
    a_share = [h for h in HOLDINGS if h["market"] != "HK"]

    # Test 1: Basic Data
    print("\n[Test 1] Basic Stock Data (/api/collect/basic)")
    basic_ok = 0
    basic_fail = 0
    for stock in HOLDINGS:
        s = stock["symbol"]
        print(f"  {stock['name']} ({s})...", end=" ", flush=True)
        r = test_endpoint("/api/collect/basic", {"symbol": s})
        all_times.append(r["time_ms"])
        results["tests"].append({"type": "basic", "symbol": s, "name": stock["name"], "api_success": r["api_success"], "time_ms": r["time_ms"], "message": r["message"]})
        if r["api_success"]:
            basic_ok += 1
            d = r["data"]
            print(f"✅ {r['time_ms']}ms | OK | Keys:{len(d.keys()) if isinstance(d,dict) else 0}")
        else:
            basic_fail += 1
            print(f"❌ {r['time_ms']}ms | {r['message'][:80]}")

    # Test 2: K-line Data (3 A-shares)
    print("\n[Test 2] K-line Data (/api/collect/kline)")
    kline_ok = 0
    kline_fail = 0
    for stock in a_share[:3]:
        s = stock["symbol"]
        print(f"  {stock['name']} ({s})...", end=" ", flush=True)
        r = test_endpoint("/api/collect/kline", {"symbol": s, "period": "daily", "adjust": "qfq"})
        all_times.append(r["time_ms"])
        results["tests"].append({"type": "kline", "symbol": s, "name": stock["name"], "api_success": r["api_success"], "time_ms": r["time_ms"], "message": r["message"]})
        if r["api_success"]:
            kline_ok += 1
            d = r["data"]
            bars = len(d) if isinstance(d, list) else (len(d.get("bars", d.get("data",[]))) if isinstance(d,dict) else 0)
            print(f"✅ {r['time_ms']}ms | Bars: {bars}")
        else:
            kline_fail += 1
            print(f"❌ {r['time_ms']}ms | {r['message'][:80]}")

    # Test 3: Financial Data (3 A-shares)
    print("\n[Test 3] Financial Data (/api/collect/financial)")
    fin_ok = 0
    fin_fail = 0
    for stock in a_share[:3]:
        s = stock["symbol"]
        print(f"  {stock['name']} ({s})...", end=" ", flush=True)
        r = test_endpoint("/api/collect/financial", {"symbol": s})
        all_times.append(r["time_ms"])
        results["tests"].append({"type": "financial", "symbol": s, "name": stock["name"], "api_success": r["api_success"], "time_ms": r["time_ms"], "message": r["message"]})
        if r["api_success"]:
            fin_ok += 1
            print(f"✅ {r['time_ms']}ms | OK")
        else:
            fin_fail += 1
            print(f"❌ {r['time_ms']}ms | {r['message'][:80]}")

    # Test 4: Sector Data
    print("\n[Test 4] Sector/Industry Data (/api/collect/sectors)")
    sector_ok = 0
    sector_fail = 0
    for topN in [5, 10]:
        print(f"  Top {topN} sectors...", end=" ", flush=True)
        r = test_endpoint("/api/collect/sectors", {"topN": topN})
        all_times.append(r["time_ms"])
        results["tests"].append({"type": "sectors", "topN": topN, "api_success": r["api_success"], "time_ms": r["time_ms"], "message": r["message"]})
        if r["api_success"]:
            sector_ok += 1
            d = r["data"]
            count = len(d) if isinstance(d, list) else len(d.get("sectors",[])) if isinstance(d,dict) else 0
            print(f"✅ {r['time_ms']}ms | Count: {count}")
        else:
            sector_fail += 1
            print(f"❌ {r['time_ms']}ms | {r['message'][:80]}")

    # Health check
    print("\n[Test 5] System Health")
    try:
        hr = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"  /health: HTTP {hr.status_code} | {hr.json()}")
    except Exception as e:
        print(f"  /health: Error - {e}")

    # Stats
    total = len(results["tests"])
    success_count = sum(1 for t in results["tests"] if t["api_success"])
    fail_count = total - success_count
    success_rate = round(success_count / max(total, 1) * 100, 1)

    if all_times:
        sorted_times = sorted(all_times)
        avg = sum(sorted_times) / len(sorted_times)
        p95 = sorted_times[int(len(sorted_times) * 0.95)] if sorted_times else 0
        max_t = sorted_times[-1]
        min_t = sorted_times[0]
    else:
        avg = p95 = max_t = min_t = 0

    # Performance score
    perf_score = 10 if avg < 500 else (8 if avg < 1500 else (6 if avg < 3000 else 4))
    data_score = min(10, round(success_rate / 10, 1))

    results["summary"] = {
        "total_tests": total,
        "api_success": success_count,
        "api_failed": fail_count,
        "success_rate_pct": success_rate,
        "avg_response_ms": round(avg, 1),
        "p95_response_ms": round(p95, 1),
        "max_response_ms": round(max_t, 1),
        "min_response_ms": round(min_t, 1),
        "performance_score": perf_score,
        "data_availability_score": data_score,
        "basic_data": {"ok": basic_ok, "fail": basic_fail},
        "kline_data": {"ok": kline_ok, "fail": kline_fail},
        "financial_data": {"ok": fin_ok, "fail": fin_fail},
        "sector_data": {"ok": sector_ok, "fail": sector_fail},
    }

    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    print(f"  Total tests:       {total}")
    print(f"  API Success:       {success_count}")
    print(f"  API Failed:         {fail_count}")
    print(f"  Success rate:       {success_rate}%")
    print(f"  Avg response:       {avg:.1f}ms")
    print(f"  P95 response:       {p95:.1f}ms")
    print(f"  Max response:       {max_t:.1f}ms")
    print(f"  Min response:       {min_t:.1f}ms")
    print(f"  Performance score:  {perf_score}/10")
    print(f"  Data availability:  {data_score}/10")

    output_path = "d:/FinSightV9/outputs/e2e_api_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Results: {output_path}")

if __name__ == "__main__":
    main()