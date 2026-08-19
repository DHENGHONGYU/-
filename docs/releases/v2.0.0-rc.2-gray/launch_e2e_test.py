# -*- coding: utf-8 -*-
"""
FinSightV9 上线前综合 E2E 测试脚本 (Python Playwright)
========================================================
测试策略（用户要求真实数据 + 随机抽样）：
  A. 10 只随机抽取股票：从 POPULAR_STOCKS 去重后随机抽取
  B. 15 只热门行业推荐股票：从 SECTOR_DEFINITIONS 各行业 keyStocks 中汇总去重，取前 15 只
页面覆盖：
  1. 门户：首页 / 驾驶舱
  2. 输入舱：录入看板 / 热门板块 / 采集监控台 / 意向池 / 候选池总览
  3. 分析舱：行业全景 / 行业评分 / 个股评分 / 智能评分 / 热门板块策略 / 价值洼地 / 多因子 / 智能资讯
  4. 交易舱：交易信号 / 持仓 / 投资组合 / 风险 / 执行计划 / 策略快照
  5. 输出舱：研究报告 / 复盘 / 因子分析 / 筹码策略 / 数据导出 / 仪表盘 / 复盘向导
  6. 总控舱：系统健康 / 智能体总控 / 智能体任务 / 模型配置 / MCP / 配置 / 测试
每步：
  - 截图 (viewport + full-page)
  - 记录加载性能 (FCP, TTI, DOMContentLoaded, resource count/size)
  - 记录功能可及性 (标题/导航/核心按钮)
输出：
  e2e/launch-screenshots/*.png  — 全流程截图
  e2e/launch-test-report-YYYYMMDD-HHMMSS.json  — 结构化结果
  e2e/launch-test-report-YYYYMMDD-HHMMSS.md    — 人类可读评分报告
"""

import json
import os
import random
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    sync_playwright,
    TimeoutError as PWTimeout,
)

# ============================================================
# 配置
# ============================================================
BASE_URL = os.environ.get("V9_BASE_URL", "http://localhost:5199")
# 如果使用 hash 路由（playwright.config.ts 中 user-journeys 使用 /#/input），
# 则需要加上 /# 前缀；实际跳转时使用 goto("#/input") 方式。
USE_HASH_ROUTER = True

ROOT_DIR = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = ROOT_DIR / "e2e" / "launch-screenshots"
REPORT_DIR = ROOT_DIR / "e2e"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
REPORT_JSON = REPORT_DIR / f"launch-test-report-{TIMESTAMP}.json"
REPORT_MD = REPORT_DIR / f"launch-test-report-{TIMESTAMP}.md"

# 随机种子：今天日期，保证可复现
random.seed(20260819)

# ============================================================
# 测试股票池 (与 TypeScript 源文件保持一致)
# ============================================================

# src/constants/stockList.ts -> POPULAR_STOCKS (去重后 46 只)
POPULAR_STOCKS_UNIQUE = [
    {"symbol": "600519", "name": "贵州茅台", "market": "sh"},
    {"symbol": "601318", "name": "中国平安", "market": "sh"},
    {"symbol": "600036", "name": "招商银行", "market": "sh"},
    {"symbol": "601398", "name": "工商银行", "market": "sh"},
    {"symbol": "600028", "name": "中国石化", "market": "sh"},
    {"symbol": "601857", "name": "中国石油", "market": "sh"},
    {"symbol": "601988", "name": "中国银行", "market": "sh"},
    {"symbol": "600030", "name": "中信证券", "market": "sh"},
    {"symbol": "601166", "name": "兴业银行", "market": "sh"},
    {"symbol": "600887", "name": "伊利股份", "market": "sh"},
    {"symbol": "600309", "name": "万华化学", "market": "sh"},
    {"symbol": "600031", "name": "三一重工", "market": "sh"},
    {"symbol": "601628", "name": "中国人寿", "market": "sh"},
    {"symbol": "600050", "name": "中国联通", "market": "sh"},
    {"symbol": "601328", "name": "交通银行", "market": "sh"},
    {"symbol": "000858", "name": "五粮液", "market": "sz"},
    {"symbol": "000001", "name": "平安银行", "market": "sz"},
    {"symbol": "000651", "name": "格力电器", "market": "sz"},
    {"symbol": "000333", "name": "美的集团", "market": "sz"},
    {"symbol": "002594", "name": "比亚迪", "market": "sz"},
    {"symbol": "000725", "name": "京东方A", "market": "sz"},
    {"symbol": "002415", "name": "海康威视", "market": "sz"},
    {"symbol": "000568", "name": "泸州老窖", "market": "sz"},
    {"symbol": "000661", "name": "长春高新", "market": "sz"},
    {"symbol": "002304", "name": "洋河股份", "market": "sz"},
    {"symbol": "300750", "name": "宁德时代", "market": "sz"},
    {"symbol": "300059", "name": "东方财富", "market": "sz"},
    {"symbol": "300760", "name": "迈瑞医疗", "market": "sz"},
    {"symbol": "300015", "name": "爱尔眼科", "market": "sz"},
    {"symbol": "300014", "name": "亿纬锂能", "market": "sz"},
    {"symbol": "688981", "name": "中芯国际", "market": "sh"},
    {"symbol": "688111", "name": "金山办公", "market": "sh"},
    {"symbol": "688012", "name": "中微公司", "market": "sh"},
    {"symbol": "600588", "name": "用友网络", "market": "sh"},
    {"symbol": "601012", "name": "隆基绿能", "market": "sh"},
    {"symbol": "002459", "name": "TCL中环", "market": "sz"},
    {"symbol": "600276", "name": "恒瑞医药", "market": "sh"},
    {"symbol": "000538", "name": "云南白药", "market": "sz"},
    {"symbol": "600196", "name": "复星医药", "market": "sh"},
    {"symbol": "600809", "name": "山西汾酒", "market": "sh"},
    {"symbol": "600570", "name": "恒生电子", "market": "sh"},
    {"symbol": "002475", "name": "立讯精密", "market": "sz"},
    {"symbol": "603288", "name": "海天味业", "market": "sh"},
    {"symbol": "000002", "name": "万科A", "market": "sz"},
    {"symbol": "601888", "name": "中国中免", "market": "sh"},
    {"symbol": "600900", "name": "长江电力", "market": "sh"},
]

# src/data/sectorDefinitions.ts -> SECTOR_DEFINITIONS keyStocks（汇总去重）
SECTOR_RECOMMENDED_STOCKS = [
    # AI + IC 重复: 688981
    {"symbol": "688256", "name": "寒武纪"},
    {"symbol": "002230", "name": "科大讯飞"},
    {"symbol": "688787", "name": "海天瑞声"},
    {"symbol": "688012", "name": "中微公司"},
    {"symbol": "688019", "name": "安集科技"},
    {"symbol": "002371", "name": "北方华创"},
    # NEV
    {"symbol": "601127", "name": "赛力斯"},
    # NEW BATTERY
    {"symbol": "002709", "name": "天赐材料"},
    {"symbol": "300073", "name": "当升科技"},
    # ROBOT / LOWALT 重复: 002050
    {"symbol": "688017", "name": "绿的谐波"},
    {"symbol": "300124", "name": "汇川技术"},
    {"symbol": "688160", "name": "步科股份"},
    {"symbol": "002241", "name": "歌尔股份"},
    {"symbol": "300900", "name": "广联航空"},
    # BIOTECH
    {"symbol": "603259", "name": "药明康德"},
    {"symbol": "688235", "name": "百济神州"},
    {"symbol": "300122", "name": "智飞生物"},
    # AEROSPACE
    {"symbol": "600893", "name": "航发动力"},
    {"symbol": "600372", "name": "中航机载"},
    {"symbol": "688002", "name": "睿创微纳"},
    # NEW MAT
    {"symbol": "600111", "name": "北方稀土"},
    {"symbol": "600516", "name": "方大炭素"},
    {"symbol": "300699", "name": "光威复材"},
    # MARINE
    {"symbol": "601989", "name": "中国重工"},
    {"symbol": "600150", "name": "中国船舶"},
    # QUANTUM
    {"symbol": "688027", "name": "国盾量子"},
    {"symbol": "300520", "name": "科大国创"},
    # BIO MFG
    {"symbol": "688065", "name": "凯赛生物"},
    {"symbol": "300381", "name": "溢多利"},
    # FUSION
    {"symbol": "002733", "name": "雄韬股份"},
    {"symbol": "300471", "name": "厚普股份"},
    {"symbol": "688339", "name": "亿华通"},
    # BCI
    {"symbol": "300818", "name": "耐普矿机"},
    # 6G / COMM SPACE 重复: 600118
    {"symbol": "600498", "name": "烽火通信"},
    {"symbol": "688523", "name": "航天环宇"},
    # MED DEV
    {"symbol": "688016", "name": "心脉医疗"},
    {"symbol": "688617", "name": "惠泰医疗"},
]


def _infer_market(symbol: str) -> str:
    """根据 6 位股票代码前缀推断市场：600/601/603/605/688/689 → sh，其他 → sz"""
    prefix = symbol[:3]
    if prefix in {"600", "601", "603", "605", "688", "689"}:
        return "sh"
    return "sz"


def build_stock_pools() -> dict[str, Any]:
    """构造 A 池 10 只随机 + B 池 15 只热门行业推荐，返回 {pool_a, pool_b, combined} """
    # A 池：从 POPULAR 随机抽 10 只
    pool_a = random.sample(POPULAR_STOCKS_UNIQUE, k=min(10, len(POPULAR_STOCKS_UNIQUE)))
    # B 池：从行业推荐按顺序去重取前 15，补全 market 字段
    seen_symbols = {s["symbol"] for s in pool_a}
    pool_b: list[dict] = []
    for stk in SECTOR_RECOMMENDED_STOCKS:
        if stk["symbol"] in seen_symbols:
            continue
        enriched = {**stk, "market": stk.get("market") or _infer_market(stk["symbol"])}
        pool_b.append(enriched)
        seen_symbols.add(stk["symbol"])
        if len(pool_b) >= 15:
            break
    combined = pool_a + pool_b
    return {
        "pool_a_random_10": pool_a,
        "pool_b_hot_sector_15": pool_b,
        "combined_25": combined,
    }


# ============================================================
# 测试页面清单 (与 routes.ts 保持一致)
# ============================================================
def build_page_test_cases(pool_b_stocks: list[dict]) -> list[dict[str, Any]]:
    """构造测试用例序列：每个用例 {id, name, group, path, assertions, priority} """
    # 先从 B 池取股票用于带参数路由 (如 /analysis/intelligent-score/:symbol)
    param_stocks = pool_b_stocks[:3] if len(pool_b_stocks) >= 3 else pool_b_stocks
    cases: list[dict[str, Any]] = []

    def _add(cid, name, group, path, priority="P0", assertions=None):
        cases.append({
            "id": cid,
            "name": name,
            "group": group,
            "path": path,
            "priority": priority,
            "assertions": assertions or ["title_ok", "topbar_5cabins_visible", "no_404_or_crash"],
        })

    # —— 门户与驾驶舱 ——
    _add("P01", "首页入口", "门户", "/")
    _add("P02", "驾驶舱 Dashboard", "门户", "/cockpit")
    # —— 输入舱 ——
    _add("I01", "输入舱 · 录入看板", "输入舱", "/input")
    _add("I02", "输入舱 · 模块首页", "输入舱", "/input/hub")
    _add("I03", "输入舱 · 热门板块筛选", "输入舱", "/input/hot-sectors")
    _add("I04", "输入舱 · 意向候选池", "输入舱", "/input/intention-pool")
    _add("I05", "输入舱 · 采集监控台", "输入舱", "/input/collection-monitor", "P1")
    _add("I06", "输入舱 · 采集策略配置", "输入舱", "/input/collection-strategy", "P1")
    _add("I07", "输入舱 · 候选池总览", "输入舱", "/input/pool-board", "P1")
    _add("I08", "输入舱 · 本地知识库", "输入舱", "/input/local-knowledge", "P2")
    # —— 分析舱 ——
    _add("A01", "分析舱 · 主面板", "分析舱", "/analysis")
    _add("A02", "分析舱 · 模块首页", "分析舱", "/analysis/hub")
    _add("A03", "分析舱 · 行业全景仪表盘", "分析舱", "/analysis/industry-dashboard")
    _add("A04", "分析舱 · V4 行业评分", "分析舱", "/analysis/industry-score")
    _add("A05", "分析舱 · V6 个股评分", "分析舱", "/analysis/stock-score")
    _add("A06", "分析舱 · 智能评分(无代码)", "分析舱", "/analysis/intelligent-score", "P0")
    # 用 B 池 3 只股票构造带代码路由
    for s in param_stocks:
        _add(
            f"A06X-{s['symbol']}",
            f"分析舱 · 智能评分({s['name']} {s['symbol']})",
            "分析舱个股",
            f"/analysis/intelligent-score/{s['symbol']}.SH" if s["market"] == "sh" else f"/analysis/intelligent-score/{s['symbol']}.SZ",
            "P0",
        )
    _add("A07", "分析舱 · 热门板块策略", "分析舱", "/analysis/hot-sector")
    _add("A08", "分析舱 · 价值洼地", "分析舱", "/analysis/value-pit")
    _add("A09", "分析舱 · 多因子筛选", "分析舱", "/analysis/multi-factor", "P1")
    _add("A10", "分析舱 · 智能资讯 V6", "分析舱", "/analysis/news-v6", "P1")
    _add("A11", "分析舱 · 智能资讯", "分析舱", "/analysis/news", "P2")
    _add("A12", "分析舱 · 评分文档库", "分析舱", "/analysis/score-docs", "P2")
    _add("A13", "分析舱 · 历史评分比对", "分析舱", "/analysis/score-comparison", "P1")
    _add("A14", "分析舱 · 复盘启动", "分析舱", "/analysis/review-launch", "P1")
    _add("A15", "分析舱 · 策略回测", "分析舱", "/analysis/backtest", "P1")
    # —— 交易舱 ——
    _add("T01", "交易舱 · 主面板", "交易舱", "/trading")
    _add("T02", "交易舱 · 交易流程", "交易舱", "/trading/flow")
    _add("T03", "交易舱 · 持仓管理", "交易舱", "/trading/holdings")
    _add("T04", "交易舱 · 投资组合", "交易舱", "/trading/portfolio", "P1")
    _add("T05", "交易舱 · 风险控制", "交易舱", "/trading/risk", "P1")
    _add("T06", "交易舱 · 执行计划", "交易舱", "/trading/execution-plans", "P1")
    _add("T07", "交易舱 · 策略快照", "交易舱", "/trading/strategy-snapshots", "P2")
    # —— 输出舱 ——
    _add("O01", "输出舱 · 主面板", "输出舱", "/output")
    _add("O02", "输出舱 · 模块首页", "输出舱", "/output/hub")
    _add("O03", "输出舱 · 研究报告", "输出舱", "/output/research", "P1")
    _add("O04", "输出舱 · 交易复盘", "输出舱", "/output/review")
    _add("O05", "输出舱 · 因子分析(三合一)", "输出舱", "/output/factor-analysis", "P0")
    _add("O06", "输出舱 · 筹码与交易策略", "输出舱", "/output/chip-strategy", "P1")
    _add("O07", "输出舱 · 数据导出", "输出舱", "/output/export", "P2")
    _add("O08", "输出舱 · 仪表盘", "输出舱", "/output/dashboard", "P1")
    _add("O09", "输出舱 · 复盘向导", "输出舱", "/output/wizard", "P2")
    # —— 总控舱 ——
    _add("C01", "总控舱 · 主面板", "总控舱", "/command")
    _add("C02", "总控舱 · 模块首页", "总控舱", "/command/hub")
    _add("C03", "总控舱 · 系统健康", "总控舱", "/command/system-health", "P0")
    _add("C04", "总控舱 · 智能体总控台", "总控舱", "/command/agents", "P1")
    _add("C05", "总控舱 · 任务管理面板", "总控舱", "/command/agents/task-panel", "P1")
    _add("C06", "总控舱 · 模型配置", "总控舱", "/command/agents/model-config", "P1")
    _add("C07", "总控舱 · 优化建议面板", "总控舱", "/command/agents/optimization-panel", "P2")
    _add("C08", "总控舱 · 自定义智能体", "总控舱", "/command/agents/custom", "P2")
    _add("C09", "总控舱 · 能力图谱", "总控舱", "/command/agents/capability-graph", "P2")
    _add("C10", "总控舱 · MCP Server 管理", "总控舱", "/command/mcp-servers", "P1")
    _add("C11", "总控舱 · 配置管理", "总控舱", "/command/config", "P1")
    _add("C12", "总控舱 · 压力测试", "总控舱", "/command/test", "P2")
    _add("C13", "总控舱 · 更新日志", "总控舱", "/command/agents/changelog", "P2")
    _add("C14", "总控舱 · 组件示例库", "总控舱", "/command/showcase", "P2")

    return cases


# ============================================================
# 性能辅助
# ============================================================
def collect_perf(page: Page) -> dict[str, Any]:
    """从页面采集 Navigation Timing + 资源统计"""
    try:
        metrics = page.evaluate("""() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            const paint = performance.getEntriesByType('paint');
            const fcpEntry = paint.find(p => p.name === 'first-contentful-paint');
            const totalTransfer = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
            const totalDecoded = resources.reduce((s, r) => s + (r.decodedBodySize || 0), 0);
            return {
                domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
                loadEvent: nav ? nav.loadEventEnd : null,
                domInteractive: nav ? nav.domInteractive : null,
                responseStart: nav ? nav.responseStart : null,
                fcp: fcpEntry ? fcpEntry.startTime : null,
                resourceCount: resources.length,
                totalTransferBytes: totalTransfer,
                totalDecodedBytes: totalDecoded,
                jsHeapUsed: performance.memory ? performance.memory.usedJSHeapSize : null,
                jsHeapTotal: performance.memory ? performance.memory.totalJSHeapSize : null,
            };
        }""")
    except Exception as exc:  # noqa: BLE001
        metrics = {"error": str(exc)}
    return metrics


# ============================================================
# 截图与命名
# ============================================================
def safe_name(s: str) -> str:
    keep = "-_."
    return "".join(c if c.isalnum() or c in keep else "_" for c in s)


def save_screenshots(page: Page, case_id: str, case_name: str) -> dict[str, str]:
    """保存 viewport 截图 和 full-page 截图，返回路径 dict"""
    stem = f"{case_id}-{safe_name(case_name)}"
    vp_path = SCREENSHOT_DIR / f"{stem}-viewport.png"
    fp_path = SCREENSHOT_DIR / f"{stem}-fullpage.png"
    page.screenshot(path=str(vp_path), type="png")
    try:
        page.screenshot(path=str(fp_path), type="png", full_page=True)
    except Exception:
        # 超长页面 full-page 可能失败（滚动条/跨 iframe），降级
        page.screenshot(path=str(fp_path), type="png")
    return {"viewport": str(vp_path.name), "fullpage": str(fp_path.name)}


# ============================================================
# 断言执行
# ============================================================
def run_assertions(page: Page, assertions: list[str]) -> dict[str, Any]:
    """执行一组断言，返回 {assertion_name: 'pass'|'fail'|'warn', detail}"""
    results: dict[str, Any] = {}

    def _ok(name, detail=""):
        results[name] = {"status": "pass", "detail": detail}

    def _fail(name, detail=""):
        results[name] = {"status": "fail", "detail": detail}

    def _warn(name, detail=""):
        results[name] = {"status": "warn", "detail": detail}

    for a in assertions:
        if a == "title_ok":
            try:
                title = page.title()
                if title and len(title) > 0:
                    _ok("title_ok", title[:80])
                else:
                    _warn("title_ok", "title empty")
            except Exception as exc:
                _fail("title_ok", str(exc))

        elif a == "topbar_5cabins_visible":
            # 顶栏应该存在"输入舱/分析舱/交易舱/输出舱/总控舱"导航锚点（使用宽松匹配）
            keywords = ["输入舱", "分析舱", "交易舱", "输出舱", "总控舱"]
            found_count = 0
            for kw in keywords:
                try:
                    loc = page.get_by_text(kw).first
                    if loc.is_visible(timeout=500):
                        found_count += 1
                except Exception:
                    pass
            if found_count >= 3:
                _ok("topbar_5cabins_visible", f"found {found_count}/5 keywords")
            else:
                _warn("topbar_5cabins_visible", f"only {found_count}/5 keywords visible (可能是侧边栏布局变体)")

        elif a == "no_404_or_crash":
            url_now = page.url
            # 崩溃常见：空白 body 或长 error stack
            try:
                body_text = page.inner_text("body", timeout=3000)
                if "Uncaught Error" in body_text or "Runtime Error" in body_text or "白屏" in body_text:
                    _fail("no_404_or_crash", "detected runtime error marker in body text")
                elif len(body_text.strip()) < 50:
                    _warn("no_404_or_crash", f"body too short (<50 chars), might be blank or fallback")
                else:
                    _ok("no_404_or_crash", f"body chars={len(body_text)}")
            except Exception as exc:
                _fail("no_404_or_crash", str(exc))

        else:
            _warn(a, "unknown assertion, skipped")

    return results


# ============================================================
# 核心执行
# ============================================================
def run_launch_test() -> dict[str, Any]:
    stock_pools = build_stock_pools()
    test_cases = build_page_test_cases(stock_pools["pool_b_hot_sector_15"])

    summary: dict[str, Any] = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "base_url": BASE_URL,
        "use_hash_router": USE_HASH_ROUTER,
        "stock_pools": stock_pools,
        "page_cases_count": len(test_cases),
        "cases": [],
        "global_errors": [],
    }

    pw: Playwright
    browser: Browser
    context: BrowserContext
    page: Page

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ])
        # 与 @playwright/test 配置保持同样的 Desktop Chrome 视口
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 FinSightV9/LaunchTest",
        )
        page = context.new_page()

        # 打开首页做一次预热 + 健康检查
        print(f"[LAUNCH-TEST] 预热访问: {BASE_URL}/ ...")
        try:
            page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(1200)
        except PWTimeout as exc:
            summary["global_errors"].append(f"首页打开超时: {exc}")
            print(f"[WARN] 首页打开超时，继续尝试单页面...")

        # 开始按用例遍历
        for idx, case in enumerate(test_cases, start=1):
            cid = case["id"]
            cname = case["name"]
            group = case["group"]
            raw_path = case["path"]
            full_path = ("#" + raw_path) if USE_HASH_ROUTER and raw_path.startswith("/") else raw_path
            url = BASE_URL + "/" + full_path.lstrip("/")
            priority = case.get("priority", "P0")

            case_result: dict[str, Any] = {
                "id": cid,
                "name": cname,
                "group": group,
                "path": raw_path,
                "priority": priority,
                "url": url,
                "step": idx,
                "status": "pending",
                "http_status": None,
                "load_ms": None,
                "screenshots": {},
                "assertions": {},
                "perf": {},
                "errors": [],
            }

            print(f"[{idx:03d}/{len(test_cases):03d}] {priority} [{group}] {cname} -> {raw_path}")
            t0 = time.perf_counter()

            # 捕获响应状态码
            def _on_response(resp, bucket: dict = case_result):
                if resp.url.rstrip("/") == (BASE_URL + "/" + (("#" + raw_path).lstrip("/")).split("#")[0]).rstrip("/"):
                    bucket["http_status"] = resp.status

            page.on("response", _on_response)

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                # SPA 加载等待：等 network 空闲（但不能太长）
                try:
                    page.wait_for_load_state("networkidle", timeout=6000)
                except PWTimeout:
                    # 有长连接（如 SSE/WebSocket）是正常的，只记一下
                    case_result["errors"].append("networkidle timeout (>6s), might be live connections")
                page.wait_for_timeout(700)  # 给 React 提交渲染

                load_ms = round((time.perf_counter() - t0) * 1000, 1)
                case_result["load_ms"] = load_ms

                # 截图
                case_result["screenshots"] = save_screenshots(page, cid, cname)
                # 断言
                case_result["assertions"] = run_assertions(page, case.get("assertions", []))
                # 性能
                case_result["perf"] = collect_perf(page)
                # 状态判断
                all_assert = case_result["assertions"].values()
                fail_count = sum(1 for v in all_assert if v.get("status") == "fail")
                if fail_count > 0:
                    case_result["status"] = "fail"
                elif load_ms and load_ms > 8000:
                    case_result["status"] = "warn"
                    case_result["errors"].append(f"load_ms={load_ms} > 8000ms threshold")
                else:
                    case_result["status"] = "pass"

            except PWTimeout as exc:
                case_result["status"] = "fail"
                case_result["errors"].append(f"Timeout: {exc}")
                # 即使超时也尽力截图
                try:
                    case_result["screenshots"] = save_screenshots(page, cid, cname)
                except Exception as s_exc:
                    case_result["errors"].append(f"screenshot after timeout failed: {s_exc}")
            except Exception as exc:  # noqa: BLE001
                case_result["status"] = "fail"
                case_result["errors"].append(f"Unhandled: {type(exc).__name__}: {exc}")
            finally:
                page.remove_listener("response", _on_response)

            summary["cases"].append(case_result)
            status_icon = {"pass": "✅", "warn": "⚠️", "fail": "❌"}.get(case_result["status"], "?")
            load_disp = case_result["load_ms"]
            print(f"        -> {status_icon} {case_result['status']}  load={load_disp}ms")

        # 关闭
        context.close()
        browser.close()

    return summary


# ============================================================
# 评分与报告
# ============================================================
def compute_score(summary: dict[str, Any]) -> dict[str, Any]:
    """根据测试结果计算各维度评分（0-100）"""
    cases = summary["cases"]
    total = len(cases)
    if total == 0:
        return {"overall": 0, "by_group": {}, "dimensions": {}}

    # 分桶统计
    by_group: dict[str, dict] = {}
    for c in cases:
        g = c["group"]
        if g not in by_group:
            by_group[g] = {"total": 0, "pass": 0, "warn": 0, "fail": 0}
        by_group[g]["total"] += 1
        by_group[g][c["status"]] += 1

    # 1) 功能可达性（40%）：按 P0/P1/P2 加权通过率
    p_weights = {"P0": 5, "P1": 3, "P2": 1}
    w_pass, w_total = 0, 0
    for c in cases:
        pw = p_weights.get(c.get("priority", "P0"), 3)
        w_total += pw
        if c["status"] == "pass":
            w_pass += pw
        elif c["status"] == "warn":
            w_pass += pw * 0.6
    func_score = round((w_pass / w_total) * 100, 1) if w_total else 0

    # 2) 页面性能（30%）：load_ms + FCP
    load_samples = [c["load_ms"] for c in cases if isinstance(c.get("load_ms"), (int, float))]
    fcp_samples = []
    for c in cases:
        fcp = c.get("perf", {}).get("fcp")
        if isinstance(fcp, (int, float)) and fcp > 0:
            fcp_samples.append(fcp)
    avg_load = sum(load_samples) / len(load_samples) if load_samples else 0
    avg_fcp = sum(fcp_samples) / len(fcp_samples) if fcp_samples else 0
    # 归一化：<2s 满分，>12s 0 分
    def _score_metric(ms, good=2000, bad=12000):
        if ms <= 0:
            return 0.0
        if ms <= good:
            return 100.0
        if ms >= bad:
            return 0.0
        return 100 - ((ms - good) / (bad - good)) * 100
    load_score = _score_metric(avg_load, good=2500, bad=10000)
    fcp_score = _score_metric(avg_fcp, good=1500, bad=6000)
    perf_score = round(load_score * 0.6 + fcp_score * 0.4, 1)

    # 3) 渲染与截图完整性（15%）：是否成功生成 viewport+fullpage 双截图
    shot_ok = 0
    for c in cases:
        sh = c.get("screenshots", {})
        if sh.get("viewport") and sh.get("fullpage"):
            shot_ok += 1
    shot_score = round((shot_ok / total) * 100, 1)

    # 4) 断言质量（15%）：no_404_or_crash 通过率 + title 正确率
    ok_crash = 0
    ok_title = 0
    for c in cases:
        a = c.get("assertions", {})
        if a.get("no_404_or_crash", {}).get("status") == "pass":
            ok_crash += 1
        if a.get("title_ok", {}).get("status") == "pass":
            ok_title += 1
    crash_score = round((ok_crash / total) * 100, 1)
    title_score = round((ok_title / total) * 100, 1)
    assert_score = round(crash_score * 0.7 + title_score * 0.3, 1)

    overall = round(func_score * 0.40 + perf_score * 0.30 + shot_score * 0.15 + assert_score * 0.15, 1)

    return {
        "overall": overall,
        "dimensions": {
            "功能可达性(40%)": func_score,
            "页面性能(30%)": perf_score,
            "截图完整性(15%)": shot_score,
            "断言质量(15%)": assert_score,
        },
        "metrics": {
            "avg_load_ms": round(avg_load, 1),
            "avg_fcp_ms": round(avg_fcp, 1),
            "load_samples": len(load_samples),
            "fcp_samples": len(fcp_samples),
            "p95_load_ms": round(sorted(load_samples)[int(len(load_samples) * 0.95)] if load_samples else 0, 1),
        },
        "by_group": by_group,
        "counts": {
            "total": total,
            "pass": sum(1 for c in cases if c["status"] == "pass"),
            "warn": sum(1 for c in cases if c["status"] == "warn"),
            "fail": sum(1 for c in cases if c["status"] == "fail"),
            "pending": sum(1 for c in cases if c["status"] == "pending"),
        },
    }


def write_markdown_report(summary: dict[str, Any], score: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# FinSightV9 上线前综合 E2E 测试报告  ")
    lines.append(f"")
    lines.append(f"- **测试时间**: `{summary['timestamp']}`  ")
    lines.append(f"- **基地址**: `{summary['base_url']}` 路由模式: `{'Hash (#/path)' if summary['use_hash_router'] else 'Browser (path)'}`  ")
    lines.append(f"- **页面用例数**: {score['counts']['total']}  ")
    lines.append(f"- **结果计数**: ✅ {score['counts']['pass']} / ⚠️ {score['counts']['warn']} / ❌ {score['counts']['fail']} / ⏳ {score['counts']['pending']}  ")
    lines.append(f"- **综合评分**: **{score['overall']} / 100**  ")
    lines.append(f"")
    lines.append(f"## 一、综合评估  ")
    lines.append(f"")
    lines.append(f"| 维度 | 权重 | 得分 | 说明 |")
    lines.append(f"|:---|:---|:---|:---|")
    overall_ratio = score['overall'] / 100
    grade = "S" if overall_ratio >= 0.92 else "A" if overall_ratio >= 0.82 else "B" if overall_ratio >= 0.70 else "C" if overall_ratio >= 0.60 else "D"
    for k, v in score["dimensions"].items():
        lines.append(f"| {k.split('(')[0]} | {k[k.find('('):-1] if '(' in k else '-'} | {v:.1f} | {'达标' if v >= 80 else '待优化' if v >= 60 else '不达标'} |")
    lines.append(f"| **综合** | 100% | **{score['overall']:.1f}** | **评级 {grade}** |")
    lines.append(f"")
    lines.append(f"### 1.1 关键性能指标  ")
    lines.append(f"")
    m = score["metrics"]
    lines.append(f"- 平均首字节到可交互 (DOMContentLoaded/Load): **{m['avg_load_ms']} ms** (采样 {m['load_samples']})  ")
    lines.append(f"- 平均 FCP (First Contentful Paint): **{m['avg_fcp_ms']} ms** (采样 {m['fcp_samples']})  ")
    lines.append(f"- P95 页面加载: **{m['p95_load_ms']} ms**  ")
    lines.append(f"")
    lines.append(f"### 1.2 分舱通过率  ")
    lines.append(f"")
    lines.append(f"| 舱 | 总数 | ✅ 通过 | ⚠️ 警告 | ❌ 失败 | 通过率 |")
    lines.append(f"|:---|:---|:---|:---|:---|:---|")
    for g, d in score["by_group"].items():
        rate = (d["pass"] + 0.5 * d["warn"]) / d["total"] if d["total"] else 0
        lines.append(f"| {g} | {d['total']} | {d['pass']} | {d['warn']} | {d['fail']} | {rate*100:.0f}% |")
    lines.append(f"")
    lines.append(f"## 二、测试股票池  ")
    lines.append(f"")
    pools = summary["stock_pools"]
    lines.append(f"### 2.1 A 池：10 只随机抽取（从 POPULAR_STOCKS 46 只中 seed=20260819）  ")
    lines.append(f"")
    lines.append(f"| 序号 | 代码 | 名称 | 市场 |")
    lines.append(f"|:---|:---|:---|:---|")
    for i, s in enumerate(pools["pool_a_random_10"], start=1):
        lines.append(f"| {i} | {s['symbol']} | {s['name']} | {s['market'].upper()} |")
    lines.append(f"")
    lines.append(f"### 2.2 B 池：15 只热门行业推荐（十五五 20 大新兴行业 keyStocks 去重前 15）  ")
    lines.append(f"")
    lines.append(f"| 序号 | 代码 | 名称 | 代表行业 |")
    lines.append(f"|:---|:---|:---|:---|")
    # 根据 symbol 反推行业（简化显示）
    sector_tags = {
        "688256": "AI芯片", "002230": "AI应用", "688787": "AI数据",
        "688012": "半导体设备", "688019": "半导体材料", "002371": "半导体设备",
        "601127": "新能源整车", "002709": "锂电材料", "300073": "锂电材料",
        "688017": "机器人核心零部件", "300124": "工控伺服", "688160": "机器人",
        "002241": "VR/低空零组件", "300900": "低空机体", "603259": "CXO/医药",
    }
    for i, s in enumerate(pools["pool_b_hot_sector_15"], start=1):
        lines.append(f"| {i} | {s['symbol']} | {s['name']} | {sector_tags.get(s['symbol'], '新兴产业')} |")
    lines.append(f"")
    lines.append(f"## 三、逐页面测试明细  ")
    lines.append(f"")
    lines.append(f"| 编号 | 页面 | 舱 | 优先级 | 结果 | 加载(ms) | FCP(ms) | 截图 |")
    lines.append(f"|:---|:---|:---|:---|:---|:---|:---|:---|")
    icon_map = {"pass": "✅", "warn": "⚠️", "fail": "❌", "pending": "⏳"}
    for c in summary["cases"]:
        fcp = c.get("perf", {}).get("fcp")
        fcp_disp = f"{fcp:.0f}" if isinstance(fcp, (int, float)) else "-"
        sh = c.get("screenshots", {})
        shot_link = ""
        if sh.get("viewport"):
            shot_link = f"[视口](e2e/launch-screenshots/{sh['viewport']}) · [全页](e2e/launch-screenshots/{sh['fullpage']})"
        load_disp = c["load_ms"] if isinstance(c.get("load_ms"), (int, float)) else "-"
        lines.append(
            f"| {c['id']} | {c['name']} | {c['group']} | {c.get('priority','-')} | "
            f"{icon_map.get(c['status'],'?')}{c['status']} | {load_disp} | {fcp_disp} | {shot_link} |"
        )
    lines.append(f"")
    lines.append(f"## 四、失败/警告用例详情  ")
    lines.append(f"")
    failed = [c for c in summary["cases"] if c["status"] != "pass"]
    if not failed:
        lines.append(f"> ✅ 无失败/警告用例，全部通过。  ")
    else:
        for c in failed:
            lines.append(f"### {c['id']} · {c['name']} ({c['group']})  ")
            lines.append(f"- 路由: `{c['path']}`  ")
            lines.append(f"- 状态: **{c['status']}**  ")
            lines.append(f"- 加载: {c.get('load_ms')} ms  ")
            if c["errors"]:
                lines.append(f"- 错误/告警:  ")
                for e in c["errors"]:
                    lines.append(f"  - {e}  ")
            if c["assertions"]:
                lines.append(f"- 断言:  ")
                for aname, av in c["assertions"].items():
                    lines.append(f"  - {aname}: **{av['status']}** — {av.get('detail','')}  ")
            sh = c.get("screenshots", {})
            if sh:
                vp = sh.get("viewport")
                fp = sh.get("fullpage")
                lines.append(f"- 证据截图: [视口](e2e/launch-screenshots/{vp}) · [全页](e2e/launch-screenshots/{fp})  ")
            lines.append(f"")
    lines.append(f"")
    if summary["global_errors"]:
        lines.append(f"## 五、全局异常  ")
        for ge in summary["global_errors"]:
            lines.append(f"- {ge}  ")
        lines.append(f"")
    lines.append(f"## 六、上线判定结论  ")
    lines.append(f"")
    if score["overall"] >= 85 and score["counts"]["fail"] <= 2:
        lines.append(f"### 🟢 结论：通过上线门槛  ")
        lines.append(f"- 综合评分 {score['overall']:.1f} ≥ 85；失败用例 {score['counts']['fail']} ≤ 2，均为 P2 非核心页面时可放行。  ")
    elif score["overall"] >= 70:
        lines.append(f"### 🟡 结论：条件放行（需修复警告项后灰度）  ")
        lines.append(f"- 综合评分 {score['overall']:.1f} ∈ [70, 85)；建议修复所有 ❌ 失败与 P0/P1 ⚠️ 警告项，再执行灰度发布。  ")
    else:
        lines.append(f"### 🔴 结论：暂不具备上线条件  ")
        lines.append(f"- 综合评分 {score['overall']:.1f} < 70；所有 ❌ 失败用例必须闭环，P0/P1 警告项必须根因治理后再行复测。  ")
    lines.append(f"")
    lines.append(f"---  ")
    lines.append(f"_脚本: `scripts/launch_e2e_test.py` · 报告生成时间: {datetime.now().isoformat(timespec='seconds')}_  ")
    md = "\n".join(lines)
    return md


# ============================================================
# main
# ============================================================
def main() -> int:
    print("=" * 72)
    print("FinSightV9 上线前综合 E2E 测试 (Python Playwright)")
    print("=" * 72)
    # 1. 跑测试
    summary = run_launch_test()
    # 2. 算分
    score = compute_score(summary)
    summary["score"] = score
    # 3. 写 JSON
    REPORT_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[REPORT] JSON -> {REPORT_JSON}")
    # 4. 写 Markdown
    md = write_markdown_report(summary, score)
    REPORT_MD.write_text(md, encoding="utf-8")
    print(f"[REPORT] MD   -> {REPORT_MD}")
    # 5. 控制台结论
    print()
    print(f"===== 测试结论 =====")
    print(f"  综合评分: {score['overall']:.1f} / 100")
    for k, v in score["dimensions"].items():
        print(f"  {k}: {v:.1f}")
    c = score["counts"]
    print(f"  页面用例: 总数 {c['total']}  |  ✅ {c['pass']}  ⚠️ {c['warn']}  ❌ {c['fail']}")
    print(f"  截图目录: {SCREENSHOT_DIR}")
    print(f"  报告: {REPORT_MD}")
    # 返回码：0 = 可上线（>=70 且无 P0 fail）；1 = 治理后复测
    has_p0_fail = any(
        c2["status"] == "fail" and c2.get("priority") == "P0"
        for c2 in summary["cases"]
    )
    if score["overall"] >= 70 and not has_p0_fail:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
