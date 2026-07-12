(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var green = style.getPropertyValue('--green').trim();
  var yellow = style.getPropertyValue('--yellow').trim();
  var purple = style.getPropertyValue('--purple').trim();
  var cyan = style.getPropertyValue('--cyan').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // Chart 1: Category distribution (pie)
  var chart1 = echarts.init(document.getElementById('chart-category'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 项 ({d}%)',
      backgroundColor: bg2,
      borderColor: rule,
      textStyle: { color: ink, fontSize: 12 }
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: muted, fontSize: 12 }
    },
    series: [{
      name: '分类分布',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: bg2,
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{c} 项',
        color: ink,
        fontSize: 11
      },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' }
      },
      data: [
        { value: 26, name: 'A类：活跃页面', itemStyle: { color: green } },
        { value: 21, name: 'B类：测试/子组件', itemStyle: { color: purple } },
        { value: 4, name: 'C类：废弃Hub页', itemStyle: { color: yellow } },
        { value: 7, name: 'D类：孤立页面', itemStyle: { color: accent2 } },
        { value: 1, name: 'E类：工具模块', itemStyle: { color: cyan } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // Chart 2: Cabin distribution (stacked bar)
  var chart2 = echarts.init(document.getElementById('chart-cabin'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: bg2,
      borderColor: rule,
      textStyle: { color: ink, fontSize: 12 }
    },
    legend: {
      data: ['A类：活跃', 'B类：误报', 'C类：废弃', 'D类：孤立'],
      textStyle: { color: muted, fontSize: 11 },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['分析舱\nanalysis', '命令舱\ncommand', '输入舱\ninput', '交易舱\ntrading', '输出舱\noutput', '根目录\npages/'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      name: '文件数',
      nameTextStyle: { color: muted },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: 'A类：活跃',
        type: 'bar',
        stack: 'total',
        data: [9, 8, 1, 2, 3, 0],
        itemStyle: { color: green, borderRadius: [0, 0, 0, 0] }
      },
      {
        name: 'B类：误报',
        type: 'bar',
        stack: 'total',
        data: [6, 6, 1, 6, 1, 1],
        itemStyle: { color: purple }
      },
      {
        name: 'C类：废弃',
        type: 'bar',
        stack: 'total',
        data: [1, 1, 1, 1, 0, 0],
        itemStyle: { color: yellow }
      },
      {
        name: 'D类：孤立',
        type: 'bar',
        stack: 'total',
        data: [1, 3, 3, 0, 0, 0],
        itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] }
      }
    ]
  });
  window.addEventListener('resize', function() { chart2.resize(); });
})();
