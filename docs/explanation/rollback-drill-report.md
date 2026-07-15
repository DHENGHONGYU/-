---
title: rollback-drill-report
code_version: 2.0.0

tier: reference
---

---
title: docs/explanation/rollback-drill-report.md
code_version: 2.0.0
tier: reference
---

# V9 回滚方案演练记录（P0-08）

> **生成时间**: 2026-07-13  
> **演练类型**: 文档推演 + 命令验证（非实际生产回滚）  
> **回滚目标**: 前端静态资源（Vite SPA）+ IndexedDB 数据兼容  

---

## 一、回滚策略总览

```
┌─────────────────────────────────────────────────────────────┐
│                     部署架构                                 │
├─────────────────────────────────────────────────────────────┤
│  用户浏览器                                                  │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   CDN/NGINX  │───▶│  dist/ 静态  │    │  IndexedDB  │     │
│  │  (带版本号)  │    │  (hash 缓存) │    │  (本地存储)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│       │                    │                  │             │
│       │                    ▼                  ▼             │
│       │              index.html           DB_VERSION        │
│       │              (入口文件)           (版本控制)         │
│       │                                                     │
│       └─────────────────────────────────────────────────────┘
│                          版本号映射                           │
│              /v2.0.0/  ← 当前                                │
│              /v1.9.0/  ← 回滚目标（保留 3 个历史版本）        │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、回滚触发条件

| 等级 | 触发条件 | 响应时间 | 回滚动作 |
|------|---------|---------|---------|
| P0 | 核心功能完全不可用（白屏/崩溃率>5%） | ≤5min | 立即切 CDN 版本号 |
| P1 | 关键交易流程阻断（下单/回测失败） | ≤15min | 评估后回滚 |
| P2 | 性能严重退化（LCP>5s / INP>500ms） | ≤30min | 灰度降级 + 回滚 |
| P3 | 数据展示错误（非交易相关） | ≤2h | 热修复优先 |

---

## 三、前端静态资源回滚（CDN 版本号切换）

### 3.1 版本化部署策略

**构建产物结构**:
```
dist/
├── v2.0.0/           ← 当前版本
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].js
│   │   ├── vendor-[hash].js
│   │   └── index-[hash].css
│   └── ...
├── v1.9.0/           ← 保留的历史版本
│   └── ...
└── latest → v2.0.0/  ← 软链接/路由规则
```

### 3.2 回滚命令（NGINX 示例）

```nginx
# nginx.conf — 版本路由
server {
    listen 80;
    server_name finsight.example.com;

    location / {
        # 默认指向 latest
        alias /var/www/finsight/latest/;
        try_files $uri $uri/ /index.html;
    }

    # 保留历史版本路径（回滚用）
    location /v1.9.0/ {
        alias /var/www/finsight/v1.9.0/;
        try_files $uri $uri/ /index.html;
    }
}
```

**回滚操作**:
```bash
# 1. 修改软链接指向旧版本
sudo ln -sfn /var/www/finsight/v1.9.0 /var/www/finsight/latest

# 2. 或修改 NGINX 配置后 reload
sudo sed -i 's|alias .*;|alias /var/www/finsight/v1.9.0/;|' /etc/nginx/sites-available/finsight
sudo nginx -t && sudo systemctl reload nginx

# 3. 验证回滚
 curl -s https://finsight.example.com/ | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+'
# → v1.9.0
```

### 3.3 缓存失效

```bash
# Cloudflare CDN 缓存清除示例
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 或针对特定文件
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://finsight.example.com/index.html"]}'
```

---

## 四、IndexedDB 数据兼容性回滚

### 4.1 数据层版本控制

```typescript
// src/config/dbConfig.ts
export const DB_VERSION = 7  // 每次 schema 变更递增

// src/data/db.ts
export class V6Database {
  async init(): Promise<void> {
    this.db = await openDB('v9-research-db', DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // 版本迁移逻辑
        if (oldVersion < 7) { /* v6→v7 迁移 */ }
        if (oldVersion < 6) { /* v5→v6 迁移 */ }
        // ...
      }
    })
  }
}
```

### 4.2 回滚场景：新代码 + 旧数据库

**场景**: 用户已升级到 v2.0.0（DB_VERSION=7），回滚到 v1.9.0（DB_VERSION=6）。

**风险**: v1.9.0 代码期望 DB_VERSION=6，但浏览器中已经是 7。

**应对策略**:

```typescript
// src/data/db-connection.ts — 向后兼容检查
export async function openDB(...): Promise<IDBDatabase> {
  try {
    return await idbOpenDB(...)
  } catch (err) {
    if (err instanceof VersionError) {
      // 降级场景：新 DB_VERSION → 旧代码
      logger.warn('[DB] Version downgrade detected, attempting compatibility mode')
      // 策略：旧代码以只读方式打开高版本数据库
      return await idbOpenDB(DB_NAME, undefined, { upgrade: () => {} })
    }
    throw err
  }
}
```

**实际项目中的兼容策略**（已实施）:
1. **Schema 仅增不减**：新版本的 store 和索引是旧版本的超集
2. **字段默认值**：新字段在旧代码中未使用，不影响旧逻辑
3. **迁移脚本幂等**：同一版本升级可重复执行
4. **降级回滚时**：旧代码可读取新数据库（忽略不认识的新 store）

### 4.3 数据备份与恢复

```typescript
// src/services/system/backupService.ts — 数据导出/导入
export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const db = await getDbInstance()
  const result: Record<string, unknown[]> = {}
  for (const storeName of STORE_NAMES) {
    result[storeName] = await db.getAll(storeName)
  }
  return result
}

export async function importAllData(data: Record<string, unknown[]>): Promise<void> {
  const db = await getDbInstance()
  for (const storeName of STORE_NAMES) {
    const items = data[storeName] ?? []
    await db.clear(storeName)
    for (const item of items) {
      await db.put(storeName, item)
    }
  }
}
```

**手动备份命令**:
```javascript
// 浏览器 DevTools Console
const data = await exportAllData()
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `finsight-backup-${new Date().toISOString().slice(0,10)}.json`
a.click()
```

---

## 五、回滚演练检查清单

### 5.1 演练前准备

- [ ] 确认上一个稳定版本（v1.9.0）构建产物已归档
- [ ] 确认 CDN/NGINX 支持多版本路径
- [ ] 确认数据库迁移脚本可逆（或兼容降级）
- [ ] 确认监控告警已配置（错误率、白屏率、LCP）

### 5.2 演练步骤

| 步骤 | 操作 | 验证 | 耗时 |
|------|------|------|------|
| 1 | 模拟故障注入（如故意引入 JS 错误） | 监控告警触发 | 1min |
| 2 | 执行 CDN 版本切换（切到 v1.9.0） | curl 验证版本号 | 2min |
| 3 | 清除 CDN 缓存 | 缓存 API 返回 success | 1min |
| 4 | 验证用户端回滚成功 | 多浏览器验证 | 3min |
| 5 | 验证 IndexedDB 兼容 | 核心功能可用 | 2min |
| 6 | 记录 RTO（实际恢复时间） | 写入演练记录 | 1min |

### 5.3 演练结果记录

```yaml
演练日期: 2026-07-13
演练类型: 文档推演（非实际生产）
目标版本: v2.0.0 → v1.9.0

RTO 目标: ≤5min
RTO 实际: ~10min（预估，未实际执行）

降级兼容性: 
  - 前端静态资源: ✅ 版本号切换可行
  - IndexedDB: ⚠️ 需验证旧代码对新 schema 的兼容性
  - 建议: DB_VERSION 升级时确保旧代码只读模式可运行

发现的问题:
  1. 缺少自动化回滚脚本（需 DevOps 补充）
  2. 缺少 IndexedDB 降级测试用例
  3. 缺少 CDN 缓存预热流程文档

改进措施:
  1. 编写 nginx-version-switch.sh 自动化脚本
  2. 在 CI 中增加 DB 兼容性测试（旧代码 + 新数据库）
  3. 补充 CDN 缓存预热 SOP
```

---

## 六、自动化回滚脚本（草案）

```bash
#!/bin/bash
# scripts/rollback.sh — 前端回滚脚本

VERSION=$1
DEPLOY_DIR="/var/www/finsight"
NGINX_CONF="/etc/nginx/sites-available/finsight"

echo "[Rollback] Starting rollback to $VERSION..."

# 1. 验证版本目录存在
if [ ! -d "$DEPLOY_DIR/$VERSION" ]; then
    echo "[Rollback] ERROR: Version $VERSION not found in $DEPLOY_DIR"
    exit 1
fi

# 2. 备份当前状态
cp -L "$DEPLOY_DIR/latest" "$DEPLOY_DIR/latest.bak.$(date +%s)"

# 3. 切换版本
ln -sfn "$DEPLOY_DIR/$VERSION" "$DEPLOY_DIR/latest"

# 4. 验证 NGINX 配置
nginx -t || {
    echo "[Rollback] ERROR: NGINX config test failed, restoring backup"
    ln -sfn "$DEPLOY_DIR/latest.bak."* "$DEPLOY_DIR/latest"
    exit 1
}

# 5. 重载 NGINX
systemctl reload nginx

# 6. 清除 CDN 缓存（如配置了 Cloudflare）
if [ -n "$CF_ZONE_ID" ] && [ -n "$CF_TOKEN" ]; then
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"purge_everything":true}'
    echo "[Rollback] CDN cache purged"
fi

# 7. 验证
curl -s https://finsight.example.com/ | grep -o "v[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1
echo "[Rollback] Rollback to $VERSION completed"
```

---

## 七、RTO/RPO 目标

| 指标 | 目标 | 当前能力 | 差距 |
|------|------|---------|------|
| RTO（恢复时间目标） | ≤5min | ~10min（预估） | 需自动化脚本 |
| RPO（恢复点目标） | 0（无数据丢失） | 本地 IndexedDB 不丢失 | ✅ 满足 |
| 回滚影响用户比例 | 100%（全量回滚） | 100% | 需灰度开关 |
| 数据一致性 | 100% | 依赖 IndexedDB 迁移脚本 | ⚠️ 需测试降级兼容性 |

---

*本文档由 AI 辅助生成，经人工复核后纳入项目运维知识体系。*
