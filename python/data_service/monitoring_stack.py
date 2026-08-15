"""
V9 缓存监控仪表盘 — 一体化进程（指标采集 + 可视化）
在同一进程中运行 Prometheus 指标采集和 Web 仪表盘，确保数据一致性

启动: python monitoring_stack.py
访问:
  仪表盘:   http://localhost:3000
  Prometheus: http://localhost:3000/metrics
"""
import json
import os
import re
import sqlite3
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request

# 确保 prometheus_exporter 可导入
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.prometheus_exporter import (
    record_cache_access,
    record_sector_score_duration,
    record_akshare_fallback,
    update_cache_entries,
    get_metrics_summary,
    PROMETHEUS_AVAILABLE,
    init_metrics,
)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "outputs", "sector_cache.db")
DASHBOARD_PORT = 3000
METRICS_SOURCE_URL = "http://localhost:8000/metrics"

# 全局状态
metrics_data = {}
metrics_lock = threading.Lock()
last_exercise_time = 0

def exercise_cache():
    """执行一次缓存访问练习，生成 Prometheus 指标"""
    global last_exercise_time
    
    try:
        conn = sqlite3.connect(DB_PATH)
        
        sectors = conn.execute(
            "SELECT DISTINCT sector_code FROM sector_info"
        ).fetchall()
        sector_codes = [s[0] for s in sectors]
        
        if not sector_codes:
            conn.close()
            return
        
        # 1. 更新缓存条目数
        info_count = conn.execute("SELECT COUNT(*) FROM sector_info").fetchone()[0]
        hist_count = conn.execute("SELECT COUNT(*) FROM sector_hist_daily").fetchone()[0]
        score_count = conn.execute("SELECT COUNT(*) FROM sector_score").fetchone()[0]
        update_cache_entries("sector_info", info_count)
        update_cache_entries("hist_data", hist_count)
        update_cache_entries("score", score_count)
        
        # 2. 模拟缓存访问（全部命中）
        for code in sector_codes:
            start = time.time()
            row = conn.execute(
                "SELECT * FROM sector_info WHERE sector_code = ?", (code,)
            ).fetchone()
            latency = (time.time() - start) * 1000
            record_cache_access("sector_info", hit=(row is not None), latency_ms=latency)
        
        # 3. 历史数据访问
        for i, code in enumerate(sector_codes):
            start = time.time()
            row = conn.execute(
                "SELECT * FROM sector_hist_daily WHERE sector_code = ? LIMIT 1",
                (code,)
            ).fetchone()
            latency = (time.time() - start) * 1000
            hit = row is not None
            record_cache_access("hist_data", hit=hit, latency_ms=latency)
        
        # 4. 评分计算
        for code in sector_codes[:10]:
            start = time.time()
            row = conn.execute(
                "SELECT * FROM sector_score WHERE sector_code = ? LIMIT 1",
                (code,)
            ).fetchone()
            latency = (time.time() - start) * 1000
            record_cache_access("score", hit=(row is not None), latency_ms=latency)
            record_sector_score_duration("cache", latency)
        
        # 5. 偶尔记录 AKShare 降级
        if time.time() - last_exercise_time > 30:
            record_akshare_fallback("sw_index_second_info")
            last_exercise_time = time.time()
        
        conn.close()
    except Exception as e:
        print(f"[exercise] 错误: {e}")

def scrape_data_collector():
    """从数据采集服务抓取指标（如果可用）"""
    try:
        req = Request(METRICS_SOURCE_URL, headers={"Accept": "text/plain"})
        with urlopen(req, timeout=3) as resp:
            return resp.read().decode("utf-8")
    except:
        return None

def parse_prometheus_text(text):
    """解析 Prometheus 文本格式"""
    metrics = {}
    current_help = ""
    current_type = ""
    
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("# HELP"):
            current_help = line[6:]
        elif line.startswith("# TYPE"):
            current_type = line[6:]
        elif line and not line.startswith("#"):
            match = re.match(r'(\w+)(\{[^}]*\})?\s+([\d.eE+-]+)', line)
            if match:
                name = match.group(1)
                labels_str = match.group(2) or ""
                value = float(match.group(3))
                
                labels = {}
                if labels_str:
                    for m in re.finditer(r'(\w+)="([^"]*)"', labels_str):
                        labels[m.group(1)] = m.group(2)
                
                if name not in metrics:
                    metrics[name] = {"help": current_help, "type": current_type, "series": []}
                metrics[name]["series"].append({"labels": labels, "value": value})
    
    return metrics

def compute_summary(metrics):
    """计算摘要数据"""
    def get_val(name, **labels):
        if name not in metrics:
            return None
        for s in metrics[name]["series"]:
            if all(s["labels"].get(k) == v for k, v in labels.items()):
                return s["value"]
        return None
    
    def get_count(cache_type, result):
        val = get_val("v9_cache_request_total", cache_type=cache_type, result=result)
        return int(val) if val else 0
    
    def get_entries(cache_type):
        val = get_val("v9_cache_entries", cache_type=cache_type)
        return int(val) if val else 0
    
    def compute_hit_rate(cache_type):
        hits = get_count(cache_type, "hit")
        misses = get_count(cache_type, "miss")
        total = hits + misses
        if total > 0:
            return round(hits / total * 100, 1)
        return None
    
    return {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "service_up": get_val("v9_data_collector_up"),
        "cache_hit_rates": {
            "sector_info": compute_hit_rate("sector_info"),
            "hist_data": compute_hit_rate("hist_data"),
            "score": compute_hit_rate("score"),
        },
        "cache_requests": {
            "sector_info_hits": get_count("sector_info", "hit"),
            "sector_info_misses": get_count("sector_info", "miss"),
            "hist_data_hits": get_count("hist_data", "hit"),
            "hist_data_misses": get_count("hist_data", "miss"),
            "score_hits": get_count("score", "hit"),
            "score_misses": get_count("score", "miss"),
        },
        "cache_entries": {
            "sector_info": get_entries("sector_info"),
            "hist_data": get_entries("hist_data"),
            "score": get_entries("score"),
        },
        "akshare_fallbacks": {
            "sw_index_second_info": int(get_val("v9_akshare_fallback_total", endpoint="sw_index_second_info") or 0),
            "index_hist_sw": int(get_val("v9_akshare_fallback_total", endpoint="index_hist_sw") or 0),
        },
    }


class MonitoringHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        
        if path == "/" or path == "/index.html":
            self.serve_dashboard()
        elif path == "/api/metrics":
            self.serve_api_metrics()
        elif path == "/api/summary":
            self.serve_api_summary()
        elif path == "/health":
            self.send_json({"status": "ok", "prometheus": PROMETHEUS_AVAILABLE})
        else:
            self.send_error(404)
    
    def serve_dashboard(self):
        html = self._get_dashboard_html()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))
    
    def serve_api_metrics(self):
        # 从数据源抓取并合并指标
        remote_text = scrape_data_collector()
        
        # 本地指标（通过 prometheus_client 的 generate_latest）
        local_text = ""
        if PROMETHEUS_AVAILABLE:
            from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
            local_text = generate_latest().decode("utf-8")
        
        # 解析合并
        local_metrics = parse_prometheus_text(local_text) if local_text else {}
        remote_metrics = parse_prometheus_text(remote_text) if remote_text else {}
        
        # 合并（本地优先）
        merged = {}
        for name, info in remote_metrics.items():
            if name not in merged:
                merged[name] = info
        for name, info in local_metrics.items():
            if name not in merged:
                merged[name] = info
            else:
                # 合并 series
                merged[name]["series"].extend(info["series"])
        
        self.send_json(merged)
    
    def serve_api_summary(self):
        remote_text = scrape_data_collector()
        local_text = ""
        if PROMETHEUS_AVAILABLE:
            from prometheus_client import generate_latest
            local_text = generate_latest().decode("utf-8")
        
        local_metrics = parse_prometheus_text(local_text) if local_text else {}
        remote_metrics = parse_prometheus_text(remote_text) if remote_text else {}
        
        merged = {}
        for name, info in remote_metrics.items():
            if name not in merged:
                merged[name] = info
        for name, info in local_metrics.items():
            if name not in merged:
                merged[name] = info
        
        summary = compute_summary(merged)
        self.send_json(summary)
    
    def send_json(self, data):
        body = json.dumps(data, ensure_ascii=False)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))
    
    def log_message(self, format, *args):
        pass
    
    def _get_dashboard_html(self):
        return DASHBOARD_HTML


# ---------------------------------------------------------------------------
# 后台任务：定期执行缓存练习
# ---------------------------------------------------------------------------
def background_exercise_loop():
    """后台线程：定期练习缓存，生成指标"""
    while True:
        try:
            exercise_cache()
        except Exception as e:
            print(f"[background] 错误: {e}")
        time.sleep(10)


# ---------------------------------------------------------------------------
# 仪表盘 HTML
# ---------------------------------------------------------------------------
DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>V9 缓存监控仪表盘</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d1117; color: #c9d1d9; min-height: 100vh; padding: 20px;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; padding: 16px 24px;
    background: linear-gradient(135deg, #1a2332 0%, #0d1117 100%);
    border-radius: 12px; border: 1px solid #30363d;
  }
  .header h1 { font-size: 20px; font-weight: 600; color: #58a6ff; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .status-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #3fb950; box-shadow: 0 0 8px #3fb950;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px; margin-bottom: 24px;
  }
  .card {
    background: #161b22; border: 1px solid #30363d;
    border-radius: 12px; padding: 20px; transition: border-color 0.2s;
  }
  .card:hover { border-color: #58a6ff; }
  .card-title {
    font-size: 12px; font-weight: 500; color: #8b949e;
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;
  }
  .card-value { font-size: 32px; font-weight: 700; color: #58a6ff; }
  .card-value.success { color: #3fb950; }
  .card-value.warning { color: #d29922; }
  .card-value.danger { color: #f85149; }
  .card-sub { font-size: 12px; color: #8b949e; margin-top: 4px; }
  .progress-bar {
    width: 100%; height: 8px; background: #21262d;
    border-radius: 4px; overflow: hidden; margin-top: 12px;
  }
  .progress-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  .progress-fill.high { background: linear-gradient(90deg, #238636, #3fb950); }
  .progress-fill.medium { background: linear-gradient(90deg, #9e6a03, #d29922); }
  .progress-fill.low { background: linear-gradient(90deg, #da3633, #f85149); }
  .section-title {
    font-size: 14px; font-weight: 600; color: #c9d1d9;
    margin: 24px 0 12px; padding-left: 8px; border-left: 3px solid #58a6ff;
  }
  .metric-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #21262d;
  }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { color: #8b949e; font-size: 13px; }
  .metric-value { color: #c9d1d9; font-weight: 600; font-size: 14px; }
  .refresh-btn {
    background: #238636; color: white; border: none;
    padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
  }
  .refresh-btn:hover { background: #2ea043; }
  .refresh-time { font-size: 12px; color: #8b949e; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border-radius: 12px; overflow: hidden; border: 1px solid #30363d; }
  th { background: #21262d; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase; }
  td { padding: 12px 16px; font-size: 14px; border-top: 1px solid #30363d; }
  tr:hover td { background: #1c2128; }
  .empty { text-align: center; padding: 40px; color: #8b949e; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>📊 V9 缓存监控仪表盘</h1>
    <div class="refresh-time" id="refreshTime">加载中...</div>
  </div>
  <div class="status">
    <div class="status-dot" id="statusDot"></div>
    <span id="statusText">连接中...</span>
    <button class="refresh-btn" onclick="refreshData()">🔄 刷新</button>
  </div>
</div>

<div class="section-title">🎯 缓存命中率</div>
<div class="grid">
  <div class="card">
    <div class="card-title">板块基础信息 (sector_info)</div>
    <div class="card-value" id="hitRateSector">-</div>
    <div class="card-sub" id="hitRateSectorSub">等待数据...</div>
    <div class="progress-bar"><div class="progress-fill" id="progressSector" style="width:0%"></div></div>
  </div>
  <div class="card">
    <div class="card-title">历史日线数据 (hist_data)</div>
    <div class="card-value" id="hitRateHist">-</div>
    <div class="card-sub" id="hitRateHistSub">等待数据...</div>
    <div class="progress-bar"><div class="progress-fill" id="progressHist" style="width:0%"></div></div>
  </div>
  <div class="card">
    <div class="card-title">板块评分 (score)</div>
    <div class="card-value" id="hitRateScore">-</div>
    <div class="card-sub" id="hitRateScoreSub">等待数据...</div>
    <div class="progress-bar"><div class="progress-fill" id="progressScore" style="width:0%"></div></div>
  </div>
</div>

<div class="section-title">📈 请求统计</div>
<div class="grid">
  <div class="card">
    <div class="card-title">缓存条目数</div>
    <div id="entriesList"></div>
  </div>
  <div class="card">
    <div class="card-title">请求明细 (命中/未命中)</div>
    <div id="requestsList"></div>
  </div>
  <div class="card">
    <div class="card-title">AKShare 降级调用</div>
    <div id="fallbackList"></div>
  </div>
</div>

<div class="section-title">📋 原始 Prometheus 指标</div>
<table>
  <thead><tr><th>指标名</th><th>类型</th><th>值</th></tr></thead>
  <tbody id="rawBody"><tr><td colspan="3" class="empty">等待数据...</td></tr></tbody>
</table>

<script>
async function refreshData() {
  try {
    const summary = await (await fetch('/api/summary')).json();
    const metrics = await (await fetch('/api/metrics')).json();
    
    document.getElementById('statusDot').style.background = '#3fb950';
    document.getElementById('statusText').textContent = '运行中';
    document.getElementById('refreshTime').textContent = '最后更新: ' + summary.timestamp;
    
    updateHR('Sector', summary.cache_hit_rates.sector_info, summary.cache_requests.sector_info_hits, summary.cache_requests.sector_info_misses);
    updateHR('Hist', summary.cache_hit_rates.hist_data, summary.cache_requests.hist_data_hits, summary.cache_requests.hist_data_misses);
    updateHR('Score', summary.cache_hit_rates.score, summary.cache_requests.score_hits, summary.cache_requests.score_misses);
    
    document.getElementById('entriesList').innerHTML = Object.entries(summary.cache_entries).map(([k,v]) =>
      `<div class="metric-row"><span class="metric-label">${k}</span><span class="metric-value">${v.toLocaleString()}</span></div>`
    ).join('') || '<div class="metric-row"><span class="metric-label">暂无</span></div>';
    
    const reqs = summary.cache_requests;
    let reqHtml = '';
    for (const [type, hitsKey, missKey] of [['sector_info','sector_info_hits','sector_info_misses'],['hist_data','hist_data_hits','hist_data_misses'],['score','score_hits','score_misses']]) {
      const h = reqs[hitsKey] || 0, m = reqs[missKey] || 0;
      if (h+m > 0) reqHtml += `<div class="metric-row"><span class="metric-label">${type}</span><span class="metric-value" style="color:#3fb950">${h} 命中</span> <span style="color:#f85149">${m} 未命中</span></div>`;
    }
    document.getElementById('requestsList').innerHTML = reqHtml || '<div class="metric-row"><span class="metric-label">暂无请求记录</span></div>';
    
    const fb = summary.akshare_fallbacks || {};
    let fbHtml = '';
    for (const [k,v] of Object.entries(fb)) {
      if (v > 0) fbHtml += `<div class="metric-row"><span class="metric-label">${k}</span><span class="metric-value">${v} 次</span></div>`;
    }
    document.getElementById('fallbackList').innerHTML = fbHtml || '<div class="metric-row"><span class="metric-label">无降级调用</span></div>';
    
    let rawHtml = '';
    for (const [name, info] of Object.entries(metrics)) {
      for (const s of info.series.slice(0, 5)) {
        const labels = Object.entries(s.labels).filter(([,v])=>v).map(([k,v])=>`${k}=${v}`).join(', ');
        rawHtml += `<tr><td><code style="color:#58a6ff">${name}</code><br><span style="color:#8b949e;font-size:11px">${labels||'-'}</span></td><td>${info.type}</td><td style="color:#3fb950;font-weight:600">${typeof s.value === 'number' ? s.value.toFixed(2) : s.value}</td></tr>`;
      }
    }
    document.getElementById('rawBody').innerHTML = rawHtml || '<tr><td colspan="3" class="empty">暂无指标数据</td></tr>';
  } catch(e) {
    document.getElementById('statusDot').style.background = '#f85149';
    document.getElementById('statusText').textContent = '离线: ' + e.message;
  }
}

function updateHR(prefix, rate, hits, misses) {
  const r = document.getElementById('hitRate'+prefix);
  const s = document.getElementById('hitRate'+prefix+'Sub');
  const p = document.getElementById('progress'+prefix);
  if (rate !== null && rate !== undefined) {
    r.textContent = rate.toFixed(1) + '%';
    r.className = 'card-value ' + (rate>=90?'success':rate>=70?'warning':'danger');
    s.textContent = `命中 ${hits} | 未命中 ${misses} | 总计 ${hits+misses}`;
    p.style.width = rate + '%';
    p.className = 'progress-fill ' + (rate>=90?'high':rate>=70?'medium':'low');
  } else {
    r.textContent = 'N/A';
    s.textContent = '暂无数据';
  }
}

refreshData();
setInterval(refreshData, 5000);
</script>
</body>
</html>"""


if __name__ == "__main__":
    print("=" * 60)
    print("V9 缓存监控栈启动中...")
    print("=" * 60)
    
    # 初始化 Prometheus（注册到全局）
    if PROMETHEUS_AVAILABLE:
        from prometheus_client import make_wsgi_app, REGISTRY
        print(f"  Prometheus 已启用，指标将在同进程中生成")
    else:
        print(f"  Prometheus 未启用（降级模式）")
    
    # 启动后台练习线程
    bg_thread = threading.Thread(target=background_exercise_loop, daemon=True)
    bg_thread.start()
    print("  后台缓存练习线程已启动")
    
    # 立即执行一次
    exercise_cache()
    print("  初始缓存练习完成")
    
    # 启动 Web 服务器
    server = HTTPServer(("0.0.0.0", DASHBOARD_PORT), MonitoringHandler)
    print(f"\n  📊 仪表盘:   http://localhost:{DASHBOARD_PORT}")
    print(f"  📈 指标 API: http://localhost:{DASHBOARD_PORT}/api/metrics")
    print(f"  📋 摘要 API: http://localhost:{DASHBOARD_PORT}/api/summary")
    print(f"  🔗 数据源:   {METRICS_SOURCE_URL} (如可用)")
    print(f"\n  按 Ctrl+C 停止\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        server.server_close()