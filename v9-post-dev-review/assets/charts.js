(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var danger = '#ef4444';
  var success = '#22c55e';

  // --- Chart: Knowledge Gaps Classification (Horizontal Bar) ---
  var elKG = document.getElementById('chart-knowledge-gaps');
  if (elKG) {
    var chartKG = echarts.init(elKG, null, { renderer: 'svg' });
    chartKG.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { type: 'value', name: '影响等级 (1-5)', nameTextStyle: { color: muted, fontSize: 11 }, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
      yAxis: {
        type: 'category',
        data: ['KG-10 子串匹配', 'KG-09 审计误报', 'KG-08 DB类型路由', 'KG-07 三级路由', 'KG-06 对比度计算', 'KG-05 Playwright', 'KG-04 dialog行为', 'KG-03 Debounce', 'KG-02 Store持久化', 'KG-01 Hooks规则'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 2, itemStyle: { color: accent2 } },
          { value: 4, itemStyle: { color: danger } },
          { value: 5, itemStyle: { color: danger } },
          { value: 4, itemStyle: { color: danger } },
          { value: 3, itemStyle: { color: accent2 } },
          { value: 3, itemStyle: { color: accent2 } },
          { value: 2, itemStyle: { color: accent } },
          { value: 4, itemStyle: { color: danger } },
          { value: 3, itemStyle: { color: accent2 } },
          { value: 5, itemStyle: { color: danger } }
        ],
        barWidth: '60%',
        label: { show: true, position: 'right', color: muted, fontSize: 11, formatter: function(p) {
          var labels = ['低', '低', '中', '高', '中', '中', '低', '高', '中', '高'];
          return labels[p.dataIndex];
        }}
      }]
    });
    window.addEventListener('resize', function() { chartKG.resize(); });
  }

  // --- Chart: Standards Before/After Defect Density (Grouped Bar) ---
  var elST = document.getElementById('chart-standards');
  if (elST) {
    var chartST = echarts.init(elST, null, { renderer: 'svg' });
    chartST.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true },
      legend: { data: ['修复前', '修复后'], textStyle: { color: ink }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['跨层违规', '颜色硬编码', '未注册页面', 'Hooks违规', 'DB写入失败', '对比度不达标'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 11, rotate: 15 }
      },
      yAxis: { type: 'value', name: '缺陷数量', nameTextStyle: { color: muted }, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
      series: [
        {
          name: '修复前',
          type: 'bar',
          data: [7, 126, 55, 1, 1, 16],
          itemStyle: { color: danger + '99' },
          barGap: '10%'
        },
        {
          name: '修复后',
          type: 'bar',
          data: [0, 0, 0, 0, 0, 0],
          itemStyle: { color: success + 'cc' }
        }
      ]
    });
    window.addEventListener('resize', function() { chartST.resize(); });
  }

  // --- Chart: Test Coverage Distribution (Bar) ---
  var elTC = document.getElementById('chart-testing');
  if (elTC) {
    var chartTC = echarts.init(elTC, null, { renderer: 'svg' });
    chartTC.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      legend: { data: ['测试文件数', '覆盖率目标(%)'], textStyle: { color: ink }, top: 0 },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['core', 'data', 'lib', 'services', 'store', 'E2E'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 12 }
      },
      yAxis: [
        { type: 'value', name: '测试文件数', nameTextStyle: { color: muted }, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
        { type: 'value', name: '覆盖率(%)', nameTextStyle: { color: muted }, max: 100, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } }
      ],
      series: [
        {
          name: '测试文件数',
          type: 'bar',
          data: [8, 12, 5, 35, 30, 11],
          itemStyle: { color: accent },
          barWidth: '40%'
        },
        {
          name: '覆盖率目标(%)',
          type: 'line',
          yAxisIndex: 1,
          data: [55, 35, 70, 70, 80, 100],
          lineStyle: { color: accent2, width: 2 },
          itemStyle: { color: accent2 },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    });
    window.addEventListener('resize', function() { chartTC.resize(); });
  }

  // --- Chart: Daily Sessions Trend (Area) ---
  var elSS = document.getElementById('chart-sessions');
  if (elSS) {
    var chartSS = echarts.init(elSS, null, { renderer: 'svg' });
    chartSS.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['6/25', '6/26', '6/27', '6/28', '6/29', '6/30', '7/1', '7/2', '7/3', '7/4', '7/5'],
        boundaryGap: false,
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 11 }
      },
      yAxis: { type: 'value', name: '会话数', nameTextStyle: { color: muted }, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
      series: [{
        type: 'line',
        data: [1, 1, 6, 8, 12, 15, 10, 20, 20, 24, 14],
        smooth: true,
        lineStyle: { color: accent, width: 2.5 },
        itemStyle: { color: accent },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: accent + '40' }, { offset: 1, color: accent + '05' }] } },
        symbol: 'circle',
        symbolSize: 6,
        markLine: {
          silent: true,
          data: [{ type: 'average', name: '日均' }],
          lineStyle: { color: accent2, type: 'dashed' },
          label: { color: accent2, fontSize: 11, formatter: '日均 {c}' }
        }
      }]
    });
    window.addEventListener('resize', function() { chartSS.resize(); });
  }
})();
