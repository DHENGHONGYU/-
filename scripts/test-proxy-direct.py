"""
直接测试代理端点（Python requests 方式，避免 Playwright 超时问题）
"""
import requests
import json

BASE = 'http://127.0.0.1:5173'

def test_endpoint(name, url):
    """测试单个端点"""
    try:
        resp = requests.get(url, timeout=10, headers={
            'Referer': 'https://data.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        })
        print(f"  [{resp.status_code}] {name}")
        if resp.status_code == 200:
            text = resp.text[:300]
            print(f"    {text[:200]}")
            try:
                data = resp.json()
                return True, data
            except:
                return False, text
        else:
            print(f"    {resp.text[:100]}")
            return False, None
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return False, None

print("=" * 70)
print("1. 分红配股 API (BonusFinancing)")
print("=" * 70)
ok, data = test_endpoint("BonusFinancing", f"{BASE}/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519")
if ok and data:
    fhyx = data.get('fhyx', data.get('data', []))
    print(f"  记录数: {len(fhyx)}")
    if fhyx:
        r = fhyx[0]
        print(f"  首条: {json.dumps(r, ensure_ascii=False)[:300]}")

print("\n" + "=" * 70)
print("2. 股本结构 API (push2)")
print("=" * 70)
ok, data = test_endpoint("push2", f"{BASE}/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39")
if ok and data:
    d = data.get('data', {})
    print(f"  总股本={d.get('f38')}万股 | 流通股本={d.get('f39')}万股")

print("\n" + "=" * 70)
print("3. 一致预期 API (datacenter-web)")
print("=" * 70)
report_names = [
    'RPT_DMSK_FN_INVESTSUMM_STAT',
    'RPT_DMSK_FN_INVESTSUMM',
    'RPT_DMSK_FN_PROFITFORECAST',
    'RPT_DMSK_FN_EARNINGSFORECAST',
    'RPT_DMSK_FN_FORECAST',
    'RPT_DMSK_FN_CONSENSUS',
    'RPT_DMSK_FN_YLYC',
]
for rn in report_names:
    params = {
        'reportName': rn,
        'columns': 'SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT',
        'filter': '(SECURITY_CODE="600519")',
        'pageNumber': '1',
        'pageSize': '3',
        'sortTypes': '-1',
        'sortColumns': 'FORECAST_YEAR',
        'source': 'WEB',
        'client': 'WEB',
    }
    url = f"{BASE}/api/proxy/em-datacenter/api/data/v1/get"
    try:
        resp = requests.get(url, params=params, timeout=10, headers={
            'Referer': 'https://data.eastmoney.com/',
        })
        try:
            data = resp.json()
            if data.get('success') and data.get('result', {}).get('data'):
                items = data['result']['data']
                print(f"  ✓ {rn}: {len(items)} 条")
                for item in items[:2]:
                    print(f"    {item.get('FORECAST_YEAR')}: 营收={item.get('REVENUE_AVG')} 净利润={item.get('NET_PROFIT_AVG')} EPS={item.get('EPS_AVG')}")
            else:
                msg = data.get('message', '')
                if '报表配置不存在' not in msg:
                    print(f"  ? {rn}: {msg[:80]}")
        except:
            print(f"  ✗ {rn}: 非JSON响应")
    except Exception as e:
        print(f"  ✗ {rn}: {e}")

print("\n" + "=" * 70)
print("4. 评级汇总 API (datacenter-web)")
print("=" * 70)
rating_names = [
    'RPT_DMSK_FN_MAINRATING',
    'RPT_DMSK_FN_RATING',
    'RPT_DMSK_FN_STOCKRATING',
]
for rn in rating_names:
    params = {
        'reportName': rn,
        'columns': 'SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE',
        'filter': '(SECURITY_CODE="600519")',
        'pageNumber': '1',
        'pageSize': '1',
        'source': 'WEB',
        'client': 'WEB',
    }
    url = f"{BASE}/api/proxy/em-datacenter/api/data/v1/get"
    try:
        resp = requests.get(url, params=params, timeout=10, headers={
            'Referer': 'https://data.eastmoney.com/',
        })
        try:
            data = resp.json()
            if data.get('success') and data.get('result', {}).get('data'):
                items = data['result']['data']
                print(f"  ✓ {rn}: {len(items)} 条")
                item = items[0]
                print(f"    买入={item.get('RATING_BUY')} 增持={item.get('RATING_OVERWEIGHT')} 持有={item.get('RATING_HOLD')} 目标价={item.get('CONSENSUS_TARGET_PRICE')}")
            else:
                msg = data.get('message', '')
                if '报表配置不存在' not in msg:
                    print(f"  ? {rn}: {msg[:80]}")
        except:
            print(f"  ✗ {rn}: 非JSON响应")
    except Exception as e:
        print(f"  ✗ {rn}: {e}")

print("\n" + "=" * 70)
print("5. 尝试 datacenter.eastmoney.com (em-dc 代理)")
print("=" * 70)
for rn in report_names[:5]:
    params = {
        'reportName': rn,
        'columns': 'SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT',
        'filter': '(SECURITY_CODE="600519")',
        'pageNumber': '1',
        'pageSize': '3',
        'sortTypes': '-1',
        'sortColumns': 'FORECAST_YEAR',
        'source': 'WEB',
        'client': 'WEB',
    }
    url = f"{BASE}/api/proxy/em-dc/securities/api/data/v1/get"
    try:
        resp = requests.get(url, params=params, timeout=10, headers={
            'Referer': 'https://data.eastmoney.com/',
        })
        try:
            data = resp.json()
            if data.get('success') and data.get('result', {}).get('data'):
                items = data['result']['data']
                print(f"  ✓ {rn}: {len(items)} 条")
            else:
                msg = data.get('message', '')
                if '报表配置不存在' not in msg:
                    print(f"  ? {rn}: {msg[:80]}")
        except:
            print(f"  ✗ {rn}: 非JSON响应")
    except Exception as e:
        print(f"  ✗ {rn}: {e}")