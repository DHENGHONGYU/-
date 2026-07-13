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

serverFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8')
  
  const nameMatch = content.match(/info:\s*ServerInfo\s*=\s*\{[^}]*name:\s*['"]([^'"]+)['"]/s)
  const serverName = nameMatch ? nameMatch[1] : path.basename(file, '.ts').replace('Server', '').toLowerCase()
  
  const lines = content.split('\n')
  const inGetTools = lines.findIndex(l => l.includes('protected getTools'))
  const inGetResources = lines.findIndex(l => l.includes('protected getResources'))
  const inGetPrompts = lines.findIndex(l => l.includes('protected getPrompts'))
  
  const sourceTools: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (inGetResources > 0 && i > inGetResources && inGetPrompts > 0 && i < inGetPrompts) {
      continue
    }
    if (inGetPrompts > 0 && i > inGetPrompts) {
      continue
    }
    if (inGetResources > 0 && inGetPrompts === -1 && i > inGetResources) {
      continue
    }
    
    const nameMatch = line.match(/name:\s*['"]([^'"]+)['"]/)
    if (nameMatch) {
      const toolName = nameMatch[1]
      if (!toolName.includes(' ') && !toolName.includes('/')) {
        if (!sourceTools.includes(toolName)) {
          sourceTools.push(toolName)
        }
      }
    }
  }
  
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