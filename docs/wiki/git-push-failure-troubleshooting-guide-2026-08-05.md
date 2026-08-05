# Git Push 失败排查指南

> **版本**: v1.0 | **日期**: 2026-08-05
> **适用范围**: V9 智能投研复盘系统全体开发者
> **关联事件**: 2026-08-05 commit `64754be9` push 失败排查实战

---

## 一、本次故障复盘

### 1.1 故障时间线

| 时间（北京时间） | 事件 | 错误信息 |
|----------------|------|---------|
| 22:15 | commit `64754be9` 提交成功 | pre-commit 钩子 17 步全通过 |
| 22:16 | 第一次 push | `Connection was reset` |
| 22:17 | 第二次 push（重试） | `Connection was reset` |
| 22:39 | 第三次 push（用户称网络恢复） | `Failed to connect to github.com:443 after 21053 ms` |
| 22:40 | 网络诊断 | `Test-NetConnection github.com:443` → `False` |

### 1.2 根因分析

**根因**：github.com:443 在当前网络环境下 TCP 连接被阻断（非 git 配置问题、非钩子问题）。

**诊断证据**：
1. `git config --get http.proxy` → 空（未配置代理）
2. `git config --get https.proxy` → 空（未配置代理）
3. `Test-NetConnection github.com -Port 443` → `False`（TCP 连接失败）
4. 错误从 `Connection was reset`（连接建立后被重置）演变为 `Failed to connect`（连接建立阶段就失败），说明封锁程度加深

**结论**：需要配置 HTTP/HTTPS 代理才能访问 GitHub。

---

## 二、常见网络错误分类

### 2.1 连接类错误

| 错误信息 | 含义 | 根因 | 严重度 |
|---------|------|------|--------|
| `Failed to connect to github.com:443 after XXXXms` | 连接超时 | 网络不通/防火墙封锁 443 端口 | 🔴 阻塞 |
| `Connection was reset` | 连接建立后被重置 | GFW 干扰/代理不稳定 | 🟡 可重试 |
| `Could not resolve host: github.com` | DNS 解析失败 | DNS 污染/DNS 服务器故障 | 🔴 阻塞 |
| `SSL certificate problem` | SSL 证书问题 | 系统时间错误/证书过期 | 🟡 可修复 |
| `RPC failed; HTTP 503` | 服务端临时不可用 | GitHub 服务波动 | 🟡 可重试 |

### 2.2 认证类错误

| 错误信息 | 含义 | 根因 |
|---------|------|------|
| `Authentication failed` | 认证失败 | 密码/Token 过期或错误 |
| `Support for password authentication was removed` | 密码登录已废弃 | GitHub 2021 起要求使用 Personal Access Token |
| `Permission denied (publickey)` | SSH 密钥认证失败 | 未配置 SSH key 或 key 未添加到 GitHub |

### 2.3 钩子类错误

| 错误信息 | 含义 | 根因 |
|---------|------|------|
| `remote: error: pre-push hook failed` | 远程 pre-push 钩子拒绝 | 服务端钩子校验失败 |
| `To github.com:... ! [remote rejected]` | 远程拒绝推送 | 分支保护规则/钩子校验 |

---

## 三、排查流程

### 3.1 排查决策树

```
git push 失败
├── 错误信息包含 "connect" / "reset" / "resolve"?
│   ├── 是 → 网络问题（§3.2）
│   │   ├── 测试连通性: Test-NetConnection github.com -Port 443
│   │   ├── True → 检查代理配置（§3.3）
│   │   └── False → 配置代理或使用 VPN（§4.1）
│   └── 否 → 继续判断
├── 错误信息包含 "Authentication" / "Permission"?
│   ├── 是 → 认证问题（§3.4）
│   └── 否 → 继续判断
├── 错误信息包含 "rejected" / "hook"?
│   ├── 是 → 钩子/保护规则问题（§3.5）
│   └── 否 → 查看完整错误日志
```

### 3.2 网络连通性诊断

```powershell
# 1. 测试 GitHub 443 端口连通性
Test-NetConnection github.com -Port 443 -InformationLevel Quiet

# 2. 测试 DNS 解析
Resolve-DnsName github.com

# 3. 查看完整连接路径
Test-NetConnection github.com -Port 443 -InformationLevel Detailed

# 4. 检查当前代理配置
git config --get http.proxy
git config --get https.proxy

# 5. 检查环境变量代理
$env:HTTP_PROXY
$env:HTTPS_PROXY
```

### 3.3 代理配置检查

```powershell
# 查看 git 全局代理配置
git config --global --get http.proxy
git config --global --get https.proxy

# 查看系统代理设置
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyEnable, ProxyServer

# 查看 git 完整配置
git config --list | Select-String "proxy"
```

### 3.4 认证问题诊断

```powershell
# 检查远程仓库 URL（确认使用 HTTPS 还是 SSH）
git remote -v

# 检查凭据缓存
git config --get credential.helper

# 检查 SSH key
ssh -T git@github.com

# 检查 Personal Access Token 配置（Windows 凭据管理器）
cmdkey /list | Select-String "github"
```

### 3.5 钩子问题诊断

```bash
# 查看 pre-push 钩子内容
cat .husky/pre-push

# 手动运行 pre-push 钩子测试
sh .husky/pre-push

# 检查远程分支保护规则（需要 GitHub CLI）
gh api repos/:owner/:repo/branches/:branch/protection
```

---

## 四、重试策略

### 4.1 网络问题重试策略

**策略 A：配置 HTTP 代理**（推荐）

```powershell
# 设置 git 代理（替换为实际代理地址和端口）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 验证配置
git config --get http.proxy
git config --get https.proxy

# 重试推送
git push origin fix/autorecover-test-comment

# 用完后取消代理（如不需要）
git config --global --unset http.proxy
git config --global --unset https.proxy
```

**策略 B：使用 SSH 协议**

```powershell
# 切换远程 URL 为 SSH
git remote set-url origin git@github.com:DHENGHONGYU/-.git

# 确保 SSH key 已配置
ssh -T git@github.com

# 重试推送
git push origin fix/autorecover-test-comment
```

**策略 C：指数退避重试**（适用于临时网络波动）

```powershell
# 第 1 次重试：等待 10 秒
Start-Sleep -Seconds 10
git push origin fix/autorecover-test-comment

# 第 2 次重试：等待 30 秒
Start-Sleep -Seconds 30
git push origin fix/autorecover-test-comment

# 第 3 次重试：等待 60 秒
Start-Sleep -Seconds 60
git push origin fix/autorecover-test-comment

# 超过 3 次仍失败 → 切换到策略 A 或 B
```

### 4.2 认证问题重试策略

```powershell
# 更新 Personal Access Token
# 1. 访问 https://github.com/settings/tokens 生成新 Token
# 2. 更新 Windows 凭据管理器
cmdkey /delete:git:https://github.com
# 3. 下次 push 时输入用户名和新 Token

# 或使用 GitHub CLI 认证
gh auth login
```

### 4.3 钩子问题重试策略

```powershell
# 如果远程拒绝推送（分支保护/钩子）
# 1. 检查推送的分支是否受保护
git branch -vv

# 2. 如果推送到 main/master 被拒，创建 PR 分支
git checkout -b feature/your-branch
git push origin feature/your-branch

# 3. 紧急情况旁路本地 pre-push 钩子（不推荐）
git push --no-verify origin fix/autorecover-test-comment
```

---

## 五、预防措施

### 5.1 网络环境配置清单

| 检查项 | 命令 | 期望 |
|--------|------|------|
| GitHub 连通性 | `Test-NetConnection github.com -Port 443` | `True` |
| 代理配置 | `git config --get http.proxy` | 已配置或网络直连 |
| DNS 解析 | `Resolve-DnsName github.com` | 正常解析 |
| SSH 连接 | `ssh -T git@github.com` | `Hi <user>! You've been authenticated.` |

### 5.2 提交前预检

```powershell
# 提交前先测试网络连通性（5 秒快速检测）
Test-NetConnection github.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($?) {
    Write-Host "✅ GitHub 连通性正常，可以 push"
} else {
    Write-Host "❌ GitHub 不可达，请配置代理后再 push"
    Write-Host "   修复: git config --global http.proxy http://127.0.0.1:7890"
}
```

### 5.3 工作流可重入性

根据 project_memory 约束「提交工作流必须可重入和幂等以处理环境不稳定性」：

1. **commit 已保存**：`git commit` 成功后，提交内容在本地，push 失败不会丢失
2. **push 可重试**：网络恢复后执行 `git push origin <branch>` 即可，无需重新 commit
3. **幂等性**：多次 push 同一 commit 不会产生重复提交（Git 已处理）

---

## 六、本次故障待办

| # | 待办 | 状态 | 说明 |
|---|------|------|------|
| 1 | 配置 git 代理 | ⏳ 待用户操作 | 需用户提供代理地址（如 `http://127.0.0.1:7890`） |
| 2 | 重新 push | ⏳ 待办 | 代理配置后执行 `git push origin fix/autorecover-test-comment` |
| 3 | 验证推送结果 | ⏳ 待办 | `git log origin/fix/autorecover-test-comment -1` 确认远程已更新 |

---

## 七、关联资源

| 资源 | 路径 |
|------|------|
| 本次提交 | commit `64754be9`（本地） |
| 分支 | `fix/autorecover-test-comment`（领先 origin 3 个提交） |
| 远程仓库 | `https://github.com/DHENGHONGYU/-.git` |
| .gitignore 治理 Wiki | [docs/wiki/gitignore-governance-wiki-2026-08-05.md](gitignore-governance-wiki-2026-08-05.md) |
| 变更对比报告 | [docs/reports/gitignore-governance-diff-report-2026-08-05.md](../reports/gitignore-governance-diff-report-2026-08-05.md) |
