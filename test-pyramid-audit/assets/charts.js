(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var success = style.getPropertyValue('--success').trim();
  var warning = style.getPropertyValue('--warning').trim();
  var danger = style.getPropertyValue('--danger').trim();

  // --- Chart: 理想测试金字塔 vs 当前状态对比 ---
  var chart1 = echarts.init(document.getElementById('chart-pyramid-compare'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: function(p) {
        return p.seriesName + '<br/>' + p.name + ': ' + p.value + '%';
      }
    },
    legend: {
      top: '0%',
      textStyle: { color: ink, fontSize: 12 },
    },
    grid: { left: '5%', right: '5%', top: '15%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['E2E / UI 测试', '集成测试', '单元测试'],
      axisLabel: { color: ink, fontSize: 12, fontWeight: 500 },
      axisLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: muted, formatter: '{value}%' },
      splitLine: { lineStyle: { color: rule } },
    },
    series: [
      {
        name: '理想比例',
        type: 'bar',
        data: [
          { value: 10, itemStyle: { color: success + '55' } },
          { value: 20, itemStyle: { color: success + '77' } },
          { value: 70, itemStyle: { color: success } },
        ],
        barWidth: '30%',
        barGap: '30%',
        label: {
          show: true,
          position: 'top',
          color: success,
          fontSize: 12,
          fontWeight: 600,
          formatter: '{c}%',
        },
      },
      {
        name: '当前状态',
        type: 'bar',
        data: [
          { value: 9.9, itemStyle: { color: danger } },
          { value: 2.3, itemStyle: { color: danger } },
          { value: 58.7, itemStyle: { color: warning } },
        ],
        barWidth: '30%',
        label: {
          show: true,
          position: 'top',
          color: danger,
          fontSize: 12,
          fontWeight: 600,
          formatter: '{c}%',
        },
      },
    ],
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart: 测试类型分布占比（细化版） ---
  var chart2 = echarts.init(document.getElementById('chart-type-distribution'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: '{b}: {c} 个 ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { color: ink, fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: 280, name: '单元测试', itemStyle: { color: accent } },
        { value: 47, name: 'E2E测试', itemStyle: { color: accent2 } },
        { value: 12, name: '审计脚本测试', itemStyle: { color: '#8b5cf6' } },
        { value: 11, name: '集成测试', itemStyle: { color: success } },
        { value: 8, name: '回归/修复验证', itemStyle: { color: '#f59e0b' } },
        { value: 6, name: '快照测试', itemStyle: { color: '#ec4899' } },
        { value: 5, name: '类型测试', itemStyle: { color: '#06b6d4' } },
        { value: 4, name: '契约测试', itemStyle: { color: '#10b981' } },
        { value: 2, name: '性能测试', itemStyle: { color: '#84cc16' } },
      ],
    }],
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart: 各维度评分雷达图 ---
  var chart3 = echarts.init(document.getElementById('chart-score-radar'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: {
      appendToBody: true,
    },
    radar: {
      indicator: [
        { name: '金字塔结构', max: 100 },
        { name: '单元测试覆盖', max: 100 },
        { name: '集成测试覆盖', max: 100 },
        { name: 'E2E测试体系', max: 100 },
        { name: '测试分层完整性', max: 100 },
        { name: '业务层保障', max: 100 },
        { name: '测试执行效率', max: 100 },
        { name: '测试可维护性', max: 100 },
      ],
      axisName: { color: ink, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      splitArea: { areaStyle: { color: [bg2, 'transparent'] } },
      axisLine: { lineStyle: { color: rule } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [35, 60, 15, 75, 85, 30, 65, 55],
          name: '当前评分',
          areaStyle: { color: accent + '22' },
          lineStyle: { color: accent, width: 2 },
          itemStyle: { color: accent },
        },
        {
          value: [90, 85, 80, 80, 90, 85, 80, 85],
          name: '理想目标',
          areaStyle: { color: success + '15' },
          lineStyle: { color: success, width: 2, type: 'dashed' },
          itemStyle: { color: success },
        },
      ],
    }],
  });
  window.addEventListener('resize', function() { chart3.resize(); });

  // --- Chart: 整改路线图时间轴 ---
  var chart4 = echarts.init(document.getElementById('chart-roadmap'), null, { renderer: 'svg' });
  chart4.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      axisPointer: { type: 'shadow' },
    },
    legend: {
      top: '0%',
      textStyle: { color: ink, fontSize: 11 },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'category',
      data: ['P3 长期治理', 'P2 中期优化', 'P1 近期补充', 'P0 立即整改'],
      axisLabel: { color: ink, fontSize: 12, fontWeight: 500 },
      axisLine: { lineStyle: { color: rule } },
    },
    series: [
      {
        name: '单元测试增量',
        type: 'bar',
        stack: 'total',
        data: [30, 60, 80, 50],
        itemStyle: { color: accent },
      },
      {
        name: '集成测试增量',
        type: 'bar',
        stack: 'total',
        data: [10, 25, 30, 15],
        itemStyle: { color: accent2 },
      },
      {
        name: 'E2E测试增量',
        type: 'bar',
        stack: 'total',
        data: [5, 8, 5, 2],
        itemStyle: { color: '#8b5cf6' },
      },
    ],
  });
  window.addEventListener('resize', function() { chart4.resize(); });
})();
