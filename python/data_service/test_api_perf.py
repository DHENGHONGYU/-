import requests, json, time

BASE = "http://127.0.0.1:8000"

print("=" * 60)
print("V9 板块评分 API + 缓存测试 (v0.2 优化版)")
print("=" * 60)

# 1. 测试预计算（首次，缓存未命中）
print("\n[1] 首次预计算 (topN=5, 缓存未命中)")
t0 = time.time()
r = requests.post(f"{BASE}/api/cache/precompute?topN=5", timeout=120)
d = r.json()
elapsed = time.time() - t0
print(f"  HTTP: {r.status_code} | 总耗时: {elapsed:.1f}s | 内部: {d.get('elapsed_ms', 'N/A')}ms")
print(f"  成功: {d.get('success')} | 数量: {d.get('count')}")
if d.get("top3"):
    for t in d["top3"]:
        print(f"    {t['code']} {t['name']} total={t['total']}")

# 2. 测试第二次调用（应命中缓存）
if d.get('count', 0) > 0:
    print("\n[2] 第二次预计算 (topN=5, 应命中缓存)")
    t0 = time.time()
    r2 = requests.post(f"{BASE}/api/cache/precompute?topN=5", timeout=30)
    d2 = r2.json()
    elapsed2 = time.time() - t0
    print(f"  HTTP: {r2.status_code} | 总耗时: {elapsed2:.1f}s | 内部: {d2.get('elapsed_ms', 'N/A')}ms")
    print(f"  成功: {d2.get('success')} | 数量: {d2.get('count')}")
    if elapsed > 0 and elapsed2 > 0:
        improvement = (elapsed - elapsed2) / elapsed * 100
        print(f"  缓存提升: {improvement:.1f}%")
else:
    print("\n[2] 跳过（首次返回空结果）")

# 3. 缓存状态
print("\n[3] 缓存健康状态")
r3 = requests.get(f"{BASE}/api/cache/stats", timeout=5)
stats = r3.json()
print(f"  Redis: {'已连接' if stats['redis']['redis_connected'] else '未连接（降级内存缓存）'}")
print(f"  内存: {stats['memory']['raw']}")

# 4. 调度器状态
print("\n[4] 调度器状态")
r4 = requests.get(f"{BASE}/api/scheduler/status", timeout=5)
print(f"  {json.dumps(r4.json(), indent=2, ensure_ascii=False)}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)