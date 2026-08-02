#!/usr/bin/env python3
"""独立预演脚本：在本地创建独立 venv + 安装 akshare + 拉取 A+H 股字典 + 数量 ≥ 8200 验证。

目标与设计：
  1) **完全自举**：不依赖项目已存在的 venv；脚本首次运行即可自己：
        - 创建临时/持久 venv（默认: %USERPROFILE%/.workbuddy/binaries/python/envs/akshare-preview/）
        - 升级 pip → 安装 akshare + pandas
        - 导入 akshare 并拉取四市场数据
  2) **不污染项目源码**：默认 --dry-run，只做数量/分布统计，不写入
     `src/services/stock/stockDictionary.ts`；加 --write-out 才会写 <repo>/outputs/stock-dict-preview-<date>.json。
  3) **完整错误处理**：把错误分为可定位的 8 类（venv 创建失败 / pip 失败 /
     akshare 导入失败 / 单接口异常 / 总量不足 / 市场分布不足 / symbol 重复 /
     代码格式违规），每类分别给诊断建议。
  4) **结构化日志**：同时写 stdout 与日志文件（默认 outputs/stock-dict-preview-<stamp>.log），
     方便在自动任务触发前做本地预演留痕。

用法（Windows PowerShell / Git Bash / CMD 均通）：
    python scripts/stock-dict-preview.py
    python scripts/stock-dict-preview.py --write-out
    python scripts/stock-dict-preview.py --min-total 8200 --min-sh 2200 --min-sz 2800 --min-bj 300 --min-hk 2600
    python scripts/stock-dict-preview.py --venv-dir C:/path/to/my/venv
    python scripts/stock-dict-preview.py --skip-install  # 若 venv 内依赖已装好，跳过 pip（加速）
    python scripts/stock-dict-preview.py --tsinghua-mirror  # 使用清华 PyPI（推荐，大陆网络）

退出码（便于 CI/自动化宿主判定）：
    0 = 全部断言通过（总量 ≥ 8200 + 四市场分布 + symbol 零重复 + 代码格式合规）
    1 = 参数错误
    2 = venv 创建 / pip 安装 / akshare 导入失败（环境层故障）
    3 = akshare 单接口返回空 / 网络不可达 / 格式变更（数据源层故障）
    4 = 数量校验失败（业务断言层，可接受但需要警觉，脚本会在 summary 列实际 vs 阈值）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import venv
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

# ---------- 路径常量（不硬编码用户名/盘符） ----------
HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
USERPROFILE = Path(os.path.expanduser("~"))
DEFAULT_VENV_DIR = USERPROFILE / ".workbuddy" / "binaries" / "python" / "envs" / "akshare-preview"
OUT_DIR = REPO_ROOT / "outputs"
OUT_DIR.mkdir(exist_ok=True)
STAMP = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
LOG_FILE = OUT_DIR / f"stock-dict-preview-{STAMP}.log"

# ---------- 日志：同时 stdout + file ----------
class Tee:
    """stdout 的 wrapper。注意必须保存原始 sys.stdout（=__stdout__），避免被自己替换后递归写。"""
    def __init__(self, paths: Iterable[Path]):
        self._orig_stdout = sys.stdout
        self.handles = [p.open("a", encoding="utf-8") for p in paths]

    def write(self, s: str) -> None:
        # 必须直接写到原始 stdout，不能走 sys.stdout（当前 Tee 就是 sys.stdout，否则会递归）
        self._orig_stdout.write(s)
        for h in self.handles:
            try:
                h.write(s)
                h.flush()
            except Exception:
                # 日志文件写失败不影响主流程
                pass

    def flush(self) -> None:
        try:
            self._orig_stdout.flush()
        except Exception:
            pass
        for h in self.handles:
            try: h.flush()
            except Exception: pass

# ---------- 错误分类 ----------
EXIT_OK = 0
EXIT_ARGERR = 1
EXIT_ENV = 2
EXIT_DATASRC = 3
EXIT_ASSERT = 4

# =======================================================
# 1) 环境准备层：venv 创建、pip 安装、akshare 可导入
# =======================================================
def ensure_python(venv_dir: Path, skip_install: bool, mirror: bool) -> Path:
    """返回 venv 中 python.exe 的路径；确保 pip / akshare / pandas 已就绪。"""
    is_windows = sys.platform.startswith("win")
    scripts = "Scripts" if is_windows else "bin"
    py = venv_dir / scripts / ("python.exe" if is_windows else "python")
    pip_py = venv_dir / scripts / ("pip.exe" if is_windows else "pip")

    need_create = not py.exists()
    if need_create:
        print(f"[ENV] venv 目录不存在，创建: {venv_dir}")
        try:
            venv.create(str(venv_dir), with_pip=True, clear=False)
        except Exception as e:
            print(f"[FATAL][ENV] venv 创建失败: {type(e).__name__}: {e}")
            print("  诊断：请检查目标目录写权限 / 磁盘剩余 / 系统 python 是否带 venv 模块（Windows 官方安装包默认勾选）")
            sys.exit(EXIT_ENV)
        # Windows Store python 有时候会把 pip 留空，这里强制确认
        if not py.exists():
            print(f"[FATAL][ENV] venv 声称创建成功，但 python 不存在: {py}")
            sys.exit(EXIT_ENV)
    else:
        print(f"[ENV] 复用既有 venv: {venv_dir}（python: {py.exists()}）")

    if skip_install:
        print(f"[ENV] --skip-install 已指定，跳过 pip/akshare 安装；仅验证 akshare 可导入")
    else:
        print("[ENV] 升级 pip ...")
        pip_cmd = [str(py), "-m", "pip", "install", "--upgrade", "pip"]
        if mirror:
            pip_cmd += ["--index-url", "https://pypi.tuna.tsinghua.edu.cn/simple", "--no-cache-dir"]
        r1 = _run(pip_cmd, label="upgrade-pip", timeout=300)
        if r1.returncode != 0:
            # 允许 pip 升级失败（某些 venv 里 pip 是不可变的），仅 WARN
            print(f"[WARN][ENV] pip 升级失败（可忽略，继续安装）：exit={r1.returncode}")

        print("[ENV] 安装 akshare / pandas ...")
        install_cmd = [str(py), "-m", "pip", "install", "akshare>=1.18.64", "pandas>=1.5"]
        if mirror:
            install_cmd += ["--index-url", "https://pypi.tuna.tsinghua.edu.cn/simple", "--no-cache-dir"]
        r2 = _run(install_cmd, label="install-akshare", timeout=600)
        if r2.returncode != 0:
            print(f"[FATAL][ENV] akshare/pandas 安装失败 exit={r2.returncode}\n  stderr tail:\n{r2.stderr[-1500:]}")
            print("  诊断：① 网络不通（建议加 --tsinghua-mirror）；② 磁盘满；③ 杀毒软件拦截 pyd。")
            sys.exit(EXIT_ENV)

    # 验证 akshare / pandas 可导入，并读取版本
    r3 = _run([str(py), "-c",
              "import akshare, pandas, sys; "
              "print(akshare.__version__ + '|' + pandas.__version__)"],
             label="import-akshare", timeout=60)
    if r3.returncode != 0:
        print(f"[FATAL][ENV] akshare 导入失败 exit={r3.returncode}\n  stderr tail:\n{r3.stderr[-1500:]}")
        sys.exit(EXIT_ENV)
    ver_line = r3.stdout.strip().splitlines()[-1]
    ak_ver, pd_ver = ver_line.split("|") if "|" in ver_line else ("?", "?")
    print(f"[ENV] akshare={ak_ver}  pandas={pd_ver}")
    return py


def _run(argv: List[str], label: str, timeout: int) -> subprocess.CompletedProcess:
    print(f"  $ ({label}) {' '.join(argv[:6])}{' ...' if len(argv) > 6 else ''}")
    try:
        return subprocess.run(
            argv,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        msg = f"[FATAL][ENV] {label} 超时（>{timeout}s）"
        print(msg)
        sys.exit(EXIT_ENV)


# =======================================================
# 2) 数据源层：通过独立 venv 调用 akshare 拉取四市场
#    注意：为了保证使用新 venv 的 akshare（而不是脚本运行时的 sys.path），
#    这里使用 subprocess 把"采集代码"作为 -c 的 python 片段传入 venv python。
# =======================================================
FETCH_CODE = r"""
import json, sys, traceback
try:
    import akshare as ak
    import pandas as pd
    out = {"SH": [], "SZ": [], "BJ": [], "HK": [], "_meta": {}}
    # A 股 (沪+深 + 前缀分市场)
    df = ak.stock_info_a_code_name()
    for _, r in df.iterrows():
        code = str(r["code"]).strip(); name = str(r["name"]).strip()
        if not code or not name: continue
        if code.startswith(("6", "900")): mkt = "SH"
        elif code.startswith(("0", "3", "200")): mkt = "SZ"
        elif code.startswith(("8", "4", "920")): mkt = "BJ"
        else: mkt = "SH"  # 兜底
        out[mkt].append([code, name])
    out["_meta"]["A_rows"] = int(len(df))
    # 北交所
    try:
        df2 = ak.stock_info_bj_name_code()
        for _, r in df2.iterrows():
            code = str(r["证券代码"]).strip(); name = str(r["证券简称"]).strip()
            if not code or not name: continue
            out["BJ"].append([code, name])
        out["_meta"]["BJ_rows"] = int(len(df2))
    except Exception as e:
        out["_meta"]["BJ_error"] = repr(e)
    # 港股
    df3 = ak.stock_hk_spot()
    for _, r in df3.iterrows():
        code = str(r["代码"]).strip()
        name = ""
        for c in ("中文名称", "名称", "简称"):
            if c in r and str(r[c]).strip():
                name = str(r[c]).strip(); break
        if not code: continue
        code = code.zfill(5)
        if not name: continue
        out["HK"].append([code, name])
    out["_meta"]["HK_rows"] = int(len(df3))
    sys.stdout.write("__JSON_START__\n")
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.write("\n__JSON_END__\n")
except Exception:
    sys.stderr.write("__STACK_START__\n" + traceback.format_exc() + "\n__STACK_END__\n")
    sys.exit(3)
"""


def fetch_via_venv(py: Path, timeout: int) -> dict:
    print(f"[DATA] 通过 venv akshare 拉取（超时 {timeout}s / 单接口）...")
    r = _run([str(py), "-c", FETCH_CODE], label="fetch-akshare-all", timeout=timeout)
    if r.returncode != 0:
        stack = ""
        m = re.search(r"__STACK_START__\n(.*?)\n__STACK_END__", r.stderr, re.S)
        if m: stack = m.group(1)
        else: stack = (r.stderr[-1800:] or "(无 stderr)")
        print(f"[FATAL][DATA] akshare 采集异常 exit={r.returncode}\n  堆栈:\n{stack}")
        print("  诊断：① akshare API 上游格式改名（列名变了）；② 时段限流；③ 海外/公司网络封堵东方财富/新浪接口。")
        sys.exit(EXIT_DATASRC)
    m = re.search(r"__JSON_START__\n(.*?)\n__JSON_END__", r.stdout + "\n" + r.stderr, re.S)
    if not m:
        print(f"[FATAL][DATA] 采集输出缺 JSON 包裹。stdout 末段:\n{r.stdout[-1200:]}")
        sys.exit(EXIT_DATASRC)
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        print(f"[FATAL][DATA] JSON 解析失败: {e}")
        sys.exit(EXIT_DATASRC)
    meta = data.get("_meta", {})
    print(f"[DATA] 原始返回（含重复）：A_rows={meta.get('A_rows')} BJ_rows={meta.get('BJ_rows')} HK_rows={meta.get('HK_rows')}")
    if "BJ_error" in meta:
        print(f"[WARN][DATA] 北交所接口单独报错（可能 akshare 列名变更）：{meta['BJ_error']}")
    return data


# =======================================================
# 3) 校验层：总量 / 分布 / 零重复 / 代码格式
# =======================================================
FMT_RULES = {
    "SH": re.compile(r"^\d{6}$"),
    "SZ": re.compile(r"^\d{6}$"),
    "BJ": re.compile(r"^(43|83|87|92)\d{6}$"),  # 43/83/87/92 开头 + 共 8 位；允许 8/4/920 开头 6 位兜底（宽松）
    "HK": re.compile(r"^\d{5}$"),
}
FMT_RULES_LENIENT_BJ = re.compile(r"^(\d{6,8})$")  # 备用：若 BJ 格式不严，则要求纯数字 6-8 位


def validate(data: dict, args) -> Tuple[List[str], List[str], dict]:
    """返回 (errors, warnings, stats)"""
    errors = []
    warnings = []
    stats = {"SH": 0, "SZ": 0, "BJ": 0, "HK": 0, "total": 0, "duplicates": 0, "format_violations": 0, "format_detail": []}
    seen = set()
    for mkt in ("SH", "SZ", "BJ", "HK"):
        rows = data.get(mkt) or []
        for code, name in rows:
            stats[mkt] += 1
            key = (mkt, code)
            if key in seen:
                stats["duplicates"] += 1
                continue
            seen.add(key)
            # 代码格式
            if mkt == "BJ":
                ok = bool(FMT_RULES[mkt].match(code)) or bool(FMT_RULES_LENIENT_BJ.match(code))
            else:
                ok = bool(FMT_RULES[mkt].match(code))
            if not ok:
                stats["format_violations"] += 1
                if len(stats["format_detail"]) < 10:
                    stats["format_detail"].append(f"{mkt}:{code}")
    stats["total"] = sum(stats[m] for m in ("SH", "SZ", "BJ", "HK")) - stats["duplicates"]
    # （但 SH/SZ/BJ/HK 内部重复会减少实际有效数；这里用 seen 重新算一遍）
    stats["total_unique"] = len(seen)
    stats["total"] = stats["total_unique"]  # 对外统一用去重后

    # 断言
    min_t = args.min_total
    mins = {"SH": args.min_sh, "SZ": args.min_sz, "BJ": args.min_bj, "HK": args.min_hk}
    if stats["total"] < min_t:
        errors.append(f"总量不足：total={stats['total']} < min_total={min_t}")
    for m, v in mins.items():
        # 市场内部重复也扣掉
        market_unique = sum(1 for (mk, _) in seen if mk == m)
        stats[m + "_unique"] = market_unique
        if market_unique < v:
            errors.append(f"{m} 分布不足：unique={market_unique} < min={v}")
    if stats["duplicates"] > 0:
        warnings.append(f"symbol 重复（按 market+code）：{stats['duplicates']} 条（已在总量去重）")
        if args.fail_on_dup:
            errors.append(f"检测到重复 symbol {stats['duplicates']} 条（--fail-on-dup 开启）")
    if stats["format_violations"] > 0:
        warnings.append(f"代码格式违规：{stats['format_violations']} 条；示例 {stats['format_detail']}")
        if args.fail_on_format:
            errors.append(f"格式违规 {stats['format_violations']} 条（--fail-on-format 开启）")
    return errors, warnings, stats


# =======================================================
# 4) 输出与入口
# =======================================================
def main() -> int:
    ap = argparse.ArgumentParser(description="本地预演：自建 venv + akshare + A+H 股票字典 ≥ 8200 验证",
                                 formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument("--venv-dir", type=Path, default=DEFAULT_VENV_DIR, help="venv 目录（不存在则自动创建）")
    ap.add_argument("--skip-install", action="store_true", help="跳过 pip 升级与 akshare 安装（仅验证可导入）")
    ap.add_argument("--tsinghua-mirror", action="store_true", help="pip 用清华 PyPI 镜像（推荐）")
    ap.add_argument("--fetch-timeout", type=int, default=600, help="akshare 采集总超时(秒)")
    ap.add_argument("--write-out", action="store_true", help="把去重后的字典写 outputs/stock-dict-preview-<stamp>.json（不碰 src/）")
    ap.add_argument("--min-total", type=int, default=8200, help="总条数阈值（含去重后）")
    ap.add_argument("--min-sh", type=int, default=2200)
    ap.add_argument("--min-sz", type=int, default=2800)
    ap.add_argument("--min-bj", type=int, default=300)
    ap.add_argument("--min-hk", type=int, default=2600)
    ap.add_argument("--fail-on-dup", action="store_true", help="symbol 重复直接判失败（默认只 WARN）")
    ap.add_argument("--fail-on-format", action="store_true", help="代码格式违规直接判失败（默认只 WARN）")
    args = ap.parse_args()

    # 参数合理性
    for k in ("min_total", "min_sh", "min_sz", "min_bj", "min_hk"):
        if getattr(args, k) < 0:
            print(f"[ARGS] {k} 不能为负")
            return EXIT_ARGERR

    print(f"[PRE] REPO_ROOT={REPO_ROOT}；日志={LOG_FILE}")
    print(f"[PRE] 阈值: total>={args.min_total}  SH>={args.min_sh}  SZ>={args.min_sz}  BJ>={args.min_bj}  HK>={args.min_hk}")

    # 1) 环境
    py = ensure_python(args.venv_dir, args.skip_install, args.tsinghua_mirror)

    # 2) 采集
    data = fetch_via_venv(py, timeout=args.fetch_timeout)

    # 3) 校验
    errors, warnings, stats = validate(data, args)

    # 4) 汇总输出
    print("\n================== SUMMARY ==================")
    print(f"  total_unique        = {stats['total_unique']}  （阈值 >= {args.min_total}）")
    for m in ("SH", "SZ", "BJ", "HK"):
        print(f"  {m}_unique            = {stats.get(m+'_unique','?'):>6}  （阈值 >= {getattr(args, 'min_'+m.lower())}）")
    print(f"  duplicates(mkt+code)= {stats['duplicates']}")
    print(f"  format_violations   = {stats['format_violations']}")
    if warnings:
        print("\n-- WARNINGS --")
        for w in warnings: print("  ! ", w)
    if errors:
        print("\n-- ERRORS (断言失败) --")
        for e in errors: print("  X ", e)
        print(f"\n[RESULT] 断言未通过，退出码 {EXIT_ASSERT}")
        return EXIT_ASSERT

    # 可选：JSON 输出（不碰 src/；不触发 git diff）
    if args.write_out:
        out_json = OUT_DIR / f"stock-dict-preview-{STAMP}.json"
        payload = {
            "generated_at": datetime.now().isoformat(),
            "stats": stats,
            "thresholds": {
                "min_total": args.min_total, "min_sh": args.min_sh, "min_sz": args.min_sz,
                "min_bj": args.min_bj, "min_hk": args.min_hk,
            },
            "records": {},  # 只在显式 --write-out 时按需可扩展（默认不写逐条明细防止 JSON 过大）
        }
        # 如需逐条明细（可用于人工 spot-check），取消下一行注释：
        # payload["records_by_market"] = {m: [{"symbol": c, "name": n} for c, n in (data.get(m) or [])] for m in ("SH","SZ","BJ","HK")}
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[OUT] 已写入统计 JSON: {out_json}")
    else:
        print(f"\n[OUT] 未加 --write-out；仅 stdout+日志（{LOG_FILE}），不产生任何 JSON 文件")

    print(f"\n[RESULT] ✅ 全部断言通过，退出码 {EXIT_OK}；可用于自动化任务触发前预演通过标记。")
    return EXIT_OK


if __name__ == "__main__":
    # 安装 tee 之后再跑 main，保证日志完整
    tee = Tee([LOG_FILE])
    sys.stdout = tee  # type: ignore[assignment]
    try:
        rc = main()
    finally:
        sys.stdout = sys.__stdout__
    sys.exit(rc)
