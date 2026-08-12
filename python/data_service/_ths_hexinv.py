"""
@module _ths_hexinv
@lifecycle @Global
@description 同花顺 hexin-v 验证码生成器（f2Zijin L2 兜底层数据源）

@remarks
## 背景
AKShare 内置的 stock_fund_flow_industry 接口依赖同花顺 hexin-v 反爬验证码。
当 AKShare 版本升级或接口签名变动时，该接口易失效。本模块直接复用 AKShare
内置的 ths.js + py_mini_racer 生成 v_code，绕过 AKShare 中间层，提升稳定性。

参考实现：cloud.tencent.com/developer/article/2659468 子晓AI量化 hexin-v 实战方案

## 三层架构定位
f2Zijin 主力净流入获取优先级：
- L1 (盘中实时, 优先)：AKShare 同花顺 stock_fund_flow_industry
- L2 (盘中实时, 兜底)：本模块 hexin-v 手动绕过 ← 当前文件
- L3 (缓存兜底)：SQLite 最近5日 net_amount 均值
- L4 (代理保底)：5日均额/20日均额 量价代理

## 缓存策略
- v_code 时效约 10-60s（同花顺服务端控制），模块级 TTL=30s 缓存，
  避免每次请求都跑 JS 解析（约 100-300ms）。
- ths.js 文件内容 + py_mini_racer 引擎实例进程级缓存，避免重复初始化。

@see hot-momentum-strategy.md §2.5.2 f2Zijin L2 兜底
"""

import logging
from typing import Optional

from lib.cache_utils import TTL_LRUCache

logger = logging.getLogger(__name__)

# v_code 缓存：TTL=30s（保守值，避免使用过期 v_code）
# max_size=1 因为 v_code 是全局共享的，不需要多个槽位
_V_CODE_CACHE = TTL_LRUCache(ttl=30.0, max_size=1)

# ths.js 文件内容进程级缓存（JS 内容稳定，无需重复读取）
_THS_JS_CONTENT_CACHE: Optional[str] = None

# py_mini_racer 引擎实例进程级缓存（一次 eval ths.js，后续多次 call("v") 复用）
_JS_ENGINE = None


def _get_ths_js_content() -> Optional[str]:
    """获取同花顺 ths.js 文件内容（进程级缓存）。

    数据源：akshare.datasets.get_ths_js("ths.js")
    失败场景：akshare 未安装 / 缺少 ths.js 资源 / 文件读取异常
    """
    global _THS_JS_CONTENT_CACHE
    if _THS_JS_CONTENT_CACHE is not None:
        return _THS_JS_CONTENT_CACHE

    try:
        from akshare.datasets import get_ths_js
    except ImportError:
        logger.warning("[hexinv] akshare 未安装 get_ths_js，无法生成 hexin-v")
        return None

    try:
        js_file_path = get_ths_js("ths.js")
        with open(js_file_path, encoding="utf-8") as f:
            content = f.read()
        _THS_JS_CONTENT_CACHE = content
        logger.info("[hexinv] ths.js 加载成功 len=%d path=%s", len(content), js_file_path)
        return content
    except Exception as e:
        logger.warning("[hexinv] 加载 ths.js 失败: %s", e, exc_info=True)
        return None


def _get_js_engine():
    """获取 py_mini_racer JS 引擎实例（进程级缓存）。

    一次 eval ths.js 后，后续多次 call("v") 复用同一上下文。
    失败场景：py_mini_racer 未安装 / ths.js 加载失败 / JS 执行异常
    """
    global _JS_ENGINE
    if _JS_ENGINE is not None:
        return _JS_ENGINE

    try:
        from py_mini_racer import MiniRacer
    except ImportError:
        logger.warning("[hexinv] py_mini_racer 未安装，无法生成 hexin-v")
        return None

    js_content = _get_ths_js_content()
    if not js_content:
        return None

    try:
        engine = MiniRacer()
        engine.eval(js_content)
        _JS_ENGINE = engine
        logger.info("[hexinv] py_mini_racer 引擎初始化完成")
        return engine
    except Exception as e:
        logger.warning("[hexinv] py_mini_racer 初始化失败: %s", e, exc_info=True)
        return None


def generate_hexin_v() -> Optional[str]:
    """
    生成同花顺 hexin-v 验证码（带 30s TTL 缓存）。

    Returns:
        hexin-v 字符串，失败返回 None

    Example:
        >>> v = generate_hexin_v()
        >>> if v:
        ...     headers = {"hexin-v": v, ...}
        ...     resp = requests.get(url, headers=headers)
    """
    # 1. 命中缓存（30s 内的 v_code 可复用，避免重复跑 JS）
    cached = _V_CODE_CACHE.get("v_code")
    if cached:
        logger.debug("[hexinv] 命中缓存 v_code len=%d", len(cached))
        return cached

    # 2. 缓存未命中，重新生成
    engine = _get_js_engine()
    if engine is None:
        return None

    try:
        v_code = engine.call("v")
        if v_code and isinstance(v_code, str):
            _V_CODE_CACHE.set("v_code", v_code)
            logger.info("[hexinv] v_code 生成成功 len=%d", len(v_code))
            return v_code
        logger.warning("[hexinv] v_code 返回异常: %r", v_code)
        return None
    except Exception as e:
        logger.warning("[hexinv] 生成 v_code 失败: %s", e, exc_info=True)
        return None


def build_ths_headers() -> Optional[dict]:
    """
    构造同花顺请求 headers（含 hexin-v）。

    Returns:
        完整 headers dict，hexin-v 生成失败返回 None

    注意：headers 中 Host/Referer 固定为 data.10jqka.com.cn/funds/hyzjl/，
    适用于行业资金流接口；其他同花顺接口可能需要调整 Referer。
    """
    v_code = generate_hexin_v()
    if not v_code:
        return None

    return {
        "Accept": "text/html, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "hexin-v": v_code,
        "Host": "data.10jqka.com.cn",
        "Pragma": "no-cache",
        "Referer": "http://data.10jqka.com.cn/funds/hyzjl/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/90.0.4430.85 Safari/537.36"
        ),
        "X-Requested-With": "XMLHttpRequest",
    }


def invalidate_cache() -> None:
    """手动失效 v_code 缓存。

    使用场景：
    - 单元测试需要强制重新生成 v_code
    - v_code 被同花顺服务端拒绝（403/401）后强制刷新
    """
    _V_CODE_CACHE.invalidate("v_code")


def reset_engine() -> None:
    """重置 JS 引擎和 ths.js 缓存（仅用于测试）。

    正常运行时无需调用，引擎和 JS 内容是稳定的。
    """
    global _JS_ENGINE, _THS_JS_CONTENT_CACHE
    _JS_ENGINE = None
    _THS_JS_CONTENT_CACHE = None
    invalidate_cache()


def cache_stats() -> dict:
    """返回 v_code 缓存统计（监控用）。

    Returns:
        包含 size/hit/miss/hit_rate/ttl 的字典
    """
    stats = _V_CODE_CACHE.stats()
    stats["js_engine_ready"] = _JS_ENGINE is not None
    stats["ths_js_loaded"] = _THS_JS_CONTENT_CACHE is not None
    return stats


__all__ = [
    "generate_hexin_v",
    "build_ths_headers",
    "invalidate_cache",
    "reset_engine",
    "cache_stats",
]
