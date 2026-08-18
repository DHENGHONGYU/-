/**
 * 直接测试 iFinD API 调用（独立于 Vite）
 */
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

// 读取 token
const configPath = path.resolve(__dirname, 'lib/ifindConfig.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const token = config.IFIND_AUTH_TOKEN

const BASE = 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp'
const url = new URL(BASE)

function jsonRpcRequest(hostname, port, path, headers, body, timeoutMs) {
  timeoutMs = timeoutMs || 30000
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    console.log('[test] Request: ' + path + ' payload=' + payload.length + ' bytes')
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
      console.log('[test] Response status=' + res.statusCode)
      res.on('data', (chunk) => { raw += chunk.toString() })
      res.on('end', () => {
        console.log('[test] Response end, raw_len=' + raw.length)
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(raw) })
        } catch (_e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: { error: 'Parse error: ' + raw.slice(0, 200) } })
        }
      })
      res.on('error', (err) => {
        console.log('[test] Response error: ' + err.message)
        reject(err)
      })
    })

    req.on('error', (err) => {
      console.log('[test] Request error: ' + err.message)
      reject(err)
    })
    req.on('timeout', () => {
      console.log('[test] Request timeout')
      req.destroy()
      reject(new Error('Timeout'))
    })

    req.write(payload)
    req.end()
  })
}

async function main() {
  try {
    console.log('[test] Starting iFinD API test...')
    console.log('[test] Token length: ' + token.length)

    // Step 1: Initialize
    console.log('\n[test] === Step 1: Initialize ===')
    const initResp = await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: token,
    }, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    })

    if (initResp.data.error) {
      console.log('[test] Initialize failed: ' + JSON.stringify(initResp.data.error))
      return
    }

    const sessionId = initResp.headers['mcp-session-id']
    console.log('[test] Session ID: ' + sessionId)

    // Step 2: Send initialized notification
    console.log('\n[test] === Step 2: Notification ===')
    const notifResp = await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: token,
      'Mcp-Session-Id': sessionId,
    }, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    console.log('[test] Notification status: ' + notifResp.statusCode)

    // Step 3: Call get_stock_summary
    console.log('\n[test] === Step 3: Call get_stock_summary ===')
    const callResp = await jsonRpcRequest(url.hostname, Number(url.port) || 443, url.pathname, {
      Authorization: token,
      'Mcp-Session-Id': sessionId,
    }, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_stock_summary',
        arguments: { query: '贵州茅台 最新估值水平和目标价' },
      },
    })

    if (callResp.data.error) {
      console.log('[test] Call failed: ' + JSON.stringify(callResp.data.error))
    } else {
      console.log('[test] Call success!')
      console.log('[test] Result: ' + JSON.stringify(callResp.data).slice(0, 500))
    }
  } catch (err) {
    console.log('[test] Error: ' + err.message)
  }
}

main()