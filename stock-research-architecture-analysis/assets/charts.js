(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- Chart 1: 五层架构概览 ---
  var chart1 = echarts.init(document.getElementById('chart-architecture-layers'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    series: [{
      type: 'treemap',
      data: [
        { name: 'L5 展示层\n81+176+21+32+1', value: 311, itemStyle: { color: accent },
          children: [
            { name: 'pages 页面', value: 81 },
            { name: 'components 组件', value: 176 },
            { name: 'apps 五舱应用', value: 21 },
            { name: 'cockpit 驾驶舱', value: 32 },
            { name: 'portal 门户', value: 1 }
          ]
        },
        { name: 'L3 引擎层\n277+77+6+34+12', value: 406, itemStyle: { color: accent2 },
          children: [
            { name: 'services 业务服务', value: 277 },
            { name: 'store 状态管理', value: 77 },
            { name: 'agents 智能体', value: 6 },
            { name: 'mcp MCP服务', value: 34 },
            { name: 'hooks React钩子', value: 12 }
          ]
        },
        { name: 'L2 数据层\n52文件', value: 52, itemStyle: { color: '#6366f1' },
          children: [
            { name: 'dataLayer 统一入口', value: 1 },
            { name: '7大领域Store', value: 35 },
            { name: 'db/schema/migration', value: 16 }
          ]
        },
        { name: 'L1 基础设施层\n31+23+36+29', value: 119, itemStyle: { color: '#10b981' },
          children: [
            { name: 'core 核心架构', value: 31 },
            { name: 'lib 工具库', value: 23 },
            { name: 'config 配置', value: 36 },
            { name: 'constants 常量', value: 29 }
          ]
        }
      ],
      breadcrumb: { show: false },
      label: { show: true, formatter: '{b}', fontSize: 12, color: '#fff', fontWeight: 600 },
      upperLabel: { show: true, height: 30 },
      itemStyle: { borderColor: '#fff', borderWidth: 2 }
    }]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart 2: 技术评分雷达图 ---
  var chart2 = echarts.init(document.getElementById('chart-tech-radar'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: { appendToBody: true },
    radar: {
      indicator: [
        { name: '架构设计', max: 10 },
        { name: '数据工程', max: 10 },
        { name: '算法模型', max: 10 },
        { name: '前端工程', max: 10 },
        { name: 'AI/LLM集成', max: 10 },
        { name: '质量保障', max: 10 },
        { name: '知识管理', max: 10 },
        { name: '性能优化', max: 10 }
      ],
      radius: '65%',
      axisName: { color: ink, fontSize: 12 },
      splitArea: { areaStyle: { color: [bg2, 'transparent'] } },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [9.2, 8.8, 9.0, 8.5, 8.0, 9.5, 8.2, 8.0],
          name: '综合评分',
          areaStyle: { color: accent + '33' },
          lineStyle: { color: accent, width: 2 },
          itemStyle: { color: accent }
        }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart 3: V6评分引擎层级权重 ---
  var chart3 = echarts.init(document.getElementById('chart-v6-weights'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      max: 20,
      axisLabel: { formatter: '{value}%', color: muted },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'category',
      data: ['L8 技术筹码', 'L5 T-M矩阵', 'L3v 估值水平', 'L0 STEEP宏观', 'L4 情景推演', 'L6 Hype周期', 'L-1 行业评分', 'L2 竞品格局', 'L3a 财务健康', 'L1 护城河', 'L7 第二曲线'],
      axisLabel: { color: ink, fontSize: 12 },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: [
        { value: 4, itemStyle: { color: '#94a3b8' } },
        { value: 5, itemStyle: { color: '#94a3b8' } },
        { value: 8, itemStyle: { color: '#60a5fa' } },
        { value: 8, itemStyle: { color: '#60a5fa' } },
        { value: 8, itemStyle: { color: '#60a5fa' } },
        { value: 7, itemStyle: { color: '#a78bfa' } },
        { value: 10, itemStyle: { color: '#34d399' } },
        { value: 10, itemStyle: { color: '#34d399' } },
        { value: 10, itemStyle: { color: '#34d399' } },
        { value: 15, itemStyle: { color: accent } },
        { value: 15, itemStyle: { color: accent } }
      ],
      label: { show: true, position: 'right', formatter: '{c}%', color: ink },
      barWidth: '60%'
    }]
  });
  window.addEventListener('resize', function() { chart3.resize(); });

  // --- Chart 4: 八域资料体系与评分层映射 ---
  var chart4 = echarts.init(document.getElementById('chart-domains-mapping'), null, { renderer: 'svg' });
  chart4.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: { bottom: 0, textStyle: { color: ink } },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: [
        { name: 'D1 行业产业', itemStyle: { color: '#ef4444' } },
        { name: 'D2 宏观环境', itemStyle: { color: '#f97316' } },
        { name: 'D3 公司基本面', itemStyle: { color: '#eab308' } },
        { name: 'D4 竞争对比', itemStyle: { color: '#22c55e' } },
        { name: 'D5 财务分析', itemStyle: { color: '#14b8a6' } },
        { name: 'D6 估值定价', itemStyle: { color: '#3b82f6' } },
        { name: 'D7 成长前沿', itemStyle: { color: '#8b5cf6' } },
        { name: 'D8 市场信号', itemStyle: { color: '#ec4899' } },
        { name: 'L-1 行业评分', itemStyle: { color: accent } },
        { name: 'L0 宏观扫描', itemStyle: { color: accent } },
        { name: 'L1 护城河', itemStyle: { color: accent } },
        { name: 'L2 竞品格局', itemStyle: { color: accent } },
        { name: 'L3a 财务健康', itemStyle: { color: accent } },
        { name: 'L3v 估值水平', itemStyle: { color: accent } },
        { name: 'L4 情景推演', itemStyle: { color: accent2 } },
        { name: 'L5 T-M矩阵', itemStyle: { color: accent2 } },
        { name: 'L6 Hype周期', itemStyle: { color: accent2 } },
        { name: 'L7 第二曲线', itemStyle: { color: accent2 } },
        { name: 'L8 技术筹码', itemStyle: { color: accent2 } }
      ],
      links: [
        { source: 'D1 行业产业', target: 'L-1 行业评分', value: 10 },
        { source: 'D2 宏观环境', target: 'L0 宏观扫描', value: 8 },
        { source: 'D3 公司基本面', target: 'L1 护城河', value: 15 },
        { source: 'D4 竞争对比', target: 'L2 竞品格局', value: 10 },
        { source: 'D5 财务分析', target: 'L3a 财务健康', value: 10 },
        { source: 'D6 估值定价', target: 'L3v 估值水平', value: 8 },
        { source: 'D7 成长前沿', target: 'L4 情景推演', value: 8 },
        { source: 'D7 成长前沿', target: 'L5 T-M矩阵', value: 5 },
        { source: 'D7 成长前沿', target: 'L6 Hype周期', value: 7 },
        { source: 'D8 市场信号', target: 'L7 第二曲线', value: 15 },
        { source: 'D8 市场信号', target: 'L8 技术筹码', value: 4 }
      ],
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.6 },
      label: { color: ink, fontSize: 11 }
    }]
  });
  window.addEventListener('resize', function() { chart4.resize(); });

  // --- Chart 5: 技术复杂度分布 ---
  var chart5 = echarts.init(document.getElementById('chart-complexity-dist'), null, { renderer: 'svg' });
  chart5.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}: {c}项 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: ink } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold', color: ink }
      },
      labelLine: { show: false },
      data: [
        { value: 12, name: '入门级 (1-3)', itemStyle: { color: '#22c55e' } },
        { value: 18, name: '中级 (4-6)', itemStyle: { color: '#eab308' } },
        { value: 15, name: '高级 (7-8)', itemStyle: { color: '#f97316' } },
        { value: 8, name: '专家级 (9-10)', itemStyle: { color: '#ef4444' } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart5.resize(); });

  // --- Chart 6: DataBridge数据流 ---
  var chart6 = echarts.init(document.getElementById('chart-databridge'), null, { renderer: 'svg' });
  chart6.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: [
        { name: 'Service层', itemStyle: { color: accent2 } },
        { name: 'Store层', itemStyle: { color: accent2 } },
        { name: 'UI组件', itemStyle: { color: accent2 } },
        { name: 'DataBridge', itemStyle: { color: accent } },
        { name: 'ACL校验', itemStyle: { color: '#6366f1' } },
        { name: 'MemoryCache', itemStyle: { color: '#6366f1' } },
        { name: '策略路由', itemStyle: { color: '#6366f1' } },
        { name: 'Handler', itemStyle: { color: '#6366f1' } },
        { name: 'Pub/Sub', itemStyle: { color: '#6366f1' } },
        { name: 'IndexedDB', itemStyle: { color: '#10b981' } },
        { name: '审计日志', itemStyle: { color: '#10b981' } },
        { name: '事件广播', itemStyle: { color: '#10b981' } }
      ],
      links: [
        { source: 'Service层', target: 'DataBridge', value: 35 },
        { source: 'Store层', target: 'DataBridge', value: 25 },
        { source: 'UI组件', target: 'DataBridge', value: 15 },
        { source: 'DataBridge', target: 'ACL校验', value: 75 },
        { source: 'DataBridge', target: 'MemoryCache', value: 60 },
        { source: 'DataBridge', target: '策略路由', value: 30 },
        { source: 'DataBridge', target: 'Handler', value: 50 },
        { source: 'DataBridge', target: 'Pub/Sub', value: 40 },
        { source: 'Handler', target: 'IndexedDB', value: 50 },
        { source: 'ACL校验', target: '审计日志', value: 75 },
        { source: 'Pub/Sub', target: '事件广播', value: 40 }
      ],
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.6 },
      label: { color: ink, fontSize: 11 }
    }]
  });
  window.addEventListener('resize', function() { chart6.resize(); });

  // --- Chart 7: 归因分析因子贡献瀑布图 ---
  var chart7 = echarts.init(document.getElementById('chart-attribution'), null, { renderer: 'svg' });
  chart7.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['基准分', 'L1护城河', 'L7第二曲线', 'L-1行业', 'L2竞品', 'L3a财务', 'L0宏观', 'L3v估值', 'L4情景', 'L6 Hype', 'L5 T-M', 'L8筹码', '综合分'],
      axisLabel: { color: muted, fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}分', color: muted },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: '辅助',
        type: 'bar',
        stack: 'total',
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
        data: [0, 50, 65, 75, 85, 92, 98, 103, 108, 112, 115, 117, 0]
      },
      {
        name: '正向贡献',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#22c55e' },
        data: [50, 15, 15, 10, 10, 10, 8, 8, 7, 5, 4, 2, 0]
      },
      {
        name: '负向贡献',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#ef4444' },
        data: [0, 0, -3, -2, -3, -4, -3, -3, -2, -2, -2, -1, 0]
      },
      {
        name: '最终得分',
        type: 'bar',
        itemStyle: { color: accent },
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 73.5]
      }
    ]
  });
  window.addEventListener('resize', function() { chart7.resize(); });
})();
