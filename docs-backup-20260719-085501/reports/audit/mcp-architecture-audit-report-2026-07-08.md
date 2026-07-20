---
title: MCP ܹ߼ȫ鱨
type: reports
domain: architecture
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: ": 2026-07-08 鷶Χ: MCP ĲϹ + ƹ MCP Υ + MCP ȱʧ : MCP ׼Э淶 + AGENTS.md v1.3.5..."
tags: [architecture, mcp, audit]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# MCP ܹ߼ȫ鱨

> ****: 2026-07-08
> **鷶Χ**: MCP ĲϹ + ƹ MCP Υ + MCP ȱʧ
> ****: MCP ׼Э淶 + AGENTS.md v1.3.5 ֲԼ
> **鷽ʽ**: ̬飨δ޸κδ룩

---

## һ

| ά |  |  | ַ |  | Υ/ȱʧ |
|------|---------|------|---------|--------|----------|
| ĲϹ | 8 | 4 | 3 | 1 |  |
| ƹ MCP Υ | 4 㼶 |  |  |  | 73  |
| MCP ȱʧ | 6  |  |  |  | 6  |
| **ϼ** | **18** | **4** | **3** | **1** | **79 ** |

---

## ܣس̶

### ?? P0  ߷գ4 

####  1MCP Tool/Resource Ȩ޿

- **λ**: [src/mcp/core/client.ts](../../../src/mcp/core/client.ts)[src/mcp/bridge/mcpBridge.ts](../../../src/mcp/bridge/mcpBridge.ts) ȫ
- ****: MCP κ ACL/ȨУ飬δ `src/core/acl.ts`  ACL_MATRIX ɡκε÷ִκ Server κ Tool `trading:main` µ
- **ǱӰ**: Υ AGENTS.md 1 СȨԭ 6 ܹԼûÿִв
- **޸**:  `MCPClientImpl.callTool`/`readResource` ڼ `aclEngine.assert()`

####  2MCPServerBase ȱڹ

- **λ**: [src/mcp/core/server.ts](../../../src/mcp/core/server.ts) L27-233
- ****:  `start()`/`stop()`/`health_check()`/`initialize()` 
- **ǱӰ**: Server ޷ŹرգԴй©գ޷ͳһ
- **޸**:  MCPServerBase  `abstract start()``abstract stop()``healthCheck()` 

####  3V6  LLM ǿδͨ MCP ¶

- **λ**: [src/mcp/servers/scoring/v6ScoringServer.ts](../../../src/mcp/servers/scoring/v6ScoringServer.ts)
- ****: `score_stock` ߽ `symbol`  LLM ǿ㿪ءģѡֽ LLM ע
- **ǱӰ**: Υ AGENTS.md "LLM ģѡʹñͨӿڱ¶û" "ֽעЩʹ LLM ǿ vs Զ"
- **޸**:  `llmEnhanceLayers`/`llmModel`  `llmEnhanced` ע

####  4RBAC Ȩ޹ MCP Server

- **λ**: `src/services/rbac/`  RBAC 5  CRUD + Ȩ/
- ****: RBAC дͨ6  ENVELOPE_ACTIONͨ DataBridge ¶ȱ MCP 
- **ǱӰ**: AI Agent ޷ͨ MCP û/ɫ/Ȩ޹
- **޸**: ½ `src/mcp/servers/system/systemServer.ts`

### ?? P1  зգ7 

| # |  | λ | Ӱ |
|---|---------|------|------|
| 5 | apps ֱ import service ʱ | [InputDashboard.tsx](../../../src/apps/input/InputDashboard.tsx) L17-21 | apps ַȫƹ MCP |
| 6 | store  42 ֵƹ MCP | `src/store/` 21 ļ | ܹͻAGENTS.md 1  storeserviceΥ MCP  |
| 7 | ȱٱ׼ stdio/SSE  | [transport.ts](../../../src/mcp/core/transport.ts) | ޷Ϊ MCP Server ¶ⲿ AI ͻ |
| 8 | MCPBridge δʵ StoreResource ͬ | [mcpBridge.ts](../../../src/mcp/bridge/mcpBridge.ts) L1-13 | Resource ݿ Store ״̬һ |
| 9 | ai-center ģ MCP Server | `src/services/ai-center/` | ʬģ飬ȫĿ |
| 10 | useCase Э 7/8 δ¶ | `src/services/useCase/` | ıţͳһƱͼ˫У޷ͨ MCP  |
| 11 | useMcpMigration.ts:64 callTool ȱʧ BUG | [useMcpMigration.ts](../../../src/components/organisms/system/migration/useMcpMigration.ts) L64 |  `generateMigrationReport()` Ȼʧ |

### ?? P2  ͷգ4 

| # |  | λ | Ӱ |
|---|---------|------|------|
| 12 | pages/components  7 ͵ | 3  pages + 4  components | ӦǨ `src/types/modules/` |
| 13 | MCPServer ӿȱ health_check  | [mcp.types.ts](../../../src/types/modules/mcp.types.ts) L158-180 | ޷ͨͳһӿѯ״̬ |
| 14 | JSONRPCRequest/Response Ͷ嵫δʹ | [mcp.types.ts](../../../src/types/modules/mcp.types.ts) L231-248 |  |
| 15 | SystemServer δ¶ | `src/services/system/` | ܹϡ־δͨ MCP ¶ |

---

## MCP ܹϹ㣩

| Ϲ | ˵ |
|--------|------|
| ?  | elicitation/cancellation/progress/roots/sampling/notification 6 ȫʵ |
| ? ע | mcpServerRegistry.ts + syncWithConfig() ʽעȸ |
| ? Registry  | register/unregister/getServer/listServers/setEnabled/getStats ȫ |
| ? ־ | mcpAuditLogger ͨ DataBridge ŷЭд executionLogs |
| ? Server  | 16  Server  import  service ͨ dependencies  |
| ? Registry һ | 16  Server ļȫ Registry עᣬ©޶ |
| ? Ӱ MCP | δƹ MCPServerBase ʵ MCP ӿڵģ |
| ? DataBridge ߽ | ݲͨ MCP ߵְ |
| ? ڲ㲻ֱ MCP | portal/apps ͨ store/bridge ӵãֲȷ |

---

## ġMCP ܹƵĽѵ;

### ѵ 1ܹʵֹڳͻ

****: AGENTS.md 1 ȷ `store/  services/`  MCP ܹҪŲͨ MCP ástore  42 ֵΥȫ AGENTS.md ֲ򣬵Υ MCP 

**ѵ**:  MCP ܹʱͬ޶ AGENTS.md ķֲȷ store Ƿ MCP ǿƷΧͻᵼ¿ʴӡ

### ѵ 2MCP ӦŻ

****: Ĳ㽨6  + ־ + ҵ㸲ǲȫ21  service Ŀ¼н 8  MCP Server װ13  service ޷ͨ MCP á

**ѵ**: MCP ܹƹӦȷ service  100% ǣ""ŻĲЭϹԣ""ǰ"Ĳҵխ"״̬ MCP ܹͬ衪store 㲻òƹ MCP ֱӵ service

### ѵ 3LLM ͸Ҫڽӿƽ׶ʵ

****: AGENTS.md ͡ȷҪ LLM ͸ȣģѡ¶ǿ㿪ءӱע V6ScoringServer ʱδЩҪ빤߲ͷؽṹ

**ѵ**: ܹԼĵеǿҪ LLM ͸ȣӦ MCP ߽ӿƽ׶ξ schemaº󲹶 ToolDescriptor  inputSchema ӺϹУ顣

### ѵ 4ڹ Server ıر

****: MCPServerBase ֻעѯlistTools/callToolȫȱʧڹstart/stop/health_checkԴ޷ͳһͷš״̬޷ͳһѯ

**ѵ**: Server Լinitialize  start  healthCheck  stop  shutdownԴй©״̬һⲻɱ⡣

### ѵ 5Ȩ޿Ӧڼܹڲǰ

****: DataBridge  ACL_MATRIX Ȩ޿ƣ MCP 㣨ǰڣȫûȨУ顣÷ͨ MCP Tool ƹ DataBridge  ACL Tool ڲ DataBridge

**ѵ**: Ȩ޿ӦڼܹڣMCP Tool ãڲڣDataBridge ݲ˫ãγ

---

## 塢οʱע

### ע 1MCP ߸Լ

**ע**:  service ʱǷͬ˶Ӧ MCP Server

**鷽**:
```powershell
# Ա service Ŀ¼ MCP Server 
ls src/services/ | Measure-Object  # 21 
ls src/mcp/servers/ | Measure-Object  # 16 
# ֵΪδǵ service 
```

****:  `audit:deadcode` ű"MCP "飬CI ǿҪ service ͬע MCP Server

### ע 2MCP ߲ϹУ

**ע**:  MCP ʱǷ AGENTS.md  LLM ͸Ҫ

**嵥**:
- [ ] Ƿ漰 LLM ãǣǷ¶ģѡ
- [ ] Ƿ漰֣ǣǷ¶ LLM ǿ㿪أ
- [ ] ؽǷע LLM ǿ vs Զ㣿
- [ ] Ƿûõ LLM أ

### ע 3ֲ MCP һ

**ע**: ޸ AGENTS.md 1 ֲʱǷͬ MCP Ҫ

****: AGENTS.md 1 Ӧ"MCP Ų"壬ȷ store Ƿ MCP ǿƷΧ룬ṩǨƼƻ

### ע 4MCP ·Ȩ

**ע**: MCP Tool Ƿ񾭹ȨУ飿

**鷽**:  `mcpAuditLogger` Ƽ¼ `aclResult` ֶΣ¼ȨУCI м־Ƿ ACL ܾ¼

### ע 5ЭϹ

**ע**: ǷҪⲿ AI ͻˣClaude DesktopCursor

**ߵ**: Ҫʵ stdio/SSE 㣻ãǰ InProcessTransport 㹻Ӧĵȷע

---

## ʱע

### ƹע 1Server Լ

**ԭ**: MCPServerBase 붨ڣ
```
initialize()  start()  [running]  healthCheck()  stop()  [stopped]
```

**Ҫ**:
- `initialize()`: ʼԴԴӡüأ
- `start()`: ̨񣨶ʱˢ¡¼ģ
- `healthCheck()`:  `{ status: 'healthy'|'degraded'|'unhealthy', details: {...} }`
- `stop()`: Źرգȴе Tool ɡͷԴ

### ƹע 2MCP Ȩ޾

**ԭ**: MCP ӦжȨ޾ DataBridge  ACL_MATRIX γ

**Ҫ**:
```typescript
// 飺 MCP_ACL_MATRIX
const MCP_ACL_MATRIX: Record<string, McpPermission> = {
  'agent': { allowedServers: ['*'], allowedTools: ['*'] },
  'ui': { allowedServers: ['fetcher', 'stockpool', 'scoring:v6'], allowedTools: ['health_check', 'list_*'] },
  'ci': { allowedServers: ['system'], allowedTools: ['get_*', 'generate_migration_report'] },
}
```

### ƹע 3MCP 

**ԭ**: Ӧƽ"ԭ"""

**Ҫ**:
- ԭӹߣ `list_pool_stocks` service װ
- Źߣ `getUnifiedStockView` service ۺϣӦͨ useCase װ
- ǰĿ 8  useCase  7 δͨ MCP ¶ȲŹ

### ƹע 4MCP  DataBridge ı߽

**ԭ**: MCP ǹߵڣDataBridge ݲ߲ͨ

**Ҫ**:
- MCP Tool  Service  DataBridge.forward()  DBд·
- MCP Tool  Service  DataBridge.query()  DBȡ·
- DataBridge Ӧͨ MCP ¶ǻʩҵ񹤾ߣ
- MCP Resource Զȡ DataBridge ݣͨ MCPBridge ͬ

### ƹע 5LLM ͸ȵĽӿ

**ԭ**: LLM عߵ inputSchema ͸Ȳ

**Ҫ**:
```typescript
// V6ScoringServer.score_stock  inputSchema ӦΪ
{
  symbol: { type: 'string' },
  llmEnhanceLayers: { 
    type: 'array', 
    items: { type: 'string', enum: ['L0', 'L1', 'L2', 'L5', 'L6'] },
    description: 'õ LLM ǿ㣨Ĭȫã'
  },
  llmModel: { type: 'string', description: 'LLM ģ ID' },
  disableLlm: { type: 'boolean', description: 'ȫ LLM ǿ' }
}
// ؽӦ
{
  layers: Array<{ name, score, llmEnhanced: boolean, model?: string }>
}
```

---

## ߡ޸ȼ

| ȼ | ޸ | Ԥƹ | ϵ |
|--------|--------|-----------|---------|
| P0-1 | MCP Ȩ޿ƣACL ɣ |  |  |
| P0-2 | Server ڹ |  |  |
| P0-3 | V6  LLM ǿ㱩¶ |  | Эͬ LLMServer |
| P0-4 | RBAC MCP Server |  |  RBAC service  |
| P1-1 | apps Υ޸ |  | 貹 fetcher/stockpool ȱʧ |
| P1-2 | store ǨƲԾ |  | ܹȷ |
| P1-3 | stdio/SSE ʵ |  | ӻ |
| P1-4 | MCPBridge StoreResource ͬ |  |  EventBus |
| P1-5 | ai-center ģ鴦 |  | ȷǷ |
| P1-6 | useCase Ź߲ |  |  useCase ȶ |
| P1-7 | useMcpMigration.ts BUG ޸ |  |  |
| P2 | Ǩ + ӿڲȫ +  |  |  |

---

## ˡ

V9 Ŀ MCP ܹ**ʩ**RegistryBridge־ã16  Server ȫȷעᣬServer ϡ

Ҫ⼯άȣ
1. **ȫά**: MCP Ȩ޿ƣP0 DataBridge  ACL γɰȫȱ
2. **ά**: 21  service  8  MCP Server13 ޷ͨ MCP ãP1
3. **Ϲά**: LLM ͸Ҫ 1/3P0Server ڹȱʧP0

鰴 P0  P1  P2 ˳޸ȴȫάȺͺϹάȵ 4  P0 ⡣

---

*鱨ʱ: 2026-07-08 (Asia/Shanghai)*
*ļ: 49  MCP ʵļ + 5 ݼܹĵ*
