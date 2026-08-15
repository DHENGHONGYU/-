"""Playwright 截图核心模块：可复用的截图函数 + CSV/Excel 批量截图 + 失败自动截图 + 钉钉告警."""
import argparse
import csv
import hashlib
import hmac
import base64
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

log = logging.getLogger("screenshot")

DEFAULT_BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-features=RendererCodeIntegrity",
    "--disable-extensions",
    "--disable-component-update",
    "--no-first-run",
]

DEFAULT_FAILURE_TEMPLATE = "FAIL-{name}-{timestamp}.png"

DINGTALK_TEMPLATE_SINGLE = """📋 截图任务失败告警
━━━━━━━━━━━━━━━━
🔗 URL: {url}
🏷️ 名称: {name}
🔁 重试: 已尝试 {attempts} 次
⏰ 时间: {time}
❌ 错误: {error}
📂 失败截图: {failure_shot}
━━━━━━━━━━━━━━━━
请及时处理！"""

DINGTALK_TEMPLATE_SUMMARY = """📊 批量截图任务完成
━━━━━━━━━━━━━━━━
📁 数据源: {source}
📌 总任务: {total}
✅ 成功: {success} ({success_pct}%)
❌ 失败: {fail} ({fail_pct}%)
⏱️ 总耗时: {total_time}ms
🔁 重试成功: {retried}
🔁 重试失败: {retry_fail}
⏰ 完成时间: {time}
━━━━━━━━━━━━━━━━
{fail_details}"""


@dataclass
class ScreenshotConfig:
    url: str = "https://www.baidu.com"
    output_dir: str = "outputs/screenshots"
    filename: Optional[str] = None
    width: int = 1440
    height: int = 900
    full_page: bool = True
    wait_ms: int = 2000
    headless: bool = True
    timeout_ms: int = 30000
    page_error: list = field(default_factory=list)
    save_on_failure: bool = True
    failure_dir: Optional[str] = None
    failure_filename_template: str = DEFAULT_FAILURE_TEMPLATE


def _resolve_filename(url: str, filename: Optional[str]) -> str:
    if filename:
        return filename
    parsed = urlparse(url)
    host = parsed.netloc.replace(".", "_") or "page"
    return f"{host}.png"


class DingTalkNotifier:
    """钉钉机器人通知：支持加签安全验证、单条告警、批量汇总."""

    def __init__(self, webhook: str, secret: Optional[str] = None):
        self.webhook = webhook
        self.secret = secret
        self._last_notify_ts = 0
        self._min_interval = 1.0

    def _build_url(self) -> str:
        if not self.secret:
            return self.webhook
        timestamp = str(round(time.time() * 1000))
        string_to_sign = f"{timestamp}\n{self.secret}"
        hmac_code = hmac.new(
            self.secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        sign = quote_plus(base64.b64encode(hmac_code))
        return f"{self.webhook}&timestamp={timestamp}&sign={sign}"

    def _send(self, message: str) -> bool:
        now = time.time()
        if now - self._last_notify_ts < self._min_interval:
            time.sleep(self._min_interval - (now - self._last_notify_ts))
        try:
            url = self._build_url()
            payload = json.dumps({
                "msgtype": "text",
                "text": {"content": message},
            }).encode("utf-8")
            req = Request(
                url, data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                if body.get("errcode") == 0:
                    self._last_notify_ts = time.time()
                    log.info("钉钉通知发送成功")
                    return True
                else:
                    log.error("钉钉通知发送失败: %s", body)
                    return False
        except Exception as e:
            log.error("钉钉通知发送异常: %s", e)
            return False

    def notify_failure(
        self, name: str, url: str, attempts: int,
        error: str, failure_shot: Optional[str] = None,
    ) -> bool:
        msg = DINGTALK_TEMPLATE_SINGLE.format(
            name=name,
            url=url,
            attempts=attempts,
            time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            error=error[:200],
            failure_shot=os.path.basename(failure_shot) if failure_shot else "无",
        )
        return self._send(msg)

    def notify_summary(
        self, source: str, results: list[tuple[str, str, bool, float, Optional[str], int]],
    ) -> bool:
        total = len(results)
        success = sum(1 for r in results if r[2])
        fail = total - success
        success_pct = (success / total * 100) if total > 0 else 0
        fail_pct = (fail / total * 100) if total > 0 else 0
        total_time = sum(r[3] for r in results)
        retried = sum(1 for r in results if r[5] > 1 and r[2])
        retry_fail = sum(1 for r in results if r[5] > 1 and not r[2])

        fail_details = ""
        if fail > 0:
            fail_lines = ["📋 失败详情:"]
            for name, path, ok, elapsed, fail_shot, attempts in results:
                if not ok:
                    shot_name = os.path.basename(fail_shot) if fail_shot else "无"
                    fail_lines.append(f"  ❌ {name} ({attempts}次) 截图: {shot_name}")
            fail_details = "\n".join(fail_lines)

        msg = DINGTALK_TEMPLATE_SUMMARY.format(
            source=source,
            total=total,
            success=success,
            success_pct=f"{success_pct:.1f}",
            fail=fail,
            fail_pct=f"{fail_pct:.1f}",
            total_time=f"{total_time:.0f}",
            retried=retried,
            retry_fail=retry_fail,
            time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            fail_details=fail_details,
        )
        return self._send(msg)


def _build_failure_filename(template: str, name: str, url: str) -> str:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_url = url.replace("://", "_").replace("/", "_").replace("?", "_").replace("&", "_")[:60]
    return template.format(name=name, timestamp=ts, url=safe_url)


def _try_failure_screenshot(
    page, failure_dir: str, name_hint: str, url: str, error: Exception,
    filename_template: str = DEFAULT_FAILURE_TEMPLATE,
) -> Optional[str]:
    try:
        os.makedirs(failure_dir, exist_ok=True)
        fname = _build_failure_filename(filename_template, name_hint, url)
        fpath = os.path.join(failure_dir, fname)
        try:
            page.screenshot(path=fpath, full_page=True, timeout=5000)
            log.info("失败页面截图已保存: %s", fpath)
            return fpath
        except Exception as e2:
            log.warning("失败页面截图也失败了: %s", e2)
            return None
    except Exception:
        return None


def take_screenshot(cfg: ScreenshotConfig) -> str:
    os.makedirs(cfg.output_dir, exist_ok=True)
    fname = _resolve_filename(cfg.url, cfg.filename)
    shot_path = os.path.join(cfg.output_dir, fname)

    log.info("截图开始: %s → %s (视口 %dx%d, full_page=%s)",
             cfg.url, shot_path, cfg.width, cfg.height, cfg.full_page)

    t0 = time.time()
    sync_ctx = sync_playwright()
    pw = sync_ctx.start()
    browser = None
    page = None
    try:
        browser = pw.chromium.launch(
            headless=cfg.headless,
            args=DEFAULT_BROWSER_ARGS,
        )
        ctx = browser.new_context(
            viewport={"width": cfg.width, "height": cfg.height},
            device_scale_factor=1,
        )
        page = ctx.new_page()
        cfg.page_error.clear()
        page.on("pageerror", lambda e: cfg.page_error.append(str(e)))

        page.goto(cfg.url, wait_until="domcontentloaded", timeout=cfg.timeout_ms)
        page.wait_for_timeout(cfg.wait_ms)
        page.screenshot(path=shot_path, full_page=cfg.full_page)
    except Exception as e:
        elapsed = (time.time() - t0) * 1000
        log.error("截图失败: %s  %s  耗时: %.0fms  错误: %s", cfg.url, fname, elapsed, e)
        if cfg.save_on_failure and page is not None:
            fail_dir = cfg.failure_dir or os.path.join(cfg.output_dir, "failures")
            _try_failure_screenshot(
                page, fail_dir, fname.replace(".png", ""), cfg.url, e,
                filename_template=cfg.failure_filename_template,
            )
        raise
    finally:
        if browser is not None:
            browser.close()
        pw.stop()

    elapsed = (time.time() - t0) * 1000
    size_kb = os.path.getsize(shot_path) / 1024
    log.info("截图完成: %s  耗时: %.0fms  大小: %.1f KB", shot_path, elapsed, size_kb)
    if cfg.page_error:
        log.warning("页面 JS 错误 (%d 条): %s", len(cfg.page_error), cfg.page_error[:3])
    return shot_path


def batch_screenshot(
    urls: list[tuple[str, str]],
    output_dir: str = "outputs/screenshots",
    width: int = 1440,
    height: int = 900,
    full_page: bool = True,
    wait_ms: int = 2000,
    timeout_ms: int = 30000,
    headless: bool = True,
    save_on_failure: bool = True,
    failure_filename_template: str = DEFAULT_FAILURE_TEMPLATE,
    max_retries: int = 3,
    retry_delay_ms: int = 2000,
    notifier: Optional[DingTalkNotifier] = None,
    notify_each_failure: bool = True,
) -> list[tuple[str, str, bool, float, Optional[str], int]]:
    """批量截图（含重试+钉钉告警）：返回 [(name, path, success, elapsed_ms, failure_shot, attempts), ...]."""
    results = []
    total = len(urls)
    failure_dir = os.path.join(output_dir, "failures")
    for idx, (name, url) in enumerate(urls, 1):
        log.info("[%d/%d] 处理: %s  %s", idx, total, name, url)

        last_error = None
        fail_shot = None
        for attempt in range(1, max_retries + 1):
            if attempt > 1:
                log.warning("[%d/%d] 第 %d/%d 次重试: %s  等待 %dms...",
                            idx, total, attempt, max_retries, name, retry_delay_ms)
                time.sleep(retry_delay_ms / 1000)

            cfg = ScreenshotConfig(
                url=url,
                output_dir=output_dir,
                filename=f"{name}.png",
                width=width,
                height=height,
                full_page=full_page,
                wait_ms=wait_ms,
                timeout_ms=timeout_ms,
                headless=headless,
                save_on_failure=save_on_failure,
                failure_dir=failure_dir,
                failure_filename_template=failure_filename_template,
            )
            t0 = time.time()
            try:
                path = take_screenshot(cfg)
                elapsed = (time.time() - t0) * 1000
                tag = " (重试成功)" if attempt > 1 else ""
                log.info("[%d/%d] ✅ %s 第 %d 次尝试成功%s", idx, total, name, attempt, tag)
                results.append((name, path, True, elapsed, None, attempt))
                last_error = None
                break
            except Exception as e:
                elapsed = (time.time() - t0) * 1000
                last_error = e
                log.warning("[%d/%d] 第 %d 次失败: %s  耗时: %.0fms  错误: %s",
                            idx, total, attempt, name, elapsed, e)
                if save_on_failure:
                    for f in os.listdir(failure_dir):
                        if f.endswith(".png") and name in f:
                            fail_shot = os.path.join(failure_dir, f)
                            break

        if last_error is not None:
            elapsed = 0
            log.error("[%d/%d] ❌ %s 全部 %d 次尝试均失败  错误: %s",
                      idx, total, name, max_retries, last_error)
            if fail_shot is None and os.path.isdir(failure_dir):
                for f in os.listdir(failure_dir):
                    if f.endswith(".png"):
                        mtime = os.path.getmtime(os.path.join(failure_dir, f))
                        if time.time() - mtime < 300:
                            fail_shot = os.path.join(failure_dir, f)
                            break
            if notifier is not None and notify_each_failure:
                notifier.notify_failure(
                    name=name,
                    url=url,
                    attempts=max_retries,
                    error=str(last_error),
                    failure_shot=fail_shot,
                )
            results.append((name, "", False, elapsed, fail_shot, max_retries))

    return results


def print_batch_report(results: list[tuple[str, str, bool, float, Optional[str], int]]):
    """输出批量截图统计报告."""
    total = len(results)
    if total == 0:
        print("\n⚠️ 无截图任务")
        return

    success = sum(1 for r in results if r[2])
    fail = total - success
    success_pct = (success / total) * 100
    fail_pct = (fail / total) * 100

    elapsed_list = [r[3] for r in results]
    total_time = sum(elapsed_list)
    avg_time = total_time / total
    min_time = min(elapsed_list)
    max_time = max(elapsed_list)

    success_times = [r[3] for r in results if r[2]]
    fail_times = [r[3] for r in results if not r[2]]

    retried = sum(1 for r in results if r[5] > 1 and r[2])
    retry_fail = sum(1 for r in results if r[5] > 1 and not r[2])

    width = 60
    print()
    print("╔" + "═" * width + "╗")
    print("║" + "批量截图统计报告".center(width) + "║")
    print("╠" + "═" * width + "╣")
    print("║" + f"总任务数:  {total}".ljust(width) + "║")
    print("║" + f"成功:      {success}  ({success_pct:.1f}%)".ljust(width) + "║")
    print("║" + f"失败:      {fail}  ({fail_pct:.1f}%)".ljust(width) + "║")
    if retried:
        print("║" + f"重试成功:  {retried}  (经重试后成功)".ljust(width) + "║")
    if retry_fail:
        print("║" + f"重试失败:  {retry_fail}  (重试后仍失败)".ljust(width) + "║")
    print("╠" + "═" * width + "╣")
    print("║" + f"总耗时:    {total_time:.0f}ms".ljust(width) + "║")
    print("║" + f"平均耗时:  {avg_time:.0f}ms".ljust(width) + "║")
    print("║" + f"最快:      {min_time:.0f}ms".ljust(width) + "║")
    print("║" + f"最慢:      {max_time:.0f}ms".ljust(width) + "║")

    if success_times:
        print("║" + f"成功平均:  {sum(success_times)/len(success_times):.0f}ms".ljust(width) + "║")
    if fail_times:
        print("║" + f"失败平均:  {sum(fail_times)/len(fail_times):.0f}ms".ljust(width) + "║")

    print("╠" + "═" * width + "╣")
    for name, path, ok, elapsed, fail_shot, attempts in results:
        icon = "✅" if ok else "❌"
        line = f"  {icon} {name}"
        if ok:
            line += f"  ✓  {elapsed:.0f}ms"
            if attempts > 1:
                line += f"  (重试{attempts}次)"
        else:
            line += f"  ✗  共{attempts}次"
            if fail_shot:
                line += f"  [失败截图: {os.path.basename(fail_shot)}]"
        print("║" + line.ljust(width) + "║")
    print("╚" + "═" * width + "╝")
    print()

    if fail > 0:
        print("  💡 失败排查建议:")
        print("     1. 检查网络连接 / VPN 状态")
        print("     2. 查看 failures/ 目录下的失败截图")
        print("     3. 适当增加 --timeout-ms 超时时间")
        print("     4. 确认目标站点是否在当前网络环境可达")
        print("     5. 使用 --retries 增加重试次数或 --retry-delay 延长重试间隔")
        print()


def load_urls_from_csv(
    csv_path: str,
    name_column: str = "name",
    url_column: str = "url",
    delimiter: str = ",",
) -> list[tuple[str, str]]:
    log.info("读取 CSV: %s", csv_path)
    urls = []
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=delimiter)
        rows = list(reader)

    if not rows:
        raise ValueError("CSV 文件为空")

    headers = [h.strip().lower() for h in rows[0]]
    name_idx = None
    url_idx = None
    for i, h in enumerate(headers):
        if h == name_column.lower():
            name_idx = i
        if h == url_column.lower():
            url_idx = i

    if name_idx is None or url_idx is None:
        raise ValueError(
            f"CSV 表头中未找到 '{name_column}' 和 '{url_column}' 列. "
            f"当前表头: {headers}"
        )

    for row in rows[1:]:
        if not row or all(not c.strip() for c in row):
            continue
        name = row[name_idx].strip() if name_idx < len(row) else ""
        url = row[url_idx].strip() if url_idx < len(row) else ""
        if not url:
            continue
        if not name:
            name = urlparse(url).netloc.replace(".", "_") or "page"
        urls.append((name, url))

    log.info("从 CSV 读取 %d 个 URL", len(urls))
    return urls


def load_urls_from_excel(
    excel_path: str,
    sheet_name: Optional[str] = None,
    name_column: str = "name",
    url_column: str = "url",
) -> list[tuple[str, str]]:
    try:
        import openpyxl
    except ImportError:
        raise ImportError("需要 openpyxl: pip install openpyxl")

    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)

    if sheet_name is None:
        sheet_name = wb.sheetnames[0]
    ws = wb[sheet_name]
    log.info("读取 Excel: %s  工作表: %s", excel_path, sheet_name)

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel 文件为空")

    headers = [str(h).strip().lower() if h is not None else "" for h in rows[0]]
    name_idx = None
    url_idx = None
    for i, h in enumerate(headers):
        if h == name_column.lower():
            name_idx = i
        if h == url_column.lower():
            url_idx = i

    if name_idx is None or url_idx is None:
        raise ValueError(
            f"Excel 表头中未找到 '{name_column}' 和 '{url_column}' 列. "
            f"当前表头: {headers}"
        )

    urls = []
    for row in rows[1:]:
        if row is None or all(c is None for c in row):
            continue
        name = str(row[name_idx]).strip() if row[name_idx] is not None else ""
        url = str(row[url_idx]).strip() if row[url_idx] is not None else ""
        if not url:
            continue
        if not name:
            name = urlparse(url).netloc.replace(".", "_") or "page"
        urls.append((name, url))

    log.info("从 Excel 读取 %d 个 URL", len(urls))
    return urls


def load_urls(file_path: str, **kwargs) -> list[tuple[str, str]]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        return load_urls_from_csv(file_path, **kwargs)
    elif ext in (".xlsx", ".xls"):
        return load_urls_from_excel(file_path, **kwargs)
    else:
        raise ValueError(f"不支持的文件格式: {ext} (支持 .csv, .xlsx, .xls)")


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Playwright 自动截图工具：URL/CSV/Excel → 保存 PNG",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    p_single = subparsers.add_parser("single", help="单个 URL 截图")
    p_single.add_argument("url", help="目标 URL")

    p_csv = subparsers.add_parser("csv", help="从 CSV 批量截图")
    p_csv.add_argument("file_path", help="CSV 文件路径 (.csv)")
    p_csv.add_argument("--name-col", default="name")
    p_csv.add_argument("--url-col", default="url")
    p_csv.add_argument("--failure-template", default=DEFAULT_FAILURE_TEMPLATE,
                       help="失败截图文件名模板 (可用变量: {name} {timestamp} {url})")
    p_csv.add_argument("--retries", type=int, default=3,
                       help="失败重试次数 (默认 3, 即最多尝试 3 次)")
    p_csv.add_argument("--retry-delay", type=int, default=2000,
                       help="重试间隔毫秒数 (默认 2000ms)")
    p_csv.add_argument("--dingtalk-webhook", default=None,
                       help="钉钉机器人 Webhook URL, 失败时发送告警")
    p_csv.add_argument("--dingtalk-secret", default=None,
                       help="钉钉机器人加签密钥 (可选)")
    p_csv.add_argument("--notify-summary-only", action="store_true",
                       help="仅发送汇总告警 (不逐条发送失败告警)")
    p_csv.add_argument("--no-save-on-failure", action="store_true")

    p_excel = subparsers.add_parser("excel", help="从 Excel 批量截图")
    p_excel.add_argument("file_path", help="Excel 文件路径 (.xlsx)")
    p_excel.add_argument("--sheet", default=None)
    p_excel.add_argument("--name-col", default="name")
    p_excel.add_argument("--url-col", default="url")
    p_excel.add_argument("--failure-template", default=DEFAULT_FAILURE_TEMPLATE,
                         help="失败截图文件名模板 (可用变量: {name} {timestamp} {url})")
    p_excel.add_argument("--retries", type=int, default=3,
                         help="失败重试次数 (默认 3, 即最多尝试 3 次)")
    p_excel.add_argument("--retry-delay", type=int, default=2000,
                         help="重试间隔毫秒数 (默认 2000ms)")
    p_excel.add_argument("--dingtalk-webhook", default=None,
                         help="钉钉机器人 Webhook URL, 失败时发送告警")
    p_excel.add_argument("--dingtalk-secret", default=None,
                         help="钉钉机器人加签密钥 (可选)")
    p_excel.add_argument("--notify-summary-only", action="store_true",
                         help="仅发送汇总告警 (不逐条发送失败告警)")
    p_excel.add_argument("--no-save-on-failure", action="store_true")

    for p in [p_single, p_csv, p_excel]:
        p.add_argument("-o", "--output-dir", default="outputs/screenshots")
        p.add_argument("-w", "--width", type=int, default=1440)
        p.add_argument("--height", type=int, default=900)
        p.add_argument("--no-full-page", action="store_true")
        p.add_argument("--wait-ms", type=int, default=2000)
        p.add_argument("--timeout-ms", type=int, default=30000)
        p.add_argument("--no-headless", action="store_true")

    parser.add_argument("url", nargs="?", default=None)
    parser.add_argument("-o", "--output-dir", default="outputs/screenshots")
    parser.add_argument("-f", "--filename", default=None)
    parser.add_argument("-w", "--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=900)
    parser.add_argument("--no-full-page", action="store_true")
    parser.add_argument("--wait-ms", type=int, default=2000)
    parser.add_argument("--timeout-ms", type=int, default=30000)
    parser.add_argument("--no-headless", action="store_true")

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    return args


def main(argv: Optional[list[str]] = None):
    args = _parse_args(argv)

    width = args.width
    height = args.height
    full_page = not args.no_full_page
    wait_ms = args.wait_ms
    timeout_ms = args.timeout_ms
    headless = not args.no_headless

    if args.url is not None and args.command is None:
        cfg = ScreenshotConfig(
            url=args.url,
            output_dir=args.output_dir,
            filename=getattr(args, "filename", None),
            width=width,
            height=height,
            full_page=full_page,
            wait_ms=wait_ms,
            headless=headless,
            timeout_ms=timeout_ms,
        )
        take_screenshot(cfg)

    elif args.command == "single":
        cfg = ScreenshotConfig(
            url=args.url,
            output_dir=args.output_dir,
            width=width,
            height=height,
            full_page=full_page,
            wait_ms=wait_ms,
            headless=headless,
            timeout_ms=timeout_ms,
        )
        take_screenshot(cfg)

    elif args.command in ("csv", "excel"):
        urls = load_urls(
            args.file_path,
            name_column=args.name_col,
            url_column=args.url_col,
        )
        save_on_failure = not getattr(args, "no_save_on_failure", False)
        failure_template = getattr(args, "failure_template", DEFAULT_FAILURE_TEMPLATE)
        retries = getattr(args, "retries", 3)
        retry_delay = getattr(args, "retry_delay", 2000)
        dingtalk_webhook = getattr(args, "dingtalk_webhook", None)
        dingtalk_secret = getattr(args, "dingtalk_secret", None)
        summary_only = getattr(args, "notify_summary_only", False)

        notifier = None
        if dingtalk_webhook:
            notifier = DingTalkNotifier(webhook=dingtalk_webhook, secret=dingtalk_secret)
            log.info("钉钉告警已启用: webhook=%s...%s",
                     dingtalk_webhook[:40], " (加签)" if dingtalk_secret else "")

        log.info("批量截图配置: %d 个 URL, 重试次数=%d, 重试间隔=%dms",
                 len(urls), retries, retry_delay)

        results = batch_screenshot(
            urls=urls,
            output_dir=args.output_dir,
            width=width,
            height=height,
            full_page=full_page,
            wait_ms=wait_ms,
            timeout_ms=timeout_ms,
            headless=headless,
            save_on_failure=save_on_failure,
            failure_filename_template=failure_template,
            max_retries=retries,
            retry_delay_ms=retry_delay,
            notifier=notifier,
            notify_each_failure=not summary_only,
        )
        print_batch_report(results)

        if notifier is not None:
            source = os.path.basename(args.file_path)
            notifier.notify_summary(source=source, results=results)


if __name__ == "__main__":
    main()