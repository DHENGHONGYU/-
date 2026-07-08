(function(){
  var s=getComputedStyle(document.documentElement);
  var accent=s.getPropertyValue('--accent').trim()||'#38bdf8';
  var ink=s.getPropertyValue('--ink').trim()||'#e2e8f0';
  var muted=s.getPropertyValue('--muted').trim()||'#94a3b8';
  var rule=s.getPropertyValue('--rule').trim()||'#334155';
  var red='#ef4444',yellow='#f59e0b',green='#22c55e';

  var radar=echarts.init(document.getElementById('chart-radar'),null,{renderer:'svg'});
  radar.setOption({
    animation:false,
    tooltip:{trigger:'item',appendToBody:true},
    legend:{data:['v1.0 整改前','v3.0 整改后'],bottom:0,textStyle:{color:ink,fontSize:12}},
    radar:{
      indicator:[
        {name:'L1 领域数据',max:100},{name:'L2 模块边界',max:100},
        {name:'L3 防腐层',max:100},{name:'L4 UI组件',max:100},
        {name:'L5 编排层',max:100},{name:'L6 废弃治理',max:100},
        {name:'横向 治理',max:100}
      ],
      shape:'polygon',splitNumber:5,
      axisName:{color:ink,fontSize:12},
      splitLine:{lineStyle:{color:rule}},
      splitArea:{show:false},
      axisLine:{lineStyle:{color:rule}}
    },
    series:[{type:'radar',data:[
      {value:[25,85,35,30,20,65,30],name:'v1.0 整改前',areaStyle:{color:red+'22'},lineStyle:{color:red,width:2,type:'dashed'},itemStyle:{color:red},symbol:'circle',symbolSize:5},
      {value:[50,90,90,55,70,92,85],name:'v4.0 整改后',areaStyle:{color:green+'33'},lineStyle:{color:green,width:2},itemStyle:{color:green},symbol:'circle',symbolSize:7}
    ]}]
  });
  window.addEventListener('resize',function(){radar.resize()});

  var bar=echarts.init(document.getElementById('chart-bar'),null,{renderer:'svg'});
  bar.setOption({
    animation:false,
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},appendToBody:true},
    legend:{data:['v1.0','v4.0'],bottom:0,textStyle:{color:ink,fontSize:12}},
    grid:{left:'3%',right:'4%',bottom:'10%',containLabel:true},
    xAxis:{type:'category',data:['静默回退\n(Critical)','魔法数字\n(Major)','页面直接\nimport Service','页面直接\nimport dataLayer','生产代码\nas any','生产代码\n@ts-expect','audit layers\nwarnings','僵尸组件\n(>400行)','循环依赖','orderStore\n行数(百)','吞异常\n(严重)'],
      axisLabel:{color:muted,fontSize:8,interval:0},axisLine:{lineStyle:{color:rule}}},
    yAxis:{type:'value',axisLabel:{color:muted},splitLine:{lineStyle:{color:rule}}},
    series:[
      {name:'v1.0',type:'bar',data:[693,560,10,3,1,2,3,3,1,8.5,5],itemStyle:{color:red+'99'},barGap:'20%'},
      {name:'v4.0',type:'bar',data:[707,538,2,0,0,0,0,0,0,4.8,0],itemStyle:{color:green+'cc'},label:{show:true,position:'top',color:ink,fontSize:9,formatter:function(p){return p.value>0?p.value:''}}}
    ]
  });
  window.addEventListener('resize',function(){bar.resize()});
})();
