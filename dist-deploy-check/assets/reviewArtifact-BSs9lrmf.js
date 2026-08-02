import{j as t,k as e,a as s,T as o}from"./index-BkmMWRQo.js";import{S as k}from"./PortalShell-BwZQ8ZBc.js";function L(i){return i>0?e.success.hex:i<0?e.danger.hex:e.textSecondary.hex}function u(i){return i>=80?e.success.hex:i>=60?e.info.hex:e.warning.hex}function j(i,r=1){return`${i.toFixed(r)}%`}function h({label:i,value:r,colorHex:n}){return t.jsxs("div",{className:s("flex flex-col gap-1"),children:[t.jsx("span",{className:s(o.typography.fontSize.xs,e.textMuted.tailwind),children:i}),t.jsx("span",{className:s(o.typography.fontSize["2xl"],o.typography.fontWeight.bold,o.typography.lineHeight.tight),style:{color:n??e.textPrimary.hex},children:r})]})}function f({children:i}){return t.jsxs("div",{className:s("flex items-center gap-2",o.spacing.pxSm),children:[t.jsx("span",{className:s("inline-block h-4 w-1 rounded-full"),style:{background:e.emerald.hex}}),t.jsx("h4",{className:s(o.typography.fontSize.base,o.typography.fontWeight.semibold,o.color.border),children:i})]})}function F({report:i,generatedAt:r,maxWidth:n=720,className:d,...c}){const{summary:a,errorAnalysis:v,disciplineAnalysis:l,skillDevelopment:$,actionPlan:m,aiInsight:p}=i,S=v.psychologicalProfile;return t.jsxs("div",{className:s("mx-auto w-full overflow-hidden border shadow-sm",o.radius.lg,e.bgCard.tailwind,d),style:{maxWidth:n},...c,children:[t.jsxs("div",{className:s("flex items-center justify-between px-6 py-4",o.color.border),style:{background:e.textPrimary.hex,color:e.bgCard.hex},children:[t.jsxs("div",{className:s("flex flex-col gap-0.5"),children:[t.jsx("span",{className:s(o.typography.fontSize.lg,o.typography.fontWeight.bold),children:"交易复盘 · 成品卡"}),t.jsxs("span",{className:s(o.typography.fontSize.xs,o.color.muted),style:{color:e.bgCard.hex},children:["V9 智能投研复盘系统 · ",r]})]}),t.jsxs("span",{className:s("rounded-full px-2.5 py-0.5",o.typography.fontSize.xs,o.typography.fontWeight.semibold),style:{background:e.emerald.hex,color:e.bgCard.hex},children:["纪律 ",a.disciplineScore.toFixed(0)]})]}),t.jsxs("div",{className:s("space-y-6 p-6"),children:[t.jsx("div",{className:s("space-y-2"),children:t.jsx(k,{value:a.disciplineScore,label:"综合纪律评分",size:"md"})}),t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"交易摘要"}),t.jsxs("div",{className:s("grid grid-cols-2 gap-4 sm:grid-cols-4"),children:[t.jsx(h,{label:"胜率",value:j(a.winRate),colorHex:u(a.winRate)}),t.jsx(h,{label:"盈亏比",value:a.profitLossRatio.toFixed(2),colorHex:u(a.profitLossRatio*20)}),t.jsx(h,{label:"总盈亏",value:j(a.totalPnLPercent),colorHex:L(a.totalPnL)}),t.jsx(h,{label:"交易笔数",value:String(a.totalTrades)})]})]}),t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"心理画像"}),t.jsxs("div",{className:s("flex flex-wrap items-center gap-2"),children:[t.jsx("span",{className:s("rounded-full px-2.5 py-0.5",o.typography.fontSize.xs,o.typography.fontWeight.semibold),style:{background:e.emerald.hex,color:e.bgCard.hex},children:S.name}),t.jsx("span",{className:s(o.typography.fontSize.sm,e.textSecondary.tailwind),children:S.rootCause})]})]}),t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"纪律分析"}),t.jsxs("div",{className:s("grid grid-cols-2 gap-4 sm:grid-cols-4"),children:[t.jsx(h,{label:"计划遵守率",value:j(l.planAdherenceRate),colorHex:u(l.planAdherenceRate)}),t.jsx(h,{label:"止损执行率",value:j(l.stopLossExecutionRate),colorHex:u(l.stopLossExecutionRate)}),t.jsx(h,{label:"仓位管理",value:l.positionManagementScore.toFixed(1),colorHex:u(l.positionManagementScore*10)}),t.jsx(h,{label:"情绪控制",value:l.emotionControlScore.toFixed(1),colorHex:u(l.emotionControlScore*10)})]})]}),t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"技能发展"}),t.jsxs("div",{className:s("flex items-center justify-between rounded-md border px-4 py-3",o.color.border),children:[t.jsx("span",{className:s(o.typography.fontSize.sm,e.textSecondary.tailwind),children:"当前综合技能等级"}),t.jsx("span",{className:s(o.typography.fontSize.lg,o.typography.fontWeight.semibold),style:{color:e.emerald.hex},children:$.overallLevel})]})]}),t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"行动计划"}),t.jsxs("div",{className:s("grid grid-cols-1 gap-3 sm:grid-cols-3"),children:[t.jsx(N,{title:"立即执行",items:m.immediate}),t.jsx(N,{title:"短期（1 个月）",items:m.shortTerm}),t.jsx(N,{title:"长期（3 个月）",items:m.longTerm})]})]}),(p.pnlAttribution.length>0||p.dataPatterns.length>0||p.personalizedAdvice.length>0)&&t.jsxs("section",{className:s("space-y-3"),children:[t.jsx(f,{children:"AI 深度洞察"}),t.jsxs("div",{className:s("space-y-2"),children:[p.pnlAttribution.length>0&&t.jsx(z,{title:"盈亏归因",items:p.pnlAttribution}),p.dataPatterns.length>0&&t.jsx(z,{title:"数据规律",items:p.dataPatterns}),p.personalizedAdvice.length>0&&t.jsx(z,{title:"个性化建议",items:p.personalizedAdvice})]})]})]}),t.jsx("div",{className:s("border-t px-6 py-3",o.typography.fontSize.xs,o.color.muted,o.color.border),children:"本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。"})]})}function N({title:i,items:r}){return r.length===0?null:t.jsxs("div",{className:s("rounded-md border p-3",o.color.border,e.bgCard.tailwind),children:[t.jsx("p",{className:s(o.typography.fontSize.sm,o.typography.fontWeight.medium,e.textSecondary.tailwind),children:i}),t.jsx("ul",{className:s("mt-2 list-disc space-y-1 pl-4",o.typography.fontSize.xs,e.textMuted.tailwind),children:r.map((n,d)=>t.jsx("li",{children:n},d))})]})}function z({title:i,items:r}){return t.jsxs("div",{className:s("space-y-1"),children:[t.jsx("p",{className:s(o.typography.fontSize.sm,o.typography.fontWeight.medium,e.textSecondary.tailwind),children:i}),t.jsx("ul",{className:s("list-disc space-y-1 pl-4",o.typography.fontSize.sm,e.textMuted.tailwind),children:r.map((n,d)=>t.jsx("li",{children:n},d))})]})}function x(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function M(i){return i>0?e.success.hex:i<0?e.danger.hex:e.textSecondary.hex}function y(i){return i>=80?e.success.hex:i>=60?e.info.hex:e.warning.hex}function w(i,r=1){return`${i.toFixed(r)}%`}function A(i){return i.length===0?"":`<ul style="margin:6px 0 0;padding-left:18px;color:${e.textMuted.hex};font-size:13px;line-height:1.7;">${i.map(r=>`<li>${x(r)}</li>`).join("")}</ul>`}function b(i){return`<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;">
    <span style="display:inline-block;width:4px;height:16px;border-radius:9999px;background:${e.emerald.hex};"></span>
    <h4 style="margin:0;font-size:15px;font-weight:600;color:${e.textPrimary.hex};">${x(i)}</h4>
  </div>`}function g(i,r,n){return`<div style="display:flex;flex-direction:column;gap:4px;">
    <span style="font-size:12px;color:${e.textMuted.hex};">${x(i)}</span>
    <span style="font-size:22px;font-weight:700;line-height:1.1;color:${n??e.textPrimary.hex};">${x(r)}</span>
  </div>`}function R(i,r){return r.length===0?"":`<div style="border:1px solid ${e.border.hex};border-radius:8px;padding:12px;background:${e.bgCard.hex};">
    <p style="margin:0;font-size:13px;font-weight:500;color:${e.textSecondary.hex};">${x(i)}</p>
    ${A(r)}
  </div>`}function C(i,r){return r.length===0?"":`<div style="margin-bottom:8px;">
    <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:${e.textSecondary.hex};">${x(i)}</p>
    ${A(r)}
  </div>`}function P(i,r){const{summary:n,errorAnalysis:d,disciplineAnalysis:c,skillDevelopment:a,actionPlan:v,aiInsight:l}=i,$=d.psychologicalProfile,m=Math.max(0,Math.min(100,n.disciplineScore));return`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>交易复盘成品卡</title>
<style>${`
    * { box-sizing: border-box; }
    body { margin:0; background:${e.bgMuted.hex}; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:${e.textPrimary.hex}; }
    .card { max-width:760px; margin:24px auto; background:${e.bgCard.hex}; border:1px solid ${e.border.hex}; border-radius:16px; overflow:hidden; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; background:${e.textPrimary.hex}; color:${e.bgCard.hex}; }
    .header .title { font-size:18px; font-weight:700; }
    .header .sub { font-size:12px; color:${e.bgCard.hex}; margin-top:2px; }
    .badge { border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; background:${e.emerald.hex}; color:${e.bgCard.hex}; }
    .body { padding:24px; display:flex; flex-direction:column; gap:24px; }
    .spectrum { height:8px; border-radius:9999px; background:${e.bgMuted.hex}; position:relative; overflow:hidden; }
    .spectrum > i { position:absolute; left:0; top:0; bottom:0; border-radius:9999px; background:linear-gradient(to right,${e.warning.hex} 0%,${e.info.hex} 50%,${e.emerald.hex} 100%); }
    .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .profile { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .profile .name { border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; background:${e.emerald.hex}; color:${e.bgCard.hex}; }
    .profile .root { font-size:13px; color:${e.textSecondary.hex}; }
    .skillbar { display:flex; align-items:center; justify-content:space-between; border:1px solid ${e.border.hex}; border-radius:8px; padding:12px 16px; }
    .footer { border-top:1px solid ${e.border.hex}; padding:12px 24px; font-size:12px; color:${e.textMuted.hex}; }
    @media (max-width:600px){ .grid4,.grid3{ grid-template-columns:repeat(2,1fr);} .card{margin:12px;} .body{padding:16px;} }
  `}</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">交易复盘 · 成品卡</div>
        <div class="sub">V9 智能投研复盘系统 · ${x(r)}</div>
      </div>
      <span class="badge">纪律 ${m.toFixed(0)}</span>
    </div>
    <div class="body">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:6px;">
          <span style="color:${e.textMuted.hex};">综合纪律评分</span>
          <span style="color:${e.emerald.hex};">${m.toFixed(0)}</span>
        </div>
        <div class="spectrum"><i style="width:${m}%"></i></div>
      </div>

      ${b("交易摘要")}
      <div class="grid4">
        ${g("胜率",w(n.winRate),y(n.winRate))}
        ${g("盈亏比",n.profitLossRatio.toFixed(2),y(n.profitLossRatio*20))}
        ${g("总盈亏",w(n.totalPnLPercent),M(n.totalPnL))}
        ${g("交易笔数",String(n.totalTrades))}
      </div>

      ${b("心理画像")}
      <div class="profile">
        <span class="name">${x($.name)}</span>
        <span class="root">${x($.rootCause)}</span>
      </div>

      ${b("纪律分析")}
      <div class="grid4">
        ${g("计划遵守率",w(c.planAdherenceRate),y(c.planAdherenceRate))}
        ${g("止损执行率",w(c.stopLossExecutionRate),y(c.stopLossExecutionRate))}
        ${g("仓位管理",c.positionManagementScore.toFixed(1),y(c.positionManagementScore*10))}
        ${g("情绪控制",c.emotionControlScore.toFixed(1),y(c.emotionControlScore*10))}
      </div>

      ${b("技能发展")}
      <div class="skillbar">
        <span style="font-size:13px;color:${e.textSecondary.hex};">当前综合技能等级</span>
        <span style="font-size:18px;font-weight:600;color:${e.emerald.hex};">${x(a.overallLevel)}</span>
      </div>

      ${b("行动计划")}
      <div class="grid3">
        ${R("立即执行",v.immediate)}
        ${R("短期（1 个月）",v.shortTerm)}
        ${R("长期（3 个月）",v.longTerm)}
      </div>

      ${l.pnlAttribution.length>0||l.dataPatterns.length>0||l.personalizedAdvice.length>0?`${b("AI 深度洞察")}
      <div>
        ${C("盈亏归因",l.pnlAttribution)}
        ${C("数据规律",l.dataPatterns)}
        ${C("个性化建议",l.personalizedAdvice)}
      </div>`:""}
    </div>
    <div class="footer">本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。</div>
  </div>
</body>
</html>`}function E(i,r){const n=P(i,r),d=new Blob([n],{type:"text/html;charset=utf-8"}),c=URL.createObjectURL(d),a=document.createElement("a");a.href=c,a.download=`交易复盘成品卡_${new Date().toISOString().slice(0,10)}.html`,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(c),0)}function I(i,r){const n=P(i,r),d=window.open("","_blank");d&&(d.document.open(),d.document.write(n),d.document.close())}export{F as R,E as d,I as o};
