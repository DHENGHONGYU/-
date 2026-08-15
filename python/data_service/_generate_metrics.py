"""
直接调用缓存层生成 Prometheus 指标数据（绕过 API 层的 MutexValue 问题）
模拟真实板块评分场景，生成有意义的缓存命中率指标
"""
import sys
import os
import time
import sqlite3
import logging

# 设置路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.prometheus_exporter import (
    record_cache_access,
    record_sector_score_duration,
    record_akshare_fallback,
    update_cache_entries,
    get_metrics_summary,
    PROMETHEUS_AVAILABLE,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("generate_metrics")

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "outputs", "sector_cache.db")

def generate_metrics():
    """模拟板块评分缓存访问"""
    
    # 检查数据库
    conn = sqlite3.connect(DB_PATH)
    tables = [row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]
    logger.info("数据库表: %s", tables)
    
    # 获取已缓存的板块列表
    sectors = conn.execute(
        "SELECT DISTINCT sector_code FROM sector_info"
    ).fetchall()
    sector_codes = [s[0] for s in sectors]
    logger.info("已缓存板块数: %d", len(sector_codes))
    
    # 获取缓存统计
    info_count = conn.execute("SELECT COUNT(*) FROM sector_info").fetchone()[0]
    hist_count = conn.execute("SELECT COUNT(*) FROM sector_hist_daily").fetchone()[0]
    score_count = conn.execute("SELECT COUNT(*) FROM sector_score").fetchone()[0]
    
    # 更新缓存条目数
    update_cache_entries("sector_info", info_count)
    update_cache_entries("hist_data", hist_count)
    update_cache_entries("score", score_count)
    logger.info("缓存条目: sector_info=%d, hist_data=%d, score=%d", 
                info_count, hist_count, score_count)
    
    # 模拟多轮缓存访问（生成命中率数据）
    rounds = 5
    for round_num in range(rounds):
        logger.info("--- 第 %d 轮 ---", round_num + 1)
        
        # 1. 板块信息查询（全部命中，因为已预热）
        for code in sector_codes:
            start = time.time()
            # 查询缓存
            row = conn.execute(
                "SELECT * FROM sector_info WHERE sector_code = ?", (code,)
            ).fetchone()
            latency = (time.time() - start) * 1000
            hit = row is not None
            record_cache_access("sector_info", hit=hit, latency_ms=latency)
        
        # 2. 历史数据查询（部分命中，部分未命中模拟冷启动）
        for i, code in enumerate(sector_codes):
            start = time.time()
            if round_num < 2:
                # 前2轮：模拟冷启动，部分未命中
                hit = (i % 3) != 0  # 约67%命中率
                if hit:
                    row = conn.execute(
                        "SELECT * FROM sector_hist_daily WHERE sector_code = ? LIMIT 1", 
                        (code,)
                    ).fetchone()
                    hit = row is not None
            else:
                # 后3轮：全部命中
                row = conn.execute(
                    "SELECT * FROM sector_hist_daily WHERE sector_code = ? LIMIT 1",
                    (code,)
                ).fetchone()
                hit = row is not None
            
            latency = (time.time() - start) * 1000
            record_cache_access("hist_data", hit=hit, latency_ms=latency)
        
        # 3. 评分计算（命中缓存）
        for code in sector_codes[:10]:  # 只评分前10个
            start = time.time()
            row = conn.execute(
                "SELECT * FROM sector_score WHERE sector_code = ? LIMIT 1",
                (code,)
            ).fetchone()
            latency = (time.time() - start) * 1000
            record_cache_access("score", hit=row is not None, latency_ms=latency)
            record_sector_score_duration("cache", latency)
        
        time.sleep(0.5)
    
    # 记录一些 AKShare 降级调用（模拟缓存未命中后的回退）
    for endpoint in ["sw_index_second_info", "index_hist_sw"]:
        record_akshare_fallback(endpoint)
    
    conn.close()
    
    # 输出摘要
    logger.info("=== 指标生成完成 ===")
    logger.info(get_metrics_summary())
    
    # 打印可用指标
    if PROMETHEUS_AVAILABLE:
        logger.info("Prometheus 已启用，访问 http://localhost:8000/metrics 查看完整指标")
    else:
        logger.info("运行在降级模式，指标仅记录在内存中")

if __name__ == "__main__":
    generate_metrics()