/**
 * iFinD JSON-RPC 2.0 API 客户端（CommonJS 版本）。
 *
 * 封装 iFinD MCP API 的 session 管理与工具调用，
 * 供 Vite 代理中间件使用。
 *
 * 协议：JSON-RPC 2.0 over HTTPS
 * 端点：https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp
 */
'use strict'

const https = require('node:https')

const IFIND_STOCK_BASE = 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp'

/** 发起 JSON-RPC 请求 */
function jsonRpcRequest(hostname, port, path, headers, body, timeoutMs) {
  timeoutMs = timeoutMs || 30000
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    console.log('[ifindClient] jsonRpcRequest: ' + hostname + ':' + port + path + ' payload_len=' + payload.length)
    const options = {
      hostname,
      port,
      path,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      }, headers, {
        'Content-Length': Buffer.byteLength(payload),
      }),
      timeout: timeoutMs,
    }

    const req = https.request(options, (res) => {
      let raw = ''
      console.log('[ifindClient] response status=' + res.statusCode + ' headers=' + JSON.stringify(res.headers))
      res.on('data', (chunk) => { raw += chunk.toString() })
      res.on('end', () => {
        console.log('[ifindClient] response end, raw_len=' + raw.length)
        let parsed
        try {
          parsed = JSON.parse(raw)
        } catch (_e) {
          parsed = { error: { code: -1, message: 'Invalid JSON response: ' + raw.slice(0, 200) } }
        }
        resolve({
          statusCode: res.statusCode || 500,
          headers: res.headers,
          data: parsed,
        })
      })
      res.on('error', (err) => {
        console.log('[ifindClient] response error: ' + err.message)
        reject(err)
      })
    })

    req.on('error', (err) => {
      console.log('[ifindClient] request error: ' + err.message)
      reject(err)
    })
    req.on('timeout', () => {
      console.log('[ifindClient] request timeout')
      req.destroy()
      reject(new Error('iFinD RPC timeout after ' + timeoutMs + 'ms'))
    })

    req.write(payload)
    req.end()
  })
}

const url = new URL(IFIND_STOCK_BASE)

/** 单次工具调用（含 session 初始化） */
async function callIfindTool(toolName, args, authToken) {
  try {
    console.log('[ifindClient] callIfindTool: ' + toolName + ' token_len=' + (authToken ? authToken.length : 0))
    // Step 1: Initialize session
    const initResp = await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: authToken,
    }, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'vite-proxy', version: '1.0.0' },
      },
    })

    if (initResp.data.error) {
      return { ok: false, data: null, error: 'initialize failed: ' + JSON.stringify(initResp.data.error) }
    }

    const sessionId = initResp.headers['mcp-session-id']
    if (!sessionId) {
      return { ok: false, data: null, error: 'No Mcp-Session-Id in initialize response' }
    }

    // Step 2: Send initialized notification
    await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: authToken,
      'Mcp-Session-Id': sessionId,
    }, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })

    // Step 3: Call tool
    const callResp = await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: authToken,
      'Mcp-Session-Id': sessionId,
    }, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    })

    if (callResp.data.error) {
      return { ok: false, data: null, error: 'tools/call failed: ' + JSON.stringify(callResp.data.error) }
    }

    return { ok: true, data: callResp.data.result }
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * 从 iFinD get_stock_summary 的 markdown 响应中解析目标价。
 *
 * 返回格式：
 *   { targetPrice: number, analystCount: number, buyCount: number, overweightCount: number, sellCount: number }
 */
function parseTargetPriceFromSummary(rawData) {
  try {
    // iFinD MCP 返回格式: { content: [{ type: "text", text: "markdown..." }] }
    const content = (rawData && rawData.content)
    if (!content || content.length === 0) return null
    const rawText = content[0].text || ''
    if (!rawText) return null

    // iFinD 返回的 text 可能是嵌套 JSON 字符串（如 {"code":1,"data":"# markdown..."}），
    // 也可能是纯 markdown 文本。先尝试解析为 JSON，提取 data 字段。
    var text = rawText
    try {
      var innerJson = JSON.parse(rawText)
      if (innerJson && innerJson.data && typeof innerJson.data === 'string') {
        text = innerJson.data
      }
    } catch (_) {
      // 不是 JSON，直接使用原始文本
    }

    // 定位"近30日机构评级与目标价"段落
    var targetSection = ''
    var targetIdx = text.indexOf('近30日机构评级与目标价')
    if (targetIdx === -1) {
      targetIdx = text.indexOf('机构评级与目标价')
    }
    if (targetIdx === -1) {
      // 回退：搜索整个文本
      targetSection = text
    } else {
      // 提取从该标题到下一个 # 标题之间的内容
      targetSection = text.slice(targetIdx)
      var nextHash = targetSection.indexOf('\n#', 1)
      if (nextHash !== -1) {
        targetSection = targetSection.slice(0, nextHash)
      }
    }

    // 在目标段落中查找表格数据行
    // 格式：|贵州茅台|600519.SH|1691.2967|28|25|2|0|
    var lines = targetSection.split('\n')
    var dataLine = ''
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      // 匹配包含数字小数点的数据行（非表头行，表头行不含小数点数字）
      if (line.indexOf('|') !== -1 && /\d+\.\d+/.test(line)) {
        dataLine = line
        break
      }
    }
    if (!dataLine) return null

    var cols = dataLine.split('|').map(function (c) { return c.trim() }).filter(Boolean)
    if (cols.length < 5) return null

    // 目标价表格列：证券代码 | 证券简称 | 目标价(综合值) | 评级机构家数 | 评级买入家数 | 评级增持家数 | 评级卖出家数
    return {
      targetPrice: parseFloat(cols[2] || '0') || 0,
      analystCount: parseInt(cols[3] || '0', 10) || 0,
      buyCount: parseInt(cols[4] || '0', 10) || 0,
      overweightCount: parseInt(cols[5] || '0', 10) || 0,
      sellCount: parseInt(cols[6] || '0', 10) || 0,
    }
  } catch (_e) {
    return null
  }
}

module.exports = { callIfindTool, parseTargetPriceFromSummary }