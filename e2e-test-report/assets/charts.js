// ECharts initialization for V9 E2E Test Report
(function() {
  // Read CSS variables for consistent theming
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var accent3 = style.getPropertyValue('--accent3').trim();
  var danger = style.getPropertyValue('--danger').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg = style.getPropertyValue('--bg').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var bg3 = style.getPropertyValue('--bg3').trim();

  // Common font for Chinese text in charts
  var chartFont = 'Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif';

  // === Chart 1: Pie Chart - Pass/Fail Distribution ===
  var pieEl = document.getElementById('chart-pie');
  if (pieEl) {
    var pieChart = echarts.init(pieEl, null, { renderer: 'svg' });
    pieChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: chartFont }
      },
      legend: {
        bottom: '5%',
        left: 'center',
        textStyle: { color: muted, fontFamily: chartFont, fontSize: 13 }
      },
      series: [{
        name: '测试结果',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: bg2,
          borderWidth: 3
        },
        label: {
          show: true,
          formatter: '{b}\n{c} ({d}%)',
          color: ink,
          fontFamily: chartFont,
          fontSize: 13,
          fontWeight: 600
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 15,
            fontWeight: 'bold'
          }
        },
        data: [
          { value: 70, name: '通过', itemStyle: { color: accent } },
          { value: 0, name: '失败', itemStyle: { color: danger } }
        ]
      }]
    });
    window.addEventListener('resize', function() { pieChart.resize(); });
  }

  // === Chart 2: Bar Chart - Tests per Spec File ===
  var barEl = document.getElementById('chart-bar');
  if (barEl) {
    var barChart = echarts.init(barEl, null, { renderer: 'svg' });
    var specNames = [
      'data-migration',
      'mcp-verify',
      'output-cabin',
      'pool-group',
      'stock-score',
      'trade-review'
    ];
    var specValues = [14, 4, 22, 5, 12, 13];
    barChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: chartFont }
      },
      grid: {
        left: '3%',
        right: '6%',
        bottom: '3%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: specNames,
        axisLabel: {
          color: muted,
          fontFamily: chartFont,
          fontSize: 11,
          rotate: 25
        },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '测试数量',
        nameTextStyle: { color: muted, fontFamily: chartFont, fontSize: 12 },
        axisLabel: { color: muted, fontFamily: chartFont },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      series: [{
        name: '测试数量',
        type: 'bar',
        barWidth: '55%',
        data: specValues.map(function(val, idx) {
          return {
            value: val,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: accent2 },
                { offset: 1, color: accent }
              ]),
              borderRadius: [6, 6, 0, 0]
            }
          };
        }),
        label: {
          show: true,
          position: 'top',
          color: ink,
          fontFamily: chartFont,
          fontSize: 13,
          fontWeight: 600
        }
      }]
    });
    window.addEventListener('resize', function() { barChart.resize(); });
  }

  // === Chart 3: Line Chart - Improvement Across Rounds ===
  var lineEl = document.getElementById('chart-line');
  if (lineEl) {
    var lineChart = echarts.init(lineEl, null, { renderer: 'svg' });
    var rounds = ['初始基线', '第 1 轮', '第 2 轮', '第 3 轮', '最终轮'];
    var passData = [26, 52, 52, 62, 70];
    var failData = [44, 18, 18, 8, 0];
    var passRate = [37.1, 74.3, 74.3, 88.6, 100];

    lineChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: chartFont },
        formatter: function(params) {
          var res = '<strong>' + params[0].axisValue + '</strong><br/>';
          params.forEach(function(p) {
            var unit = p.seriesName === '通过率' ? '%' : ' 个';
            res += p.marker + ' ' + p.seriesName + ': <strong>' + p.value + unit + '</strong><br/>';
          });
          return res;
        }
      },
      legend: {
        data: ['通过', '失败', '通过率'],
        top: '2%',
        textStyle: { color: muted, fontFamily: chartFont, fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '6%',
        bottom: '3%',
        top: '14%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: rounds,
        boundaryGap: false,
        axisLabel: { color: muted, fontFamily: chartFont, fontSize: 12 },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          name: '测试数量',
          nameTextStyle: { color: muted, fontFamily: chartFont, fontSize: 12 },
          axisLabel: { color: muted, fontFamily: chartFont },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: rule, type: 'dashed' } }
        },
        {
          type: 'value',
          name: '通过率 (%)',
          nameTextStyle: { color: muted, fontFamily: chartFont, fontSize: 12 },
          axisLabel: { color: muted, fontFamily: chartFont, formatter: '{value}%' },
          axisLine: { show: false },
          splitLine: { show: false },
          min: 0,
          max: 100
        }
      ],
      series: [
        {
          name: '通过',
          type: 'line',
          data: passData,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: accent },
          itemStyle: { color: accent },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: accent + '40' },
              { offset: 1, color: accent + '05' }
            ])
          }
        },
        {
          name: '失败',
          type: 'line',
          data: failData,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: danger },
          itemStyle: { color: danger },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: danger + '30' },
              { offset: 1, color: danger + '05' }
            ])
          }
        },
        {
          name: '通过率',
          type: 'line',
          yAxisIndex: 1,
          data: passRate,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 10,
          lineStyle: { width: 2, color: accent3, type: 'dashed' },
          itemStyle: { color: accent3 }
        }
      ]
    });
    window.addEventListener('resize', function() { lineChart.resize(); });
  }
})();
