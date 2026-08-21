---
doc_id: V9-DOC-DEV-008
title: "PathTrace 模块 GitHub Actions 部署与版本门控指南"
domain: project
status: active
last_updated: 2026-08-15
---

# PathTrace 模块 GitHub Actions 部署与版本门控指南

> **工作流文件**: `.github/workflows/pathtrace-ci.yml`
> **应用范围**: `scripts/PathTrace.ps*`, `deploy-pathtrace-module.ps1`, `test-pathtrace-global.ps1`
> **版本**: v1.0.0
> **最后更新**: 2026-08-09

---

## 1. 流水线总览

```
push tag v1.2.0 (或 workflow_dispatch create_release=true)
              │
              ▼
  ┌──────────────────────────────┐
  │  Job: validate (ubuntu/pwsh) │   ← 快速门禁，10 分钟超时
  │  ① 文件完整性检查             │
  │  ② PowerShell 语法 AST 解析  │
  │  ③ PSD1 清单结构校验         │
  │    ↳ ModuleVersion ≥ 1.0.0   │   ← 硬门控：低版本阻断
  │    ↳ 7 个核心函数声明完整    │
  │  ④ psm1/psd1 导出交叉校验    │
  └──────────────────────────────┘
              │  ✅ exit 0
              ▼
  ┌───────────────────────────────────────┐
  │  Job: test (3 × matrix, fail-fast:false) │ ← 20 分钟超时 / 每个
  │  ┌───────────────────────────────────┐ │
  │  │ A: windows-latest / PS 5.1        │ │  ← 项目主流环境完整 16 项测试
  │  │   - test-pathtrace-global.ps1    │ │
  │  │   - deploy → verify → uninstall  │ │
  │  ├───────────────────────────────────┤ │
  │  │ B: windows-latest / pwsh 7       │ │  ← 交叉 PS 版本完整 16 项测试
  │  │   - 同上                         │ │
  │  ├───────────────────────────────────┤ │
  │  │ C: ubuntu-latest / pwsh 7        │ │  ← 跨平台烟测（纯逻辑无 IO）
  │  │   - 5 函数可用 / 空数组 / 空串  │ │
  │  └───────────────────────────────────┘ │
  └───────────────────────────────────────┘
              │  ✅ 所有 3 组合格
              ▼
  ┌────────────────────────────────────┐
  │  Job: release (ubuntu)             │
  │  ① 版本判定：tag → dispatch → psd1 │
  │  ② 打包 zip: PathTrace-vX.Y.Z.zip │
  │  ③ Release Notes 由 README 提取    │
  │  ④ softprops/action-gh-release 上传 │
  │  产出: GitHub Release + zip 资产   │
  └────────────────────────────────────┘
```

---

## 2. ModuleVersion ≥ 1.0.0 版本门控机制

### 2.1 为什么要做版本门控？

| 场景 | 未加门控的后果 | 加门控后的结果 |
|------|--------------|--------------|
| 开发者误将 `ModuleVersion = 0.0.1` 提交 main | tag v1.2.0 发布，用户下载的 zip 实际 ModuleVersion 为 0.0.1，`Get-Module` 显示 0.0.1，版本混乱 → 用户混淆 + 升级路径不可追踪 | validate 在 PSD1 校验步骤 `exit 1`，Release 不会被创建，tag 仍留在原处但无损坏资产 |
| 第一次发布时漏改版本号（还是 0.0） | Release Notes 显示 "v1.0.0" 但 manifest 实际 0.0.0，出现双重真理源 | 阻断提示 `ModuleVersion 0.0 is < 1.0.0` |
| 新建分支 cherry-pick 时带了旧版 psd1 | 与之前的 Release 发生版本号倒挂回退 | 阻断提示 `ModuleVersion 0.9.0 is < 1.0.0` |

### 2.2 门控代码位置与实现

**文件**: [pathtrace-ci.yml#L104-L128](file:///D:/FinSightV9/.github/workflows/pathtrace-ci.yml#L104-L128)

核心原理（3 层保护）：

```
层次 1: 显式版本比较
  [version]$manifest.Version -lt [version]'1.0.0'
  —— 使用 PowerShell [version] 类型比较，避免字符串比较陷阱

层次 2: 红色错误消息 + 具体版本号
  Write-Error "ModuleVersion $($manifest.Version) is < 1.0.0"
  —— GitHub Actions UI 中以红色标红，实际版本号一目了然

层次 3: exit 1 中断流水线 + needs 依赖
  exit 1 → validate job FAIL → test/release 自动 SKIP
  —— 不需要额外条件，needs: validate 语义原生保证
```

### 2.3 门控触发时的用户视角

| 用户操作 | GitHub 上看到的内容 |
|---------|-------------------|
| Push commit 含 `ModuleVersion = '0.9.0'` | ❌ All checks failed (1/1) |
| 点进 validate job 的 Step 3 | 红色错误：`ModuleVersion 0.9.0 is < 1.0.0` + exit code 1 |
| test/release 行状态 | ⏭️ SKIPPED（灰字，无日志） |
| push `v1.2.0` tag 触发 Release | ❌ Release **不会**被创建，不会产生新资产 |
| Repository → Releases 页面 | 不变，旧版本资产完好无损 |

### 2.4 门控绕过方式（仅紧急场景）

1. **推荐方式**：修 PSD1 `ModuleVersion = '1.0.0'` 或更高，重新提交。
2. **临时绕过（不推荐）**：注释工作流 YAML 第 125-127 行（if 块），推送新 commit → 通过 → 立即恢复代码 → 追加一次 commit 补上版本号。

### 2.5 本地预验证（推荐在 push tag 前跑）

```powershell
# 1. 直接跑语法检查（同 Job validate）
$manifest = Test-ModuleManifest -Path scripts/PathTrace.psd1
if ([version]$manifest.Version -lt [version]'1.0.0') {
    Write-Error "PRE-CHECK FAIL: ModuleVersion $($manifest.Version) < 1.0.0, fix before push tag!"
    exit 1
}

# 2. 快速跑完整测试套件
.\scripts\test-pathtrace-global.ps1
```

---

## 3. 超时与失败传播机制

### 3.1 validate Job 超时或失败时的下游行为

GitHub Actions 对 `needs:` 语义的默认行为：**需要的 job 全部成功，下游 job 才会运行**。pathtrace-ci.yml 中：

```yaml
test:
  name: Test ...
  needs: validate    # validate 不通过 → 此处自动 SKIPPED

release:
  name: Release ...
  needs: [validate, test]   # 两个都必须成功 → 否则自动 SKIPPED
  if: startsWith(github.ref, 'refs/tags/v') || ...
```

### 3.2 超时场景模拟

| 失败原因 | validate Job 状态 |  Actions UI 显示 | test Job 状态 | release Job 状态 |
|---------|-------------------|----------------|--------------|-----------------|
| **ModuleVersion 0.9.0 门控** | ❌ FAIL (exit 1) | 红色错误: `ModuleVersion 0.9.0 is < 1.0.0` | ⏭️ SKIPPED | ⏭️ SKIPPED |
| **语法检查失败** | ❌ FAIL (exit 1) | 红色错误: `Syntax check FAILED: ...` | ⏭️ SKIPPED | ⏭️ SKIPPED |
| **validate 超 10 分钟** | ❌ FAIL (timeout) | 红色错误: `The job running on runner ... has exceeded the maximum execution time of 10 minutes` | ⏭️ SKIPPED | ⏭️ SKIPPED |
| **runner 网络超时 (checkout)** | ❌ FAIL (runner offline) | 红色错误: `Unable to reach actions runner` | ⏭️ SKIPPED | ⏭️ SKIPPED |
| **actions/checkout SHA 错误** | ❌ FAIL (step failed) | 红色错误: `Cannot find action ... sha1234` | ⏭️ SKIPPED | ⏭️ SKIPPED |
| ✅ validate 正常通过 | ✅ PASS | 绿色 | ✅ 正常开始 | (成功后进入) ✅ 正常开始 |

### 3.3 超时提示的清晰度

GitHub Actions 对超时会输出**原生的、明确的**红色横幅消息，格式为：

```
The job running on runner GitHub Actions 4 has exceeded the maximum
execution time of 10 minutes.
```

在 validate job 的 `timeout-minutes: 10` 前提下，任何原因的 10 分钟未完成（挂起、网络慢、步骤卡住）都会触发此消息，同时下游 test/release **因 needs 不满足自动灰掉 SKIPPED**，不会静默运行，也不会"以为已经验证过"。

### 3.4 超时排查建议

| 超时阶段 | 大概率原因 | 排查方式 |
|---------|-----------|---------|
| checkout step | runner 网络慢 / 仓库过大 | 重试一次；启用 actions cache |
| Setup PowerShell step | pwsh 7 下载慢 | 复用 runner 缓存；或切到已带 pwsh 的镜像 |
| Syntax 检查 step | 目标文件异常大导致 AST 解析卡住 | 本地跑同样命令测耗时；必要时加超时上限（单步内 `Stopwatch`） |
| PSD1 Manifest 检查 | 依赖网络（例：Test-ModuleManifest 检查签名签名 CA） | 离线 runner 可能触发；本地先测 |

---

## 4. 触发方式速查

```powershell
# 方式 1: 直接 push main/develop 分支（自动触发 validate + test）
git add .
git commit -m "fix(pathtrace): bump ModuleVersion to 1.1.0"
git push origin develop
# → 只跑 validate + test，Release 不会被创建

# 方式 2: 推送 vX.Y.Z tag 触发完整发布流程
#   注意顺序：先 commit + push 工作流文件，再 push tag（避免 tag 指向旧版本 yml）
git commit -m "chore(release): PathTrace v1.2.0"
git push origin develop
git tag v1.2.0
git push origin v1.2.0        # ← 这里才会触发 Release

# 方式 3: GitHub Web UI → Actions → PathTrace Module CI/CD → Run workflow
#   参数:
#     version: 1.2.0              # 覆盖版本号（可选）
#     create_release: ☑ true      # 强制创建 Release 即使没 tag
```

---

## 5. Release 产物结构

```
PathTrace-v1.2.0.zip
├── PathTrace.psm1                     ← 核心模块 (7 函数)
├── PathTrace.psd1                     ← 清单 (ModuleVersion=1.2.0)
├── README.md                          ← 项目 README 归档副本
├── PathTrace-Usage.md                 ← 详细使用文档
├── deploy-pathtrace-module.ps1        ← 一键部署脚本
├── test-pathtrace-global.ps1          ← 16 项自动化测试
└── VERSION                            ← 构建时间戳（例: PathTrace v1.2.0 - built 2026-08-09T...）
```

---

## 6. 失败回滚 SOP

| 场景 | SOP |
|------|-----|
| **ModuleVersion 写错，被 validate 阻断** | 改 `scripts/PathTrace.psd1` 中的 `ModuleVersion` → 本地验证 `Test-ModuleManifest` → commit 重新推送 |
| **tag 打错了（v1.0.0 应为 v1.1.0），但 Release 未创建** | 本地删 tag: `git tag -d v1.0.0`，远端删 tag: `git push origin :refs/tags/v1.0.0` → 打正确 tag → 重新 push tag |
| **Release 已创建但发现包有问题** | Repository → Releases → 点错误版本 → Delete（或 Edit → 标记 prerelease/draft）→ 打补丁 tag vX.Y.Z+1 重发 |
| **release job 上传资产失败** | Release 处于 draft 状态或只有半份资产 → 手动运行 workflow（dispatch, create_release=true，version=X.Y.Z）→ 覆盖上传；或 Edit Release → upload 手工拖 zip |
| **validate 因为外部依赖超时（Setup PowerShell 下载）** | 10 分钟后自动超时失败 → 到 Actions 页面 → Re-run failed jobs 或 Re-run all jobs（Runner 网络偶发问题通常第二次 OK） |

---

## 7. 流水线健康仪表盘

| 指标 | 阈值 | 当前值 |
|------|------|--------|
| validate 平均耗时 | ≤ 3 min | TBD (首次发布后补) |
| test 平均耗时 | ≤ 10 min / matrix | TBD |
| release 平均耗时 | ≤ 5 min | TBD |
| ModuleVersion < 1.0.0 被阻断次数 | — | TBD (次数越多代表门控越有效但开发提交流程需优化) |
| 超时失败率 | ≤ 5% / 月 | TBD |
