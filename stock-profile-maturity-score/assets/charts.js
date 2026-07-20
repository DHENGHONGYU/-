(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#2563eb';
  var accent2 = style.getPropertyValue('--accent2').trim() || '#7c3aed';
  var ink = style.getPropertyValue('--ink').trim() || '#1a1f2e';
  var muted = style.getPropertyValue('--muted').trim() || '#64748b';
  var rule = style.getPropertyValue('--rule').trim() || '#e2e8f0';
  var bg2 = style.getPropertyValue('--bg2').trim() || '#ffffff';
  var success = '#10b981';
  var warning = '#f59e0b';
  var danger = '#ef4444';

  // --- Chart: Radar Comparison ---
  var radarChart = echarts.init(document.getElementById('radar-chart'), null, { renderer: 'svg' });
  radarChart.setOption({
    animation: false,
    tooltip: { appendToBody: true },
    legend: {
      data: ['V9当前水平', '行业标杆（同花顺/东财）', '第一梯队（雪球/富途）'],
      bottom: 0,
      textStyle: { color: ink, fontSize: 13 }
    },
    radar: {
      indicator: [
        { name: '资料覆盖广度', max: 100 },
        { name: '数据质量与深度', max: 100 },
        { name: '分层组织能力', max: 100 },
        { name: '评分支撑能力', max: 100 },
        { name: 'AI智能化程度', max: 100 },
        { name: '社区与UGC融合', max: 100 },
        { name: '文件化与可移植性', max: 100 }
      ],
      center: ['50%', '45%'],
      radius: '65%',
      axisName: {
        color: ink,
        fontSize: 13,
        fontWeight: 500
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(37,99,235,0.02)', 'rgba(37,99,235,0.04)', 'rgba(37,99,235,0.06)', 'rgba(37,99,235,0.08)', 'rgba(37,99,235,0.10)']
        }
      },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [30, 40, 45, 65, 30, 25, 20],
          name: 'V9当前水平',
          lineStyle: { color: accent, width: 2 },
          areaStyle: { color: accent + '30' },
          itemStyle: { color: accent }
        },
        {
          value: [95, 95, 90, 80, 92, 70, 30],
          name: '行业标杆（同花顺/东财）',
          lineStyle: { color: success, width: 2 },
          areaStyle: { color: success + '15' },
          itemStyle: { color: success }
        },
        {
          value: [75, 75, 80, 65, 70, 95, 40],
          name: '第一梯队（雪球/富途）',
          lineStyle: { color: warning, width: 2 },
          areaStyle: { color: warning + '15' },
          itemStyle: { color: warning }
        }
      ]
    }]
  });

  // --- Chart: Roadmap Progress ---
  var roadmapChart = echarts.init(document.getElementById('roadmap-chart'), null, { renderer: 'svg' });
  roadmapChart.setOption({
    animation: false,
    tooltip: { appendToBody: true, trigger: 'axis' },
    grid: { left: 60, right: 40, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['当前', '阶段1\n(1-2月)', '阶段2\n(2-4月)', '阶段3\n(4-6月)', '阶段4\n(6-9月)', '阶段5\n(9-12月)'],
      axisLabel: { color: muted, fontSize: 12, interval: 0 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      name: '成熟度评分',
      nameTextStyle: { color: muted, fontSize: 12 },
      axisLabel: { color: muted, fontSize: 12 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [{
      type: 'line',
      data: [42, 55, 70, 80, 88, 92],
      smooth: true,
      lineStyle: { color: accent, width: 3 },
      itemStyle: { color: accent, borderWidth: 2, borderColor: bg2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: accent + '30' },
            { offset: 1, color: accent + '05' }
          ]
        }
      },
      label: {
        show: true,
        position: 'top',
        color: ink,
        fontSize: 13,
        fontWeight: 600,
        formatter: '{c}分'
      },
      markArea: {
        silent: true,
        data: [
          [{ yAxis: 0, itemStyle: { color: danger + '10' } }, { yAxis: 40 }],
          [{ yAxis: 40, itemStyle: { color: warning + '10' } }, { yAxis: 60 }],
          [{ yAxis: 60, itemStyle: { color: success + '08' } }, { yAxis: 75 }],
          [{ yAxis: 75, itemStyle: { color: accent + '08' } }, { yAxis: 100 }]
        ]
      }
    }]
  });

  window.addEventListener('resize', function() {
    radarChart.resize();
    roadmapChart.resize();
  });
})();
