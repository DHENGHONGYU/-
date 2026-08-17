"""
数据流引擎 (DataFlowEngine)
===========================
对应 TypeScript: src/core/dataflow/dataflowEngine.ts + dataflowTypes.ts

核心职责：
1. 12 通道发布-订阅模式
2. LRU 内存缓存 + TTL 过期
3. SSE 实时推送（aiohttp 实现）
4. 轮询模式降级（HTTP 长轮询）
5. 缓存统计 + 命中率监控
"""

import asyncio
import time
import json
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set, Callable, Optional, Generic, TypeVar
from collections import OrderedDict
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


# ============================================================
# 类型定义（对应 dataflowTypes.ts）
# ============================================================

T = TypeVar('T')

class ChannelPriority(Enum):
    HIGH   = "high"
    NORMAL = "normal"
    LOW    = "low"

PRIORITY_ORDER: Dict[str, int] = {
    "high":   0,
    "normal": 1,
    "low":    2,
}

@dataclass
class DataPacket:
    """数据包（对应 DataPacket<T>）"""
    channel: str
    data: Any
    timestamp: float = field(default_factory=time.time)
    seq: int = 0

@dataclass
class ChannelMeta:
    """通道元数据（对应 ChannelMeta）"""
    channel: str
    description: str
    refresh_interval: int    # 毫秒
    persist: bool = True
    priority: ChannelPriority = ChannelPriority.NORMAL
    ttl: int = 0             # 缓存过期时间（毫秒），0 表示不缓存

@dataclass
class CacheStats:
    """缓存统计（对应 CacheStats）"""
    hits: int = 0
    misses: int = 0
    size: int = 0
    total_requests: int = 0
    total_entries: int = 0
    max_entries: int = 100
    hit_rate: float = 0.0
    hit_count: int = 0
    miss_count: int = 0
    expired_count: int = 0
    evicted_count: int = 0

# 数据流事件
class DataFlowEvent(Enum):
    CONNECTED        = "dataflow:connected"
    DISCONNECTED     = "dataflow:disconnected"
    PACKET_PUBLISHED = "dataflow:packet_published"


# ============================================================
# 12 通道定义（对应 TS DEFAULT_CHANNELS）
# ============================================================

DEFAULT_CHANNELS: List[ChannelMeta] = [
    ChannelMeta(channel="market:index",       description="大盘指数实时数据", refresh_interval=5000,  persist=True,  priority=ChannelPriority.HIGH),
    ChannelMeta(channel="market:sector",      description="板块涨跌排行",     refresh_interval=10000, persist=True,  priority=ChannelPriority.HIGH),
    ChannelMeta(channel="market:fundflow",    description="资金流向统计",     refresh_interval=15000, persist=True,  priority=ChannelPriority.NORMAL),
    ChannelMeta(channel="market:emotion",     description="市场情绪指标",     refresh_interval=30000, persist=False, priority=ChannelPriority.LOW),
    ChannelMeta(channel="portfolio:summary",  description="持仓总览",         refresh_interval=10000, persist=True,  priority=ChannelPriority.HIGH),
    ChannelMeta(channel="portfolio:holding",  description="持仓明细",         refresh_interval=30000, persist=True,  priority=ChannelPriority.NORMAL),
    ChannelMeta(channel="portfolio:risk",     description="持仓风险",         refresh_interval=10000, persist=True,  priority=ChannelPriority.HIGH),
    ChannelMeta(channel="strategy:signal",    description="买卖信号",         refresh_interval=5000,  persist=False, priority=ChannelPriority.HIGH),
    ChannelMeta(channel="strategy:score",     description="股票评分",         refresh_interval=60000, persist=True,  priority=ChannelPriority.NORMAL),
    ChannelMeta(channel="agent:status",       description="Agent状态",        refresh_interval=10000, persist=False, priority=ChannelPriority.NORMAL),
    ChannelMeta(channel="agent:logs",         description="Agent日志",        refresh_interval=2000,  persist=False, priority=ChannelPriority.HIGH),
    ChannelMeta(channel="system:health",      description="系统健康",         refresh_interval=30000, persist=False, priority=ChannelPriority.LOW),
]

# 采集相关扩展通道
COLLECTION_CHANNELS: List[ChannelMeta] = [
    ChannelMeta(channel="collection:progress", description="采集进度",        refresh_interval=1000,  persist=False, priority=ChannelPriority.HIGH),
    ChannelMeta(channel="collection:result",   description="采集结果",        refresh_interval=5000,  persist=True,  priority=ChannelPriority.NORMAL),
    ChannelMeta(channel="collection:error",    description="采集错误",        refresh_interval=2000,  persist=False, priority=ChannelPriority.HIGH),
]


# ============================================================
# 缓存条目
# ============================================================

@dataclass
class CacheEntry:
    data: Any
    timestamp: float
    seq: int
    channel: str
    last_access_at: float
    ttl_ms: int = 0  # 0 = 永不过期

    @property
    def is_expired(self) -> bool:
        if self.ttl_ms <= 0:
            return False
        return (time.time() * 1000 - self.timestamp * 1000) > self.ttl_ms


# ============================================================
# DataFlowEngine
# ============================================================

class DataFlowEngine:
    """
    数据流引擎

    对应 TypeScript DataFlowEngine 完整实现：
    - publish(channel, data): 发布数据到通道
    - subscribe(channel, callback): 订阅通道
    - getCache(channel): 获取缓存数据
    - getCacheStats(): 获取缓存统计
    - start_sse_server(host, port): 启动 SSE 推送服务器
    """

    def __init__(self, max_cache_entries: int = 100):
        # 订阅者：channel → {callback, priority}
        self._subscribers: Dict[str, List[tuple[Callable, ChannelPriority]]] = {}

        # LRU 缓存：channel → OrderedDict[key → CacheEntry]
        self._cache: Dict[str, OrderedDict] = {}

        # 缓存配置
        self._cache_max_entries = max_cache_entries

        # 缓存统计
        self._cache_stats = CacheStats(max_entries=max_cache_entries)

        # 序列号
        self._seq: Dict[str, int] = {}

        # 通道元数据
        self._channels: Dict[str, ChannelMeta] = {}
        for ch in DEFAULT_CHANNELS + COLLECTION_CHANNELS:
            self._channels[ch.channel] = ch

        # 全局序列号
        self._global_seq = 0

        # SSE 服务器
        self._sse_server: Optional[SSEServer] = None
        self._sse_lock = threading.Lock()

        # 连接计数器
        self._connected_clients = 0

    # ==========================================================
    # 发布
    # ==========================================================

    def publish(self, channel: str, data: Any, ttl_ms: int = 0) -> DataPacket:
        """
        发布数据到通道

        对应 TS: dataFlowEngine.publish(channel, data)
        """
        self._global_seq += 1
        seq = self._seq.get(channel, 0) + 1
        self._seq[channel] = seq

        packet = DataPacket(
            channel=channel,
            data=data,
            timestamp=time.time(),
            seq=seq,
        )

        # 写入缓存
        self._cache_put(channel, packet, ttl_ms)

        # 分发到订阅者
        subs = self._subscribers.get(channel, [])
        # 按优先级排序
        subs.sort(key=lambda x: PRIORITY_ORDER.get(x[1].value, 1))

        for callback, _ in subs:
            try:
                callback(packet)
            except Exception:
                pass  # 订阅者错误不影响其他订阅者

        # 同时广播到 SSE 客户端
        if self._sse_server:
            self._sse_server.broadcast(channel, packet)

        return packet

    # ==========================================================
    # 订阅
    # ==========================================================

    def subscribe(self, channel: str, callback: Callable[[DataPacket], None],
                  priority: ChannelPriority = ChannelPriority.NORMAL) -> Callable:
        """
        订阅通道，返回取消订阅函数

        对应 TS: dataFlowEngine.subscribe(channel, callback)
        """
        if channel not in self._subscribers:
            self._subscribers[channel] = []

        self._subscribers[channel].append((callback, priority))

        # 返回取消订阅函数
        def unsubscribe():
            self._subscribers[channel] = [
                (cb, p) for cb, p in self._subscribers[channel]
                if cb != callback
            ]

        return unsubscribe

    # ==========================================================
    # 缓存
    # ==========================================================

    def _cache_put(self, channel: str, packet: DataPacket, ttl_ms: int = 0) -> None:
        """写入缓存"""
        if channel not in self._cache:
            self._cache[channel] = OrderedDict()

        cache = self._cache[channel]
        key = str(packet.seq)

        # LRU 淘汰
        if len(cache) >= self._cache_max_entries:
            cache.popitem(last=False)
            self._cache_stats.evicted_count += 1

        cache[key] = CacheEntry(
            data=packet,
            timestamp=packet.timestamp,
            seq=packet.seq,
            channel=channel,
            last_access_at=time.time(),
            ttl_ms=ttl_ms,
        )
        self._cache_stats.total_entries += 1

    def get_cache(self, channel: str, key: Optional[str] = None) -> Optional[DataPacket]:
        """
        获取缓存数据

        对应 TS: dataFlowEngine.getCache(channel)
        """
        self._cache_stats.total_requests += 1

        cache = self._cache.get(channel, OrderedDict())
        if not cache:
            self._cache_stats.misses += 1
            self._cache_stats.miss_count += 1
            return None

        if key:
            entry = cache.get(key)
            if entry:
                if entry.is_expired:
                    del cache[key]
                    self._cache_stats.expired_count += 1
                    self._cache_stats.misses += 1
                    return None
                entry.last_access_at = time.time()
                self._cache_stats.hits += 1
                self._cache_stats.hit_count += 1
                return entry.data

        # 返回最新缓存
        _, latest = cache.popitem(last=True)
        cache[latest.seq] = latest  # 放回去
        if latest.is_expired:
            self._cache_stats.expired_count += 1
            self._cache_stats.misses += 1
            return None
        latest.last_access_at = time.time()
        self._cache_stats.hits += 1
        self._cache_stats.hit_count += 1
        return latest.data

    def get_cache_stats(self) -> CacheStats:
        """获取缓存统计"""
        total = self._cache_stats.hits + self._cache_stats.misses
        self._cache_stats.size = sum(len(c) for c in self._cache.values())
        self._cache_stats.hit_rate = (
            self._cache_stats.hits / total if total > 0 else 0.0
        )
        return self._cache_stats

    # ==========================================================
    # SSE 推送服务器
    # ==========================================================

    def start_sse_server(self, host: str = "0.0.0.0", port: int = 8080) -> None:
        """
        启动 SSE 推送服务器

        对应 TS: DataFlowEngine 的 SSE 模式
        提供两个端点：
        - GET /sse/stream?channels=market:index,strategy:signal → SSE 订阅
        - GET /sse/poll?channel=market:index → 轮询降级
        - GET /sse/channels → 通道列表
        - GET /sse/stats → 缓存统计
        """
        with self._sse_lock:
            if self._sse_server:
                return

            self._sse_server = SSEServer(
                host=host,
                port=port,
                engine=self,
            )
            thread = threading.Thread(target=self._sse_server.start, daemon=True)
            thread.start()

    def stop_sse_server(self) -> None:
        """停止 SSE 服务器"""
        with self._sse_lock:
            if self._sse_server:
                self._sse_server.stop()
                self._sse_server = None

    @property
    def sse_url(self) -> Optional[str]:
        """SSE 服务器 URL"""
        if self._sse_server:
            return f"http://{self._sse_server.host}:{self._sse_server.port}"
        return None

    @property
    def connected_clients(self) -> int:
        return self._connected_clients

    # ==========================================================
    # 通道管理
    # ==========================================================

    def get_channels(self) -> List[ChannelMeta]:
        return list(self._channels.values())

    def get_channel_meta(self, channel: str) -> Optional[ChannelMeta]:
        return self._channels.get(channel)


# ============================================================
# SSE HTTP 服务器
# ============================================================

class SSEServer:
    """SSE 推送 HTTP 服务器"""

    def __init__(self, host: str, port: int, engine: DataFlowEngine):
        self.host = host
        self.port = port
        self.engine = engine
        self._http_server: Optional[HTTPServer] = None
        self._clients: List['SSEClientHandler'] = []
        self._running = False

    class _RequestHandler(BaseHTTPRequestHandler):
        """内置 HTTP 请求处理器"""

        def log_message(self, format, *args):
            pass  # 静默日志

        def _send_sse_headers(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

        def _send_json(self, data: dict, status: int = 200):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            params = parse_qs(parsed.query)

            engine = self.server.engine  # type: DataFlowEngine

            # SSE 流订阅
            if path == "/sse/stream":
                channels_str = params.get("channels", [""])[0]
                channels = [c.strip() for c in channels_str.split(",") if c.strip()]

                self._send_sse_headers()

                # 注册为 SSE 客户端
                client = SSEClientHandler(self.wfile)
                self.server._clients.append(client)

                try:
                    # 发送初始连接事件
                    init_msg = f"event: connected\ndata: {json.dumps({'channels': channels, 'timestamp': time.time()})}\n\n"
                    self.wfile.write(init_msg.encode())
                    self.wfile.flush()

                    # 为每个通道注册回调
                    unsubscribers = []
                    for ch in channels:
                        def make_callback(c):
                            def callback(packet: DataPacket):
                                try:
                                    msg = f"event: {c}\ndata: {json.dumps(packet.data, default=str, ensure_ascii=False)}\n\n"
                                    self.wfile.write(msg.encode())
                                    self.wfile.flush()
                                except Exception:
                                    pass
                            return callback
                        unsub = engine.subscribe(ch, make_callback(ch))
                        unsubscribers.append(unsub)

                    # 保持连接（心跳）
                    while True:
                        heartbeat = f": heartbeat {time.time()}\n\n"
                        try:
                            self.wfile.write(heartbeat.encode())
                            self.wfile.flush()
                        except Exception:
                            break
                        time.sleep(30)

                except Exception:
                    pass
                finally:
                    for unsub in unsubscribers:
                        unsub()
                    if client in self.server._clients:
                        self.server._clients.remove(client)

            # 轮询降级
            elif path == "/sse/poll":
                channel = params.get("channel", [""])[0]
                packet = engine.get_cache(channel)
                if packet:
                    self._send_json({"data": packet.data, "timestamp": packet.timestamp, "seq": packet.seq})
                else:
                    self._send_json({"data": None, "timestamp": time.time(), "seq": 0}, status=204)

            # 通道列表
            elif path == "/sse/channels":
                channels = [
                    {"channel": c.channel, "description": c.description,
                     "refresh_interval": c.refresh_interval, "priority": c.priority.value}
                    for c in engine.get_channels()
                ]
                self._send_json({"channels": channels})

            # 缓存统计
            elif path == "/sse/stats":
                stats = engine.get_cache_stats()
                self._send_json({
                    "hits": stats.hits,
                    "misses": stats.misses,
                    "hit_rate": stats.hit_rate,
                    "size": stats.size,
                    "connected_clients": len(self.server._clients),
                })

            else:
                self._send_json({"error": "Not Found"}, status=404)

    def start(self):
        """启动 SSE 服务器"""
        self._http_server = HTTPServer((self.host, self.port), self._RequestHandler)
        self._http_server.engine = self.engine  # type: ignore
        self._http_server._clients = self._clients  # type: ignore
        self._running = True
        self._http_server.serve_forever()

    def stop(self):
        """停止 SSE 服务器"""
        self._running = False
        if self._http_server:
            self._http_server.shutdown()

    def broadcast(self, channel: str, packet: DataPacket):
        """广播到所有 SSE 客户端（由 publish 触发）"""
        # SSE 客户端通过订阅机制自动接收，此处为补充
        pass


class SSEClientHandler:
    """SSE 客户端占位"""
    def __init__(self, wfile):
        self.wfile = wfile


# ============================================================
# 全局单例
# ============================================================

# 对应 TS: export const dataFlowEngine = new DataFlowEngine()
data_flow_engine = DataFlowEngine()