"""直接 HTTP 测试代理端点 + 浏览器内模块调用验证"""
import requests
import json
import sys

BASE_URL = "http://localhost:5173"
TEST_SYMBOL = "600519.SH"  # 贵州茅台

def test_proxy_endpoint(name, url, validator=None):
    """测试单个代理端点"""
    full_url = f"{BASE_URL}{url}"
    print(f"\n  [{name}]")
    print(f"  URL: {full_url}")
    
    try:
        resp = requests.get(full_url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
            "Accept": "application/json, text/html",
            "Referer": "https://data.eastmoney.com/",
        })
        print(f"  HTTP {resp.status_code} | Content-Type: {resp.headers.get('Content-Type', 'N/A')[:60]}")
        
        if resp.status_code != 200:
            print(f"  ❌ 非 200 响应")
            print(f"  body: {resp.text[:300]}")
            return False
        
        text = resp.text
        # 尝试 JSON 解析
        try:
            data = resp.json()
            if validator:
                ok = validator(data)
                if ok:
                    print(f"  ✅ 数据验证通过")
                    return True
                else:
                    print(f"  ⚠️ 数据格式正确但内容验证失败")
                    return False
            else:
                print(f"  ✅ JSON 解析成功")
                return True
        except json.JSONDecodeError:
            if "报表配置不存在" in text:
                print(f"  ⚠️ 报表配置不存在（reportName 需更新）")
            elif text.strip().startswith("<!DOCTYPE") or text.strip().startswith("<html"):
                print(f"  ⚠️ 返回 HTML 而非 JSON（端点可能需调整）")
            else:
                print(f"  ⚠️ 非 JSON 响应: {text[:200]}")
            return False
    except requests.exceptions.Timeout:
        print(f"  ❌ 超时（30s）")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"  ❌ 连接失败: {e}")
        return False
    except Exception as e:
        print(f"  ❌ 异常: {type(e).__name__}: {e}")
        return False


def validate_bonus(data):
    """验证分红数据"""
    records = data.get("fhyx", [])
    print(f"     fhyx 记录数: {len(records)}")
    if records:
        first = records[0]
        plan = first.get("IMPL_PLAN_PROFILE", "N/A")
        ex_date = first.get("EX_DIVIDEND_DATE", "N/A")
        print(f"     首条: {plan} | 除权日: {ex_date}")
        return len(records) > 0
    return False


def validate_push2(data):
    """验证股本结构数据"""
    inner = data.get("data", {})
    f38 = inner.get("f38", 0)  # 总股本（万股）
    f39 = inner.get("f39", 0)  # 流通股本（万股）
    print(f"     总股本: {f38} 万股 ({f38/10000:.2f} 亿股)")
    print(f"     流通股本: {f39} 万股 ({f39/10000:.2f} 亿股)")
    return f38 > 0 or f39 > 0


def validate_consensus(data):
    """验证一致预期数据"""
    result = data.get("result", {})
    items = result.get("data", [])
    print(f"     result.data 记录数: {len(items)}")
    if items:
        first = items[0]
        print(f"     首条: 财年{first.get('FORECAST_YEAR', 'N/A')} | 营收{first.get('REVENUE_AVG', 'N/A')} | 净利{first.get('NET_PROFIT_AVG', 'N/A')} | EPS{first.get('EPS_AVG', 'N/A')} | 分析师{first.get('ANALYST_COUNT', 'N/A')}人")
        return len(items) > 0
    return False


def validate_rating(data):
    """验证评级数据"""
    result = data.get("result", {})
    items = result.get("data", [])
    print(f"     result.data 记录数: {len(items)}")
    if items:
        first = items[0]
        print(f"     买入:{first.get('RATING_BUY', 0)} 增持:{first.get('RATING_OVERWEIGHT', 0)} 持有:{first.get('RATING_HOLD', 0)} 减持:{first.get('RATING_UNDERWEIGHT', 0)} 卖出:{first.get('RATING_SELL', 0)}")
        print(f"     综合评级:{first.get('CONSENSUS_RATING', 'N/A')} 目标价:{first.get('CONSENSUS_TARGET_PRICE', 'N/A')}")
        return True
    return False


def test_alternative_consensus_endpoints():
    """测试替代的一致预期端点"""
    print("\n  尝试替代端点...")
    
    # 备选 1: 使用 datacenter-web 域名
    alt_urls = [
        ("datacenter-web (一致预期)", 
         "/api/proxy/em-datacenter/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INVESTSUMM_STAT&columns=SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&sortTypes=-1&sortColumns=FORECAST_YEAR&source=WEB&client=WEB"),
        ("datacenter-web (评级)",
         "/api/proxy/em-datacenter/securities/api/data/v1/get?reportName=RPT_DMSK_FN_MAINRATING&columns=SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB"),
    ]
    
    for name, url in alt_urls:
        full_url = f"{BASE_URL}{url}"
        try:
            resp = requests.get(full_url, timeout=30, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://data.eastmoney.com/",
            })
            print(f"    [{name}] HTTP {resp.status_code}")
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if "result" in data and data["result"] and data["result"].get("data"):
                        items = data["result"]["data"]
                        print(f"      ✅ 成功! 记录数: {len(items)}")
                        if items:
                            print(f"      首条: {json.dumps(items[0], ensure_ascii=False)[:300]}")
                            return True
                    else:
                        print(f"      ⚠️ 无数据: {json.dumps(data, ensure_ascii=False)[:200]}")
                except json.JSONDecodeError:
                    print(f"      ⚠️ 非 JSON: {resp.text[:200]}")
        except Exception as e:
            print(f"    [{name}] ❌ {e}")
    
    return False


def main():
    print("=" * 60)
    print("维度 15/16 代理端点直接 HTTP 测试")
    print(f"测试标的: {TEST_SYMBOL} (贵州茅台)")
    print("=" * 60)
    
    # 1. 测试 Vite 服务可用性
    print("\n[Vite 服务检查]")
    try:
        resp = requests.get(f"{BASE_URL}/@vite/client", timeout=10)
        print(f"  ✅ Vite 可用 (HTTP {resp.status_code})")
    except Exception as e:
        print(f"  ❌ Vite 不可用: {e}")
        print("  请确保 Vite 开发服务器正在运行")
        return 1
    
    # 2. 测试四个代理端点
    print("\n" + "=" * 60)
    print("代理端点测试")
    print("=" * 60)
    
    results = {}
    
    # 测试 1: 分红配股
    results["bonus"] = test_proxy_endpoint(
        "分红配股 (F10 BonusFinancing)",
        "/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519",
        validate_bonus
    )
    
    # 测试 2: 股本结构
    results["push2"] = test_proxy_endpoint(
        "股本结构 (push2)",
        "/api/proxy/em-push2/api/qt/stock/get?secid=1.600519&fields=f38,f39",
        validate_push2
    )
    
    # 测试 3: 一致预期
    results["consensus"] = test_proxy_endpoint(
        "一致预期 (datacenter)",
        "/api/proxy/em-dc/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INVESTSUMM_STAT&columns=SECURITY_CODE,FORECAST_YEAR,REVENUE_AVG,NET_PROFIT_AVG,EPS_AVG,ANALYST_COUNT&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=3&sortTypes=-1&sortColumns=FORECAST_YEAR&source=WEB&client=WEB",
        validate_consensus
    )
    
    # 测试 4: 评级汇总
    results["rating"] = test_proxy_endpoint(
        "评级汇总 (datacenter)",
        "/api/proxy/em-dc/securities/api/data/v1/get?reportName=RPT_DMSK_FN_MAINRATING&columns=SECURITY_CODE,RATING_BUY,RATING_OVERWEIGHT,RATING_HOLD,RATING_UNDERWEIGHT,RATING_SELL,CONSENSUS_RATING,CONSENSUS_TARGET_PRICE&filter=(SECURITY_CODE=\"600519\")&pageNumber=1&pageSize=1&source=WEB&client=WEB",
        validate_rating
    )
    
    # 如果一致预期或评级失败，尝试替代端点
    if not results.get("consensus") or not results.get("rating"):
        test_alternative_consensus_endpoints()
    
    # 汇总
    print("\n" + "=" * 60)
    print("验证汇总")
    print("=" * 60)
    ok_count = sum(1 for v in results.values() if v)
    for name, ok in results.items():
        status = "✅" if ok else "❌"
        label = {"bonus": "分红配股", "push2": "股本结构", "consensus": "一致预期", "rating": "评级汇总"}[name]
        print(f"  {status} {label}")
    print(f"\n通过: {ok_count}/{len(results)}")
    
    # 返回：全通过=0，部分通过=1，全失败=2
    if ok_count == len(results):
        return 0
    elif ok_count > 0:
        return 1
    else:
        return 2


if __name__ == "__main__":
    sys.exit(main())