// charts.js — 股票分析模块设计文档图表
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- Chart: 合规评分五维度雷达图 ---
  var radarEl = document.getElementById('chart-radar');
  if (radarEl && typeof echarts !== 'undefined') {
    var chart = echarts.init(radarEl, null, { renderer: 'svg' });
    chart.setOption({
      animation: false,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        formatter: function(params) {
          var dims = ['层覆盖度', '证据充分度', '置信度等级', 'V6-LLM一致性', '规范遵循度'];
          var html = '<div style="font-weight:600;margin-bottom:6px;">' + params.name + '</div>';
          params.value.forEach(function(v, i) {
            html += dims[i] + ': <strong>' + v.toFixed(1) + '</strong><br/>';
          });
          return html;
        }
      },
      legend: {
        data: ['权重(%)', '目标得分', '最低合格线'],
        bottom: 0,
        textStyle: { color: muted, fontSize: 12 },
        itemGap: 20
      },
      radar: {
        center: ['50%', '48%'],
        radius: '65%',
        indicator: [
          { name: '层覆盖度\n(20%)', max: 5 },
          { name: '证据充分度\n(25%)', max: 5 },
          { name: '置信度等级\n(20%)', max: 5 },
          { name: 'V6-LLM一致性\n(15%)', max: 5 },
          { name: '规范遵循度\n(20%)', max: 5 }
        ],
        axisName: {
          color: ink,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 16
        },
        splitLine: { lineStyle: { color: rule } },
        splitArea: {
          areaStyle: {
            color: [bg2, 'transparent', bg2, 'transparent', bg2]
          }
        },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: [5.0, 5.0, 5.0, 5.0, 5.0],
            name: '目标得分',
            itemStyle: { color: accent },
            lineStyle: { color: accent, width: 2 },
            areaStyle: { color: accent, opacity: 0.12 },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            value: [4.0, 4.0, 4.0, 4.0, 4.0],
            name: '最低合格线',
            itemStyle: { color: accent2 },
            lineStyle: { color: accent2, width: 2, type: 'dashed' },
            areaStyle: { color: accent2, opacity: 0.08 },
            symbol: 'circle',
            symbolSize: 5
          },
          {
            value: [4.0, 5.0, 4.0, 3.0, 4.0],
            name: '权重(%)',
            itemStyle: { color: muted },
            lineStyle: { color: muted, width: 1.5, opacity: 0.5 },
            areaStyle: { color: muted, opacity: 0.05 },
            symbol: 'diamond',
            symbolSize: 7
          }
        ]
      }]
    });
    window.addEventListener('resize', function() { chart.resize(); });
  }
})();
