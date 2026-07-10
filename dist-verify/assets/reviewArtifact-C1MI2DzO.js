import{s as H}from"./middleware-BkBZHxXY.js";import{al as F,V as I,X as k,Y as C,Z as U,_ as L,am as D,an as _,ae as W,n as V,a8 as B,g as G,j as r,e,c as o,T as l}from"./index-BxngZjDM.js";import{u as R,r as q}from"./orderStore-Ts52ZUua.js";import{w as Y}from"./withBroadcast-U2bzyHG_.js";import{c as K}from"./vendor-Cbuww7DR.js";import{S as X}from"./PortalShell-CDcgcg9w.js";const p=G(),T={latestReport:null,tradeErrors:[],disciplineScore:100,skillRoadmap:[],psychologicalProfile:null,loading:!0,error:null,isRefreshing:!1,lastUpdated:0};function Z(t){return{disciplineScore:t.summary.disciplineScore,skillRoadmap:t.skillDevelopment.learningPath.map(n=>n.title),psychologicalProfile:t.errorAnalysis.psychologicalProfile}}const ae=K()(H((t,n)=>({...T,recalculate:async i=>{const a=n();if(a.isRefreshing){p.debug("[disciplineStore] recalculate skipped: isRefreshing is true");return}const d={latestReport:a.latestReport,tradeErrors:a.tradeErrors,disciplineScore:a.disciplineScore,skillRoadmap:a.skillRoadmap,psychologicalProfile:a.psychologicalProfile,lastUpdated:a.lastUpdated};t({isRefreshing:!0,loading:a.latestReport===null,error:null});try{p.info("[disciplineStore] recalculate 开始");let s=i;s||(await q.waitFor("orderStore"),await R.getState().refresh(),s=R.getState().orders),p.info(`[disciplineStore] 生成复盘报告: 订单数=${s.length}`);const x=await D(s),c=Z(x),y=_(s),f={id:"latest",generatedAt:x.generatedAt,report:x,tradeErrors:y.errors,...c};try{await k.forward(W.create({source:C.tradeReviews,target:B.db,action:L.saveTradeReview,traceId:`discipline-save-${V(8)}`},f)),p.info("[disciplineStore] 复盘摘要已持久化")}catch(g){const $=g instanceof Error?g.message:String(g);p.warn("[disciplineStore] 复盘摘要持久化失败",{error:$})}t({latestReport:x,tradeErrors:y.errors,...c,loading:!1,error:null,isRefreshing:!1,lastUpdated:Date.now()}),p.info("[disciplineStore] recalculate 完成",{disciplineScore:c.disciplineScore,totalTrades:x.summary.totalTrades})}catch(s){const x=s instanceof Error?s.message:String(s);p.error("[disciplineStore] recalculate 失败，回滚到旧快照",{error:x}),t({...d,loading:!1,error:x,isRefreshing:!1})}},refresh:async()=>{const i=n();if(i.isRefreshing){p.debug("[disciplineStore] refresh skipped: isRefreshing is true");return}const a={latestReport:i.latestReport,tradeErrors:i.tradeErrors,disciplineScore:i.disciplineScore,skillRoadmap:i.skillRoadmap,psychologicalProfile:i.psychologicalProfile,lastUpdated:i.lastUpdated};t({isRefreshing:!0,loading:i.latestReport===null,error:null});try{p.info("[disciplineStore] refresh 开始");const d=await k.query({action:L.queryGet,store:U.tradeReviews,source:C.tradeReviews,key:"latest"});if(!d.success)throw new Error(d.error??"读取复盘记录失败");const s=d.data??null;if(!s){p.info("[disciplineStore] 未找到已持久化的复盘记录"),t({loading:!1,error:null,isRefreshing:!1});return}t({latestReport:s.report,tradeErrors:s.tradeErrors,disciplineScore:s.disciplineScore,skillRoadmap:s.skillRoadmap,psychologicalProfile:s.psychologicalProfile,loading:!1,error:null,isRefreshing:!1,lastUpdated:s.generatedAt}),p.info("[disciplineStore] refresh 完成",{disciplineScore:s.disciplineScore,generatedAt:s.generatedAt})}catch(d){const s=d instanceof Error?d.message:String(d);p.error("[disciplineStore] refresh 失败，回滚到旧快照",{error:s}),t({...a,loading:!1,error:s,isRefreshing:!1})}},reset:()=>{p.info("[disciplineStore] reset"),t({...T}),Y(I.DISCIPLINE_CHANGED,{action:"reset"})},loadOrders:async()=>{p.info("[disciplineStore] loadOrders 开始（委托给 orderStore）");try{await R.getState().refresh();const i=R.getState().orders;return p.info(`[disciplineStore] loadOrders 完成: ${i.length} 笔`),i}catch(i){const a=i instanceof Error?i.message:String(i);throw p.error(`[disciplineStore] loadOrders 异常: ${a}`),i}},generateReviewReport:i=>{p.info(`[disciplineStore] generateReviewReport 开始: ${i.length} 笔`);try{const a=F(i);return p.info("[disciplineStore] generateReviewReport 完成"),a}catch(a){const d=a instanceof Error?a.message:String(a);throw p.error(`[disciplineStore] generateReviewReport 异常: ${d}`),a}}})));function J(t){return t>0?e.success.hex:t<0?e.danger.hex:e.textSecondary.hex}function b(t){return t>=80?e.success.hex:t>=60?e.info.hex:e.warning.hex}function j(t,n=1){return`${t.toFixed(n)}%`}function m({label:t,value:n,colorHex:i}){return r.jsxs("div",{className:o("flex flex-col gap-1"),children:[r.jsx("span",{className:o(l.typography.fontSize.xs,e.textMuted.tailwind),children:t}),r.jsx("span",{className:o(l.typography.fontSize["2xl"],l.typography.fontWeight.bold,l.typography.lineHeight.tight),style:{color:i??e.textPrimary.hex},children:n})]})}function v({children:t}){return r.jsxs("div",{className:o("flex items-center gap-2",l.spacing.pxSm),children:[r.jsx("span",{className:o("inline-block h-4 w-1 rounded-full"),style:{background:e.emerald.hex}}),r.jsx("h4",{className:o(l.typography.fontSize.base,l.typography.fontWeight.semibold,l.color.border),children:t})]})}function ne({report:t,generatedAt:n,maxWidth:i=720,className:a,...d}){const{summary:s,errorAnalysis:x,disciplineAnalysis:c,skillDevelopment:y,actionPlan:f,aiInsight:g}=t,$=x.psychologicalProfile;return r.jsxs("div",{className:o("mx-auto w-full overflow-hidden border shadow-sm",l.radius.lg,e.bgCard.tailwind,a),style:{maxWidth:i},...d,children:[r.jsxs("div",{className:o("flex items-center justify-between px-6 py-4",l.color.border),style:{background:e.textPrimary.hex,color:e.bgCard.hex},children:[r.jsxs("div",{className:o("flex flex-col gap-0.5"),children:[r.jsx("span",{className:o(l.typography.fontSize.lg,l.typography.fontWeight.bold),children:"交易复盘 · 成品卡"}),r.jsxs("span",{className:o(l.typography.fontSize.xs,l.color.muted),style:{color:e.bgCard.hex},children:["V9 智能投研复盘系统 · ",n]})]}),r.jsxs("span",{className:o("rounded-full px-2.5 py-0.5",l.typography.fontSize.xs,l.typography.fontWeight.semibold),style:{background:e.emerald.hex,color:e.bgCard.hex},children:["纪律 ",s.disciplineScore.toFixed(0)]})]}),r.jsxs("div",{className:o("space-y-6 p-6"),children:[r.jsx("div",{className:o("space-y-2"),children:r.jsx(X,{value:s.disciplineScore,label:"综合纪律评分",size:"md"})}),r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"交易摘要"}),r.jsxs("div",{className:o("grid grid-cols-2 gap-4 sm:grid-cols-4"),children:[r.jsx(m,{label:"胜率",value:j(s.winRate),colorHex:b(s.winRate)}),r.jsx(m,{label:"盈亏比",value:s.profitLossRatio.toFixed(2),colorHex:b(s.profitLossRatio*20)}),r.jsx(m,{label:"总盈亏",value:j(s.totalPnLPercent),colorHex:J(s.totalPnL)}),r.jsx(m,{label:"交易笔数",value:String(s.totalTrades)})]})]}),r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"心理画像"}),r.jsxs("div",{className:o("flex flex-wrap items-center gap-2"),children:[r.jsx("span",{className:o("rounded-full px-2.5 py-0.5",l.typography.fontSize.xs,l.typography.fontWeight.semibold),style:{background:e.emerald.hex,color:e.bgCard.hex},children:$.name}),r.jsx("span",{className:o(l.typography.fontSize.sm,e.textSecondary.tailwind),children:$.rootCause})]})]}),r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"纪律分析"}),r.jsxs("div",{className:o("grid grid-cols-2 gap-4 sm:grid-cols-4"),children:[r.jsx(m,{label:"计划遵守率",value:j(c.planAdherenceRate),colorHex:b(c.planAdherenceRate)}),r.jsx(m,{label:"止损执行率",value:j(c.stopLossExecutionRate),colorHex:b(c.stopLossExecutionRate)}),r.jsx(m,{label:"仓位管理",value:c.positionManagementScore.toFixed(1),colorHex:b(c.positionManagementScore*10)}),r.jsx(m,{label:"情绪控制",value:c.emotionControlScore.toFixed(1),colorHex:b(c.emotionControlScore*10)})]})]}),r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"技能发展"}),r.jsxs("div",{className:o("flex items-center justify-between rounded-md border px-4 py-3",l.color.border),children:[r.jsx("span",{className:o(l.typography.fontSize.sm,e.textSecondary.tailwind),children:"当前综合技能等级"}),r.jsx("span",{className:o(l.typography.fontSize.lg,l.typography.fontWeight.semibold),style:{color:e.emerald.hex},children:y.overallLevel})]})]}),r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"行动计划"}),r.jsxs("div",{className:o("grid grid-cols-1 gap-3 sm:grid-cols-3"),children:[r.jsx(E,{title:"立即执行",items:f.immediate}),r.jsx(E,{title:"短期（1 个月）",items:f.shortTerm}),r.jsx(E,{title:"长期（3 个月）",items:f.longTerm})]})]}),(g.pnlAttribution.length>0||g.dataPatterns.length>0||g.personalizedAdvice.length>0)&&r.jsxs("section",{className:o("space-y-3"),children:[r.jsx(v,{children:"AI 深度洞察"}),r.jsxs("div",{className:o("space-y-2"),children:[g.pnlAttribution.length>0&&r.jsx(P,{title:"盈亏归因",items:g.pnlAttribution}),g.dataPatterns.length>0&&r.jsx(P,{title:"数据规律",items:g.dataPatterns}),g.personalizedAdvice.length>0&&r.jsx(P,{title:"个性化建议",items:g.personalizedAdvice})]})]})]}),r.jsx("div",{className:o("border-t px-6 py-3",l.typography.fontSize.xs,l.color.muted,l.color.border),children:"本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。"})]})}function E({title:t,items:n}){return n.length===0?null:r.jsxs("div",{className:o("rounded-md border p-3",l.color.border,e.bgCard.tailwind),children:[r.jsx("p",{className:o(l.typography.fontSize.sm,l.typography.fontWeight.medium,e.textSecondary.tailwind),children:t}),r.jsx("ul",{className:o("mt-2 list-disc space-y-1 pl-4",l.typography.fontSize.xs,e.textMuted.tailwind),children:n.map((i,a)=>r.jsx("li",{children:i},a))})]})}function P({title:t,items:n}){return r.jsxs("div",{className:o("space-y-1"),children:[r.jsx("p",{className:o(l.typography.fontSize.sm,l.typography.fontWeight.medium,e.textSecondary.tailwind),children:t}),r.jsx("ul",{className:o("list-disc space-y-1 pl-4",l.typography.fontSize.sm,e.textMuted.tailwind),children:n.map((i,a)=>r.jsx("li",{children:i},a))})]})}function h(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Q(t){return t>0?e.success.hex:t<0?e.danger.hex:e.textSecondary.hex}function S(t){return t>=80?e.success.hex:t>=60?e.info.hex:e.warning.hex}function N(t,n=1){return`${t.toFixed(n)}%`}function M(t){return t.length===0?"":`<ul style="margin:6px 0 0;padding-left:18px;color:${e.textMuted.hex};font-size:13px;line-height:1.7;">${t.map(n=>`<li>${h(n)}</li>`).join("")}</ul>`}function w(t){return`<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;">
    <span style="display:inline-block;width:4px;height:16px;border-radius:9999px;background:${e.emerald.hex};"></span>
    <h4 style="margin:0;font-size:15px;font-weight:600;color:${e.textPrimary.hex};">${h(t)}</h4>
  </div>`}function u(t,n,i){return`<div style="display:flex;flex-direction:column;gap:4px;">
    <span style="font-size:12px;color:${e.textMuted.hex};">${h(t)}</span>
    <span style="font-size:22px;font-weight:700;line-height:1.1;color:${i??e.textPrimary.hex};">${h(n)}</span>
  </div>`}function z(t,n){return n.length===0?"":`<div style="border:1px solid ${e.border.hex};border-radius:8px;padding:12px;background:${e.bgCard.hex};">
    <p style="margin:0;font-size:13px;font-weight:500;color:${e.textSecondary.hex};">${h(t)}</p>
    ${M(n)}
  </div>`}function A(t,n){return n.length===0?"":`<div style="margin-bottom:8px;">
    <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:${e.textSecondary.hex};">${h(t)}</p>
    ${M(n)}
  </div>`}function O(t,n){const{summary:i,errorAnalysis:a,disciplineAnalysis:d,skillDevelopment:s,actionPlan:x,aiInsight:c}=t,y=a.psychologicalProfile,f=Math.max(0,Math.min(100,i.disciplineScore));return`<!DOCTYPE html>
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
        <div class="sub">V9 智能投研复盘系统 · ${h(n)}</div>
      </div>
      <span class="badge">纪律 ${f.toFixed(0)}</span>
    </div>
    <div class="body">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:6px;">
          <span style="color:${e.textMuted.hex};">综合纪律评分</span>
          <span style="color:${e.emerald.hex};">${f.toFixed(0)}</span>
        </div>
        <div class="spectrum"><i style="width:${f}%"></i></div>
      </div>

      ${w("交易摘要")}
      <div class="grid4">
        ${u("胜率",N(i.winRate),S(i.winRate))}
        ${u("盈亏比",i.profitLossRatio.toFixed(2),S(i.profitLossRatio*20))}
        ${u("总盈亏",N(i.totalPnLPercent),Q(i.totalPnL))}
        ${u("交易笔数",String(i.totalTrades))}
      </div>

      ${w("心理画像")}
      <div class="profile">
        <span class="name">${h(y.name)}</span>
        <span class="root">${h(y.rootCause)}</span>
      </div>

      ${w("纪律分析")}
      <div class="grid4">
        ${u("计划遵守率",N(d.planAdherenceRate),S(d.planAdherenceRate))}
        ${u("止损执行率",N(d.stopLossExecutionRate),S(d.stopLossExecutionRate))}
        ${u("仓位管理",d.positionManagementScore.toFixed(1),S(d.positionManagementScore*10))}
        ${u("情绪控制",d.emotionControlScore.toFixed(1),S(d.emotionControlScore*10))}
      </div>

      ${w("技能发展")}
      <div class="skillbar">
        <span style="font-size:13px;color:${e.textSecondary.hex};">当前综合技能等级</span>
        <span style="font-size:18px;font-weight:600;color:${e.emerald.hex};">${h(s.overallLevel)}</span>
      </div>

      ${w("行动计划")}
      <div class="grid3">
        ${z("立即执行",x.immediate)}
        ${z("短期（1 个月）",x.shortTerm)}
        ${z("长期（3 个月）",x.longTerm)}
      </div>

      ${c.pnlAttribution.length>0||c.dataPatterns.length>0||c.personalizedAdvice.length>0?`${w("AI 深度洞察")}
      <div>
        ${A("盈亏归因",c.pnlAttribution)}
        ${A("数据规律",c.dataPatterns)}
        ${A("个性化建议",c.personalizedAdvice)}
      </div>`:""}
    </div>
    <div class="footer">本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。</div>
  </div>
</body>
</html>`}function le(t,n){const i=O(t,n),a=new Blob([i],{type:"text/html;charset=utf-8"}),d=URL.createObjectURL(a),s=document.createElement("a");s.href=d,s.download=`交易复盘成品卡_${new Date().toISOString().slice(0,10)}.html`,document.body.appendChild(s),s.click(),document.body.removeChild(s),setTimeout(()=>URL.revokeObjectURL(d),0)}function de(t,n){const i=O(t,n),a=window.open("","_blank");a&&(a.document.open(),a.document.write(i),a.document.close())}export{ne as R,le as d,de as o,ae as u};
