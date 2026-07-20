// V9 七大体系成熟度对标报告 - 图表脚本
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

  // --- Chart 1: Radar Chart ---
  var radarEl = document.getElementById('chart-radar');
  if (radarEl) {
    var radarChart = echarts.init(radarEl, null, { renderer: 'svg' });
    radarChart.setOption({
      animation: false,
      tooltip: {
        appendToBody: true,
        trigger: 'item'
      },
      legend: {
        data: ['V9 现状', '成熟APP标准'],
        bottom: 0,
        textStyle: { color: ink, fontSize: 13 }
      },
      radar: {
        indicator: [
          { name: '文档体系', max: 100 },
          { name: '代码体系', max: 100 },
          { name: '审计体系', max: 100 },
          { name: '契约/MCP体系', max: 100 },
          { name: '数据架构', max: 100 },
          { name: '测试体系', max: 100 },
          { name: '注册表体系', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: ink,
          fontSize: 13,
          fontWeight: 600
        },
        splitLine: {
          lineStyle: { color: rule }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(37, 99, 235, 0.02)', 'rgba(37, 99, 235, 0.04)', 'rgba(37, 99, 235, 0.06)', 'rgba(37, 99, 235, 0.08)']
          }
        },
        axisLine: {
          lineStyle: { color: rule }
        }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: [78, 92, 90, 88, 93, 80, 86],
            name: 'V9 现状',
            itemStyle: { color: accent },
            lineStyle: { color: accent, width: 2 },
            areaStyle: {
              color: {
                type: 'radial',
                x: 0.5, y: 0.5, r: 0.5,
                colorStops: [
                  { offset: 0, color: 'rgba(37, 99, 235, 0.05)' },
                  { offset: 1, color: 'rgba(37, 99, 235, 0.25)' }
                ]
              }
            },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            value: [90, 90, 85, 85, 85, 85, 80],
            name: '成熟APP标准',
            itemStyle: { color: muted },
            lineStyle: { color: muted, type: 'dashed', width: 1.5 },
            areaStyle: {
              color: 'rgba(100, 116, 139, 0.08)'
            },
            symbol: 'circle',
            symbolSize: 4
          }
        ]
      }]
    });
    window.addEventListener('resize', function() { radarChart.resize(); });
  }

  // --- Chart 2: Bar Chart ---
  var barEl = document.getElementById('chart-bar');
  if (barEl) {
    var barChart = echarts.init(barEl, null, { renderer: 'svg' });
    barChart.setOption({
      animation: false,
      tooltip: {
        appendToBody: true,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          var p = params[0];
          var grade = p.value >= 90 ? 'A 级（优秀）' : p.value >= 80 ? 'B 级（良好）' : 'C 级（待建设）';
          return p.name + '<br/>达标率：' + p.value + '%<br/>评级：' + grade;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['文档体系', '代码体系', '审计体系', '契约/MCP体系', '数据架构', '测试体系', '注册表体系'],
        axisLabel: {
          color: ink,
          fontSize: 12,
          interval: 0,
          rotate: 0
        },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: muted,
          fontSize: 12,
          formatter: '{value}%'
        },
        splitLine: { lineStyle: { color: rule } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 78, itemStyle: { color: warning } },
          { value: 92, itemStyle: { color: success } },
          { value: 90, itemStyle: { color: success } },
          { value: 88, itemStyle: { color: success } },
          { value: 93, itemStyle: { color: success } },
          { value: 80, itemStyle: { color: warning } },
          { value: 86, itemStyle: { color: success } }
        ],
        barWidth: '45%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          color: ink,
          fontSize: 12,
          fontWeight: 600,
          formatter: '{c}%'
        }
      }],
      markLine: {
        silent: true,
        symbol: 'none',
        data: [{
          yAxis: 85,
          lineStyle: { color: accent, type: 'dashed', width: 1.5 },
          label: {
            show: true,
            position: 'end',
            color: accent,
            fontSize: 11,
            formatter: 'A级基准线 85%'
          }
        }]
      }
    });
    window.addEventListener('resize', function() { barChart.resize(); });
  }
})();
