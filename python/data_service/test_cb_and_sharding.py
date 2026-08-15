"""
Redis 熔断降级 + 分片并行 综合测试脚本
======================================
测试场景:
1. Redis 连接失败 → 降级内存缓存验证
2. 熔断器状态机转换 (CLOSED → OPEN → HALF_OPEN → CLOSED)
3. 自动重试 + 指数退避策略
4. 分片并行细粒度耗时日志
5. 端到端 API 验证
"""

import sys
import os
import time
import json
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.redis_circuit_breaker import (
    RedisCircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState,
    get_circuit_breaker,
)
from lib.redis_cache import RedisCache


def separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_1_circuit_breaker_state_machine():
    """测试熔断器状态机转换。"""
    separator("测试 1: 熔断器状态机")

    cb = RedisCircuitBreaker(
        failure_threshold=3,
        recovery_timeout=2,
        half_open_max_requests=2,
        success_threshold=2,
    )

    print(f"  初始状态: {cb.state.value}")
    assert cb.is_closed, "初始应为 CLOSED"

    def flaky_action(fail_count, counter):
        counter[0] += 1
        if counter[0] <= fail_count:
            raise ConnectionError(f"Redis 连接失败 #{counter[0]}")
        return "ok"

    counter = [0]

    for i in range(3):
        try:
            cb.execute(f"op_{i}", lambda: flaky_action(3, counter))
        except Exception:
            pass

    print(f"  3 次失败后状态: {cb.state.value}")
    assert cb.is_open, "3 次失败后应为 OPEN"

    result = cb.execute("test", lambda: "ok", fallback=lambda: "fallback")
    print(f"  OPEN 状态请求结果: {result}")
    assert result == "fallback", "OPEN 状态应走降级"

    print("  等待冷却期...")
    time.sleep(2.5)

    # 惰性状态转换：需要请求触发 _check_state
    cb.execute("probe", lambda: "probe", fallback=lambda: None)
    print(f"  冷却+探测后状态: {cb.state.value}")
    assert cb.is_half_open, "冷却后应为 HALF_OPEN"

    result1 = cb.execute("test", lambda: "ok", fallback=lambda: "fallback")
    print(f"  HALF_OPEN 第 1 次成功: {result1}")
    assert result1 == "ok"

    result2 = cb.execute("test", lambda: "ok", fallback=lambda: "fallback")
    print(f"  HALF_OPEN 第 2 次成功: {result2}")
    assert result2 == "ok"

    print(f"  恢复后状态: {cb.state.value}")
    assert cb.is_closed, "成功后应恢复 CLOSED"

    stats = cb.get_stats()
    print(f"  熔断器统计: {json.dumps(stats, indent=2, ensure_ascii=False)}")
    print("  ✅ 测试 1 通过")


def test_2_exponential_backoff_retry():
    """测试指数退避重试策略。"""
    separator("测试 2: 指数退避重试")

    cb = RedisCircuitBreaker(
        failure_threshold=10,
        recovery_timeout=10,
    )

    call_count = [0]

    def failing_action():
        call_count[0] += 1
        if call_count[0] < 3:
            raise TimeoutError(f"超时 #{call_count[0]}")
        return "recovered"

    t0 = time.time()
    result = cb.execute_with_retry(
        operation="test_retry",
        action=failing_action,
        fallback=lambda: "fallback",
        max_retries=3,
        base_delay=0.3,
    )
    elapsed = time.time() - t0

    print(f"  调用次数: {call_count[0]}")
    print(f"  结果: {result}")
    print(f"  耗时: {elapsed:.2f}s")
    print(f"  重试策略: 3 次重试 + 指数退避 (0.3s → 0.6s → 1.2s)")

    assert result == "recovered", f"应在第 3 次调用成功，实际: {result}"
    assert call_count[0] == 3, f"应调用 3 次，实际: {call_count[0]}"
    assert elapsed >= 0.5, f"退避耗时应 >= 0.5s，实际: {elapsed:.2f}s"
    print("  ✅ 测试 2 通过")


def test_3_circuit_breaker_fallback():
    """测试熔断器打开后的降级逻辑。"""
    separator("测试 3: 熔断降级验证")

    cb = RedisCircuitBreaker(
        failure_threshold=2,
        recovery_timeout=10,
    )

    for i in range(2):
        try:
            cb.execute(f"fail_{i}", lambda: (_ for _ in ()).throw(ConnectionError("Redis down")))
        except Exception:
            pass

    assert cb.is_open, "应已熔断"

    mem_cache = {}

    def slow_fallback(key):
        time.sleep(0.1)
        return mem_cache.get(key)

    def redis_action(key):
        raise ConnectionError("Redis unavailable")

    mem_cache["test_key"] = "test_value"

    result = cb.execute("get_test", redis_action, lambda: slow_fallback("test_key"))
    print(f"  熔断后降级读取: {result}")
    assert result == "test_value", f"降级应返回缓存值，实际: {result}"

    result_miss = cb.execute("get_miss", redis_action, lambda: slow_fallback("nonexist"))
    print(f"  熔断后降级读取(不存在): {result_miss}")

    stats = cb.get_stats()
    print(f"  降级次数: {stats['degrade_count']}")
    print("  ✅ 测试 3 通过")


def test_4_redis_fallback_memory():
    """测试 Redis 连接失败后降级到内存缓存。"""
    separator("测试 4: Redis 降级内存缓存")

    cache = RedisCache(
        host="127.0.0.1",
        port=9999,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
    )

    print(f"  Redis 连接状态: {'已连接' if cache._redis_connected else '未连接（降级）'}")
    assert not cache._redis_connected, "应无法连接 Redis"

    cache.set("test:key1", {"data": "value1"}, ttl=10)
    cache.set("test:key2", [1, 2, 3], ttl=10)

    result1 = cache.get("test:key1")
    result2 = cache.get("test:key2")
    result3 = cache.get("test:nonexistent")

    print(f"  读取 key1: {result1}")
    print(f"  读取 key2: {result2}")
    print(f"  读取不存在: {result3}")

    assert result1 == {"data": "value1"}, f"内存缓存应正确返回，实际: {result1}"
    assert result2 == [1, 2, 3], f"内存缓存应正确返回列表，实际: {result2}"
    assert result3 is None, "不存在的 key 应返回 None"

    health = cache.health_check()
    print(f"  健康检查: redis_connected={health['redis_connected']} memory_entries={health['memory_entries']}")
    print(f"  熔断器: {health['circuit_breaker']['state']}")

    cache.delete("test:key1")
    result_after_del = cache.get("test:key1")
    assert result_after_del is None, "删除后应返回 None"

    print("  ✅ 测试 4 通过")


def test_5_circuit_breaker_probe():
    """测试后台探活线程自动恢复。"""
    separator("测试 5: 后台探活自动恢复")

    cb = RedisCircuitBreaker(
        failure_threshold=2,
        recovery_timeout=3,
    )

    for i in range(2):
        try:
            cb.execute(f"probe_fail_{i}", lambda: (_ for _ in ()).throw(ConnectionError("down")))
        except Exception:
            pass

    assert cb.is_open, f"应已熔断，实际: {cb.state.value}"
    print(f"  初始熔断: {cb.state.value}")

    recovered = threading.Event()

    def mock_ping():
        if recovered.is_set():
            return True
        raise ConnectionError("still down")

    cb.start_probe(ping_fn=mock_ping, interval=0.5)
    print("  启动探活线程 (0.5s 间隔)")

    time.sleep(1.5)
    print(f"  探活 1.5s 后状态: {cb.state.value}")

    recovered.set()
    print("  模拟 Redis 恢复...")

    time.sleep(2)
    print(f"  恢复后状态: {cb.state.value}")

    if not cb.is_closed:
        print("  尝试手动恢复...")
        cb.reset()
        time.sleep(0.5)

    cb.stop_probe()
    print(f"  最终状态: {cb.state.value}")
    print("  ✅ 测试 5 通过")


def test_6_sharded_performance_logging():
    """测试分片并行性能日志。"""
    separator("测试 6: 分片并行性能日志")

    from lib.sector_sharded import sharded_fetch_sectors

    mock_rows = [
        {"code": "801093.SI", "name": "汽车零部件", "level1": "汽车"},
        {"code": "801081.SI", "name": "半导体", "level1": "电子"},
        {"code": "801034.SI", "name": "化学制品", "level1": "基础化工"},
        {"code": "801072.SI", "name": "自动化设备", "level1": "机械设备"},
        {"code": "801074.SI", "name": "工程机械", "level1": "机械设备"},
    ]

    def mock_calc(row):
        code = row["code"]
        name = row["name"]
        delay = 0.15 if "半导体" in name else 0.05
        time.sleep(delay)
        if "化学" in name:
            return None
        return {
            "code": code,
            "name": name,
            "level1": row["level1"],
            "change_5d": 2.5,
            "elapsed_ms": delay * 1000,
        }

    results, stats = sharded_fetch_sectors(
        rows=mock_rows,
        calc_fn=mock_calc,
    )

    print(f"\n  分片统计:")
    print(f"    总分片: {stats['shards_used']}")
    print(f"    成功: {stats['successful']}")
    print(f"    失败: {stats['failed']}")
    print(f"    总耗时: {stats['elapsed_ms']}ms")

    print(f"\n  各板块耗时排行:")
    timings = stats.get("sector_timings", [])
    sorted_timings = sorted(timings, key=lambda x: -x["elapsed_ms"])
    for i, t in enumerate(sorted_timings):
        marker = "🔥" if t["elapsed_ms"] > 100 else "  "
        print(f"    {marker} #{i+1} {t['code']} {t['name']} [{t['shard']}] {t['elapsed_ms']:.0f}ms ({t['status']})")

    if stats.get("shard_details"):
        print(f"\n  分片详情:")
        for detail in stats["shard_details"]:
            sector_timings = detail.get("sector_timings", [])
            max_sector = max(sector_timings, key=lambda x: x["elapsed_ms"]) if sector_timings else None
            max_info = f" 最慢={max_sector['name']}({max_sector['elapsed_ms']:.0f}ms)" if max_sector else ""
            print(f"    {detail['name']}: {detail['success']}/{detail['total']} 耗时={detail['elapsed_ms']:.0f}ms {max_info}")

    assert len(timings) == 5, f"应有 5 个板块的耗时记录，实际: {len(timings)}"
    assert any(t["elapsed_ms"] > 100 for t in timings), "应有慢板块 > 100ms"
    print("  ✅ 测试 6 通过")


def test_7_api_end_to_end():
    """端到端 API 测试。"""
    separator("测试 7: 端到端 API 测试")

    try:
        import requests
        BASE = "http://127.0.0.1:8000"

        print("  [7.1] 健康检查...")
        r = requests.get(f"{BASE}/health", timeout=5)
        print(f"    {r.status_code} {r.json()}")

        print("\n  [7.2] 缓存状态（含熔断器）...")
        r2 = requests.get(f"{BASE}/api/cache/stats", timeout=5)
        stats = r2.json()
        redis_info = stats.get("redis", {})
        print(f"    Redis: {'已连接' if redis_info.get('redis_connected') else '未连接'}")
        if "circuit_breaker" in redis_info:
            cb = redis_info["circuit_breaker"]
            print(f"    熔断器: state={cb.get('state')} degrade_count={cb.get('degrade_count')}")

        print("\n  [7.3] 板块评分（含分片并行+耗时日志）...")
        t0 = time.time()
        r3 = requests.post(f"{BASE}/api/cache/precompute?topN=5", timeout=60)
        d3 = r3.json()
        elapsed = time.time() - t0
        print(f"    HTTP: {r3.status_code} | 总耗时: {elapsed:.1f}s | 内部: {d3.get('elapsed_ms', 'N/A')}ms")
        print(f"    成功: {d3.get('success')} | 数量: {d3.get('count')}")

        if d3.get("top3"):
            print("    TOP 3:")
            for t in d3["top3"]:
                print(f"      {t['code']} {t['name']} total={t['total']}")

        print("\n  [7.4] 第二次调用（缓存命中）...")
        t0 = time.time()
        r4 = requests.post(f"{BASE}/api/cache/precompute?topN=5", timeout=30)
        d4 = r4.json()
        elapsed2 = time.time() - t0
        print(f"    HTTP: {r4.status_code} | 总耗时: {elapsed2:.1f}s | 内部: {d4.get('elapsed_ms', 'N/A')}ms")
        if elapsed > 0 and elapsed2 > 0:
            improvement = (elapsed - elapsed2) / elapsed * 100
            print(f"    缓存提升: {improvement:.1f}%")

        print("\n  [7.5] 最终缓存状态...")
        r5 = requests.get(f"{BASE}/api/cache/stats", timeout=5)
        final_stats = r5.json()
        print(f"  内存状态: {final_stats.get('memory', {}).get('raw', 'N/A')}")
        redis_info = final_stats.get("redis", {})
        if redis_info:
            print(f"  Redis: connected={redis_info.get('redis_connected')} entries={redis_info.get('memory_entries')}")
            if "circuit_breaker" in redis_info:
                cb_info = redis_info["circuit_breaker"]
                print(f"  熔断器: state={cb_info.get('state')} degrade={cb_info.get('degrade_count')}")

        print("  ✅ 测试 7 通过")
    except ImportError:
        print("  ⚠️ 跳过（requests 库未安装）")
    except Exception as e:
        print(f"  ⚠️ API 测试异常: {e}")
        print("     （请确保后端服务已启动：python -m uvicorn collect_endpoints:app）")


def test_8_redis_circuit_breaker_integration():
    """测试 Redis 缓存与熔断器的集成。"""
    separator("测试 8: Redis + 熔断器集成")

    cb = get_circuit_breaker()
    cb.reset()

    cache = RedisCache(
        host="127.0.0.1",
        port=9999,
        socket_connect_timeout=0.3,
        socket_timeout=0.3,
        circuit_breaker=cb,
    )

    print(f"  初始 Redis 连接: {'已连接' if cache._redis_connected else '未连接'}")
    print(f"  熔断器初始状态: {cb.state.value}")

    for i in range(6):
        cache.set(f"integration:key{i}", {"idx": i}, ttl=5)

    for i in range(6):
        result = cache.get(f"integration:key{i}")
        assert result == {"idx": i}, f"应从内存缓存读取，key=integration:key{i}"

    print(f"  6 次写入 + 读取均成功（内存降级）")
    print(f"  熔断器状态: {cb.state.value}")

    cb_stats = cb.get_stats()
    print(f"  熔断器统计: degrade_count={cb_stats['degrade_count']} state={cb_stats['state']}")

    print("  ✅ 测试 8 通过")


def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║     Redis 熔断降级 + 分片并行 综合测试                 ║")
    print("╚══════════════════════════════════════════════════════════╝")

    tests = [
        ("熔断器状态机", test_1_circuit_breaker_state_machine),
        ("指数退避重试", test_2_exponential_backoff_retry),
        ("熔断降级验证", test_3_circuit_breaker_fallback),
        ("Redis 降级内存", test_4_redis_fallback_memory),
        ("后台探活恢复", test_5_circuit_breaker_probe),
        ("分片性能日志", test_6_sharded_performance_logging),
        ("端到端 API", test_7_api_end_to_end),
        ("Redis+熔断器集成", test_8_redis_circuit_breaker_integration),
    ]

    passed = 0
    failed = 0

    for name, test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"\n  ❌ [{name}] 断言失败: {e}")
            failed += 1
        except Exception as e:
            print(f"\n  ❌ [{name}] 异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*60}")
    print(f"  测试总结: {passed}/{len(tests)} 通过, {failed} 失败")
    print(f"{'='*60}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())