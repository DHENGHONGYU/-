"""
@module lib
@lifecycle @Global
@description 可复用工具模块 — 提取自 v2.1 回归测试修复的技术模式

@remarks
## 模块清单
- dynamic_match: 动态正则匹配（解决变量插值问题）
- timeout_utils: 超时控制（线程+Queue 模式）
- cache_utils: TTL + LRU 缓存

## 来源
提取自《技术复盘_v2.1回归测试修复_2026-07-03.md》

## 版本
v1.0.0 (2026-07-03)
"""

from .dynamic_match import escape_regex, dynamic_match, DynamicRegexBuilder
from .timeout_utils import (
    TimeoutError as CallTimeoutError,
    call_with_timeout,
    call_with_timeout_and_retry,
)
from .cache_utils import TTL_LRUCache, cached, CachedAPIClient

__all__ = [
    # 动态正则
    "escape_regex",
    "dynamic_match",
    "DynamicRegexBuilder",
    # 超时控制
    "CallTimeoutError",
    "call_with_timeout",
    "call_with_timeout_and_retry",
    # 缓存
    "TTL_LRUCache",
    "cached",
    "CachedAPIClient",
]

__version__ = "1.0.0"
