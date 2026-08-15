"""Playwright 截图自动化测试：复用 screenshot_core.ScreenshotConfig + take_screenshot."""
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.screenshot_core import ScreenshotConfig, take_screenshot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("screenshot-test")

SCREENSHOT_DIR = Path("outputs") / "test-screenshots"

TEST_URLS = [
    ("baidu", "https://www.baidu.com"),
    ("github", "https://github.com"),
    ("example", "https://example.com"),
]


@pytest.fixture(scope="module", autouse=True)
def ensure_output_dir():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    log.info("输出目录已确保存在: %s", SCREENSHOT_DIR)
    yield


class TestScreenshot:
    """端到端截图测试套件."""

    @pytest.mark.parametrize("name,url", TEST_URLS)
    def test_page_screenshot(self, name: str, url: str):
        log.info("=" * 60)
        log.info("开始测试: name=%s  url=%s", name, url)
        log.info("时间: %s", datetime.now().isoformat())

        cfg = ScreenshotConfig(
            url=url,
            output_dir=str(SCREENSHOT_DIR),
            filename=f"{name}-homepage.png",
            width=1440,
            height=900,
            full_page=True,
            wait_ms=2000,
            timeout_ms=30000,
        )
        log.info("配置: %s", cfg)

        t0 = time.time()
        try:
            result = take_screenshot(cfg)
            elapsed = (time.time() - t0) * 1000
            log.info("截图完成: %s  耗时: %.0fms", result, elapsed)
        except Exception:
            elapsed = (time.time() - t0) * 1000
            log.error("截图失败! 耗时: %.0fms", elapsed)
            raise

        assert os.path.isfile(result), f"截图文件不存在: {result}"
        size_kb = os.path.getsize(result) / 1024
        log.info("文件大小: %.1f KB", size_kb)
        assert os.path.getsize(result) > 1024, f"截图文件过小: {result} ({size_kb:.1f} KB)"
        log.info("测试通过: %s", name)

    def test_custom_viewport(self):
        log.info("=" * 60)
        log.info("开始测试: custom_viewport (移动端 375x812)")

        cfg = ScreenshotConfig(
            url="https://example.com",
            output_dir=str(SCREENSHOT_DIR),
            filename="example-mobile.png",
            width=375,
            height=812,
            full_page=False,
            wait_ms=1500,
            timeout_ms=30000,
        )
        log.info("配置: %dx%d  full_page=%s", cfg.width, cfg.height, cfg.full_page)

        t0 = time.time()
        result = take_screenshot(cfg)
        elapsed = (time.time() - t0) * 1000
        log.info("截图完成: %s  耗时: %.0fms", result, elapsed)

        assert os.path.isfile(result)
        size_kb = os.path.getsize(result) / 1024
        log.info("文件大小: %.1f KB", size_kb)
        assert os.path.getsize(result) > 512
        log.info("测试通过: custom_viewport")

    def test_full_page_vs_viewport(self):
        log.info("=" * 60)
        log.info("开始测试: full_page_vs_viewport 对比")

        cfg_full = ScreenshotConfig(
            url="https://example.com",
            output_dir=str(SCREENSHOT_DIR),
            filename="example-full.png",
            full_page=True,
            wait_ms=1500,
            timeout_ms=30000,
        )
        cfg_view = ScreenshotConfig(
            url="https://example.com",
            output_dir=str(SCREENSHOT_DIR),
            filename="example-viewport.png",
            full_page=False,
            wait_ms=1500,
            timeout_ms=30000,
        )

        t0 = time.time()
        path_full = take_screenshot(cfg_full)
        t1 = time.time()
        log.info("全页截图完成: %s  耗时: %.0fms", path_full, (t1 - t0) * 1000)

        path_view = take_screenshot(cfg_view)
        t2 = time.time()
        log.info("可视区截图完成: %s  耗时: %.0fms", path_view, (t2 - t1) * 1000)

        size_full = os.path.getsize(path_full)
        size_view = os.path.getsize(path_view)
        log.info("全页: %.1f KB  可视区: %.1f KB", size_full / 1024, size_view / 1024)

        assert size_full >= size_view, (
            f"全页截图 ({size_full}) 应 >= 可视区截图 ({size_view})"
        )
        log.info("测试通过: full_page_vs_viewport")