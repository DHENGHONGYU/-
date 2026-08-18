/**
 * iFinD JSON-RPC 2.0 API 客户端（Node.js 环境）。
 *
 * 封装 iFinD MCP API 的 session 管理与工具调用，
 * 供 Vite 代理中间件使用。
 *
 * 协议：JSON-RPC 2.0 over HTTPS
 * 端点：https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp
 */
import https from 'node:https'

const IFIND_STOCK_BASE = 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp'

interface IfindRpcResponse {
  jsonrpc?: string
  id?: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** 发起 JSON-RPC 请求 */
function jsonRpcRequest(
  hostname: string,
  port: number,
  path: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 30000,
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; data: IfindRpcResponse }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options: https.RequestOptions = {
      hostname,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...headers,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: timeoutMs,
    }

    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      res.on('end', () => {
        let parsed: IfindRpcResponse
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = { error: { code: -1, message: 'Invalid JSON response: ' + raw.slice(0, 200) } }
        }
        resolve({
          statusCode: res.statusCode ?? 500,
          headers: res.headers as Record<string, string | string[] | undefined>,
          data: parsed,
        })
      })
    })

    req.on('error', (err) => reject(err))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`iFinD RPC timeout after ${timeoutMs}ms`))
    })

    req.write(payload)
    req.end()
  })
}

const url = new URL(IFIND_STOCK_BASE)

/** 单次工具调用（含 session 初始化） */
export async function callIfindTool(
  toolName: string,
  args: Record<string, unknown>,
  authToken: string,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
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
      return { ok: false, data: null, error: `initialize failed: ${JSON.stringify(initResp.data.error)}` }
    }

    const sessionId = initResp.headers['mcp-session-id'] as string | undefined
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
      return { ok: false, data: null, error: `tools/call failed: ${JSON.stringify(callResp.data.error)}` }
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
export function parseTargetPriceFromSummary(rawData: unknown): {
  targetPrice: number
  analystCount: number
  buyCount: number
  overweightCount: number
  sellCount: number
} | null {
  try {
    // iFinD MCP 返回格式: { content: [{ type: "text", text: "markdown..." }] }
    const content = (rawData as Record<string, unknown>)?.content as Array<{ type: string; text: string }> | undefined
    if (!content || content.length === 0) return null
    const text = content[0]?.text ?? ''
    if (!text) return null

    // 解析"近30日机构评级与目标价"表格
    // 格式：
    // |证券代码|证券简称|目标价(综合值)|评级机构家数|评级买入家数|评级增持家数|评级卖出家数|
    // |贵州茅台|600519.SH|1691.2967|28|25|2|0|
    const tableMatch = text.match(/\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/)
    if (!tableMatch) return null

    // 跳过表头行，找数据行
    const lines = text.split('\n')
    let dataLine = ''
    for (const line of lines) {
      if (line.includes('|') && /\d+\.\d+/.test(line)) {
        dataLine = line
        break
      }
    }
    if (!dataLine) {
      // 尝试用第二个匹配（跳过表头）
      const allMatches = [...text.matchAll(/\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/g)]
      if (allMatches.length >= 2) {
        const m = allMatches[1]!
        return {
          targetPrice: parseFloat(m[3] ?? '0') || 0,
          analystCount: parseInt(m[4] ?? '0', 10) || 0,
          buyCount: parseInt(m[5] ?? '0', 10) || 0,
          overweightCount: parseInt(m[6] ?? '0', 10) || 0,
          sellCount: parseInt(m[7] ?? '0', 10) || 0,
        }
      }
      return null
    }

    const cols = dataLine.split('|').map((c) => c.trim()).filter(Boolean)
    if (cols.length < 7) return null

    return {
      targetPrice: parseFloat(cols[2] ?? '0') || 0,
      analystCount: parseInt(cols[3] ?? '0', 10) || 0,
      buyCount: parseInt(cols[4] ?? '0', 10) || 0,
      overweightCount: parseInt(cols[5] ?? '0', 10) || 0,
      sellCount: parseInt(cols[6] ?? '0', 10) || 0,
    }
  } catch {
    return null
  }
}