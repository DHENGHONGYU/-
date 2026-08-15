"""
V9 缓存监控仪表盘 — 轻量级 Grafana 替代方案
直接读取 Prometheus /metrics 端点，提供实时可视化

启动: python monitoring_dashboard.py
访问: http://localhost:3000
"""
import json
import re
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from collections import defaultdict

METRICS_URL = "http://localhost:8000/metrics"
DASHBOARD_PORT = 3000

def fetch_metrics():
    """从数据采集服务获取 Prometheus 指标"""
    try:
        req = Request(METRICS_URL, headers={"Accept": "text/plain"})
        with urlopen(req, timeout=5) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        return f"# ERROR: {e}"

def parse_metrics(text):
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
            # 解析指标行
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
                
                metrics[name]["series"].append({
                    "labels": labels,
                    "value": value,
                })
    
    return metrics

def get_metric_value(metrics, name, label_key=None, label_value=None):
    """获取特定指标值"""
    if name not in metrics:
        return None
    for s in metrics[name]["series"]:
        if label_key is None or s["labels"].get(label_key) == label_value:
            return s["value"]
    return None

def get_cache_hit_rate(metrics, cache_type):
    """计算缓存命中率"""
    hits = 0
    total = 0
    if "v9_cache_request_total" in metrics:
        for s in metrics["v9_cache_request_total"]["series"]:
            if s["labels"].get("cache_type") == cache_type:
                if s["labels"].get("result") == "hit":
                    hits = s["value"]
                else:
                    total += s["value"]
        total += hits
    if total > 0:
        return round(hits / total * 100, 1)
    return None

class DashboardHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.serve_dashboard()
        elif self.path == "/api/metrics":
            self.serve_api_metrics()
        elif self.path == "/api/summary":
            self.serve_api_summary()
        else:
            self.send_error(404)
    
    def serve_dashboard(self):
        html = DASHBOARD_HTML
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))
    
    def serve_api_metrics(self):
        raw = fetch_metrics()
        parsed = parse_metrics(raw)
        data = {}
        for name, info in parsed.items():
            data[name] = {
                "help": info["help"],
                "type": info["type"],
                "series": info["series"],
            }
        self.send_json(data)
    
    def serve_api_summary(self):
        raw = fetch_metrics()
        parsed = parse_metrics(raw)
        
        summary = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "service_up": get_metric_value(parsed, "v9_data_collector_up"),
            "cache_hit_rates": {
                "sector_info": get_cache_hit_rate(parsed, "sector_info"),
                "hist_data": get_cache_hit_rate(parsed, "hist_data"),
                "score": get_cache_hit_rate(parsed, "score"),
            },
            "cache_requests": {
                "sector_info_hits": self._count_requests(parsed, "sector_info", "hit"),
                "sector_info_misses": self._count_requests(parsed, "sector_info", "miss"),
                "hist_data_hits": self._count_requests(parsed, "hist_data", "hit"),
                "hist_data_misses": self._count_requests(parsed, "hist_data", "miss"),
                "score_hits": self._count_requests(parsed, "score", "hit"),
                "score_misses": self._count_requests(parsed, "score", "miss"),
            },
            "cache_entries": self._get_cache_entries(parsed),
            "latency_p50": self._get_latency_percentile(parsed, 0.5),
            "latency_p99": self._get_latency_percentile(parsed, 0.99),
        }
        
        self.send_json(summary)
    
    def _count_requests(self, parsed, cache_type, result):
        if "v9_cache_request_total" not in parsed:
            return 0
        total = 0
        for s in parsed["v9_cache_request_total"]["series"]:
            if s["labels"].get("cache_type") == cache_type and s["labels"].get("result") == result:
                total += s["value"]
        return int(total)
    
    def _get_cache_entries(self, parsed):
        entries = {}
        if "v9_cache_entries" in parsed:
            for s in parsed["v9_cache_entries"]["series"]:
                ct = s["labels"].get("cache_type", "unknown")
                entries[ct] = int(s["value"])
        return entries
    
    def _get_latency_percentile(self, parsed, pct):
        if "v9_cache_latency_seconds" not in parsed:
            return None
        # 简化计算：取所有 latency bucket 中最大值
        max_val = 0
        for s in parsed["v9_cache_latency_seconds"]["series"]:
            if s["value"] > max_val:
                max_val = s["value"]
        return round(max_val * 1000, 2)  # 转为毫秒
    
    def send_json(self, data):
        body = json.dumps(data, ensure_ascii=False)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))
    
    def log_message(self, format, *args):
        pass  # 静默日志

# ---------------------------------------------------------------------------
# 仪表盘 HTML (Grafana 风格)
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
    background: #0d1117;
    color: #c9d1d9;
    min-height: 100vh;
    padding: 20px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding: 16px 24px;
    background: linear-gradient(135deg, #1a2332 0%, #0d1117 100%);
    border-radius: 12px;
    border: 1px solid #30363d;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #58a6ff;
  }
  .header .status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #3fb950;
    box-shadow: 0 0 8px #3fb950;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 20px;
    transition: border-color 0.2s;
  }
  .card:hover { border-color: #58a6ff; }
  .card-title {
    font-size: 12px;
    font-weight: 500;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .card-value {
    font-size: 32px;
    font-weight: 700;
    color: #58a6ff;
  }
  .card-value.success { color: #3fb950; }
  .card-value.warning { color: #d29922; }
  .card-value.danger { color: #f85149; }
  .card-sub {
    font-size: 12px;
    color: #8b949e;
    margin-top: 4px;
  }
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #21262d;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 12px;
  }
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  .progress-fill.high { background: linear-gradient(90deg, #238636, #3fb950); }
  .progress-fill.medium { background: linear-gradient(90deg, #9e6a03, #d29922); }
  .progress-fill.low { background: linear-gradient(90deg, #da3633, #f85149); }
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #c9d1d9;
    margin: 24px 0 12px;
    padding-left: 8px;
    border-left: 3px solid #58a6ff;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    background: #161b22;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #30363d;
  }
  .table th {
    background: #21262d;
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
  }
  .table td {
    padding: 12px 16px;
    font-size: 14px;
    border-top: 1px solid #30363d;
  }
  .table tr:hover td { background: #1c2128; }
  .refresh-btn {
    background: #238636;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }
  .refresh-btn:hover { background: #2ea043; }
  .refresh-time {
    font-size: 12px;
    color: #8b949e;
  }
  .empty-state {
    text-align: center;
    padding: 40px;
    color: #8b949e;
  }
  .empty-state .icon { font-size: 48px; margin-bottom: 12px; }
  .metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #21262d;
  }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { color: #8b949e; font-size: 13px; }
  .metric-value { color: #c9d1d9; font-weight: 600; font-size: 14px; }
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

<!-- 缓存命中率卡片 -->
<div class="section-title">🎯 缓存命中率</div>
<div class="grid" id="hitRateCards">
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

<!-- 统计数据 -->
<div class="section-title">📈 请求统计</div>
<div class="grid" id="statsCards">
  <div class="card">
    <div class="card-title">缓存条目数</div>
    <div id="entriesList" style="margin-top:8px"></div>
  </div>
  <div class="card">
    <div class="card-title">请求明细</div>
    <div id="requestsList" style="margin-top:8px"></div>
  </div>
  <div class="card">
    <div class="card-title">延迟指标</div>
    <div id="latencyList" style="margin-top:8px"></div>
  </div>
</div>

<!-- 原始指标表 -->
<div class="section-title">📋 原始 Prometheus 指标</div>
<div id="rawMetricsContainer">
  <table class="table">
    <thead>
      <tr><th>指标名</th><th>类型</th><th>值</th></tr>
    </thead>
    <tbody id="rawMetricsBody">
      <tr><td colspan="3" class="empty-state">等待数据...</td></tr>
    </tbody>
  </table>
</div>

<script>
async function refreshData() {
  try {
    const summaryResp = await fetch('/api/summary');
    const summary = await summaryResp.json();
    const metricsResp = await fetch('/api/metrics');
    const metrics = await metricsResp.json();
    
    // 更新状态
    document.getElementById('statusDot').style.background = '#3fb950';
    document.getElementById('statusText').textContent = '运行中';
    document.getElementById('refreshTime').textContent = '最后更新: ' + summary.timestamp;
    
    // 更新命中率卡片
    updateHitRateCard('Sector', summary.cache_hit_rates.sector_info, 
      summary.cache_requests.sector_info_hits, summary.cache_requests.sector_info_misses);
    updateHitRateCard('Hist', summary.cache_hit_rates.hist_data,
      summary.cache_requests.hist_data_hits, summary.cache_requests.hist_data_misses);
    updateHitRateCard('Score', summary.cache_hit_rates.score,
      summary.cache_requests.score_hits, summary.cache_requests.score_misses);
    
    // 更新统计卡片
    updateEntriesList(summary.cache_entries);
    updateRequestsList(summary.cache_requests);
    updateLatencyList(summary.latency_p50, summary.latency_p99);
    
    // 更新原始指标表
    updateRawMetrics(metrics);
    
  } catch (e) {
    document.getElementById('statusDot').style.background = '#f85149';
    document.getElementById('statusText').textContent = '离线';
    console.error(e);
  }
}

function updateHitRateCard(prefix, rate, hits, misses) {
  const rateEl = document.getElementById('hitRate' + prefix);
  const subEl = document.getElementById('hitRate' + prefix + 'Sub');
  const progressEl = document.getElementById('progress' + prefix);
  
  if (rate !== null && rate !== undefined) {
    rateEl.textContent = rate.toFixed(1) + '%';
    rateEl.className = 'card-value ' + (rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger');
    subEl.textContent = `命中 ${hits} | 未命中 ${misses} | 总计 ${hits + misses}`;
    progressEl.style.width = rate + '%';
    progressEl.className = 'progress-fill ' + (rate >= 90 ? 'high' : rate >= 70 ? 'medium' : 'low');
  } else {
    rateEl.textContent = 'N/A';
    subEl.textContent = '暂无数据';
  }
}

function updateEntriesList(entries) {
  const container = document.getElementById('entriesList');
  if (Object.keys(entries).length === 0) {
    container.innerHTML = '<div class="metric-row"><span class="metric-label">暂无缓存</span></div>';
    return;
  }
  container.innerHTML = Object.entries(entries).map(([k, v]) => 
    `<div class="metric-row"><span class="metric-label">${k}</span><span class="metric-value">${v.toLocaleString()}</span></div>`
  ).join('');
}

function updateRequestsList(req) {
  const container = document.getElementById('requestsList');
  const items = [];
  if (req.sector_info_hits || req.sector_info_misses) {
    items.push(`<div class="metric-row"><span class="metric-label">sector_info</span><span class="metric-value">命中 ${req.sector_info_hits} / 未命中 ${req.sector_info_misses}</span></div>`);
  }
  if (req.hist_data_hits || req.hist_data_misses) {
    items.push(`<div class="metric-row"><span class="metric-label">hist_data</span><span class="metric-value">命中 ${req.hist_data_hits} / 未命中 ${req.hist_data_misses}</span></div>`);
  }
  if (req.score_hits || req.score_misses) {
    items.push(`<div class="metric-row"><span class="metric-label">score</span><span class="metric-value">命中 ${req.score_hits} / 未命中 ${req.score_misses}</span></div>`);
  }
  if (items.length === 0) items.push('<div class="metric-row"><span class="metric-label">暂无请求记录</span></div>');
  container.innerHTML = items.join('');
}

function updateLatencyList(p50, p99) {
  const container = document.getElementById('latencyList');
  const items = [];
  if (p50 !== null) items.push(`<div class="metric-row"><span class="metric-label">P50 延迟</span><span class="metric-value">${p50}ms</span></div>`);
  if (p99 !== null) items.push(`<div class="metric-row"><span class="metric-label">P99 延迟</span><span class="metric-value">${p99}ms</span></div>`);
  if (items.length === 0) items.push('<div class="metric-row"><span class="metric-label">暂无延迟数据</span></div>');
  container.innerHTML = items.join('');
}

function updateRawMetrics(metrics) {
  const tbody = document.getElementById('rawMetricsBody');
  const rows = [];
  for (const [name, info] of Object.entries(metrics)) {
    for (const series of info.series.slice(0, 3)) {
      const labelStr = Object.entries(series.labels)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || '-';
      rows.push(`<tr>
        <td><code style="color:#58a6ff">${name}</code><br><span style="color:#8b949e;font-size:11px">${labelStr}</span></td>
        <td>${info.type}</td>
        <td style="color:#3fb950;font-weight:600">${series.value}</td>
      </tr>`);
    }
  }
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">暂无指标数据（触发 API 调用后将自动生成）</td></tr>';
  } else {
    tbody.innerHTML = rows.join('');
  }
}

// 自动刷新
refreshData();
setInterval(refreshData, 5000);
</script>

</body>
</html>"""

if __name__ == "__main__":
    print(f"启动 V9 缓存监控仪表盘...")
    print(f"  仪表盘: http://localhost:{DASHBOARD_PORT}")
    print(f"  数据源: {METRICS_URL}")
    print(f"  按 Ctrl+C 停止")
    
    server = HTTPServer(("0.0.0.0", DASHBOARD_PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        server.server_close()