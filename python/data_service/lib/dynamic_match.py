"""
@module lib/dynamic_match
@lifecycle @Global
@description 动态正则匹配工具 — 解决 JavaScript 字面量正则 `${var}` 不插值的 Python 等价问题

@remarks
## 背景
JavaScript 中字面量正则 `/v_${var}=/` 不会插值，导致静默匹配失败。
Python 中虽无此问题（re.compile 接受字符串），但仍需统一动态正则构造模式，
避免转义遗漏和注入风险。

## 核心功能
- dynamic_match: 动态构造正则并匹配
- escape_regex: 转义正则特殊字符
- DynamicRegexBuilder: 链式构造复杂正则

@see 技术复盘_v2.1回归测试修复_2026-07-03.md 第二章
"""

import re
from typing import Optional, AnyStr, Pattern


def escape_regex(text: str) -> str:
    """
    转义字符串中的正则特殊字符

    Args:
        text: 待转义的字符串

    Returns:
        转义后的字符串（正则安全）

    Example:
        >>> escape_regex("sh600519")
        'sh600519'
        >>> escape_regex("v$.519")
        'v\\$\\.519'
    """
    return re.escape(text)


def dynamic_match(
    text: str,
    pattern: str,
    variables: dict[str, str],
    flags: int = 0,
) -> Optional[re.Match]:
    """
    动态构造正则并匹配（支持变量插值 + 自动转义）

    Args:
        text: 待匹配文本
        pattern: 含 ${var} 占位符的模式模板
        variables: 变量键值对
        flags: 正则标志（如 re.IGNORECASE）

    Returns:
        Match 对象或 None

    Example:
        >>> match = dynamic_match(
        ...     'v_sh600519="1~maotai~600519"',
        ...     'v_${code}="([^"]+)"',
        ...     {'code': 'sh600519'}
        ... )
        >>> match.group(1) if match else None
        '1~maotai~600519'
    """
    resolved = pattern
    for key, value in variables.items():
        # 转义 value 中的正则特殊字符，防止注入
        escaped = escape_regex(str(value))
        resolved = resolved.replace(f"${{{key}}}", escaped)

    try:
        regex = re.compile(resolved, flags)
        return regex.search(text)
    except re.error as e:
        # 正则编译失败时返回 None，避免静默异常
        return None


class DynamicRegexBuilder:
    """
    链式正则构造器（用于复杂动态正则）

    Example:
        >>> regex = (
        ...     DynamicRegexBuilder()
        ...     .literal("v_")
        ...     .variable("code")
        ...     .literal('="')
        ...     .capture(r'[^"]+')
        ...     .literal('"')
        ...     .build({"code": "sh600519"})
        ... )
        >>> match = regex.search('v_sh600519="data"')
    """

    def __init__(self):
        self._parts: list[str] = []
        self._variables: set[str] = set()

    def literal(self, text: str) -> "DynamicRegexBuilder":
        """添加字面量（自动转义）"""
        self._parts.append(escape_regex(text))
        return self

    def variable(self, name: str) -> "DynamicRegexBuilder":
        """添加变量占位符（运行时转义）"""
        self._variables.add(name)
        self._parts.append(f"__VAR_{name}__")
        return self

    def raw(self, pattern: str) -> "DynamicRegexBuilder":
        """添加原始正则片段（不转义）"""
        self._parts.append(pattern)
        return self

    def capture(self, pattern: str) -> "DynamicRegexBuilder":
        """添加捕获组（原始正则）"""
        self._parts.append(f"({pattern})")
        return self

    def build(self, variables: dict[str, str], flags: int = 0) -> Pattern[str]:
        """
        构造最终正则

        Args:
            variables: 变量键值对
            flags: 正则标志

        Returns:
            编译后的正则对象

        Raises:
            KeyError: 缺少变量
            re.error: 正则编译失败
        """
        # 检查所有变量都已提供
        missing = self._variables - set(variables.keys())
        if missing:
            raise KeyError(f"缺少变量: {missing}")

        # 替换变量占位符（转义值）
        parts = []
        for part in self._parts:
            if part.startswith("__VAR_") and part.endswith("__"):
                var_name = part[6:-2]
                parts.append(escape_regex(str(variables[var_name])))
            else:
                parts.append(part)

        return re.compile("".join(parts), flags)


__all__ = ["escape_regex", "dynamic_match", "DynamicRegexBuilder"]
