---
title: "GitHub 连接问题网络排查报告"
domain: project
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v1.1.0
change_log:
  - version: v1.1.0
    changes: "精简：删除诊断细节表/配置快照/执行清单，保留故障模式+根因+解决方案"
    date: 2026-08-23
---

# GitHub 连接问题网络排查报告

> **报告编号**: NET-2026-0809-001 | **排查时间**: 2026-08-09 | **环境**: Windows 11 / PowerShell 5

## 故障模式

| 操作类型 | 结果 |
|---------|------|
| 小流量 HTTP GET（`Invoke-WebRequest https://github.com`） | ✅ 200 OK |
| 大流量 git HTTP POST（push/fetch） | ❌ `Recv failure: Connection was reset` |
| DNS 解析 / TCP 握手 / TLS 握手 | ✅ 正常 |

**特征**：TLS 握手完成后**数据传输阶段**被 RST，典型 DPI/防火墙拦截大流量上传。

## 根因判定

| 优先级 | 根因 | 说明 |
|--------|------|------|
| **P0** | TCP 大流量上传被 DPI/运营商重置 | 小 GET 正常但大 POST 被 RST；ghproxy.com 等国内镜像完全不可达 |
| P1 | Tracking Ref 污染 | 首次 push 失败后 `refs/remotes/origin/main` 未更新，后续 push 误判 `Everything up-to-date` |
| P2 | Pre-push Hook 兼容 | `.husky/pre-push` 在后台 PowerShell Job 中 STDOUT 管道问题 |

## 解决方案（按优先级）

### A. 配置本地代理（根治）

```powershell
# SOCKS5 代理（推荐，DNS 走代理）
git config --global http.proxy  socks5h://127.0.0.1:7890
git config --global https.proxy socks5h://127.0.0.1:7890

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### B. 拆分推送为多次小批

```powershell
git push origin <commit>:refs/heads/main --no-verify --progress
Start-Sleep -Seconds 30
git push origin <tag> --no-verify --progress
```

### C. 切换 SSH 协议（避免 HTTPS DPI）

```powershell
ssh-keygen -t ed25519 -C "your-email@example.com"
# 将公钥添加到 GitHub → Settings → SSH and GPG keys
git remote set-url origin git@github.com:DHENGHONGYU/-.git
```

### D. 本地导出 bundle（兜底）

```powershell
git bundle create D:\FinSightV9.bundle main <tag>
# 通过网盘/USB/IM 传输
```
