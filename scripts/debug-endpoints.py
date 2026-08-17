"""Debug push2 and em-dc endpoints"""
import requests
import json

BASE_URL = "http://localhost:5173"

# Test 1: push2 with different URL formats
print("=== push2 端点调试 ===")
tests = [
    "/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39",
    "/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39,f57,f58",
]
for url in tests:
    print(f"\nURL: {url}")
    try:
        resp = requests.get(f"{BASE_URL}{url}", timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Referer": "https://quote.eastmoney.com/",
        })
        print(f"  HTTP {resp.status_code}")
        print(f"  Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
        print(f"  Body: {resp.text[:500]}")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

# Test 2: Try direct push2 access (not through proxy)
print("\n\n=== push2 直连测试 ===")
try:
    resp = requests.get(
        "https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f38,f39",
        timeout=15,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Referer": "https://quote.eastmoney.com/",
        }
    )
    print(f"HTTP {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
    print(f"Body: {resp.text[:500]}")
except Exception as e:
    print(f"❌ {type(e).__name__}: {e}")

# Test 3: em-dc endpoint - what does it actually return?
print("\n\n=== em-dc 端点调试 ===")
dc_url = "/api/proxy/em-dc/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INVESTSUMM_STAT&columns=SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB"
print(f"URL: {dc_url}")
try:
    resp = requests.get(f"{BASE_URL}{dc_url}", timeout=15, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
        "Referer": "https://data.eastmoney.com/",
    })
    print(f"HTTP {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
    print(f"Body: {resp.text[:500]}")
except Exception as e:
    print(f"❌ {type(e).__name__}: {e}")

# Test 4: Try em-datacenter with different report names
print("\n\n=== 尝试不同 reportName ===")
alt_reports = [
    "RPT_DMSK_FN_INVESTSUMM",
    "RPT_DMSK_FN_INVESTSUMM_STAT_NEW",
    "RPT_DMSK_FN_INVESTSUMMSTAT",
    "RPT_DMSK_FN_INVESTSTAT",
    "RPT_F10_FINANCE_MAINFINADATA",
]
for rpt in alt_reports:
    url = f"/api/proxy/em-datacenter/securities/api/data/v1/get?reportName={rpt}&columns=SECURITY_CODE,FORECAST_YEAR&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB"
    try:
        resp = requests.get(f"{BASE_URL}{url}", timeout=15, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://data.eastmoney.com/",
        })
        if resp.status_code == 200:
            text = resp.text
            if "报表配置不存在" in text:
                print(f"  ❌ {rpt}: 报表配置不存在")
            elif "result" in text and '"data"' in text:
                try:
                    data = resp.json()
                    items = data.get("result", {}).get("data", [])
                    if items:
                        print(f"  ✅ {rpt}: 成功! {len(items)} 条记录")
                        print(f"     首条: {json.dumps(items[0], ensure_ascii=False)[:200]}")
                    else:
                        print(f"  ⚠️ {rpt}: result.data 为空")
                except:
                    print(f"  ⚠️ {rpt}: JSON 解析失败, body={text[:200]}")
            else:
                print(f"  ? {rpt}: HTTP 200, body={text[:200]}")
        else:
            print(f"  ❌ {rpt}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  ❌ {rpt}: {type(e).__name__}: {e}")

print("\n\n=== 完成 ===")