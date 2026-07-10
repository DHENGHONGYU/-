import{u as R,au as I,av as N,aw as P,ax as C,V as E,ay as T,g as M}from"./index-BxngZjDM.js";import{l as $,a as b,b as x}from"./scorePageService-FYDsUEo7.js";import{l as w}from"./scoreTrendService-8Feh7dIl.js";import{w as h}from"./withBroadcast-U2bzyHG_.js";import{c as _}from"./vendor-Cbuww7DR.js";const H=`你是 V9 智能投研系统的 V6 个股智能评分分析师。请基于 V6 股票分析模型（v6-stock-analysis-model v4.3）的分层框架，对指定标的进行多源资料综合评分。

## V6 模型映射（分析时参考，输出仍用下方九维）
- L-1 行业评分估值：从 sectorSkillData / industry-score-mapping 提取行业得分。
- L0 宏观扫描：STEEP（社会/技术/经济/环境/政策）趋势。
- L1 护城河：技术独占性、客户锁定、规模效应、网络效应、资源独占。
- L2 竞品格局：技术代差、市场份额、客户认证。
- L3 财务/估值：营收增长、盈利、现金流、订单、PE/PEG。
- L4 情景推演：乐观/基准/悲观情景概率与目标价。
- L5 技术成熟度：T-M 矩阵定位。
- L6 叙事/Hype Cycle：主题热度与市场情绪位置。
- L7 第二曲线：新业务驱动。
- L8 技术筹码：量价/资金/融资/筹码变化度。

## 评分维度（V6 九维，每项 1-5，null 表示数据缺失无法评分）
1. 估值：PE、PB、PS、PEG 相对估值水平。参考 V6 估值行业基准：显著低估(PEG<0.5)、低估(0.5-0.75)、合理(0.75-1.25)、高估(>1.5)。
2. 成长：营收/利润增速、ROE 持续性、行业空间、第二曲线贡献。
3. 盈利：ROE、毛利率、净利率、现金流质量。经营现金流/净利>120%为健康，<50%为失血。
4. 质量：资产负债表健康度、治理结构、盈利可持续性。关注应收账款增速>营收增速50%、存货周转恶化等风险。
5. 动量：近期价格趋势、相对强度、突破形态、技术筹码强度。
6. 波动：价格波动率、回撤控制、融资余额变化、筹码稳定性。
7. 流动性：成交量、市值、换手率。成交量 vs 60日均量 <60%为洼地，>150%为热点。
8. 行业：行业景气度、政策支持、竞争格局、国产替代空间。
9. 情绪：市场关注度、资金流向、事件催化、Hype 周期位置。

## 评分规则
- 禁止杜撰数据：如果某项维度缺乏对应资料，必须将 score 设为 null，并在 rationale 中说明“数据缺失，未参与评分”。
- 禁止给默认值：不允许因为数据缺失就使用中性分或随机分。
- 每项评分必须给出依据：rationale 需引用资料来源（基础数据字段、补充文件片段、行业报告片段）。
- 证据链：evidence 数组列出 1-3 条支持该评分的关键原文或数据点。
- 综合分计算：综合分由调用方根据有效维度等权平均计算，你可在 summary 中给出定性结论，但不要返回 overallScore。

## 输出格式
必须返回严格的 JSON，不要包含 markdown 代码块或额外解释：
{
  "dimensions": [
    {
      "name": "估值",
      "score": 4.2,
      "rationale": "PE 为 12.5，低于行业中枢，估值分较高。",
      "evidence": ["基础数据: pe=12.5", "行业报告: 行业平均 PE 18"]
    }
  ],
  "summary": "整体评价...",
  "basis": "本评分主要基于...",
  "missingFields": ["roe", "marketCap"]
}

## 特别说明
- 如果所有维度均无法评分，返回全部 score 为 null，并在 summary 中说明“资料不足，无法评分”。
- 评分结论需区分“数据支持的强结论”和“基于经验的推测”，后者需在 rationale 中标注置信度低。`,k="未提供";function B(e){const{symbol:t,stock:r,supplementaryTexts:n,reportText:o}=e,d=r?{symbol:r.symbol,name:r.name,price:r.price??"数据缺失",pe:r.pe??"数据缺失",pb:r.pb??"数据缺失",roe:r.roe??"数据缺失",marketCap:r.marketCap??"数据缺失"}:"未找到该标的基础数据",a=[`标的代码: ${t}`,`基础数据:
${JSON.stringify(d,null,2)}`,`补充文件资料 (${n.length} 份):`,...n.map((s,l)=>`[文件${l+1}]
${s}`),`行业分析报告/资料:
${o||k}`,"请严格按照 system 指令中的 JSON 格式返回九维评分结果。"].join(`

`);return[{role:"system",content:H},{role:"user",content:a}]}const F=C();function G(e){return new Promise((t,r)=>{const n=new FileReader;n.onload=()=>{t(typeof n.result=="string"?n.result:"")},n.onerror=()=>{r(new Error(`读取文件 ${e.name} 失败`))},n.readAsText(e)})}async function V(e){return await Promise.all(e.map(async r=>{const n=await G(r);return`文件名: ${r.name}
内容:
${n}`}))}function J(e){if(!e)return["stock"];const t=[];return(e.price===void 0||e.price===null)&&t.push("price"),(e.pe===void 0||e.pe===null)&&t.push("pe"),(e.pb===void 0||e.pb===null)&&t.push("pb"),(e.roe===void 0||e.roe===null)&&t.push("roe"),(e.marketCap===void 0||e.marketCap===null)&&t.push("marketCap"),t}function U(e){const t=e.match(/```(?:json)?\s*([\s\S]*?)\s*```/);return t&&t[1]?t[1].trim():e.trim()}function j(e){const t=U(e);try{return JSON.parse(t)}catch{throw new N("LLM 返回内容不是合法 JSON")}}function A(e,t,r=!1){const n=typeof e.name=="string"&&e.name.length>0?e.name:t,o=typeof e.score=="number"?Math.max(1,Math.min(5,e.score)):null,d=typeof e.rationale=="string"?e.rationale:"未提供评分依据",a=Array.isArray(e.evidence)?e.evidence.filter(s=>typeof s=="string"):[];return{name:n,score:o,rationale:d,evidence:a,weight:1/F.length,usedLlm:r}}function z(e,t){const r=Array.isArray(e.dimensions)?e.dimensions:[],n=F.map(s=>{const l=r.find(g=>typeof g.name=="string"&&g.name.includes(s)),u=t?.factorOverrides?.find(g=>g.factorId===s),c=t?.enableLlm?u?.useLlm??!1:!1;return A(l||{name:s,score:null,rationale:"数据缺失，未参与评分"},s,c)}),o=typeof e.summary=="string"?e.summary:"未生成总结",d=typeof e.basis=="string"?e.basis:"未生成评分依据",a=Array.isArray(e.missingFields)?e.missingFields.filter(s=>typeof s=="string"):[];return{dimensions:n,summary:o,basis:d,missingFields:a}}function K(e){return P(e.map(t=>({name:t.name,score:t.score})),C().map(t=>({name:t,weight:1,enabled:!0})))}async function W(e,t){const{symbol:r,files:n,reportText:o,llmConfig:d}=e,a=(l,u,c)=>{t?.({step:l,status:u,message:c})};let s="fetchBasicData";try{s="fetchBasicData",a(s,"running","读取基础数据...");const l=await R.stocks.get(r),u=J(l);a(s,"done",l?`已读取 ${l.name}(${l.symbol})`:"未找到基础数据"),s="readSupplementaryFiles",a(s,"running",`读取 ${n.length} 个补充文件...`);const c=await V(n);a(s,"done",`已读取 ${n.length} 个文件`),s="prepareReportText",a(s,"running","整理行业报告资料..."),a(s,"done",o?"已整理报告资料":"未提供报告资料"),s="llmAnalysis",a(s,"running","调用大模型进行评分分析...");const g=B({symbol:r,stock:l,supplementaryTexts:c,reportText:o}),m=await I(g,d);a(s,"done",`模型 ${m.model} 返回分析结果`),s="parseScore",a(s,"running","解析评分结果...");const S=j(m.content),p=z(S,e.transparencyConfig),y=K(p.dimensions);a(s,"done",y!==null?`综合分 ${y}`:"综合分无法计算");const O=Array.from(new Set([...u,...p.missingFields])),v={symbol:r,overallScore:y,dimensionScores:p.dimensions,summary:p.summary,basis:p.basis,missingFields:O,sourceSnapshot:{stock:l,fileNames:n.map(D=>D.name),reportLength:o.length},configSnapshot:{model:d?.model??"",baseURL:d?.baseURL??""},modelResponse:m.content,dataVersion:l?.dataVersion??0,scoredAt:Date.now()};s="saveResult",a(s,"running","保存评分结果...");const L=await R.intelligentScores.save(v);return L.success?(a(s,"done","评分结果已保存"),{success:!0,data:v}):(a(s,"error",L.error??"保存失败"),{success:!1,error:L.error??"保存评分结果失败"})}catch(l){const u=l instanceof Error?l.message:String(l);return a(s,"error",u),{success:!1,error:u}}}const i=M(),ne={fetchBasicData:{label:"读取基础数据",description:"从数据采集层获取标的字段"},readSupplementaryFiles:{label:"解析补充文件",description:"读取本地上传文件内容"},prepareReportText:{label:"整理行业报告",description:"汇总用户输入的分析资料"},llmAnalysis:{label:"大模型分析",description:"调用最新大模型进行评分推理"},parseScore:{label:"解析评分",description:"校验并计算综合分"},saveResult:{label:"保存结果",description:"通过 DataBridge 写入数据库"}},oe=["fetchBasicData","readSupplementaryFiles","prepareReportText","llmAnalysis","parseScore","saveResult"],te=C();function se(e,t){if(e===null||t===null)return"";const r=e-t;return r>0?`(+${r.toFixed(2)})`:r<0?`(${r.toFixed(2)})`:"(0.00)"}const f={fetchBasicData:"pending",readSupplementaryFiles:"pending",prepareReportText:"pending",llmAnalysis:"pending",parseScore:"pending",saveResult:"pending"},q={symbol:"",stocks:[],files:[],reportText:"",llmConfig:T(),transparencyConfig:T(),showConfig:!1,progress:{...f},progressMessage:"",result:void 0,previousResult:void 0,history:[],logs:[],error:"",loading:!1,trendData:void 0,trendLoading:!1,trendError:null};function Q(e){if(!e.transparencyConfig.enableLlm)return!0;const{baseURL:t,apiKey:r,model:n}=e.llmConfig;return t.trim().length>0&&r.trim().length>0&&n.trim().length>0}const ie=_((e,t)=>({...q,setSymbol:r=>{i.info(`[intelligentScoreStore] setSymbol: ${r}`),e({symbol:r})},setFiles:r=>e({files:r}),setReportText:r=>e({reportText:r}),setLlmConfig:r=>{e(typeof r=="function"?n=>({llmConfig:r(n.llmConfig)}):{llmConfig:r})},setTransparencyConfig:r=>{e(typeof r=="function"?n=>({transparencyConfig:r(n.transparencyConfig)}):{transparencyConfig:r})},toggleLlm:()=>{i.info("[intelligentScoreStore] toggleLlm"),e(r=>({transparencyConfig:{...r.transparencyConfig,enableLlm:!r.transparencyConfig.enableLlm}}))},toggleFactorOverride:r=>{i.info(`[intelligentScoreStore] toggleFactorOverride: ${r}`),e(n=>({transparencyConfig:{...n.transparencyConfig,factorOverrides:n.transparencyConfig.factorOverrides?.map(o=>o.factorId===r?{...o,useLlm:!o.useLlm}:o)}}))},setShowConfig:r=>{e(typeof r=="function"?n=>({showConfig:r(n.showConfig)}):{showConfig:r})},setProgress:(r,n)=>{e(o=>({progress:{...o.progress,[r]:n}}))},setProgressMessage:r=>e({progressMessage:r}),resetProgress:()=>e({progress:{...f},progressMessage:""}),setResult:r=>{e({result:r}),h(E.INTELLIGENT_SCORES_CHANGED,{action:"setResult"})},setPreviousResult:r=>e({previousResult:r}),setHistory:r=>{e({history:r}),h(E.INTELLIGENT_SCORES_CHANGED,{action:"setHistory"})},setLogs:r=>e({logs:r}),setError:r=>e({error:r}),setLoading:r=>e({loading:r}),clearError:()=>e({error:""}),loadStocks:async()=>{i.info("[intelligentScoreStore] loadStocks 开始");try{const r=await x();e({stocks:r}),i.info(`[intelligentScoreStore] loadStocks 完成: ${r.length} 只股票`)}catch(r){const n=r instanceof Error?r.message:String(r);i.error(`[intelligentScoreStore] loadStocks 异常: ${n}`),e({error:n})}},loadHistory:async r=>{if(!r){i.info("[intelligentScoreStore] loadHistory 跳过: symbol 为空"),e({previousResult:void 0,history:[]});return}i.info(`[intelligentScoreStore] loadHistory 开始: ${r}`);try{const n=await $(r);e({history:n,previousResult:n[0]}),i.info(`[intelligentScoreStore] loadHistory 完成: ${r}, ${n.length} 条记录`)}catch(n){const o=n instanceof Error?n.message:String(n);i.error(`[intelligentScoreStore] loadHistory 异常: ${r}, ${o}`),e({error:o})}},loadLogs:async r=>{if(!r){i.info("[intelligentScoreStore] loadLogs 跳过: symbol 为空"),e({logs:[]});return}i.info(`[intelligentScoreStore] loadLogs 开始: ${r}`);try{const n=await b(r);e({logs:n}),i.info(`[intelligentScoreStore] loadLogs 完成: ${r}, ${n.length} 条日志`)}catch(n){const o=n instanceof Error?n.message:String(n);i.error(`[intelligentScoreStore] loadLogs 异常: ${r}, ${o}`),e({error:o})}},runScore:async r=>{const n=t(),o=r?.symbol??n.symbol,d=r?.files??n.files,a=r?.reportText??n.reportText,s=r?.llmConfig??n.llmConfig;if(!o.trim()){i.info("[intelligentScoreStore] runScore 跳过: symbol 为空"),e({error:"请选择或输入股票代码"});return}if(!Q(n)){i.info("[intelligentScoreStore] runScore 跳过: LLM 未配置"),e({error:"请先配置 LLM 接口（baseURL、apiKey、model）",showConfig:!0});return}i.info(`[intelligentScoreStore] runScore 开始: symbol=${o.trim()}, mode=direct`),e({loading:!0,error:"",result:void 0,progressMessage:"",progress:{...f}});const l={symbol:o.trim(),files:d,reportText:a.trim(),llmConfig:s,transparencyConfig:n.transparencyConfig},u=({step:c,status:g,message:m})=>{e(S=>({progress:{...S.progress,[c]:g}})),m&&e({progressMessage:m})};try{const c=await W(l,u);if(e({loading:!1}),c.success&&c.data){e({result:c.data});const g=await $(o);e({history:g,previousResult:g[0]});const m=await b(o);e({logs:m}),i.info(`[intelligentScoreStore] runScore 完成: symbol=${o.trim()}, overallScore=${c.data.overallScore}`)}else{const g=c.error??"评分失败";i.error(`[intelligentScoreStore] runScore 失败: ${g}`),e({error:g})}}catch(c){const g=c instanceof Error?c.message:String(c);i.error(`[intelligentScoreStore] runScore 异常: ${g}`),e({loading:!1,error:g})}},loadScoreTrend:async(r,n)=>{if(!r){i.info("[intelligentScoreStore] loadScoreTrend 跳过: symbol 为空"),e({trendData:void 0,trendError:null,trendLoading:!1});return}i.info(`[intelligentScoreStore] loadScoreTrend 开始: ${r}, period=${n}`),e({trendLoading:!0,trendError:null});try{const o=await w(r,n);o.success?(e({trendData:o.data,trendLoading:!1}),i.info(`[intelligentScoreStore] loadScoreTrend 完成: ${r}`)):(e({trendError:o.error,trendLoading:!1}),i.error(`[intelligentScoreStore] loadScoreTrend 失败: ${o.error}`))}catch(o){const d=o instanceof Error?o.message:String(o);i.error(`[intelligentScoreStore] loadScoreTrend 异常: ${r}, ${d}`),e({trendError:d,trendLoading:!1})}},resetResult:()=>{i.info("[intelligentScoreStore] resetResult"),e({result:void 0,previousResult:void 0,history:[],logs:[],progress:{...f},progressMessage:"",error:"",trendData:void 0,trendLoading:!1,trendError:null}),h(E.INTELLIGENT_SCORES_CHANGED,{action:"reset"})}}));export{te as D,oe as S,ne as a,se as f,Q as s,ie as u};
