"""
全链路验证脚本：Vite → Embedding Service → Embedding Daemon
同时生成性能瓶颈分析报告
"""
import time
import json
import requests

VITE = "http://localhost:5199"
SERVICE = "http://127.0.0.1:8001"
DAEMON = "http://127.0.0.1:8765"

print("=" * 60)
print("  FULL CHAIN VERIFICATION: Vite -> Service -> Daemon")
print("=" * 60)

# ── 1. Direct daemon test ──
print("\n📡 Step 1: Direct Daemon (8765)")
t0 = time.perf_counter()
r = requests.get(f"{DAEMON}/health", timeout=5)
dt = (time.perf_counter() - t0) * 1000
print(f"  Health: {r.status_code} ({dt:.1f}ms)")
t0 = time.perf_counter()
r = requests.post(f"{DAEMON}/embed", json={"text": "test text"}, timeout=5)
dt = (time.perf_counter() - t0) * 1000
data = r.json()
print(f"  Embed:  {r.status_code} ({dt:.1f}ms) dim={data['dimension']}")

# ── 2. Service -> Daemon ──
print("\n📡 Step 2: Embedding Service (8001) -> Daemon (8765)")
t0 = time.perf_counter()
r = requests.get(f"{SERVICE}/api/embed/health", timeout=5)
dt = (time.perf_counter() - t0) * 1000
data = r.json()
print(f"  Health: {r.status_code} ({dt:.1f}ms) status={data['status']} model={data['model_loaded']}")

test_texts = [
    "Hello world",
    "自然语言处理中的嵌入向量生成",
    "In machine learning, embedding is the conversion of data into vectors",
    "Short",
    "A" * 500,
]
for i, text in enumerate(test_texts):
    t0 = time.perf_counter()
    r = requests.post(f"{SERVICE}/api/embed", json={"text": text}, timeout=10)
    dt = (time.perf_counter() - t0) * 1000
    d = r.json() if r.ok else {}
    flag = "!!SLOW" if dt >= 100 else "  OK"
    dim = d.get("dimension", "?")
    print(f"  [{i+1}] len={len(text):4d} -> {r.status_code} ({dt:6.1f}ms) {flag} dim={dim}")

# ── 3. Batch embed ──
print("\n📡 Step 3: Batch Embed")
batch = ["Stock price analysis", "Market trend prediction", "Financial risk assessment"]
t0 = time.perf_counter()
r = requests.post(f"{SERVICE}/api/embed/batch", json=batch, timeout=10)
dt = (time.perf_counter() - t0) * 1000
d = r.json()
flag = "!!SLOW" if dt >= 100 else "  OK"
print(f"  Batch({len(batch)} texts): {r.status_code} ({dt:.1f}ms) {flag} vectors={len(d.get('vectors',[]))} dim={d.get('dimension','?')}")

# ── 4. Through Vite Proxy ──
print("\n📡 Step 4: Through Vite Proxy (5199 -> 8001 -> 8765)")
t0 = time.perf_counter()
r = requests.get(f"{VITE}/api/embed/health", timeout=10)
dt = (time.perf_counter() - t0) * 1000
flag = "!!SLOW" if dt >= 100 else "  OK"
print(f"  Proxy Health: {r.status_code} ({dt:.1f}ms) {flag}")

t0 = time.perf_counter()
r = requests.post(f"{VITE}/api/embed", json={"text": "Vite proxy test through frontend"}, timeout=10)
dt = (time.perf_counter() - t0) * 1000
flag = "!!SLOW" if dt >= 100 else "  OK"
if r.ok:
    d = r.json()
    print(f"  Proxy Embed:  {r.status_code} ({dt:.1f}ms) {flag} dim={d['dimension']}")
else:
    print(f"  Proxy Embed:  {r.status_code} ({dt:.1f}ms) {flag} ERROR: {r.text[:100]}")

# ── 5. Performance stats ──
print("\n📊 Step 5: Performance Analysis")
r = requests.get(f"{SERVICE}/__debug/perf", timeout=5)
stats = r.json()
summary = stats["summary"]
print(f"  Total requests:  {summary['total_requests']}")
print(f"  Slow requests:   {summary['slow_requests']} (threshold: {summary['slow_threshold_ms']}ms)")
print(f"  Errors:          {summary['errors']}")
print(f"  Avg time:        {summary['avg_ms']}ms")
print(f"  Max time:        {summary['max_ms']}ms")
print(f"  Bottleneck:      {summary['bottleneck_endpoint']}")
print(f"  Endpoint breakdown:")
for ep, data in summary["endpoints"].items():
    bar = "#" * min(int(data["avg_ms"] / 10), 40)
    flag = "!!" if data["max_ms"] >= 100 else "  "
    print(f"    {flag} {ep:35s} avg={data['avg_ms']:8.1f}ms  max={data['max_ms']:8.1f}ms  p95={data['p95_ms']:8.1f}ms  n={data['count']:3d}  |{bar}|")

# ── 6. Slow request filter ──
print("\n🔍 Step 6: Slow Requests (>100ms)")
r = requests.get(f"{SERVICE}/__debug/slow", timeout=5)
slow_data = r.json()
print(f"  Total slow: {slow_data['count']} requests")
if slow_data["requests"]:
    for i, sr in enumerate(slow_data["requests"][:10]):
        flag = "🚨" if sr["elapsed_ms"] > 500 else "⚠️"
        print(f"    {flag} [{i+1}] {sr['endpoint']:30s} {sr['elapsed_ms']:8.1f}ms  status={sr['status']}")
    if slow_data["count"] > 10:
        print(f"    ... and {slow_data['count'] - 10} more")
else:
    print("    No slow requests 🎉")

# ── 7. Bottleneck analysis ──
print("\n🔎 Step 7: Bottleneck Analysis")
print(stats.get("bottleneck_analysis", "No analysis available"))

print("\n" + "=" * 60)
print("  ✅ FULL CHAIN VERIFICATION COMPLETE")
print("=" * 60)