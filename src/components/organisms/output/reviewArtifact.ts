/**
 * @fileoverview P5 复盘成品卡导出工具
 *
 * 将一份 TradeReviewReport 序列化为「自包含、可独立预览/分享」的 HTML 文档：
 * - 全部 CSS 内联、零外部依赖，双击即可在任意浏览器打开；
 * - 所有颜色均引用设计令牌（COLOR_TOKENS.*.hex），源码不含任何字面 HEX/RGB，
 *   因此不会触发令牌扫描（audit:tokens）的基线回归；
 * - 用户内容经 HTML 转义，避免标签注入破坏文档结构。
 *
 * @module components/output/reviewArtifact
  * @doc [V9-DOC-FRONT-046]
*/
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { TradeReviewReport } from '@/services/trading/tradeReviewAI'

/** HTML 实体转义，防止复盘文本破坏文档结构 */
function esc(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function signHex(value: number): string {
  if (value > 0) return COLOR_TOKENS.success.hex
  if (value < 0) return COLOR_TOKENS.danger.hex
  return COLOR_TOKENS.textSecondary.hex
}

function scoreHex(value: number): string {
  if (value >= 80) return COLOR_TOKENS.success.hex
  if (value >= 60) return COLOR_TOKENS.info.hex
  return COLOR_TOKENS.warning.hex
}

function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function listBlock(items: string[]): string {
  if (items.length === 0) return ''
  return `<ul style="margin:6px 0 0;padding-left:16px;color:${COLOR_TOKENS.textMuted.hex};font-size:13px;line-height:1.7;">${items
    .map((it) => `<li>${esc(it)}</li>`)
    .join('')}</ul>`
}

function sectionTitle(title: string): string {
  return `<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;">
    <span style="display:inline-block;width:4px;height:16px;border-radius:9999px;background:${COLOR_TOKENS.emerald.hex};"></span>
    <h4 style="margin:0;font-size:15px;font-weight:600;color:${COLOR_TOKENS.textPrimary.hex};">${esc(title)}</h4>
  </div>`
}

function metric(label: string, value: string, colorHex?: string): string {
  return `<div style="display:flex;flex-direction:column;gap:4px;">
    <span style="font-size:12px;color:${COLOR_TOKENS.textMuted.hex};">${esc(label)}</span>
    <span style="font-size:22px;font-weight:700;line-height:1.1;color:${colorHex ?? COLOR_TOKENS.textPrimary.hex};">${esc(value)}</span>
  </div>`
}

function planColumn(title: string, items: string[]): string {
  if (items.length === 0) return ''
  return `<div style="border:1px solid ${COLOR_TOKENS.border.hex};border-radius:8px;padding:12px;background:${COLOR_TOKENS.bgCard.hex};">
    <p style="margin:0;font-size:13px;font-weight:500;color:${COLOR_TOKENS.textSecondary.hex};">${esc(title)}</p>
    ${listBlock(items)}
  </div>`
}

function insightGroup(title: string, items: string[]): string {
  if (items.length === 0) return ''
  return `<div style="margin-bottom:8px;">
    <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:${COLOR_TOKENS.textSecondary.hex};">${esc(title)}</p>
    ${listBlock(items)}
  </div>`
}

/**
 * 生成自包含 HTML 文档字符串（用于预览与分享）。
 * @param report 复盘报告
 * @param generatedAt 生成时间（展示用字符串）
 */
export function buildReviewArtifactHtml(report: TradeReviewReport, generatedAt: string): string {
  const { summary, errorAnalysis, disciplineAnalysis, skillDevelopment, actionPlan, aiInsight } = report
  const profile = errorAnalysis.psychologicalProfile
  const score = Math.max(0, Math.min(100, summary.disciplineScore))

  const css = `
    * { box-sizing: border-box; }
    body { margin:0; background:${COLOR_TOKENS.bgMuted.hex}; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:${COLOR_TOKENS.textPrimary.hex}; }
    .card { max-width:760px; margin:24px auto; background:${COLOR_TOKENS.bgCard.hex}; border:1px solid ${COLOR_TOKENS.border.hex}; border-radius:8px; overflow:hidden; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; background:${COLOR_TOKENS.textPrimary.hex}; color:${COLOR_TOKENS.bgCard.hex}; }
    .header .title { font-size:18px; font-weight:700; }
    .header .sub { font-size:12px; color:${COLOR_TOKENS.bgCard.hex}; margin-top:2px; }
    .badge { border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; background:${COLOR_TOKENS.emerald.hex}; color:${COLOR_TOKENS.bgCard.hex}; }
    .body { padding:24px; display:flex; flex-direction:column; gap:24px; }
    .spectrum { height:8px; border-radius:9999px; background:${COLOR_TOKENS.bgMuted.hex}; position:relative; overflow:hidden; }
    .spectrum > i { position:absolute; left:0; top:0; bottom:0; border-radius:9999px; background:linear-gradient(to right,${COLOR_TOKENS.warning.hex} 0%,${COLOR_TOKENS.info.hex} 50%,${COLOR_TOKENS.emerald.hex} 100%); }
    .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .profile { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .profile .name { border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; background:${COLOR_TOKENS.emerald.hex}; color:${COLOR_TOKENS.bgCard.hex}; }
    .profile .root { font-size:13px; color:${COLOR_TOKENS.textSecondary.hex}; }
    .skillbar { display:flex; align-items:center; justify-content:space-between; border:1px solid ${COLOR_TOKENS.border.hex}; border-radius:8px; padding:12px 16px; }
    .footer { border-top:1px solid ${COLOR_TOKENS.border.hex}; padding:12px 24px; font-size:12px; color:${COLOR_TOKENS.textMuted.hex}; }
    @media (max-width:600px){ .grid4,.grid3{ grid-template-columns:repeat(2,1fr);} .card{margin:12px;} .body{padding:16px;} }
  `

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>交易复盘成品卡</title>
<style>${css}</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">交易复盘 · 成品卡</div>
        <div class="sub">V9 智能投研复盘系统 · ${esc(generatedAt)}</div>
      </div>
      <span class="badge">纪律 ${score.toFixed(0)}</span>
    </div>
    <div class="body">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:6px;">
          <span style="color:${COLOR_TOKENS.textMuted.hex};">综合纪律评分</span>
          <span style="color:${COLOR_TOKENS.emerald.hex};">${score.toFixed(0)}</span>
        </div>
        <div class="spectrum"><i style="width:${score}%"></i></div>
      </div>

      ${sectionTitle('交易摘要')}
      <div class="grid4">
        ${metric('胜率', pct(summary.winRate), scoreHex(summary.winRate))}
        ${metric('盈亏比', summary.profitLossRatio.toFixed(2), scoreHex(summary.profitLossRatio * 20))}
        ${metric('总盈亏', pct(summary.totalPnLPercent), signHex(summary.totalPnL))}
        ${metric('交易笔数', String(summary.totalTrades))}
      </div>

      ${sectionTitle('心理画像')}
      <div class="profile">
        <span class="name">${esc(profile.name)}</span>
        <span class="root">${esc(profile.rootCause)}</span>
      </div>

      ${sectionTitle('纪律分析')}
      <div class="grid4">
        ${metric('计划遵守率', pct(disciplineAnalysis.planAdherenceRate), scoreHex(disciplineAnalysis.planAdherenceRate))}
        ${metric('止损执行率', pct(disciplineAnalysis.stopLossExecutionRate), scoreHex(disciplineAnalysis.stopLossExecutionRate))}
        ${metric('仓位管理', disciplineAnalysis.positionManagementScore.toFixed(1), scoreHex(disciplineAnalysis.positionManagementScore * 10))}
        ${metric('情绪控制', disciplineAnalysis.emotionControlScore.toFixed(1), scoreHex(disciplineAnalysis.emotionControlScore * 10))}
      </div>

      ${sectionTitle('技能发展')}
      <div class="skillbar">
        <span style="font-size:13px;color:${COLOR_TOKENS.textSecondary.hex};">当前综合技能等级</span>
        <span style="font-size:18px;font-weight:600;color:${COLOR_TOKENS.emerald.hex};">${esc(skillDevelopment.overallLevel)}</span>
      </div>

      ${sectionTitle('行动计划')}
      <div class="grid3">
        ${planColumn('立即执行', actionPlan.immediate)}
        ${planColumn('短期（1 个月）', actionPlan.shortTerm)}
        ${planColumn('长期（3 个月）', actionPlan.longTerm)}
      </div>

      ${
        aiInsight.pnlAttribution.length > 0 || aiInsight.dataPatterns.length > 0 || aiInsight.personalizedAdvice.length > 0
          ? `${sectionTitle('AI 深度洞察')}
      <div>
        ${insightGroup('盈亏归因', aiInsight.pnlAttribution)}
        ${insightGroup('数据规律', aiInsight.dataPatterns)}
        ${insightGroup('个性化建议', aiInsight.personalizedAdvice)}
      </div>`
          : ''
      }
    </div>
    <div class="footer">本成品卡由 AI 基于本地交易记录生成，仅供个人研究复盘参考，不构成任何投资建议。</div>
  </div>
</body>
</html>`

  return html
}

/** 触发浏览器下载独立 HTML 成品卡 */
export function downloadReviewArtifactHtml(report: TradeReviewReport, generatedAt: string): void {
  const html = buildReviewArtifactHtml(report, generatedAt)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `交易复盘成品卡_${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 在新标签页打开成品卡预览（分享/自检） */
export function openReviewArtifactPreview(report: TradeReviewReport, generatedAt: string): void {
  const html = buildReviewArtifactHtml(report, generatedAt)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}

