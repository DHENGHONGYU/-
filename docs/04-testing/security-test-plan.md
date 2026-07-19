---
title: security-test-plan
type: reference
domain: qa
phase: planning
tier: important
status: active
maintainer: V9 Architecture Team
summary: "V9 作为纯前端应用，XSS 是最大的安全风险。风险点分布："
tags: [qa, security, test, plan, testing]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-005
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 安全测试计划与 XSS 专项测试用例

> **Version**: v1.1.0 ｜ **创建日期**: 2026-07-15 ｜ **适用版本**: V9 v2.0.0+
> **D1 批次进度**: ? XSS 专项 E2E 测试 + CSP 验证 + 加密验证 + 错误信息检查
> **合规参考**: OWASP Top 10、《个人信息保护法》、《证券期货业网络和信息安全管理办法》

---

## 0. D1 批次安全合规补强成果

### 0.1 已完成清单

| 任务 | 产出 | 状态 |
| :--- | :--- | :--- |
| XSS 专项 E2E 测试 | `e2e/security-xss.spec.ts`，14 个用例 | ? 完成 |
| 数据加密验证 | AES-GCM 256 + PBKDF2 100k 迭代，API Key 加密存储 | ? 完成 |
| CSP 策略验证 | 生产构建注入 CSP meta，9 项策略 | ? 完成 |
| 错误信息脱敏 | 本地 logger，无敏感数据外泄 | ? 完成 |
| 依赖架构审计 | 3446 模块 / 9188 依赖 / 0 循环依赖 | ? 完成 |

### 0.2 安全现状基线

| 安全领域 | 现状 | 等级 |
| :--- | :--- | :--- |
| XSS 防护 | React 默认转义 + CSP + 0 处 dangerouslySetInnerHTML | ?? 良好 |
| 数据加密 | AES-GCM 256 + PBKDF2，API Key 加密存储 | ?? 良好 |
| CSP 策略 | 生产构建注入 meta 标签，9 项策略 | ?? 良好 |
| 依赖安全 | 架构审计通过，npm audit 国内镜像不可用 | ?? 中等 |
| 错误信息 | 本地 logger，无敏感泄露 | ?? 良好 |

---

---

## 1. 安全测试总览

### 1.1 测试范围

| 安全领域 | 测试范围 | 优先级 |
| :--- | :--- | :--- |
| **XSS 跨站脚本** | 存储型 XSS、反射型 XSS、DOM 型 XSS | P0 |
| **数据安全** | 加密存储、敏感数据保护、数据导出/删除 | P0 |
| **依赖安全** | npm 包漏洞、供应链安全 | P1 |
| **认证授权** | DataBridge ACL、MCP 权限 | P1 |
| **错误信息安全** | 错误信息脱敏、堆栈泄露 | P1 |
| **配置安全** | CSP、HTTPS、安全头 | P2 |
| **CSRF/重放** | API 请求伪造、重放攻击 | P2 |
| **业务逻辑安全** | 越权访问、数据篡改 | P2 |

### 1.2 测试方法

| 方法 | 工具 | 频率 |
| :--- | :--- | :--- |
| **静态代码扫描** | ESLint 安全规则、audit:hardcode | 每次提交 |
| **依赖漏洞扫描** | npm audit、Dependabot | 每周 |
| **单元测试安全** | Vitest 安全相关用例 | 每次提交 |
| **E2E 安全测试** | Playwright XSS 专项 | 每次发布前 |
| **渗透测试** | 手动 / OWASP ZAP | 每季度 |
| **代码审计** | 人工 Code Review | 关键模块 |

### 1.3 安全等级定义

| 等级 | 定义 | 修复时限 | 示例 |
| :--- | :--- | :--- | :--- |
| **严重 (Critical)** | 可直接获取用户数据/控制系统 | 24 小时 | XSS 窃取 API Key、数据加密被破解 |
| **高危 (High)** | 可造成严重信息泄露或越权 | 72 小时 | 依赖远程代码执行、越权访问敏感数据 |
| **中危 (Medium)** | 可造成有限信息泄露或误导 | 1 周 | 错误信息泄露路径、CSRF 可被利用 |
| **低危 (Low)** | 影响有限的安全问题 | 1 月 | 缺少安全头、轻微信息泄露 |
| **信息 (Info)** | 建议性质的安全改进 | 排期 | 最佳实践建议、安全配置优化 |

---

## 2. XSS 专项测试

### 2.1 XSS 风险点识别

V9 作为纯前端应用，XSS 是最大的安全风险。风险点分布：

| 风险点 | 类型 | 可能性 | 影响 | 风险等级 |
| :--- | :--- | :--- | :--- | :--- |
| 用户输入的股票名称/笔记 | 存储型 | 中 | 高 | 高危 |
| URL 参数渲染 | DOM 型 | 中 | 中 | 中危 |
| 第三方数据（新闻/资讯） | 存储型 | 低 | 高 | 中危 |
| 导入的 JSON/CSV 数据 | 存储型 | 中 | 中 | 中危 |
| 富文本/Markdown 渲染 | 存储型 | 低 | 高 | 中危 |
| localStorage 数据读取 | DOM 型 | 低 | 中 | 低危 |

### 2.2 XSS 防护架构

```
┌─────────────────────────────────────────────────┐
│              XSS 多层防护体系                     │
├─────────────────────────────────────────────────┤
│  第 1 层：React 自动转义（框架层）                │
│    - 默认所有 {variable} 自动 HTML 转义          │
│    - 禁止直接使用 dangerouslySetInnerHTML        │
├─────────────────────────────────────────────────┤
│  第 2 层：输入校验（应用层）                     │
│    - 所有用户输入做长度/格式/字符校验            │
│    - 股票代码、名称等字段严格限制字符集          │
├─────────────────────────────────────────────────┤
│  第 3 层：输出编码（展示层）                     │
│    - 动态生成的属性值进行属性编码                │
│    - URL 参数进行 URL 编码                      │
├─────────────────────────────────────────────────┤
│  第 4 层：CSP 策略（部署层）                     │
│    - Content-Security-Policy 限制脚本来源        │
│    - 禁止内联脚本、禁止 eval                     │
└─────────────────────────────────────────────────┘
```

### 2.3 XSS 测试用例清单

#### 2.3.1 存储型 XSS — 用户输入

| 编号 | 测试场景 | 测试步骤 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| XSS-001 | 股票名称注入 | 1. 添加股票，名称填入 `<script>alert(1)</script>`<br>2. 查看股票列表<br>3. 查看股票详情 | 名称被转义显示，不执行脚本 | P0 |
| XSS-002 | 笔记内容注入 | 1. 在交易复盘中写入 `<img src=x onerror=alert(1)>`<br>2. 保存并查看笔记 | 内容被转义，不触发 onerror | P0 |
| XSS-003 | 分组名称注入 | 1. 创建分组，名称为 `"><script>alert(1)</script>`<br>2. 查看分组列表和详情 | 名称被转义，不执行脚本 | P1 |
| XSS-004 | 标签注入 | 1. 给股票打标签，标签内容为 `<svg onload=alert(1)>`<br>2. 查看标签展示 | 标签被转义，不执行 | P1 |
| XSS-005 | 搜索关键词注入 | 1. 在搜索框输入 `"><img src=x onerror=alert(1)>`<br>2. 查看搜索结果页 | 搜索词被转义，不触发 | P1 |

#### 2.3.2 DOM 型 XSS — URL 参数

| 编号 | 测试场景 | 测试步骤 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| XSS-006 | URL 参数渲染 | 访问 `/path?param=<script>alert(1)</script>` | 参数被转义，不执行 | P0 |
| XSS-007 | URL Hash 注入 | 访问 `/path#<img src=x onerror=alert(1)>` | Hash 被安全处理 | P1 |
| XSS-008 | 路由参数注入 | 访问 `/analysis/stock-score/<script>alert(1)</script>` | 路由安全处理，404 或转义 | P1 |
| XSS-009 | 回跳参数注入 | 访问 `/login?redirect=javascript:alert(1)` | redirect 参数被校验，不执行 | P2 |

#### 2.3.3 第三方数据 XSS

| 编号 | 测试场景 | 测试步骤 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| XSS-010 | 新闻内容注入 | Mock 新闻 API 返回含 `<script>` 的内容 | 新闻展示被转义 | P1 |
| XSS-011 | 资讯标题注入 | Mock 资讯标题含恶意 HTML | 标题被转义 | P1 |
| XSS-012 | 数据导入注入 | 导入含 XSS payload 的 CSV/JSON 文件 | 导入数据被安全处理 | P1 |

#### 2.3.4 富文本/Markdown XSS

| 编号 | 测试场景 | 测试步骤 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| XSS-013 | Markdown 注入 | 在笔记中写入 `[click](javascript:alert(1))` | 链接被安全处理 | P1 |
| XSS-014 | HTML 标签注入 | 在支持 HTML 的内容中写入 `<iframe src=...>` | 危险标签被过滤 | P2 |
| XSS-015 | 事件处理器注入 | 写入 `<div onmouseover=alert(1)>` | 事件属性被过滤 | P2 |

#### 2.3.5 高级 XSS 绕过

| 编号 | 测试场景 | Payload | 优先级 |
| :--- | :--- | :--- | :--- |
| XSS-016 | 编码绕过 | `%3Cscript%3Ealert(1)%3C/script%3E` | P2 |
| XSS-017 | Unicode 绕过 | `\u003cscript\u003e` | P2 |
| XSS-018 | 大小写绕过 | `<ScRiPt>alert(1)</ScRiPt>` | P2 |
| XSS-019 | 事件处理器 | `<img src=x onerror=alert(1)>` | P1 |
| XSS-020 | SVG 注入 | `<svg onload=alert(1)>` | P2 |
| XSS-021 | CSS 注入 | `<style>body{background:url(javascript:alert(1))}</style>` | P2 |

### 2.4 XSS 自动化测试

#### Playwright E2E XSS 测试模板

```typescript
// e2e/security/xss.spec.ts
import { test, expect } from '@playwright/test'

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  '"><script>alert("xss")</script>',
  '<svg onload=alert("xss")>',
  '<div onmouseover=alert("xss")>',
  '[click](javascript:alert("xss"))',
]

test.describe('XSS 安全测试', () => {
  for (const payload of XSS_PAYLOADS) {
    test(`股票名称 XSS 防护: ${payload.substring(0, 30)}`, async ({ page }) => {
      await page.goto('/input')
      // 输入恶意 payload
      await page.getByPlaceholder('股票名称/代码').fill(payload)
      await page.getByRole('button', { name: '添加' }).click()
      // 验证不弹 alert
      page.on('dialog', dialog => {
        throw new Error(`XSS 漏洞发现: ${dialog.message()}`)
      })
      // 验证页面不崩溃
      await expect(page.getByRole('heading', { name: /输入舱/ })).toBeVisible()
    })
  }
})
```

### 2.5 CSP 安全策略（已实现）

V9 在生产构建时通过 `vite.config.ts` 的 `inject-csp-meta` 插件自动注入 CSP meta 标签：

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https:;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

**实现说明**：
- 仅 `build` 阶段注入，避免破坏 dev 的 HMR/WebSocket
- `script-src 'self'` 禁用 unsafe-inline，原内联脚本已外置为 `public/theme-boot.js`
- `style-src` 保留 `'unsafe-inline'` 是 React 动态行内样式的刚需
- `connect-src` 当前放行 `'self' https:`，上线前应收紧为精确行情域名白名单
- `object-src 'none'` + `frame-ancestors 'none'` 减少攻击面

**验证位置**：
- 配置：[vite.config.ts](file:///g:/FinSightV9/vite.config.ts#L8-L40)
- 测试：`e2e/security-xss.spec.ts` → CSP 策略验证

---

## 3. 其他安全测试

### 3.1 数据安全测试

| 编号 | 测试项 | 测试方法 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-001 | API Key 加密存储 | 检查 localStorage 中 API Key 是否为密文 | 为加密态，非明文 | P0 |
| SEC-002 | 数据导出完整性 | 导出全部数据，验证数据完整 | 数据完整，格式正确 | P1 |
| SEC-003 | 数据删除彻底性 | 删除数据后检查 IndexedDB / localStorage | 数据完全清除 | P1 |
| SEC-004 | 加密数据篡改 | 手动篡改加密数据后解密 | 解密失败或报错 | P1 |
| SEC-005 | 跨 Tab 数据隔离 | 多 Tab 打开，验证数据不串 | 各 Tab 数据独立 | P2 |
| SEC-006 | 浏览器退出后数据 | 关闭浏览器后重新打开 | 数据持久化正常 | P2 |

### 3.2 依赖安全测试

| 编号 | 测试项 | 工具/方法 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-010 | npm audit 扫描 | `npm audit` | 0 个高危/严重漏洞 | P1 |
| SEC-011 | 依赖许可证审计 | license-checker | 无传染性许可证问题 | P2 |
| SEC-012 | Lockfile 完整性 | lockfile-lint | 包完整性未被篡改 | P2 |
| SEC-013 | 最小依赖原则 | 定期审计依赖必要性 | 无未使用的依赖 | P2 |
| SEC-014 | 构建产物安全 | 检查 production bundle | 无敏感信息泄露 | P1 |

### 3.3 认证授权测试

| 编号 | 测试项 | 测试方法 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-020 | DataBridge ACL | 越权写入测试 | 越权操作被拒绝 | P1 |
| SEC-021 | MCP Server 权限 | 未授权 Server 访问敏感数据 | 访问被拒绝 | P1 |
| SEC-022 | 配置修改权限 | 普通用户修改系统配置 | 需要确认或拒绝 | P2 |
| SEC-023 | 数据导出权限 | 导出全部数据是否需要二次确认 | 有二次确认 | P2 |

### 3.4 错误信息安全测试

| 编号 | 测试项 | 测试方法 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-030 | 错误信息脱敏 | 主动触发错误，检查错误信息 | 不泄露堆栈/路径/密钥 | P1 |
| SEC-031 | SourceMap 安全 | 生产环境检查 SourceMap | 生产关闭 SourceMap | P0 |
| SEC-032 | 控制台信息 | 检查生产环境 console 输出 | 无敏感信息打印 | P1 |
| SEC-033 | 404 页面信息 | 访问不存在的路径 | 404 页不泄露技术栈 | P2 |

### 3.5 配置安全测试

| 编号 | 测试项 | 测试方法 | 预期结果 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-040 | HTTPS 强制 | 部署环境验证 | 强制 HTTPS，HTTP 自动跳转 | P1 |
| SEC-041 | CSP 安全头 | 检查响应头 | CSP 策略正确配置 | P1 |
| SEC-042 | X-Frame-Options | 检查响应头 | 禁止或限制 iframe 嵌入 | P2 |
| SEC-043 | HSTS | 检查响应头 | 启用 HSTS | P2 |
| SEC-044 | Cookie 安全 | 检查 Cookie 属性 | Secure + HttpOnly + SameSite | P2 |

---

## 4. 安全测试执行计划

### 4.1 执行频率

| 测试类型 | 频率 | 负责人 | 输出 |
| :--- | :--- | :--- | :--- |
| 静态代码扫描 | 每次提交 | CI 自动 | 扫描报告 |
| 依赖漏洞扫描 | 每周 | CI 自动 | npm audit 报告 |
| XSS 单元测试 | 每次提交 | CI 自动 | 测试结果 |
| XSS E2E 测试 | 每次发布前 | QA / 自动化 | 测试报告 |
| 渗透测试 | 每季度 | 安全团队 | 渗透测试报告 |
| 全面安全审计 | 每年 | 第三方 | 安全审计报告 |

### 4.2 发布前安全检查清单

发布前必须确认以下所有 P0/P1 项：

- [ ] npm audit 0 个高危漏洞
- [ ] 生产构建关闭 SourceMap
- [ ] API Key / 敏感数据加密存储
- [ ] XSS 关键用例全部通过
- [ ] DataBridge ACL 权限验证通过
- [ ] 错误信息不泄露堆栈/路径
- [ ] CSP 安全头配置正确
- [ ] HTTPS 强制启用
- [ ] 依赖中无未使用的包
- [ ] 代码中无硬编码密钥

---

## 5. 安全缺陷修复流程

```
发现安全漏洞 → 评估等级 → 
  Critical/High: 紧急修复 + 安全公告 + 热更新
  Medium: 本迭代修复
  Low: 排期修复
→ 验证修复 → 发布安全更新 → 记录归档
```

### 5.1 漏洞严重等级判定

| 维度 | 严重 (3) | 高危 (2) | 中危 (1) | 低危 (0) |
| :--- | :--- | :--- | :--- | :--- |
| **利用难度** | 极易 | 容易 | 中等 | 困难 |
| **影响范围** | 全部用户 | 大量用户 | 部分用户 | 个别用户 |
| **数据影响** | 数据泄露/篡改 | 信息泄露 | 有限泄露 | 无直接影响 |
| **业务影响** | 系统不可用 | 功能受损 | 体验下降 | 几乎无影响 |

**最终等级** = 利用难度 × 影响范围 × 数据影响 × 业务影响（加权计算）

---

## 6. 安全测试工具链

| 工具 | 用途 | 配置状态 |
| :--- | :--- | :--- |
| **ESLint security rules** | 静态安全扫描 | 待配置 |
| **npm audit** | 依赖漏洞扫描 | 待定期执行 |
| **Playwright** | XSS E2E 测试 | 可扩展 |
| **audit:hardcode** | 硬编码密钥扫描 | ? 已配置 |
| **OWASP ZAP** | 主动扫描 / 渗透测试 | 待接入 |
| **Snyk / Dependabot** | 依赖漏洞持续监控 | 待接入 |

---

## 7. 附录：XSS Payload 速查

### 基础 Payload
```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
```

### 绕过 Payload
```html
<ScRiPt>alert(1)</ScRiPt>
<img src=x onerror=alert&#40;1&#41;>
<iframe src="javascript:alert(1)">
<a href="javascript:alert(1)">click</a>
```

### DOM XSS Payload
```
#<script>alert(1)</script>
?param=<img src=x onerror=alert(1)>
```

### Unicode/编码绕过
```
\u003cscript\u003ealert(1)\u003c/script\u003e
%3Cscript%3Ealert(1)%3C/script%3E
&#60;script&#62;alert(1)&#60;/script&#62;
```

---

*本安全测试计划为初始版本，随安全测试实践持续更新。发现安全漏洞请按安全缺陷修复流程处理。*
