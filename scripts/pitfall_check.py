#!/usr/bin/env python3
"""
@module scripts/pitfall_check.py
@lifecycle @Global
@description 踩坑规则门禁检查脚本 — 在代码提交前自动检查 4 条规则

@remarks
## 检查规则（来自踩坑备忘录 #11-#14）
1. 正则动态构造：检测字面量正则中的 ${var}（JS）/ 错误的字符串插值（Python）
2. 第三方库调用超时：检测 AKShare 调用是否有 call_with_timeout 包装
3. TTL+LRU 缓存：检测频繁调用的 API 是否有缓存
4. 降级路径限制：检测降级层数是否 ≤2

## 使用方式
    python scripts/pitfall_check.py [path1 path2 ...]

不传 path 时默认检查 git 暂存区文件。

## 退出码
- 0: 全部通过
- 1: 存在违规（阻止提交）

@see 踩坑备忘录.md #11-#14
@see 技术复盘_v2.1回归测试修复_2026-07-03.md 第五章
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


# ============================================================
# 数据结构
# ============================================================

@dataclass
class Violation:
    """违规记录"""
    rule_id: str
    rule_name: str
    file_path: str
    line_number: int
    line_content: str
    severity: str  # ERROR / WARN
    suggestion: str


@dataclass
class CheckResult:
    """检查结果"""
    total_files: int = 0
    total_violations: int = 0
    errors: int = 0
    warnings: int = 0
    violations: list[Violation] = field(default_factory=list)

    def add(self, v: Violation) -> None:
        self.violations.append(v)
        self.total_violations += 1
        if v.severity == "ERROR":
            self.errors += 1
        else:
            self.warnings += 1

    @property
    def passed(self) -> bool:
        return self.errors == 0


# ============================================================
# 工具函数
# ============================================================

def get_staged_files() -> list[Path]:
    """获取 git 暂存区文件列表"""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True, text=True, encoding="utf-8",
        )
        if result.returncode != 0:
            return []
        return [Path(f) for f in result.stdout.strip().split("\n") if f]
    except Exception:
        return []


def read_file_lines(path: Path) -> list[str]:
    """读取文件行（容错）"""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.readlines()
    except Exception:
        return []


def filter_code_lines(lines: list[str]) -> list[tuple[int, str]]:
    """
    过滤出有效代码行（排除注释、空行、docstring 内的行）

    Returns:
        [(line_number, line_content), ...] 仅包含有效代码行
    """
    result = []
    in_docstring = False
    docstring_marker = None

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # 跳过注释和空行
        if stripped.startswith("#") or not stripped:
            continue

        # docstring 状态跟踪
        if not in_docstring:
            for marker in ('"""', "'''"):
                if marker in line:
                    if line.count(marker) >= 2:
                        # 单行 docstring，跳过本行
                        break
                    else:
                        in_docstring = True
                        docstring_marker = marker
                        break
            else:
                # 非 docstring 行，加入结果
                result.append((i, line))
                continue
            continue  # docstring 开始行，跳过
        else:
            # 在 docstring 内
            if docstring_marker and docstring_marker in line:
                in_docstring = False
                docstring_marker = None
            continue

    return result


def is_python_file(path: Path) -> bool:
    return path.suffix == ".py"


def is_js_ts_file(path: Path) -> bool:
    return path.suffix in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")


# ============================================================
# 规则 11: 正则动态构造检查
# ============================================================

def check_regex_dynamic_construction(path: Path, lines: list[str], result: CheckResult) -> None:
    """
    规则 11: 检测字面量正则中的 ${var}（JS）

    JS 中 /v_${var}=/ 不会插值，必须用 new RegExp()
    Python 中 re.compile(f"v_{var}=") 是正确的，但 re.compile("v_${var}=") 不会插值
    """
    code_lines = filter_code_lines(lines)

    # JS/TS 文件：检测字面量正则中的 ${
    if is_js_ts_file(path):
        for i, line in code_lines:
            # 匹配字面量正则 /...${...}.../
            if re.search(r'/[^/]*\$\{[^}]+\}[^/]*/[gimsuy]*', line):
                result.add(Violation(
                    rule_id="11",
                    rule_name="正则动态构造",
                    file_path=str(path),
                    line_number=i,
                    line_content=line.rstrip(),
                    severity="ERROR",
                    suggestion="字面量正则中 ${var} 不会插值，请改用 new RegExp(`...${var}...`)",
                ))

    # Python 文件：检测 re.compile 中的 ${}（应为 f-string 或 .format）
    if is_python_file(path):
        for i, line in code_lines:
            # 检测 re.compile("...${...}...") — Python 中 ${} 不是插值语法
            if "re.compile" in line and "${" in line and "f\"" not in line and "f'" not in line:
                result.add(Violation(
                    rule_id="11",
                    rule_name="正则动态构造",
                    file_path=str(path),
                    line_number=i,
                    line_content=line.rstrip(),
                    severity="WARN",
                    suggestion="Python 中 re.compile('${var}') 不会插值，请改用 re.compile(f'{var}') 或字符串拼接",
                ))


# ============================================================
# 规则 12: 第三方库调用超时检查
# ============================================================

# 需要超时控制的第三方库函数
TIMEOUT_REQUIRED_FUNCS = [
    "stock_zh_a_spot_em",
    "stock_zh_a_daily",
    "stock_individual_info_em",
    "stock_financial_em",
    "stock_news_em",
    "requests.get",
    "requests.post",
    "urlopen",
]

def check_timeout_control(path: Path, lines: list[str], result: CheckResult) -> None:
    """
    规则 12: 检测 AKShare/requests 调用是否有超时控制

    检查模式：
    - 直接调用 ak.xxx() 而无 call_with_timeout 包装 → ERROR
    - requests.get() 无 timeout 参数 → ERROR
    """
    if not is_python_file(path):
        return

    code_lines = filter_code_lines(lines)

    for i, line in code_lines:
        # 检测 requests.get/post 无 timeout
        if re.search(r'requests\.(get|post|put|delete)\s*\(', line):
            if "timeout=" not in line and "timeout =" not in line:
                # 检查是否在 call_with_timeout 内（粗略检查上下文）
                context = "\n".join(lines[max(0, i-3):i])
                if "call_with_timeout" not in context:
                    result.add(Violation(
                        rule_id="12",
                        rule_name="第三方库调用超时",
                        file_path=str(path),
                        line_number=i,
                        line_content=line.rstrip(),
                        severity="ERROR",
                        suggestion="requests 调用必须设置 timeout 参数，或用 call_with_timeout 包装",
                    ))

        # 检测 AKShare 函数直接调用（无 call_with_timeout 包装）
        for func in TIMEOUT_REQUIRED_FUNCS:
            if func.startswith("stock_"):
                # AKShare 函数：检测 ak.xxx() 直接调用
                pattern = rf'\bak\.{func}\s*\('
                if re.search(pattern, line):
                    # 检查上下文是否有 call_with_timeout
                    context = "\n".join(lines[max(0, i-5):i+1])
                    if "call_with_timeout" not in context and "call_with_timeout_and_retry" not in context:
                        result.add(Violation(
                            rule_id="12",
                            rule_name="第三方库调用超时",
                            file_path=str(path),
                            line_number=i,
                            line_content=line.rstrip(),
                            severity="WARN",
                            suggestion=f"AKShare {func} 调用建议用 call_with_timeout 包装，防止无限等待",
                        ))


# ============================================================
# 规则 13: TTL+LRU 缓存检查
# ============================================================

# 需要缓存的频繁调用函数
CACHE_REQUIRED_FUNCS = [
    "stock_zh_a_spot_em",
    "stock_zh_a_daily",
    "stock_individual_info_em",
]

def check_cache_strategy(path: Path, lines: list[str], result: CheckResult) -> None:
    """
    规则 13: 检测频繁调用的 API 是否有缓存

    检查模式：
    - 文件中调用 stock_zh_a_spot_em 等函数，但无 @cached 装饰器或 TTL_LRUCache
    """
    if not is_python_file(path):
        return

    code_lines = filter_code_lines(lines)
    file_content = "".join(lines)
    has_cache = any(marker in file_content for marker in [
        "@cached", "TTL_LRUCache", "_KLINE_CACHE", "_SPOT_CACHE",
        "call_with_cache", "CachedAPIClient",
    ])

    for i, line in code_lines:
        for func in CACHE_REQUIRED_FUNCS:
            if f"ak.{func}" in line or f"akshare.{func}" in line:
                if not has_cache:
                    result.add(Violation(
                        rule_id="13",
                        rule_name="TTL+LRU 缓存",
                        file_path=str(path),
                        line_number=i,
                        line_content=line.rstrip(),
                        severity="WARN",
                        suggestion=f"频繁调用的 {func} 建议添加 @cached 装饰器或 TTL_LRUCache",
                    ))


# ============================================================
# 规则 14: 降级路径限制检查
# ============================================================

def check_degradation_depth(path: Path, lines: list[str], result: CheckResult) -> None:
    """
    规则 14: 检测降级层数是否 ≤2

    检查模式：
    - 文件中出现 3 个及以上 except 块串联（粗略估计降级层数）
    - 文件中出现 "第3层" / "第4层" / "第3层降级" 等关键词
    """
    if not is_python_file(path):
        return

    code_lines = filter_code_lines(lines)

    # 检测显式的"第N层"标记
    for i, line in code_lines:
        if re.search(r'第[3-9]层|第三层|第四层|第五层', line):
            result.add(Violation(
                rule_id="14",
                rule_name="降级路径限制",
                file_path=str(path),
                line_number=i,
                line_content=line.rstrip(),
                severity="WARN",
                suggestion="降级路径建议 ≤2 层，避免延迟累积。部分可用优于完全不可用",
            ))

    # 统计 except 块数量（粗略估计降级层数，基于过滤后的代码行）
    except_count = sum(1 for _, line in code_lines if line.strip().startswith("except "))
    if except_count >= 4:
        try_count = sum(1 for _, line in code_lines if line.strip().startswith("try:"))
        if try_count >= 3:
            result.add(Violation(
                rule_id="14",
                rule_name="降级路径限制",
                file_path=str(path),
                line_number=1,
                line_content=f"<file> except_count={except_count} try_count={try_count}",
                severity="WARN",
                suggestion=f"文件中有 {try_count} 个 try 块 + {except_count} 个 except 块，降级路径可能过深（建议 ≤2 层）",
            ))


# ============================================================
# 主检查流程
# ============================================================

CHECKERS = [
    ("11", "正则动态构造", check_regex_dynamic_construction),
    ("12", "第三方库调用超时", check_timeout_control),
    ("13", "TTL+LRU 缓存", check_cache_strategy),
    ("14", "降级路径限制", check_degradation_depth),
]


def check_file(path: Path, result: CheckResult) -> None:
    """检查单个文件"""
    if not path.exists():
        return

    # 只检查 Python 和 JS/TS 文件
    if not (is_python_file(path) or is_js_ts_file(path)):
        return

    lines = read_file_lines(path)
    if not lines:
        return

    result.total_files += 1

    for rule_id, rule_name, checker in CHECKERS:
        try:
            checker(path, lines, result)
        except Exception as e:
            print(f"  [WARN] 检查器 {rule_name} 异常: {e}", file=sys.stderr)


def check_paths(paths: list[Path]) -> CheckResult:
    """检查多个路径"""
    result = CheckResult()

    for path in paths:
        if path.is_file():
            check_file(path, result)
        elif path.is_dir():
            for root, dirs, files in os.walk(path):
                # 跳过 node_modules / .git / __pycache__ 等
                dirs[:] = [d for d in dirs if d not in {
                    "node_modules", ".git", "__pycache__", ".next",
                    "dist", "build", ".cache",
                }]
                for f in files:
                    check_file(Path(root) / f, result)

    return result


def print_report(result: CheckResult) -> None:
    """打印检查报告"""
    print("=" * 70)
    print("踩坑规则门禁检查报告")
    print("=" * 70)
    print(f"检查文件数: {result.total_files}")
    print(f"违规总数: {result.total_violations} (ERROR: {result.errors}, WARN: {result.warnings})")
    print()

    if not result.violations:
        print("✅ 全部通过，未检测到违规")
        return

    # 按规则分组
    by_rule: dict[str, list[Violation]] = {}
    for v in result.violations:
        by_rule.setdefault(v.rule_id, []).append(v)

    for rule_id in sorted(by_rule.keys()):
        vs = by_rule[rule_id]
        rule_name = vs[0].rule_name
        print(f"--- 规则 #{rule_id}: {rule_name} ({len(vs)} 项) ---")
        for v in vs:
            icon = "❌" if v.severity == "ERROR" else "⚠️"
            print(f"  {icon} {v.file_path}:{v.line_number}")
            print(f"     代码: {v.line_content[:100]}")
            print(f"     建议: {v.suggestion}")
        print()

    print("=" * 70)
    if result.errors > 0:
        print(f"❌ 检查未通过: {result.errors} 个 ERROR 违规，已阻止提交")
        print("   修复 ERROR 项后重新提交，或使用 --no-verify 跳过检查（不推荐）")
    else:
        print(f"✅ 检查通过: 0 个 ERROR, {result.warnings} 个 WARN（不阻止提交）")


def main() -> int:
    """主入口"""
    # 解析参数
    args = sys.argv[1:]

    if args:
        # 显式指定路径
        paths = [Path(a) for a in args]
    else:
        # 默认检查 git 暂存区
        paths = get_staged_files()
        if not paths:
            print("[pitfall_check] 无暂存文件，跳过检查")
            return 0

    # 只检查存在的路径
    paths = [p for p in paths if p.exists()]

    if not paths:
        print("[pitfall_check] 无待检查文件")
        return 0

    print(f"[pitfall_check] 检查 {len(paths)} 个文件...")

    result = check_paths(paths)
    print_report(result)

    return 0 if result.passed else 1


if __name__ == "__main__":
    sys.exit(main())
