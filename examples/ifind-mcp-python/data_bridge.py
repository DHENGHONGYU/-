"""
数据桥接层 (DataBridge)
=======================
对应 TypeScript: src/core/databridge.ts

核心职责：
1. 统一写入入口：forward(action, payload)
2. ACL 权限校验：验证模块对 Store 的读写权限
3. 审计日志：每次写入记录操作日志
4. 广播通知：写入完成后通知订阅者
5. 目标 Store 推断：根据 ENVELOPE_ACTION 映射到 IndexedDB Store
"""

import time
import json
import hashlib
from dataclasses import dataclass, field
from typing import Any, Optional, Dict, List, Callable
from enum import Enum


# ============================================================
# 信封协议
# ============================================================

class EnvelopeAction(Enum):
    """信封操作类型（对应 TypeScript ENVELOPE_ACTION）"""
    # 股票基础数据
    INSERT_STOCK          = "insertStock"
    UPDATE_STOCK          = "updateStock"
    DELETE_STOCK          = "deleteStock"

    # K线行情
    SAVE_DAILY_QUOTES     = "saveDailyQuotes"

    # 评分数据
    SAVE_V6_SCORE         = "saveV6Score"
    SAVE_INTELLIGENT_SCORES = "saveIntelligentScores"
    SAVE_INDUSTRY_SCORES  = "saveIndustryScores"
    SAVE_ROTATION_SCORES  = "saveRotationScores"
    SAVE_SECTOR_SCORES    = "saveSectorScores"

    # 交易
    INSERT_ORDER          = "insertOrder"
    UPDATE_ORDER          = "updateOrder"

    # 资讯
    SAVE_NEWS             = "saveNews"
    SAVE_NEWS_STOCK_MAP   = "saveNewsStockMap"
    NEWS_ARTICLE_BOOKMARKED = "newsArticleBookmarked"

    # 采集
    SAVE_COLLECTION_RESULT = "saveCollectionResult"

    # 文档
    SAVE_LOCAL_DOCS       = "saveLocalDocs"
    SAVE_SCORE_DOCS       = "saveScoreDocs"

    # 其他
    SAVE_STRATEGY_SNAPSHOTS = "saveStrategySnapshots"
    INSERT_SIGNAL         = "insertSignal"


@dataclass
class Envelope:
    """数据信封"""
    action: EnvelopeAction
    payload: Any
    module: str = "unknown"
    timestamp: float = field(default_factory=time.time)
    envelope_id: str = ""

    def __post_init__(self):
        if not self.envelope_id:
            raw = f"{self.action.value}:{self.module}:{self.timestamp}"
            self.envelope_id = hashlib.md5(raw.encode()).hexdigest()[:12]


# ============================================================
# ACL 权限矩阵
# ============================================================

class AccessLevel(Enum):
    """权限级别"""
    NONE   = 0   # 无权限
    READ   = 1   # 只读
    WRITE  = 2   # 读写
    ADMIN  = 3   # 管理


# 模块 → (Store → 权限) 矩阵
# 对应 TypeScript: ACL_MATRIX
ACL_MATRIX: Dict[str, Dict[str, AccessLevel]] = {
    "stockpool": {
        "stocks":              AccessLevel.WRITE,
        "watchlists":          AccessLevel.WRITE,
        "news_bookmarks":      AccessLevel.WRITE,
        "chip_strategy_review": AccessLevel.READ,
    },
    "analyzer": {
        "v6_scores":           AccessLevel.WRITE,
        "intelligent_scores":  AccessLevel.WRITE,
        "industry_scores":     AccessLevel.WRITE,
        "rotation_scores":     AccessLevel.WRITE,
        "sector_scores":       AccessLevel.WRITE,
        "score_docs":          AccessLevel.WRITE,
        "stocks":              AccessLevel.READ,
        "daily_quotes":        AccessLevel.READ,
    },
    "collector": {
        "daily_quotes":        AccessLevel.WRITE,
        "news":                AccessLevel.WRITE,
        "news_stock_map":      AccessLevel.WRITE,
        "sector_scores":       AccessLevel.WRITE,
        "financial_reports":   AccessLevel.WRITE,
        "local_docs":          AccessLevel.WRITE,
        "sentiment_cache":     AccessLevel.WRITE,
        "collection_results":  AccessLevel.WRITE,
        "v6_scores":           AccessLevel.WRITE,
        "stocks":              AccessLevel.READ,
        "research_logs":       AccessLevel.READ,
    },
    "trading": {
        "orders":              AccessLevel.WRITE,
        "signals":             AccessLevel.WRITE,
        "strategy_snapshots":  AccessLevel.WRITE,
        "stocks":              AccessLevel.READ,
        "v6_scores":           AccessLevel.READ,
        "daily_quotes":        AccessLevel.READ,
    },
    "news": {
        "news":                AccessLevel.WRITE,
        "news_stock_map":      AccessLevel.WRITE,
        "news_bookmarks":      AccessLevel.WRITE,
        "sentiment_cache":     AccessLevel.WRITE,
        "stocks":              AccessLevel.READ,
    },
}

# 操作 → 目标 Store 映射
ACTION_TO_STORE: Dict[EnvelopeAction, str] = {
    EnvelopeAction.INSERT_STOCK:           "stocks",
    EnvelopeAction.UPDATE_STOCK:           "stocks",
    EnvelopeAction.DELETE_STOCK:           "stocks",
    EnvelopeAction.SAVE_DAILY_QUOTES:      "daily_quotes",
    EnvelopeAction.SAVE_V6_SCORE:          "v6_scores",
    EnvelopeAction.SAVE_COLLECTION_RESULT: "collection_results",
    EnvelopeAction.SAVE_INTELLIGENT_SCORES: "intelligent_scores",
    EnvelopeAction.SAVE_INDUSTRY_SCORES:   "industry_scores",
    EnvelopeAction.SAVE_ROTATION_SCORES:   "rotation_scores",
    EnvelopeAction.SAVE_SECTOR_SCORES:     "sector_scores",
    EnvelopeAction.INSERT_ORDER:           "orders",
    EnvelopeAction.UPDATE_ORDER:           "orders",
    EnvelopeAction.SAVE_NEWS:              "news",
    EnvelopeAction.SAVE_NEWS_STOCK_MAP:    "news_stock_map",
    EnvelopeAction.SAVE_COLLECTION_RESULT: "collection_results",
    EnvelopeAction.SAVE_LOCAL_DOCS:        "local_docs",
    EnvelopeAction.SAVE_SCORE_DOCS:        "score_docs",
    EnvelopeAction.SAVE_STRATEGY_SNAPSHOTS: "strategy_snapshots",
    EnvelopeAction.INSERT_SIGNAL:          "signals",
    EnvelopeAction.NEWS_ARTICLE_BOOKMARKED: "news_bookmarks",
}


# ============================================================
# 数据桥接层
# ============================================================

class DataBridge:
    """
    数据桥接层

    对应 TypeScript DataBridge 核心实现：
    1. forward(envelope) → ACL 校验 → 推断 Store → 写入 → 审计 → 广播
    2. 集成 DataFlowEngine：每次写入后自动 SSE 推送

    新增方法：
    - set_data_flow_engine(engine): 绑定 DataFlowEngine 实例
    - _publish_sse(store_name, envelope): SSE 推送写入事件
    """

    def __init__(self, data_flow_engine: Optional[Any] = None):
        # 模拟 IndexedDB 存储
        self._stores: Dict[str, Dict[str, Any]] = {}

        # 审计日志
        self._audit_logs: List[dict] = []

        # 订阅者：Store → 回调列表
        self._subscribers: Dict[str, List[Callable[[str, Any], None]]] = {}

        # === 新增：DataFlowEngine 实例 ===
        self._data_flow_engine = data_flow_engine

    def set_data_flow_engine(self, engine: Any) -> None:
        """
        绑定 DataFlowEngine 实例

        绑定后，每次 forward() 写入成功会自动通过 SSE 推送通知。
        """
        self._data_flow_engine = engine

    # ----------------------------------------------------------
    # 核心方法：forward
    # ----------------------------------------------------------

    def forward(self, action: EnvelopeAction, payload: Any,
                module: str = "unknown") -> dict:
        """
        统一写入入口

        对应 TypeScript: dataBridge.forward(ENVELOPE_ACTION, payload)

        返回: {"ok": bool, "store": str, "envelope_id": str, "error": str | None}
        """
        envelope = Envelope(action=action, payload=payload, module=module)

        # Step 1: 推断目标 Store
        store_name = ACTION_TO_STORE.get(action)
        if store_name is None:
            return {"ok": False, "store": "", "envelope_id": envelope.envelope_id,
                    "error": f"未知操作 {action.value}"}

        # Step 2: ACL 权限校验
        acl_ok = self._check_acl(module, store_name, "write")
        if not acl_ok:
            return {"ok": False, "store": store_name, "envelope_id": envelope.envelope_id,
                    "error": f"模块 {module} 无对 {store_name} 的写入权限"}

        # Step 3: 写入存储
        self._ensure_store(store_name)
        key = getattr(payload, "symbol", None) or getattr(payload, "id", None) or envelope.envelope_id
        self._stores[store_name][str(key)] = payload

        # Step 4: 审计日志
        self._write_audit_log(envelope, store_name, key)

        # Step 5: 广播通知（本地订阅者）
        self._broadcast(store_name, envelope)

        # Step 6: SSE 推送（DataFlowEngine）
        self._publish_sse(store_name, envelope)

        return {"ok": True, "store": store_name, "envelope_id": envelope.envelope_id}

    # ----------------------------------------------------------
    # 查询方法
    # ----------------------------------------------------------

    def query(self, store_name: str, key: str, module: str = "unknown") -> Optional[Any]:
        """读取数据（带 ACL 校验）"""
        if not self._check_acl(module, store_name, "read"):
            return None
        store = self._stores.get(store_name, {})
        return store.get(key)

    def query_all(self, store_name: str, module: str = "unknown") -> List[Any]:
        """读取全部数据"""
        if not self._check_acl(module, store_name, "read"):
            return []
        store = self._stores.get(store_name, {})
        return list(store.values())

    # ----------------------------------------------------------
    # 订阅
    # ----------------------------------------------------------

    def subscribe(self, store_name: str, callback: Callable[[str, Any], None]) -> None:
        """订阅 Store 变更"""
        if store_name not in self._subscribers:
            self._subscribers[store_name] = []
        self._subscribers[store_name].append(callback)

    def unsubscribe(self, store_name: str, callback: Callable[[str, Any], None]) -> None:
        """取消订阅"""
        if store_name in self._subscribers:
            self._subscribers[store_name] = [
                cb for cb in self._subscribers[store_name] if cb != callback
            ]

    # ----------------------------------------------------------
    # 审计日志
    # ----------------------------------------------------------

    def get_audit_logs(self, limit: int = 50) -> List[dict]:
        """获取最近 N 条审计日志"""
        return self._audit_logs[-limit:]

    def get_audit_logs_by_module(self, module: str, limit: int = 50) -> List[dict]:
        """按模块过滤审计日志"""
        return [log for log in self._audit_logs if log["module"] == module][-limit:]

    # ----------------------------------------------------------
    # 内部方法
    # ----------------------------------------------------------

    def _publish_sse(self, store_name: str, envelope: Envelope) -> None:
        """
        通过 DataFlowEngine 推送 SSE 事件

        对应 TS: dataFlowEngine.publish()
        推送频道：data:write → 所有订阅了该 Store 的 SSE 客户端
        """
        if self._data_flow_engine:
            try:
                self._data_flow_engine.publish("data:write", {
                    "store": store_name,
                    "action": envelope.action.value,
                    "module": envelope.module,
                    "envelope_id": envelope.envelope_id,
                    "timestamp": envelope.timestamp,
                })
            except Exception:
                pass  # SSE 推送失败不影响主流程

    def _check_acl(self, module: str, store_name: str, operation: str) -> bool:
        """ACL 权限校验"""
        module_acl = ACL_MATRIX.get(module, {})
        level = module_acl.get(store_name, AccessLevel.NONE)

        if operation == "read":
            return level in (AccessLevel.READ, AccessLevel.WRITE, AccessLevel.ADMIN)
        elif operation == "write":
            return level in (AccessLevel.WRITE, AccessLevel.ADMIN)
        return False

    def _ensure_store(self, store_name: str) -> None:
        """确保 Store 存在"""
        if store_name not in self._stores:
            self._stores[store_name] = {}

    def _write_audit_log(self, envelope: Envelope, store_name: str, key: Any) -> None:
        """写入审计日志"""
        self._audit_logs.append({
            "id": envelope.envelope_id,
            "action": envelope.action.value,
            "module": envelope.module,
            "store": store_name,
            "key": str(key),
            "timestamp": envelope.timestamp,
            "payload_summary": str(envelope.payload)[:200],
        })

    def _broadcast(self, store_name: str, envelope: Envelope) -> None:
        """广播通知订阅者"""
        subscribers = self._subscribers.get(store_name, [])
        for callback in subscribers:
            try:
                callback(store_name, envelope.payload)
            except Exception:
                pass  # 订阅者错误不影响主流程

    # ----------------------------------------------------------
    # 统计
    # ----------------------------------------------------------

    @property
    def store_stats(self) -> dict:
        """各 Store 数据量统计"""
        return {
            name: len(store) for name, store in self._stores.items()
        }

    @property
    def audit_count(self) -> int:
        """审计日志总数"""
        return len(self._audit_logs)