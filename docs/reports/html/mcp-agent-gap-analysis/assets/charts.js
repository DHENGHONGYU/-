// assets/charts.js — V9 MCP Server & Agent 管理群功能遗漏诊断报告
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var green = style.getPropertyValue('--green').trim();
  var yellow = style.getPropertyValue('--yellow').trim();
  var red = style.getPropertyValue('--red').trim();
  var purple = style.getPropertyValue('--purple').trim();

  // ============================================================
  // Chart 1: 路由-页面实现热力图
  // ============================================================
  var routeHeatmap = echarts.init(document.getElementById('chart-route-heatmap'), null, { renderer: 'svg' });
  var routeCategories = ['已实现', '未实现'];
  var routeItems = [
    '/command', '/command/hub', '/command/agents',
    '/command/agents/registry', '/command/agents/registry/:agentId',
    '/command/agents/trigger', '/command/agents/tasks',
    '/command/agents/custom', '/command/agents/llm',
    '/command/agents/capability-graph', '/command/agents/dag-scheduler',
    '/command/agents/feedback'
  ];
  var routeData = [
    [0, 0, 1], [0, 1, 1], [0, 2, 1],
    [1, 3, 1], [1, 4, 1], [1, 5, 1], [1, 6, 1],
    [1, 7, 1], [1, 8, 1], [1, 9, 1], [1, 10, 1], [1, 11, 1]
  ];

  routeHeatmap.setOption({
    tooltip: {
      appendToBody: true,
      formatter: function(p) {
        return routeItems[p.value[1]] + '<br/>状态: ' + routeCategories[p.value[0]];
      }
    },
    grid: { left: '5%', right: '5%', top: 30, bottom: 60 },
    xAxis: {
      type: 'category',
      data: routeItems,
      axisLabel: { color: muted, fontSize: 10, rotate: 35 },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'category',
      data: routeCategories,
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { show: false }
    },
    visualMap: {
      min: 0,
      max: 1,
      show: false,
      inRange: { color: [red, green] }
    },
    series: [{
      type: 'heatmap',
      data: routeData,
      label: {
        show: true,
        formatter: function(p) { return p.value[0] === 0 ? '✓' : '✗'; },
        color: ink,
        fontSize: 14
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
    }],
    animation: false
  });
  window.addEventListener('resize', function() { routeHeatmap.resize(); });

  // ============================================================
  // Chart 2: MCP Server 注册覆盖率
  // ============================================================
  var mcpCoverage = echarts.init(document.getElementById('chart-mcp-coverage'), null, { renderer: 'svg' });
  var serviceDomains = ['scoring','fetcher','trading','analysis','news','llm','portfolio','screening','backtest','stockpool','system','execution','export','input','data-collector','trade'];
  var registered = [true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false];
  var priorities = ['—','—','—','P0','P0','P0','P1','P1','P1','P1','P1','P2','P2','P2','P2','P2'];

  mcpCoverage.setOption({
    tooltip: {
      appendToBody: true,
      formatter: function(p) {
        return serviceDomains[p.dataIndex] + '<br/>状态: ' + (registered[p.dataIndex] ? '已注册' : '未注册') + '<br/>优先级: ' + priorities[p.dataIndex];
      }
    },
    grid: { left: '3%', right: '4%', top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: serviceDomains,
      axisLabel: { color: muted, fontSize: 10, rotate: 35 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      name: 'Tools 数',
      axisLabel: { color: muted },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: serviceDomains.map(function(d, i) {
        var val = registered[i] ? [6, 5, 9][i] || 0 : 0;
        return {
          value: val,
          itemStyle: {
            color: registered[i] ? green : (priorities[i] === 'P0' ? red : priorities[i] === 'P1' ? yellow : muted)
          }
        };
      }),
      label: {
        show: true,
        position: 'top',
        formatter: function(p) { return registered[p.dataIndex] ? p.value : '未注册'; },
        color: ink,
        fontSize: 10
      },
      barWidth: '60%'
    }],
    animation: false
  });
  window.addEventListener('resize', function() { mcpCoverage.resize(); });

  // ============================================================
  // Chart 3: MCP 协议规范对齐度雷达图
  // ============================================================
  var mcpRadar = echarts.init(document.getElementById('chart-mcp-radar'), null, { renderer: 'svg' });
  mcpRadar.setOption({
    tooltip: { appendToBody: true },
    radar: {
      center: ['50%', '55%'],
      radius: '65%',
      indicator: [
        { name: 'Tools', max: 100 },
        { name: 'Resources', max: 100 },
        { name: 'Prompts', max: 100 },
        { name: 'Transport', max: 100 },
        { name: 'Registry', max: 100 },
        { name: 'Sampling', max: 100 },
        { name: 'Notifications', max: 100 },
        { name: 'Progress', max: 100 },
        { name: 'Cancellation', max: 100 },
        { name: 'Roots', max: 100 },
        { name: 'Elicitation', max: 100 },
        { name: 'Completions', max: 100 },
        { name: 'Authorization', max: 100 }
      ],
      axisName: { color: muted, fontSize: 10 },
      splitArea: { areaStyle: { color: [bg2, 'transparent'] } },
      splitLine: { lineStyle: { color: rule } },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: [100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0],
        name: '当前实现',
        areaStyle: { color: accent + '33' },
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent }
      },
      {
        value: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        name: '协议规范',
        areaStyle: { color: 'transparent' },
        lineStyle: { color: muted, width: 1, type: 'dashed' },
        itemStyle: { color: muted }
      }]
    }],
    animation: false
  });
  window.addEventListener('resize', function() { mcpRadar.resize(); });

  // ============================================================
  // Chart 4: Agent 模块完成度
  // ============================================================
  var agentComplete = echarts.init(document.getElementById('chart-agent-completeness'), null, { renderer: 'svg' });
  var agentModules = ['类型定义','运行时','健康监控','注册表','配置管理','任务队列','组件注册','统一入口','Agent Store','监控 Store'];
  var agentCompleteness = [100, 60, 100, 100, 100, 100, 100, 100, 100, 100];

  agentComplete.setOption({
    tooltip: {
      appendToBody: true,
      formatter: function(p) { return agentModules[p.dataIndex] + ': ' + p.value + '%'; }
    },
    grid: { left: '3%', right: '4%', top: 20, bottom: 60 },
    xAxis: {
      type: 'category',
      data: agentModules,
      axisLabel: { color: muted, fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      max: 120,
      axisLabel: { color: muted, formatter: '{value}%' },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: agentCompleteness.map(function(v) {
        return {
          value: v,
          itemStyle: { color: v >= 100 ? green : v >= 60 ? yellow : red }
        };
      }),
      barWidth: '50%',
      label: { show: true, position: 'top', formatter: '{c}%', color: ink, fontSize: 10 },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: yellow, type: 'dashed', width: 1 },
        data: [{ yAxis: 100, label: { formatter: '100%', color: muted, fontSize: 10 } }]
      }
    }],
    animation: false
  });
  window.addEventListener('resize', function() { agentComplete.resize(); });

  // ============================================================
  // Chart 5: 模块间关联关系 (Sankey)
  // ============================================================
  var moduleRel = echarts.init(document.getElementById('chart-module-relations'), null, { renderer: 'svg' });
  moduleRel.setOption({
    tooltip: { appendToBody: true, trigger: 'item' },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'left',
      layoutIterations: 0,
      data: [
        { name: 'MCP Server\n(3/16)', itemStyle: { color: green } },
        { name: 'MCP Bridge', itemStyle: { color: accent } },
        { name: 'MCP Registry', itemStyle: { color: accent } },
        { name: 'Agent Runtime\n(stub)', itemStyle: { color: yellow } },
        { name: 'Agent Health\nMonitor', itemStyle: { color: green } },
        { name: 'Task Queue', itemStyle: { color: green } },
        { name: 'Agent Store', itemStyle: { color: green } },
        { name: 'Monitor Store', itemStyle: { color: green } },
        { name: 'AgentDashboard\nPage', itemStyle: { color: green } },
        { name: 'EngineMonitor\nPage', itemStyle: { color: green } },
        { name: 'CommandHub\nPage', itemStyle: { color: green } },
        { name: 'Agent Pages\n(缺失)', itemStyle: { color: red } },
        { name: 'MCP Server UI\n(缺失)', itemStyle: { color: red } }
      ],
      links: [
        { source: 'MCP Server\n(3/16)', target: 'MCP Bridge', value: 3, lineStyle: { color: green + '88' } },
        { source: 'MCP Server\n(3/16)', target: 'MCP Registry', value: 3, lineStyle: { color: green + '88' } },
        { source: 'MCP Bridge', target: 'Agent Runtime\n(stub)', value: 0, lineStyle: { color: red + '88', type: 'dashed' } },
        { source: 'Agent Runtime\n(stub)', target: 'Task Queue', value: 5, lineStyle: { color: accent + '88' } },
        { source: 'Agent Runtime\n(stub)', target: 'Agent Health\nMonitor', value: 5, lineStyle: { color: accent + '88' } },
        { source: 'Agent Health\nMonitor', target: 'Monitor Store', value: 3, lineStyle: { color: green + '88' } },
        { source: 'Task Queue', target: 'Agent Store', value: 3, lineStyle: { color: green + '88' } },
        { source: 'Agent Store', target: 'AgentDashboard\nPage', value: 2, lineStyle: { color: green + '88' } },
        { source: 'Monitor Store', target: 'AgentDashboard\nPage', value: 2, lineStyle: { color: green + '88' } },
        { source: 'Monitor Store', target: 'EngineMonitor\nPage', value: 2, lineStyle: { color: green + '88' } },
        { source: 'Agent Store', target: 'Agent Pages\n(缺失)', value: 0, lineStyle: { color: red + '88', type: 'dashed' } },
        { source: 'MCP Registry', target: 'MCP Server UI\n(缺失)', value: 0, lineStyle: { color: red + '88', type: 'dashed' } },
        { source: 'CommandHub\nPage', target: 'Agent Pages\n(缺失)', value: 0, lineStyle: { color: red + '88', type: 'dashed' } }
      ],
      label: { color: ink, fontSize: 10 },
      lineStyle: { curveness: 0.5 }
    }],
    animation: false
  });
  window.addEventListener('resize', function() { moduleRel.resize(); });

  // ============================================================
  // Chart 6: 实施路线图甘特图
  // ============================================================
  var roadmap = echarts.init(document.getElementById('chart-roadmap'), null, { renderer: 'svg' });

  var tasks = [
    { name: 'F-01: 核心Agent页面', start: 0, end: 3, phase: 'Phase 1', color: red },
    { name: 'F-02: Agent→MCP链路', start: 0, end: 2, phase: 'Phase 1', color: red },
    { name: 'F-03: MCP Sampling', start: 0, end: 2, phase: 'Phase 1', color: red },
    { name: 'F-04: Notification', start: 2, end: 3.5, phase: 'Phase 1', color: red },
    { name: 'F-05: 3个核心Server', start: 0, end: 3, phase: 'Phase 1', color: red },
    { name: 'F-06: 4项协议特性', start: 3, end: 7, phase: 'Phase 2', color: yellow },
    { name: 'F-07: 5个扩展Server', start: 3, end: 6, phase: 'Phase 2', color: yellow },
    { name: 'F-08: MCP管理UI', start: 4, end: 6, phase: 'Phase 2', color: yellow },
    { name: 'F-09: 导航修复', start: 3, end: 3.5, phase: 'Phase 2', color: yellow },
    { name: 'F-10: Agent反馈', start: 5, end: 6.5, phase: 'Phase 2', color: yellow },
    { name: 'F-11: Completions/Auth', start: 7, end: 9, phase: 'Phase 3', color: muted },
    { name: 'F-12: 剩余5 Server', start: 7, end: 10, phase: 'Phase 3', color: muted }
  ];

  roadmap.setOption({
    tooltip: {
      appendToBody: true,
      formatter: function(p) {
        var t = tasks[p.dataIndex];
        return t.name + '<br/>Phase: ' + t.phase + '<br/>工期: ' + (t.end - t.start) + '天';
      }
    },
    grid: { left: '22%', right: '5%', top: 30, bottom: 30 },
    xAxis: {
      type: 'value',
      name: '天数',
      min: 0,
      max: 12,
      axisLabel: { color: muted },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'category',
      data: tasks.map(function(t) { return t.name; }),
      axisLabel: { color: ink, fontSize: 10 },
      axisLine: { lineStyle: { color: rule } },
      inverse: true
    },
    series: [{
      type: 'custom',
      renderItem: function(params, api) {
        var t = tasks[api.value(0)];
        var start = api.coord([t.start, api.value(0)]);
        var end = api.coord([t.end, api.value(0)]);
        var height = api.size([0, 1])[1] * 0.6;
        return {
          type: 'rect',
          shape: {
            x: start[0],
            y: start[1] - height / 2,
            width: end[0] - start[0],
            height: height
          },
          style: { fill: t.color, opacity: 0.85 },
          textContent: t.end - t.start <= 1 ? null : {
            type: 'text',
            style: {
              text: t.phase,
              fill: ink,
              font: '10px Inter',
              x: start[0] + 8,
              y: start[1]
            }
          }
        };
      },
      data: tasks.map(function(_, i) { return i; }),
      encode: { x: [0], y: [0] }
    }],
    animation: false
  });
  window.addEventListener('resize', function() { roadmap.resize(); });

})();