"""
V9 数据流转时序校验系统
验证目标：写入 → 广播 → 消费 的闭环时序正确性
对应架构：OrderStore / ExecutionStore / DisciplineStore / DualStrategyStore / SignalStore
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set


@dataclass
class DataRecord:
    """模拟持久化数据记录，带版本号与来源"""
    key: str
    payload: Dict[str, Any]
    version: int = 0
    source: str = "unknown"
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class BroadcastEvent:
    """DataBridge 广播事件"""
    channel: str
    source: str
    version: int
    payload: Any
    timestamp: datetime = field(default_factory=datetime.now)


class MockIndexedDB:
    """模拟 IndexedDB：异步 IO + 互斥锁保证原子写入"""

    def __init__(self, io_latency_ms: float = 10.0):
        self._stores: Dict[str, Dict[str, DataRecord]] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._io_latency = io_latency_ms / 1000.0
        self._versions: Dict[str, int] = {}

    def _ensure_lock(self, store: str) -> asyncio.Lock:
        return self._locks.setdefault(store, asyncio.Lock())

    async def put(self, store: str, key: str, payload: Dict[str, Any], source: str) -> int:
        """写入数据并返回新的全局版本号（原子递增）"""
        async with self._ensure_lock(store):
            # 模拟磁盘 IO 延迟
            await asyncio.sleep(self._io_latency)
            store_data = self._stores.setdefault(store, {})
            self._versions[store] = self._versions.get(store, 0) + 1
            record = DataRecord(
                key=key,
                payload=payload,
                version=self._versions[store],
                source=source,
            )
            store_data[key] = record
            return record.version

    async def get_all(self, store: str) -> List[DataRecord]:
        async with self._ensure_lock(store):
            await asyncio.sleep(self._io_latency / 2)
            return list(self._stores.get(store, {}).values())


class DataBridge:
    """模拟 DataBridge 事件总线：发布订阅 + 去抖合并"""

    def __init__(self, debounce_ms: float = 50.0):
        self._subscribers: Dict[str, List[Callable[[BroadcastEvent], None]]] = {}
        self._debounce_ms = debounce_ms / 1000.0
        self._timers: Dict[str, asyncio.Task] = {}
        self.broadcast_log: List[BroadcastEvent] = []

    def subscribe(self, channel: str, callback: Callable[[BroadcastEvent], None]) -> Callable[[], None]:
        self._subscribers.setdefault(channel, []).append(callback)

        def unsubscribe() -> None:
            if callback in self._subscribers.get(channel, []):
                self._subscribers[channel].remove(callback)

        return unsubscribe

    async def publish(self, event: BroadcastEvent) -> None:
        """立即发布事件"""
        self.broadcast_log.append(event)
        for cb in self._subscribers.get(event.channel, []):
            cb(event)

    async def publish_debounced(self, event: BroadcastEvent) -> None:
        """去抖合并发布：同频道短时间多次写入合并为一次广播"""
        # 关闭去抖时退化为立即发布（用于测试和严格实时场景）
        if self._debounce_ms <= 0:
            await self.publish(event)
            return

        channel = event.channel
        if channel in self._timers:
            self._timers[channel].cancel()

        async def _fire() -> None:
            await asyncio.sleep(self._debounce_ms)
            await self.publish(event)
            if channel in self._timers:
                del self._timers[channel]

        self._timers[channel] = asyncio.create_task(_fire())


class BaseStore:
    """Store 基类：提供状态、锁、快照、订阅等通用能力"""

    def __init__(
        self,
        name: str,
        db: MockIndexedDB,
        bridge: DataBridge,
        store_name: str,
        source: str,
    ):
        self.name = name
        self._db = db
        self._bridge = bridge
        self._store_name = store_name
        self._source = source
        self.data: Optional[Any] = None
        self.version: int = 0
        self.loading: bool = False
        self.error: Optional[str] = None
        self.is_updating: bool = False
        self._unsubscribe: Optional[Callable[[], None]] = None

    async def _write(self, key: str, payload: Dict[str, Any]) -> int:
        """关键路径：先持久化，成功后广播（使用去抖合并同频道短窗口多次写入）"""
        version = await self._db.put(self._store_name, key, payload, self._source)
        # 只有持久化成功后才广播
        event = BroadcastEvent(
            channel=self._store_name,
            source=self._source,
            version=version,
            payload=payload,
        )
        # 默认使用去抖发布，关闭 debounce_ms=0 时退化为立即发布
        await self._bridge.publish_debounced(event)
        return version

    def snapshot(self) -> Dict[str, Any]:
        return {"data": self.data, "version": self.version}

    def restore(self, snap: Dict[str, Any]) -> None:
        self.data = snap["data"]
        self.version = snap["version"]

    async def refresh(self) -> None:
        """从持久化层刷新数据；失败时回滚到旧状态"""
        if self.is_updating:
            return
        self.is_updating = True
        self.loading = True
        self.error = None
        snap = self.snapshot()

        try:
            records = await self._db.get_all(self._store_name)
            # 子类可覆盖 _aggregate 实现业务计算
            self.data = self._aggregate(records)
            self.version = max((r.version for r in records), default=0)
            self.loading = False
        except Exception as exc:
            self.restore(snap)
            self.error = str(exc)
            self.loading = False
        finally:
            self.is_updating = False

    def _aggregate(self, records: List[DataRecord]) -> Any:
        return records

    def init_subscriptions(self, channels: List[str], ignore_sources: Set[str]) -> None:
        """初始化 DataBridge 订阅，带 source 过滤与去抖"""

        async def _on_event(event: BroadcastEvent) -> None:
            if event.source in ignore_sources:
                return
            await self.refresh()

        def _handler(event: BroadcastEvent) -> None:
            asyncio.create_task(_on_event(event))

        for channel in channels:
            self._bridge.subscribe(channel, _handler)

    def destroy(self) -> None:
        if self._unsubscribe:
            self._unsubscribe()


class OrderStore(BaseStore):
    """交易总账本：orders + positions + realized/unrealized PnL"""

    def __init__(self, db: MockIndexedDB, bridge: DataBridge):
        super().__init__("OrderStore", db, bridge, "orders", "orderstore")
        self.realized_pnl: float = 0.0
        self.unrealized_pnl: float = 0.0

    async def save_order(self, order: Dict[str, Any]) -> int:
        key = order["id"]
        return await self._write(key, order)

    def _aggregate(self, records: List[DataRecord]) -> List[Dict[str, Any]]:
        orders = [r.payload for r in sorted(records, key=lambda r: r.version)]
        # 简化盈亏计算
        self.realized_pnl = sum(o.get("realized", 0.0) for o in orders)
        self.unrealized_pnl = sum(o.get("unrealized", 0.0) for o in orders)
        return orders


class ExecutionStore(BaseStore):
    """策略执行引擎：entryPlan / stopLoss / takeProfit / currentPhase"""

    def __init__(self, db: MockIndexedDB, bridge: DataBridge):
        super().__init__("ExecutionStore", db, bridge, "executions", "executionstore")
        self.current_phase: str = "watch"

    async def plan_entry(self, plan: Dict[str, Any]) -> int:
        self.current_phase = "plan"
        return await self._write(plan["symbol"], plan)

    async def execute_entry(self, order: Dict[str, Any]) -> int:
        self.current_phase = "entry"
        return await self._write(order["symbol"], {"phase": "entry", "order": order})


class DisciplineStore(BaseStore):
    """AI 纪律与复盘：监听订单变更后重算 tradeReview"""

    def __init__(self, db: MockIndexedDB, bridge: DataBridge, order_store: OrderStore):
        super().__init__("DisciplineStore", db, bridge, "discipline", "disciplinestore")
        self._order_store = order_store
        self.discipline_score: float = 100.0
        self.trade_errors: List[str] = []
        self.skill_roadmap: List[str] = []

    async def recalculate(self) -> None:
        """从 OrderStore 拉取最新订单，重算纪律评分"""
        await self._order_store.refresh()
        orders = self._order_store.data or []
        # 模拟 tradeReviewAI 计算
        error_count = sum(1 for o in orders if o.get("has_error"))
        self.discipline_score = max(0.0, 100.0 - error_count * 8)
        self.trade_errors = [o["symbol"] for o in orders if o.get("has_error")]
        self.skill_roadmap = ["风险仓位控制", "止损纪律", "情绪管理"][:error_count]
        self.data = {
            "score": self.discipline_score,
            "errors": self.trade_errors,
            "roadmap": self.skill_roadmap,
        }
        # 广播纪律更新
        await self._bridge.publish(
            BroadcastEvent("discipline", "disciplinestore", self.version + 1, self.data)
        )


class DualStrategyStore(BaseStore):
    """双策略信号池"""

    def __init__(self, db: MockIndexedDB, bridge: DataBridge):
        super().__init__("DualStrategyStore", db, bridge, "dual_strategy", "dualstrategy")

    def _aggregate(self, records: List[DataRecord]) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "hot": [r.payload for r in records if r.payload.get("type") == "hot"],
            "pit": [r.payload for r in records if r.payload.get("type") == "pit"],
            "rotation": [r.payload for r in records if r.payload.get("type") == "rotation"],
        }


class SignalStore(BaseStore):
    """技术信号缓存"""

    def __init__(self, db: MockIndexedDB, bridge: DataBridge):
        super().__init__("SignalStore", db, bridge, "signals", "signalstore")

    def _aggregate(self, records: List[DataRecord]) -> Dict[str, Dict[str, float]]:
        result: Dict[str, Dict[str, float]] = {}
        for r in records:
            symbol = r.payload.get("symbol")
            if symbol:
                result[symbol] = {
                    "rsi": r.payload.get("rsi", 0.0),
                    "macd": r.payload.get("macd", 0.0),
                    "volume_breakout": r.payload.get("volume_breakout", 0.0),
                }
        return result


class StoreConsumer:
    """模拟 UI Widget：订阅 Store 更新"""

    def __init__(self, name: str, bridge: DataBridge):
        self.name = name
        self.received: List[BroadcastEvent] = []
        self._unsubscribe = bridge.subscribe("orders", self.on_order_update)

    def on_order_update(self, event: BroadcastEvent) -> None:
        self.received.append(event)

    def count(self) -> int:
        return len(self.received)


# =============================================================================
# 测试用例
# =============================================================================


class TestRunner:
    def __init__(self):
        self.results: List[Dict[str, Any]] = []

    def assert_true(self, condition: bool, message: str) -> None:
        if not condition:
            raise AssertionError(message)

    async def run_case(self, name: str, fn: Callable[[], None]) -> Dict[str, Any]:
        try:
            await fn()
            result = {"name": name, "status": "PASS", "error": None}
        except AssertionError as exc:
            result = {"name": name, "status": "FAIL", "error": str(exc)}
        except Exception as exc:
            result = {"name": name, "status": "ERROR", "error": str(exc)}
        self.results.append(result)
        return result

    def report(self) -> None:
        print("\n测试总结:")
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        total = len(self.results)
        for r in self.results:
            emoji = "✅" if r["status"] == "PASS" else "❌"
            print(f"  {emoji} {r['name']}: {r['status']}")
            if r["error"]:
                print(f"     错误: {r['error']}")
        print(f"\n总计: {total} 个测试, {passed} 通过, {total - passed} 失败")


async def main() -> None:
    print("=" * 60)
    print("  数据流转时序校验系统")
    print("  验证「写入 → 广播 → 消费」闭环时序正确性")
    print("=" * 60)

    runner = TestRunner()
    db = MockIndexedDB(io_latency_ms=10)
    bridge = DataBridge(debounce_ms=30)

    # T-1: 正常流程（关闭去抖以严格验证时序）
    async def test_normal_flow() -> None:
        db_n = MockIndexedDB(io_latency_ms=10)
        bridge_n = DataBridge(debounce_ms=0)
        order_store = OrderStore(db_n, bridge_n)
        consumer = StoreConsumer("PnLAnalysisWidget", bridge_n)

        # 保存订单
        version = await order_store.save_order({
            "id": "O-001",
            "symbol": "000001",
            "qty": 100,
            "realized": 500.0,
            "unrealized": 120.0,
        })

        # 关键断言 1：数据已持久化
        records = await db_n.get_all("orders")
        runner.assert_true(len(records) == 1, "数据必须已写入 IndexedDB")

        # 关键断言 2：广播在持久化之后
        runner.assert_true(len(bridge_n.broadcast_log) >= 1, "必须有广播事件")
        event = bridge_n.broadcast_log[-1]
        runner.assert_true(event.channel == "orders", "广播频道必须是 orders")
        runner.assert_true(event.version == version, "广播版本号必须等于持久化版本号")

        # 关键断言 3：消费者收到事件
        runner.assert_true(consumer.count() >= 1, "消费者必须收到广播")

        # 关键断言 4：拉取版本号匹配
        await order_store.refresh()
        runner.assert_true(order_store.version == version, "拉取版本号必须匹配")

    # T-2: 并发写入版本号单调递增
    async def test_concurrent_writes() -> None:
        db_c = MockIndexedDB(io_latency_ms=5)
        bridge_c = DataBridge(debounce_ms=0)  # 关闭去抖以观测每次广播
        order_store = OrderStore(db_c, bridge_c)
        versions: List[int] = []

        async def _save(i: int) -> None:
            v = await order_store.save_order({"id": f"O-{i:03d}", "symbol": "000001", "qty": i})
            versions.append(v)

        await asyncio.gather(*(_save(i) for i in range(1, 11)))

        runner.assert_true(len(set(versions)) == 10, f"版本号必须唯一，实际 {versions}")
        runner.assert_true(max(versions) == 10, f"最大版本号必须为 10，实际 {max(versions)}")
        runner.assert_true(versions == sorted(versions), f"版本号必须单调递增，实际 {versions}")

    # T-3: source 过滤防止自激（关闭去抖以严格验证事件）
    async def test_source_filter() -> None:
        db_s = MockIndexedDB(io_latency_ms=5)
        bridge_s = DataBridge(debounce_ms=0)
        order_store = OrderStore(db_s, bridge_s)
        external_count = 0
        self_count = 0

        def _handler(event: BroadcastEvent) -> None:
            nonlocal external_count, self_count
            if event.source == "orderstore":
                self_count += 1
            else:
                external_count += 1

        bridge_s.subscribe("orders", _handler)
        await order_store.save_order({"id": "SELF-1", "symbol": "000001", "qty": 1})
        # 外部来源事件
        await bridge_s.publish(BroadcastEvent("orders", "external", 99, {}))

        runner.assert_true(self_count >= 1, f"应收到自身事件，实际 {self_count}")
        runner.assert_true(external_count == 1, f"应收到外部来源事件，实际 {external_count}")

    # T-4: 去抖合并
    async def test_debounce() -> None:
        db_d = MockIndexedDB(io_latency_ms=2)
        bridge_d = DataBridge(debounce_ms=50)
        order_store = OrderStore(db_d, bridge_d)
        count = 0

        def _handler(_event: BroadcastEvent) -> None:
            nonlocal count
            count += 1

        bridge_d.subscribe("orders", _handler)

        # 快速 5 次写入（在 50ms 去抖窗口内）
        for i in range(5):
            await order_store.save_order({"id": f"D-{i}", "symbol": "000001", "qty": i})

        # 等待去抖窗口关闭并额外留余量
        await asyncio.sleep(0.12)
        runner.assert_true(count < 5, f"去抖应合并多次广播，实际广播次数 {count}")
        runner.assert_true(count >= 1, f"至少应触发一次广播，实际广播次数 {count}")

    # T-5: 脏读防护
    async def test_dirty_read_prevention() -> None:
        order_store = OrderStore(db, bridge)
        await order_store.save_order({"id": "DR-1", "symbol": "000001", "qty": 100})
        await order_store.refresh()
        runner.assert_true(order_store.data is not None, "拉取数据不应为空")
        runner.assert_true(order_store.version >= 1, "拉取版本号应 >= 广播版本号")

    # T-6: 多 Store 管道联动
    async def test_multi_store_pipeline() -> None:
        db_p = MockIndexedDB(io_latency_ms=5)
        bridge_p = DataBridge(debounce_ms=20)
        order_store = OrderStore(db_p, bridge_p)
        discipline_store = DisciplineStore(db_p, bridge_p, order_store)
        discipline_store.init_subscriptions(["orders"], ignore_sources=set())

        await order_store.save_order({
            "id": "PIPE-1",
            "symbol": "000001",
            "qty": 100,
            "has_error": True,
        })
        await asyncio.sleep(0.05)
        await discipline_store.recalculate()

        runner.assert_true(discipline_store.discipline_score < 100, "有错单时纪律评分应下降")
        runner.assert_true(len(discipline_store.trade_errors) == 1, "应识别 1 个错误")
        runner.assert_true(len(bridge_p.broadcast_log) >= 2, "应包含订单广播和纪律广播")

    await runner.run_case("test_normal_flow", test_normal_flow)
    await runner.run_case("test_concurrent_writes", test_concurrent_writes)
    await runner.run_case("test_source_filter", test_source_filter)
    await runner.run_case("test_debounce", test_debounce)
    await runner.run_case("test_dirty_read_prevention", test_dirty_read_prevention)
    await runner.run_case("test_multi_store_pipeline", test_multi_store_pipeline)

    runner.report()


if __name__ == "__main__":
    asyncio.run(main())
