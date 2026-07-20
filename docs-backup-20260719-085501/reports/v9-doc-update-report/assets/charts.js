// assets/charts.js
(function() {
    var style = getComputedStyle(document.documentElement);
    var accent = style.getPropertyValue('--accent').trim();
    var accent2 = style.getPropertyValue('--accent2').trim();
    var ink = style.getPropertyValue('--ink').trim();
    var muted = style.getPropertyValue('--muted').trim();
    var rule = style.getPropertyValue('--rule').trim();
    var bg2 = style.getPropertyValue('--bg2').trim();
    var success = '#22c55e';
    var warning = '#f59e0b';
    var danger = '#ef4444';

    // --- Chart: audit-trend ---
    var chartAudit = echarts.init(document.getElementById('chart-audit-trend'), null, { renderer: 'svg' });
    chartAudit.setOption({
        tooltip: { trigger: 'axis', appendToBody: true },
        legend: { data: ['Critical', 'Major', 'Warning'], top: 0, textStyle: { color: muted } },
        grid: { left: 60, right: 30, top: 50, bottom: 40 },
        xAxis: {
            type: 'category',
            data: ['基线测量', '迭代1-4', '迭代5-6', '迭代7-8', '迭代9\n(本次)'],
            axisLine: { lineStyle: { color: rule } },
            axisLabel: { color: muted, fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            name: '问题数',
            nameTextStyle: { color: muted },
            axisLine: { lineStyle: { color: rule } },
            axisLabel: { color: muted },
            splitLine: { lineStyle: { color: rule, type: 'dashed' } }
        },
        animation: false,
        series: [
            {
                name: 'Critical', type: 'bar', stack: 'total',
                data: [40, 13, 13, 0, 0],
                itemStyle: { color: danger },
                barWidth: '40%'
            },
            {
                name: 'Major', type: 'bar', stack: 'total',
                data: [268, 263, 147, 0, 0],
                itemStyle: { color: warning }
            },
            {
                name: 'Warning', type: 'bar', stack: 'total',
                data: [528, 529, 560, 560, 107],
                itemStyle: { color: accent }
            }
        ]
    });
    window.addEventListener('resize', function() { chartAudit.resize(); });

    // --- Chart: doc-update-pie ---
    var chartDocPie = echarts.init(document.getElementById('chart-doc-updates'), null, { renderer: 'svg' });
    chartDocPie.setOption({
        tooltip: { trigger: 'item', appendToBody: true },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: muted, fontSize: 11 } },
        animation: false,
        series: [{
            type: 'pie', radius: ['35%', '65%'], center: ['40%', '50%'],
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: ink } },
            data: [
                { value: 10, name: '版本号同步', itemStyle: { color: accent } },
                { value: 8, name: '内容精确性', itemStyle: { color: accent2 } },
                { value: 7, name: 'P0不一致修复', itemStyle: { color: danger } },
                { value: 4, name: 'P1不一致修复', itemStyle: { color: warning } },
                { value: 3, name: '数据字典扩展', itemStyle: { color: success } },
                { value: 4, name: '辅助文档验证', itemStyle: { color: muted } }
            ]
        }]
    });
    window.addEventListener('resize', function() { chartDocPie.resize(); });

    // --- Chart: health-radar ---
    var chartRadar = echarts.init(document.getElementById('chart-health-radar'), null, { renderer: 'svg' });
    chartRadar.setOption({
        tooltip: { appendToBody: true },
        animation: false,
        radar: {
            indicator: [
                { name: '类型安全', max: 100 },
                { name: '分层合规', max: 100 },
                { name: '文档同步', max: 100 },
                { name: '硬编码治理', max: 100 },
                { name: '数据字典', max: 100 },
                { name: '交叉一致性', max: 100 }
            ],
            shape: 'polygon',
            splitNumber: 4,
            axisName: { color: muted, fontSize: 11 },
            splitLine: { lineStyle: { color: rule } },
            splitArea: { show: false },
            axisLine: { lineStyle: { color: rule } }
        },
        series: [{
            type: 'radar',
            data: [
                {
                    value: [100, 100, 100, 87, 95, 100],
                    name: '当前状态',
                    areaStyle: { color: accent + '33' },
                    lineStyle: { color: accent, width: 2 },
                    itemStyle: { color: accent }
                }
            ]
        }]
    });
    window.addEventListener('resize', function() { chartRadar.resize(); });
})();
