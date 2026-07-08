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
  var warn = style.getPropertyValue('--warn').trim();

  // === Chart 1: Radar - V6 Design vs V9 Implementation ===
  var chartRadar = echarts.init(document.getElementById('chart-radar'), null, { renderer: 'svg' });
  chartRadar.setOption({
    animation: false,
    tooltip: { appendToBody: true },
    legend: {
      data: ['V6 设计意图', 'V9 实际实现'],
      bottom: 10,
      textStyle: { color: muted, fontSize: 12 }
    },
    radar: {
      indicator: [
        { name: '评分引擎集成', max: 100 },
        { name: '路由单轨化', max: 100 },
        { name: '组件体系化', max: 100 },
        { name: '废弃资产清理', max: 100 },
        { name: '基础设施覆盖', max: 100 },
        { name: 'Mock 治理', max: 100 }
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: ink, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [100, 100, 100, 100, 100, 100],
          name: 'V6 设计意图',
          lineStyle: { color: accent, width: 2 },
          areaStyle: { color: accent + '20' },
          itemStyle: { color: accent }
        },
        {
          value: [0, 30, 40, 50, 38, 15],
          name: 'V9 实际实现',
          lineStyle: { color: danger, width: 2 },
          areaStyle: { color: danger + '20' },
          itemStyle: { color: danger }
        }
      ]
    }]
  });
  window.addEventListener('resize', function() { chartRadar.resize(); });

  // === Chart 2: Bar - Routes registered vs documented ===
  var chartRoutes = echarts.init(document.getElementById('chart-routes'), null, { renderer: 'svg' });
  chartRoutes.setOption({
    animation: false,
    tooltip: { appendToBody: true, trigger: 'axis' },
    legend: {
      data: ['routes.ts 实际路由', '文档记录路由'],
      bottom: 10,
      textStyle: { color: muted, fontSize: 12 }
    },
    grid: { left: 80, right: 30, top: 20, bottom: 60 },
    xAxis: {
      type: 'category',
      data: ['输入舱', '分析舱', '交易舱', '输出舱', '总控舱', '其他'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: 'routes.ts 实际路由',
        type: 'bar',
        data: [6, 14, 4, 5, 14, 3],
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
        barWidth: '30%'
      },
      {
        name: '文档记录路由',
        type: 'bar',
        data: [4, 8, 2, 3, 5, 3],
        itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] },
        barWidth: '30%'
      }
    ]
  });
  window.addEventListener('resize', function() { chartRoutes.resize(); });

  // === Chart 3: Bar - EventBus coverage ===
  var chartEventbus = echarts.init(document.getElementById('chart-eventbus'), null, { renderer: 'svg' });
  chartEventbus.setOption({
    animation: false,
    tooltip: { appendToBody: true, trigger: 'axis' },
    legend: {
      data: ['已接入 withBroadcast', '未接入'],
      bottom: 10,
      textStyle: { color: muted, fontSize: 12 }
    },
    grid: { left: 100, right: 30, top: 20, bottom: 60 },
    xAxis: {
      type: 'category',
      data: ['poolStore', 'orderStore', 'analysisStore', 'hotSectorStore', 'dualStrategyStore', 'disciplineStore', 'scoreDocStore', 'backtestStore', 'marketDataStore', 'riskStore', 'industryScoreStore', 'intelligentScoreStore', 'positionStore', 'strategySnapshotStore', 'dataTestStore', 'sectorAnalysisStore', 'signalQualityStore', '其余 27 Store'],
      axisLabel: { color: muted, fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [
      {
        name: '已接入 withBroadcast',
        type: 'bar',
        stack: 'total',
        data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        itemStyle: { color: success, borderRadius: [4, 4, 0, 0] },
        barWidth: '60%'
      },
      {
        name: '未接入',
        type: 'bar',
        stack: 'total',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        itemStyle: { color: danger + '80', borderRadius: [4, 4, 0, 0] },
        barWidth: '60%'
      }
    ]
  });
  window.addEventListener('resize', function() { chartEventbus.resize(); });

  // === Chart 4: Scatter - Risk Matrix ===
  var chartMatrix = echarts.init(document.getElementById('chart-matrix'), null, { renderer: 'svg' });
  chartMatrix.setOption({
    animation: false,
    tooltip: {
      appendToBody: true,
      formatter: function(params) {
        return '<strong>' + params.data[3] + '</strong><br/>影响范围: ' + params.data[0] + '/10<br/>修复复杂度: ' + params.data[1] + '/10';
      }
    },
    grid: { left: 70, right: 40, top: 30, bottom: 60 },
    xAxis: {
      name: '影响范围',
      nameTextStyle: { color: muted },
      min: 0, max: 10,
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      name: '修复复杂度',
      nameTextStyle: { color: muted },
      min: 0, max: 10,
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'scatter',
      symbolSize: function(data) { return data[2] * 5; },
      data: [
        [9, 7, 14, 'P0-A: 引擎集成'],
        [8, 3, 10, 'P0-B: PortalShell 单轨'],
        [7, 5, 12, 'P1-A: 分析舱/交易舱双轨'],
        [6, 4, 10, 'P1-B: 废弃资产清理'],
        [7, 8, 13, 'P1-C: Mock 治理'],
        [3, 2, 6, 'P1-D: 路由文档'],
        [5, 3, 8, 'P1-E: 孤立页面'],
        [4, 4, 8, 'P1-F: 数据流违规'],
        [4, 5, 7, 'P2-A: EventBus 扩展'],
        [3, 3, 6, 'P2-B: usePageGuard 扩展'],
        [2, 2, 5, 'P2-C: @legacy 标记'],
        [3, 6, 8, 'P2-D: 类型安全'],
        [2, 1, 4, 'P2-E: temp 清理']
      ],
      itemStyle: {
        color: function(params) {
          var label = params.data[3];
          if (label.indexOf('P0') >= 0) return danger;
          if (label.indexOf('P1') >= 0) return warn;
          return accent;
        }
      },
      label: {
        show: true,
        formatter: function(params) { return params.data[3].split(': ')[1]; },
        position: 'right',
        color: ink,
        fontSize: 10
      }
    }]
  });
  window.addEventListener('resize', function() { chartMatrix.resize(); });
})();
