(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var red = '#ef4444';
  var yellow = '#eab308';
  var green = '#22c55e';

  // --- Chart 1: Hardcode Distribution ---
  var chart1 = echarts.init(document.getElementById('chart-hardcode'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['静默回退', '魔法数字', 'Tailwind 颜色', 'HEX 颜色'],
      axisLabel: { color: muted, fontSize: 12 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '数量',
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: [
        { value: 704, itemStyle: { color: red } },
        { value: 418, itemStyle: { color: accent2 } },
        { value: 218, itemStyle: { color: accent } },
        { value: 10, itemStyle: { color: muted } }
      ],
      barWidth: '50%',
      label: {
        show: true,
        position: 'top',
        color: ink,
        fontSize: 12,
        fontWeight: 600
      }
    }]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart 2: Component Usage ---
  var chart2 = echarts.init(document.getElementById('chart-components'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: 'var(--bg)', borderWidth: 2 },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}\n{c}',
        color: muted,
        fontSize: 12
      },
      emphasis: { label: { fontSize: 16, fontWeight: 'bold' } },
      data: [
        { value: 28, name: '可复用组件', itemStyle: { color: green } },
        { value: 22, name: '单次使用', itemStyle: { color: accent2 } },
        { value: 66, name: '未使用组件', itemStyle: { color: red } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart 3: MCP Gap Impact Heatmap ---
  var chart3 = echarts.init(document.getElementById('chart-gap-heatmap'), null, { renderer: 'svg' });
  var xData = ['Server 抽象', 'Tool 协议', 'Resource 模板', 'Prompt 模板'];
  var yData = ['可维护性', '可扩展性', '可测试性', 'Agent 能力', '代码复用', '类型安全'];
  var heatData = [
    [0, 0, 5], [0, 1, 5], [0, 2, 4], [0, 3, 4],
    [1, 0, 5], [1, 1, 5], [1, 2, 3], [1, 3, 3],
    [2, 0, 4], [2, 1, 4], [2, 2, 3], [2, 3, 2],
    [3, 0, 5], [3, 1, 5], [3, 2, 4], [3, 3, 5],
    [4, 0, 4], [4, 1, 3], [4, 2, 3], [4, 3, 4],
    [5, 0, 3], [5, 1, 3], [5, 2, 2], [5, 3, 2]
  ];
  chart3.setOption({
    animation: false,
    tooltip: {
      appendToBody: true,
      formatter: function(params) {
        return xData[params.value[0]] + ' × ' + yData[params.value[1]] + ': ' + params.value[2] + ' 分';
      }
    },
    grid: { left: '15%', right: '5%', top: '5%', bottom: '10%' },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { color: muted, fontSize: 11, rotate: 20 },
      axisLine: { lineStyle: { color: rule } },
      splitArea: { show: false }
    },
    yAxis: {
      type: 'category',
      data: yData,
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      splitArea: { show: false }
    },
    visualMap: {
      min: 1,
      max: 5,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: { color: muted },
      inRange: { color: [bg2, accent2, red] }
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: {
        show: true,
        color: ink,
        fontSize: 12,
        fontWeight: 600
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
    }]
  });
  window.addEventListener('resize', function() { chart3.resize(); });
})();