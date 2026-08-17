"""Find correct Eastmoney consensus/rating endpoints and share structure alternatives"""
import requests
import json
import re

BASE_URL = "http://localhost:5173"

# === 1. 腾讯行情获取总股本/流通股本 ===
print("=== 腾讯行情详细数据 ===")
# 腾讯行情包含 总市值 和 流通市值
try:
    resp = requests.get(
        "https://qt.gtimg.cn/q=sh600519",
        timeout=15,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    text = resp.text
    parts = text.split('~')
    print(f"当前价 [3]: {parts[3] if len(parts) > 3 else 'N/A'}")
    print(f"总市值 [44]: {parts[44] if len(parts) > 44 else 'N/A'} (亿元)")
    print(f"流通市值 [45]: {parts[45] if len(parts) > 45 else 'N/A'} (亿元)")
    if len(parts) > 44:
        price = float(parts[3])
        total_mcap = float(parts[44])
        float_mcap = float(parts[45])
        if price > 0:
            total_shares = total_mcap / price  # 亿股
            float_shares = float_mcap / price
            print(f"推算总股本: {total_shares:.2f} 亿股")
            print(f"推算流通股本: {float_shares:.2f} 亿股")
except Exception as e:
    print(f"❌ {type(e).__name__}: {e}")


# === 2. 尝试东财个股页面的 API 调用 ===
print("\n\n=== 东财个股页面 API 探测 ===")
# 东财个股页面通常调用这些 API
stock_page_urls = [
    # 盈利预测
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INVESTSUMM&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&sortTypes=-1&sortColumns=FORECAST_YEAR&source=WEB&client=WEB",
    # 机构评级
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_RATING&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
    # 业绩预测（新）
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_PERFORMANCEE&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_PERFORMANCE_E&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_PERFORMANCEFORECAST&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
    # 评级
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_RATINGDETAIL&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_RATING_SUMM&columns=ALL&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&source=WEB&client=WEB",
]

for url in stock_page_urls:
    # Extract report name
    rpt_match = re.search(r'reportName=([^&]+)', url)
    rpt_name = rpt_match.group(1) if rpt_match else "UNKNOWN"
    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Referer": "https://data.eastmoney.com/",
        })
        if resp.status_code == 200:
            text = resp.text
            if "报表配置不存在" in text:
                print(f"  ❌ {rpt_name}: 不存在")
            elif '"success":true' in text:
                try:
                    data = resp.json()
                    result = data.get("result", {})
                    items = result.get("data", []) if result else []
                    if items:
                        print(f"  ✅ {rpt_name}: 成功! {len(items)} 条")
                        print(f"     字段: {list(items[0].keys())[:15]}")
                        print(f"     首条: {json.dumps(items[0], ensure_ascii=False)[:300]}")
                    else:
                        print(f"  ⚠️ {rpt_name}: data 为空, full={text[:300]}")
                except:
                    print(f"  ⚠️ {rpt_name}: JSON err, text={text[:200]}")
            elif "返回字段不存在" in text:
                print(f"  ⚠️ {rpt_name}: 报表存在但字段 ALL 不支持")
            else:
                print(f"  ? {rpt_name}: {text[:200]}")
        else:
            print(f"  ❌ {rpt_name}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  ❌ {rpt_name}: {type(e).__name__}: {e}")


# === 3. 尝试通过东财 easyMoney API 获取盈利预测 ===
print("\n\n=== 东财 easyMoney API 探测 ===")
# 东财新版 API 路径
easy_money_urls = [
    "https://emweb.securities.eastmoney.com/PC_HSF10/ProfitForecast/PageAjax?code=SH600519",
    "https://emweb.securities.eastmoney.com/PC_HSF10/ResearchReport/PageAjax?code=SH600519",
]

for url in easy_money_urls:
    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Referer": "https://emweb.securities.eastmoney.com/",
        })
        print(f"\nURL: {url}")
        print(f"  HTTP {resp.status_code} | {resp.headers.get('Content-Type', 'N/A')[:60]}")
        if resp.status_code == 200:
            try:
                data = resp.json()
                print(f"  JSON keys: {list(data.keys())[:15]}")
                for key in data:
                    val = data[key]
                    if isinstance(val, list) and len(val) > 0:
                        print(f"  [{key}] 记录数: {len(val)}")
                        print(f"    首条: {json.dumps(val[0], ensure_ascii=False)[:300]}")
                    elif isinstance(val, dict):
                        print(f"  [{key}] 字段: {list(val.keys())[:10]}")
            except:
                print(f"  Body: {resp.text[:300]}")
    except Exception as e:
        print(f"\nURL: {url}")
        print(f"  ❌ {type(e).__name__}: {e}")


# === 4. 尝试通过代理的东财 F10 盈利预测 ===
print("\n\n=== 代理 F10 盈利预测 ===")
proxy_urls = [
    "/api/proxy/em-f10/PC_HSF10/ProfitForecast/PageAjax?code=SH600519",
    "/api/proxy/em-f10/PC_HSF10/ResearchReport/PageAjax?code=SH600519",
    "/api/proxy/em-f10/PC_HSF10/ValueAnalysis/PageAjax?code=SH600519",
]

for url in proxy_urls:
    full_url = f"{BASE_URL}{url}"
    try:
        resp = requests.get(full_url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://emweb.securities.eastmoney.com/",
        })
        print(f"\nURL: {full_url}")
        print(f"  HTTP {resp.status_code} | {resp.headers.get('Content-Type', 'N/A')[:60]}")
        if resp.status_code == 200:
            ct = resp.headers.get('Content-Type', '')
            if 'json' in ct:
                try:
                    data = resp.json()
                    print(f"  JSON keys: {list(data.keys())[:15]}")
                    for key in data:
                        val = data[key]
                        if isinstance(val, list) and len(val) > 0:
                            print(f"  [{key}] 记录数: {len(val)}")
                            print(f"    首条: {json.dumps(val[0], ensure_ascii=False)[:300]}")
                        elif isinstance(val, dict):
                            print(f"  [{key}] 字段: {list(val.keys())[:10]}")
                except:
                    print(f"  Body: {resp.text[:300]}")
            else:
                print(f"  Body: {resp.text[:200]}")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

print("\n\n=== 完成 ===")