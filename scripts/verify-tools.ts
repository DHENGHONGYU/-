import * as fs from 'fs'
import * as path from 'path'

const serversDir = 'src/mcp/servers'
const policyPath = '.trae/mcp-whitelist-policy.json'

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))

const whitelistTools: Record<string, string[]> = {}
for (const [serverName, server] of Object.entries(policy.trustedMcpServers)) {
  whitelistTools[serverName] = [
    ...(server.allowedTools || []),
    ...(server.restrictedTools || [])
  ]
}
for (const [serverName, server] of Object.entries(policy.observedMcpServers || {})) {
  whitelistTools[serverName] = [
    ...(server.allowedTools || []),
    ...(server.restrictedTools || [])
  ]
}

function getServerFiles(dir: string, files: string[] = []): string[] {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getServerFiles(fullPath, files)
    } else if (file.endsWith('Server.ts')) {
      files.push(fullPath)
    }
  })
  return files
}

const serverFiles = getServerFiles(serversDir)
console.log('=== MCP服务器源码工具名称交叉验证 ===')
console.log('')
console.log('发现服务器文件数:', serverFiles.length)
console.log('')

let allMismatches: { server: string; type: string; tools: string[] }[] = []

function extractToolsFromContent(content: string): string[] {
  const tools: string[] = []
  
  const getToolsIndex = content.indexOf('protected getTools')
  if (getToolsIndex === -1) {
    return tools
  }
  
  let braceDepth = 0
  let inReturnArray = false
  let arrayDepth = 0
  let startIndex = getToolsIndex
  
  for (let i = getToolsIndex; i < content.length; i++) {
    const char = content[i]
    
    if (char === '{') {
      braceDepth++
      if (braceDepth === 1 && !inReturnArray) {
        continue
      }
    } else if (char === '}') {
      braceDepth--
      if (braceDepth === 0) {
        break
      }
    } else if (char === '[' && braceDepth > 0 && !inReturnArray) {
      const prevChars = content.substring(Math.max(0, i - 10), i)
      if (prevChars.includes('return')) {
        inReturnArray = true
        arrayDepth = 1
        continue
      }
    } else if (char === '[' && inReturnArray) {
      arrayDepth++
    } else if (char === ']' && inReturnArray) {
      arrayDepth--
      if (arrayDepth === 0) {
        inReturnArray = false
        break
      }
    }
    
    if (inReturnArray) {
      const nameMatch = content.substring(i).match(/^name:\s*['"]([^'"]+)['"]/)
      if (nameMatch) {
        const toolName = nameMatch[1]
        if (!toolName.includes(' ') && !toolName.includes('/')) {
          if (!tools.includes(toolName)) {
            tools.push(toolName)
          }
        }
      }
    }
  }
  
  return tools
}

serverFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8')
  
  const nameMatch = content.match(/info:\s*ServerInfo\s*=\s*\{[^}]*name:\s*['"]([^'"]+)['"]/s)
  const serverName = nameMatch ? nameMatch[1] : path.basename(file, '.ts').replace('Server', '').toLowerCase()
  
  const sourceTools = extractToolsFromContent(content)
  
  const whitelistServerTools = whitelistTools[serverName] || whitelistTools[serverName.replace(':main', '')] || whitelistTools[serverName.split(':')[0]] || []
  
  const sourceOnly = sourceTools.filter(t => !whitelistServerTools.includes(t))
  const whitelistOnly = whitelistServerTools.filter(t => !sourceTools.includes(t))
  
  if (sourceOnly.length > 0 || whitelistOnly.length > 0) {
    console.log('服务器:', serverName)
    console.log('  文件:', file)
    console.log('  源码工具:', sourceTools)
    console.log('  白名单工具:', whitelistServerTools)
    if (sourceOnly.length > 0) {
      console.log('  ❌ 源码中有但白名单中没有:', sourceOnly)
      allMismatches.push({ server: serverName, type: 'missing_in_whitelist', tools: sourceOnly })
    }
    if (whitelistOnly.length > 0) {
      console.log('  ❌ 白名单中有但源码中没有:', whitelistOnly)
      allMismatches.push({ server: serverName, type: 'missing_in_source', tools: whitelistOnly })
    }
    console.log('')
  } else {
    console.log('✅ 服务器:', serverName, '-', file)
    console.log('   工具数:', sourceTools.length)
    console.log('   工具:', sourceTools)
  }
})

console.log('')
if (allMismatches.length === 0) {
  console.log('✅ 所有服务器工具名称交叉验证通过！')
} else {
  console.log('❌ 存在', allMismatches.length, '个工具名称不一致问题')
}
