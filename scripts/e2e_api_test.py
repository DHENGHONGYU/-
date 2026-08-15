"""
FinSightV9 E2E Test - POST-based API verification
"""
import json, time, urllib.request, urllib.error
from datetime import datetime

API_BASE = "http://localhost:8000"
HOLDINGS = [
    {"code": "00700.HK", "name": "腾讯控股"},
    {"code": "00981.HK", "name": "中芯国际"},
    {"code": "688638.SH", "name": "信科移动"},
    {"code": "002466.SZ", "name": "天齐锂业"},
    {"code": "002460.SZ", "name": "赣锋锂业"},
    {"code": "01797.HK", "name": "东方甄选"},
    {"code": "09988.HK", "name": "阿里巴巴"},
    {"code": "688325.SH", "name": "赛微微电"},
    {"code": "600309.SH", "name": "万华化学"},
]

results = {
    "test_time": datetime.now().isoformat(),
    "api_tests": [],
    "summary": {"total": 0, "success": 0, "failed": 0}
}

def test_api_post(endpoint, label, payload=None):
    url = f"{API_BASE}{endpoint}"
    if payload is None:
        payload = {}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            data_json = json.loads(body)
            elapsed = (time.time() - start) * 1000
            success = data_json.get("success", False)
            result = {
                "label": label,
                "endpoint": endpoint,
                "elapsed_ms": round(elapsed, 1),
                "status_code": resp.status,
                "success": success,
                "data_summary": _summarize(data_json.get("data")),
                "message": data_json.get("message", "")[:120]
            }
            results["api_tests"].append(result)
            status = "PASS" if success else "WARN"
            print(f"  [{status}] {label}: {elapsed:.0f}ms | code={resp.status} | {result['data_summary']}")
            return result
    except urllib.error.HTTPError as e:
        elapsed = (time.time() - start) * 1000
        body = e.read().decode()[:200] if hasattr(e, "read") else str(e)
        result = {
            "label": label,
            "endpoint": endpoint,
            "elapsed_ms": round(elapsed, 1),
            "status_code": e.code,
            "success": False,
            "error": f"HTTP {e.code}: {body[:150]}"
        }
        results["api_tests"].append(result)
        print(f"  [FAIL] {label}: {elapsed:.0f}ms | HTTP {e.code}")
        return result
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        result = {
            "label": label,
            "endpoint": endpoint,
            "elapsed_ms": round(elapsed, 1),
            "success": False,
            "error": str(e)[:150]
        }
        results["api_tests"].append(result)
        print(f"  [FAIL] {label}: {elapsed:.0f}ms | Error: {e}")
        return result

def _summarize(data):
    if data is None:
        return "data=null"
    if isinstance(data, dict):
        keys = list(data.keys())[:6]
        return "keys=" + ",".join(keys)
    if isinstance(data, list):
        return f"list[{len(data)}]"
    return str(data)[:80]

# Also test GET endpoints
def test_api_get(endpoint, label, params=None):
    url = f"{API_BASE}{endpoint}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    start = time.time()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            data_json = json.loads(body)
            elapsed = (time.time() - start) * 1000
            result = {
                "label": label,
                "endpoint": endpoint,
                "elapsed_ms": round(elapsed, 1),
                "status_code": resp.status,
                "success": True,
                "data_summary": _summarize(data_json),
            }
            results["api_tests"].append(result)
            print(f"  [PASS] {label}: {elapsed:.0f}ms | {result['data_summary']}")
            return result
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        result = {
            "label": label,
            "endpoint": endpoint,
            "elapsed_ms": round(elapsed, 1),
            "success": False,
            "error": str(e)[:150]
        }
        results["api_tests"].append(result)
        print(f"  [FAIL] {label}: {elapsed:.0f}ms | Error: {e}")
        return result

print("=" * 60)
print("FinSightV9 API-Level E2E Verification (POST)")
print(f"Time: {results['test_time']}")
print("=" * 60)

# 1. Health check (GET)
print("\n--- Health Check ---")
test_api_get("/health", "服务健康检查")

# 2. Basic data (POST)
print("\n--- Basic Data (POST /api/collect/basic) ---")
for h in HOLDINGS:
    test_api_post("/api/collect/basic", f"{h['name']}({h['code']}) 基本信息", {"symbol": h["code"]})

# 3. K-line data (POST)
print("\n--- K-Line Data (POST /api/collect/kline) ---")
for h in HOLDINGS[:5]:
    test_api_post("/api/collect/kline", f"{h['name']}({h['code']}) 日K线",
                  {"symbol": h["code"], "period": "daily"})

# 4. Financial data (POST)
print("\n--- Financial Data (POST /api/collect/financial) ---")
for h in HOLDINGS[:3]:
    test_api_post("/api/collect/financial", f"{h['name']}({h['code']}) 财务数据",
                  {"symbol": h["code"]})

# 5. Sector data (POST)
print("\n--- Sector Data (POST /api/collect/sectors) ---")
test_api_post("/api/collect/sectors", "行业板块数据", {})

# Aggregate
print("\n--- Summary ---")
results["summary"]["total"] = len(results["api_tests"])
results["summary"]["success"] = sum(1 for t in results["api_tests"] if t.get("success"))
results["summary"]["failed"] = results["summary"]["total"] - results["summary"]["success"]

print(f"Total: {results['summary']['total']}")
print(f"Success: {results['summary']['success']}")
print(f"Failed: {results['summary']['failed']}")

if results["api_tests"]:
    times = [t["elapsed_ms"] for t in results["api_tests"]]
    print(f"Avg response: {sum(times)/len(times):.1f}ms")
    print(f"Max response: {max(times):.1f}ms")
    print(f"Min response: {min(times):.1f}ms")

with open("d:/FinSightV9/outputs/e2e-api-results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\nSaved to outputs/e2e-api-results.json")