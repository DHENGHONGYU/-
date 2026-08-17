"""Find correct report names and alternative share structure sources"""
import requests
import json

BASE_URL = "http://localhost:5173"

# === 1. 尝试通过东财 F10 获取股本结构 ===
print("=== 东财 F10 股本结构尝试 ===")
# Eastmoney F10 has CapitalStructure page
f10_urls = [
    # 直接访问东财 F10 股本结构页面
    "https://emweb.securities.eastmoney.com/PC_HSF10/CapitalStructure/PageAjax?code=SH600519",
    # 通过代理
    "/api/proxy/em-f10/PC_HSF10/CapitalStructure/PageAjax?code=SH600519",
    # 尝试 F10 公司概况
    "/api/proxy/em-f10/PC_HSF10/CompanySurvey/PageAjax?code=SH600519",
    # 尝试 F10 财务分析
    "/api/proxy/em-f10/PC_HSF10/FinanceAnalysis/PageAjax?code=SH600519",
]

for url in f10_urls:
    full_url = url if url.startswith("http") else f"{BASE_URL}{url}"
    print(f"\nURL: {full_url}")
    try:
        resp = requests.get(full_url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Referer": "https://emweb.securities.eastmoney.com/",
        })
        print(f"  HTTP {resp.status_code} | {resp.headers.get('Content-Type', 'N/A')[:60]}")
        text = resp.text[:500]
        if resp.status_code == 200:
            try:
                data = resp.json()
                print(f"  JSON keys: {list(data.keys())[:15]}")
                # 检查是否有股本数据
                for key in data:
                    val = data[key]
                    if isinstance(val, list) and len(val) > 0:
                        print(f"  [{key}] 记录数: {len(val)}, 首条: {json.dumps(val[0], ensure_ascii=False)[:200]}")
                    elif isinstance(val, dict):
                        print(f"  [{key}]: {json.dumps(val, ensure_ascii=False)[:200]}")
            except:
                print(f"  Body: {text}")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")


# === 2. 尝试腾讯行情 API 获取股本 ===
print("\n\n=== 腾讯行情 API 股本测试 ===")
try:
    # Tencent stock API returns total shares in the quote
    resp = requests.get(
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,1,qfq",
        timeout=15,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    print(f"HTTP {resp.status_code}")
    print(f"Body: {resp.text[:500]}")
except Exception as e:
    print(f"❌ {type(e).__name__}: {e}")

# 腾讯实时行情（包含总股本/流通股本）
print("\n--- 腾讯实时行情 ---")
try:
    resp = requests.get(
        "https://qt.gtimg.cn/q=sh600519",
        timeout=15,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    print(f"HTTP {resp.status_code}")
    text = resp.text
    # 腾讯行情返回格式: v_sh600519="1~贵州茅台~600519~..."
    print(f"Body: {text[:800]}")
    # 解析字段
    if '~' in text:
        parts = text.split('~')
        print(f"\n字段数: {len(parts)}")
        for i, p in enumerate(parts[:50]):
            print(f"  [{i}] {p}")
except Exception as e:
    print(f"❌ {type(e).__name__}: {e}")


# === 3. 尝试找到正确的一致预期/评级 reportName ===
print("\n\n=== 东财 datacenter 报表名探测 ===")
# 从东财个股页面探测可能的 reportName
report_names_to_try = [
    # 盈利预测相关
    "RPT_DMSK_FN_INVESTSUMM_STAT",
    "RPT_DMSK_FN_INVESTSUMM",
    "RPT_DMSK_FN_INVESTSUMMSTAT",
    "RPT_DMSK_FN_PROFITSTAT",
    "RPT_DMSK_FN_PROFIT",
    "RPT_DMSK_FN_MAINPROFIT",
    "RPT_F10_FINANCE_MAINFINADATA",
    # 评级相关
    "RPT_DMSK_FN_MAINRATING",
    "RPT_DMSK_FN_RATINGSTAT",
    "RPT_DMSK_FN_RATING",
    "RPT_DMSK_FN_RATINGSUMM",
    # 通用
    "RPT_DMSK_FN_STOCKPERFORMANCE",
    "RPT_DMSK_FN_BASICINFO",
    "RPT_DMSK_FN_MAINBUSINESS",
]

for rpt in report_names_to_try:
    url = f"/api/proxy/em-datacenter/securities/api/data/v1/get?reportName={rpt}&columns=SECURITY_CODE&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB"
    try:
        resp = requests.get(f"{BASE_URL}{url}", timeout=15, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://data.eastmoney.com/",
        })
        if resp.status_code == 200:
            text = resp.text
            if "报表配置不存在" in text:
                print(f"  ❌ {rpt}: 不存在")
            elif '"success":true' in text or '"data"' in text:
                try:
                    data = resp.json()
                    result = data.get("result", {})
                    items = result.get("data", []) if result else []
                    if items:
                        print(f"  ✅ {rpt}: 成功! {len(items)} 条")
                        print(f"     可用字段: {list(items[0].keys()) if items else 'N/A'}")
                    else:
                        print(f"  ⚠️ {rpt}: result.data 为空, full={text[:300]}")
                except:
                    print(f"  ⚠️ {rpt}: JSON parse error, text={text[:200]}")
            elif "返回字段不存在" in text:
                print(f"  ⚠️ {rpt}: 报表存在但字段不对")
            else:
                print(f"  ? {rpt}: {text[:200]}")
        else:
            print(f"  ❌ {rpt}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  ❌ {rpt}: {type(e).__name__}: {e}")

# 也尝试 em-dc 域名
print("\n--- em-dc 域名探测 ---")
for rpt in ["RPT_DMSK_FN_INVESTSUMM_STAT", "RPT_DMSK_FN_MAINRATING", "RPT_DMSK_FN_PROFITSTAT", "RPT_DMSK_FN_RATINGSTAT"]:
    url = f"/api/proxy/em-dc/securities/api/data/v1/get?reportName={rpt}&columns=SECURITY_CODE&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB"
    try:
        resp = requests.get(f"{BASE_URL}{url}", timeout=15, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://data.eastmoney.com/",
        })
        if resp.status_code == 200:
            text = resp.text
            if "报表配置不存在" in text:
                print(f"  ❌ {rpt}: 不存在")
            elif '"success":true' in text:
                print(f"  ✅ {rpt}: 成功! {text[:300]}")
            else:
                print(f"  ? {rpt}: {text[:200]}")
    except Exception as e:
        print(f"  ❌ {rpt}: {type(e).__name__}: {e}")

print("\n\n=== 完成 ===")