(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var danger = style.getPropertyValue('--danger').trim();
  var success = style.getPropertyValue('--success').trim();
  var warning = style.getPropertyValue('--warning').trim();

  // Chart 1: Issues by cabin (stacked bar)
  var chart1 = echarts.init(document.getElementById('chart-issues'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
    legend: {
      data: ['排版问题', '颜色违规', '交互缺陷', '控制台错误'],
      textStyle: { color: muted, fontSize: 12 },
      top: 0
    },
    grid: { left: 80, right: 30, top: 40, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: ['首页', '驾驶舱', '输入舱Hub', '批量导入', '热门板块', '分析舱Hub', '个股评分', '板块分析', '行业评分', '智能评分', '智能资讯', '交易舱Hub', '持仓管理', '策略快照', '输出舱Hub', '研究报告', '交易复盘', '总控舱Hub', '智能体总控', '注册表', '任务列表', 'MCP管理', '系统监控'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { show: false }
    },
    series: [
      {
        name: '排版问题',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: warning },
        data: [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4]
      },
      {
        name: '颜色违规',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: danger },
        data: [1, 1, 6, 6, 8, 3, 4, 14, 6, 6, 7, 5, 8, 7, 3, 6, 6, 7, 6, 12, 1, 1, 7]
      },
      {
        name: '交互缺陷',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: accent },
        data: [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 7, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1]
      },
      {
        name: '控制台错误',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: muted },
        data: [2, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 3, 3, 3, 3, 49, 3, 3, 5, 5, 3]
      }
    ]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // Chart 2: Performance metrics comparison
  var chart2 = echarts.init(document.getElementById('chart-performance'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    legend: {
      data: ['FCP', 'LCP', 'TBT'],
      textStyle: { color: muted, fontSize: 12 },
      top: 0
    },
    grid: { left: 80, right: 60, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: ['首页', '输入舱', '分析舱', '交易舱', '输出舱'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted }
    },
    yAxis: [
      {
        type: 'value',
        name: '时间 (s)',
        nameTextStyle: { color: muted },
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'TBT (ms)',
        nameTextStyle: { color: muted },
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'FCP',
        type: 'bar',
        barWidth: '20%',
        itemStyle: { color: accent },
        data: [1.8, 1.8, 1.8, 2.5, 2.1]
      },
      {
        name: 'LCP',
        type: 'bar',
        barWidth: '20%',
        itemStyle: { color: accent2 },
        data: [2.3, 2.2, 2.2, 3.1, 2.5]
      },
      {
        name: 'TBT',
        type: 'line',
        yAxisIndex: 1,
        itemStyle: { color: success },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 8,
        data: [30, 10, 10, 130, 70]
      }
    ]
  });
  window.addEventListener('resize', function() { chart2.resize(); });
})();
