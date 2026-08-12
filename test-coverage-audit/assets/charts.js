(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- Chart: 六层架构测试覆盖率 ---
  var chart1 = echarts.init(document.getElementById('chart-layer-coverage'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      formatter: function(params) {
        var p = params[0];
        return p.name + '<br/>测试覆盖率: ' + p.value + '%';
      }
    },
    grid: { left: '15%', right: '10%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: ['L6 基础设施', 'L4 核心层', 'L2 应用层', 'L3 服务层', 'L1 表现层', 'L5 数据层'],
      axisLabel: { color: muted, fontSize: 12 },
      axisLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: muted, formatter: '{value}%' },
      splitLine: { lineStyle: { color: rule } },
    },
    series: [{
      type: 'bar',
      data: [
        { value: 81, itemStyle: { color: accent } },
        { value: 66.7, itemStyle: { color: accent } },
        { value: 42, itemStyle: { color: accent2 } },
        { value: 25.5, itemStyle: { color: '#f59e0b' } },
        { value: 22.6, itemStyle: { color: '#f59e0b' } },
        { value: 9.8, itemStyle: { color: '#ef4444' } },
      ],
      barWidth: '50%',
      label: {
        show: true,
        position: 'top',
        color: ink,
        fontSize: 12,
        fontWeight: 600,
        formatter: '{c}%',
      },
    }],
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart: 测试类型分布饼图 ---
  var chart2 = echarts.init(document.getElementById('chart-test-types'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: ink, fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: bg2, borderWidth: 2 },
      label: { show: false },
      data: [
        { value: 280, name: '单元测试', itemStyle: { color: accent } },
        { value: 47, name: 'E2E测试', itemStyle: { color: accent2 } },
        { value: 11, name: '集成测试', itemStyle: { color: '#10b981' } },
        { value: 12, name: '审计脚本测试', itemStyle: { color: '#8b5cf6' } },
        { value: 6, name: '快照测试', itemStyle: { color: '#f59e0b' } },
        { value: 5, name: '类型测试', itemStyle: { color: '#06b6d4' } },
        { value: 4, name: '契约测试', itemStyle: { color: '#ec4899' } },
        { value: 4, name: '修复验证', itemStyle: { color: '#64748b' } },
        { value: 2, name: '性能测试', itemStyle: { color: '#84cc16' } },
      ],
    }],
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart: 各模块测试文件数对比 ---
  var chart3 = echarts.init(document.getElementById('chart-module-coverage'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
    },
    legend: {
      top: '0%',
      textStyle: { color: ink, fontSize: 12 },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'category',
      data: ['lib', 'mcp', 'core', 'agents', 'cockpit', 'store', 'services', 'components', 'pages', 'data', 'hooks', 'apps'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
    },
    series: [
      {
        name: '源文件',
        type: 'bar',
        data: [23, 34, 30, 6, 32, 80, 280, 174, 78, 51, 11, 21],
        itemStyle: { color: bg2 },
        barWidth: '35%',
      },
      {
        name: '测试文件',
        type: 'bar',
        data: [20, 27, 20, 4, 16, 40, 70, 40, 12, 5, 1, 1],
        itemStyle: { color: accent },
        barWidth: '35%',
      },
    ],
  });
  window.addEventListener('resize', function() { chart3.resize(); });
})();
