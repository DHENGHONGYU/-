---
title: S06 · 版本发布与部署 SOP
type: sop
domain: release-deploy
phase: deployment
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "按 semver 2.0 规范版本号（含 RC/HOTFIX 豁免）→ 文件单向同步（package.json → CHANGELOG → Git Tag，禁止反向）→ 构建产物三校验（清单+哈希+Entry）→ 灰度/正式/回滚三段部署命令。附部署后 30 分钟监控清单与双回滚预案。"
tags: [sop, release, deployment, semver, rollback, tagging]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-006
related_docs:
  - V9-DOC-REP-051   # DEPLOYMENT-CHECKLIST-2026-08-14.md
  - V9-DOC-SOP-005   # 上线前全面体检（前置依赖）
  - V9-DOC-QA-065    # 质量门禁标准
referenced_by: [V9-DOC-SOP-007]
change_log:
  - version: v1.0.0
    changes: "Initial version：固化 semver 单向同步规则，构建产物三校验、灰度/正式/回滚三段命令、双回滚预案、部署后 30 分钟监控清单。"
    date: 2026-08-19
---

# S06 · 版本发布与部署 SOP

> **编号**：S06 · **适用场景**：[S05 上线前全面体检](./S05-pre-launch-checklist.md) 结论为 GO / CONDITIONAL-GO 时，执行版本号打标、构建、部署与上线操作。  
> **执行角色**：发布经理 / DevOps / 架构师（双人签字模式） · **预计耗时**：20–40 分钟（含灰度观察 15 分钟）  
> **规范等级**：🟥 强制执行。**所有版本发布操作必须具备「可回滚」双预案**（见 §二 2.D）。禁止"孤注一掷"式部署。

---

## 参考文档

| # | 文档 | 引用位置 | 说明 |
|---|------|---------|------|
| 1 | [上线前部署校验清单（DEPLOYMENT-CHECKLIST v1.0.0）](../reports/testing/DEPLOYMENT-CHECKLIST-2026-08-14.md) | §二 2.D 灰度/正式命令行 与 §4 部署后监控补充 | 本文档 §2.D 与其保持步骤一致，§4 追加 30 分钟监控项（不重写） |
| 2 | [S05 上线前全面体检](./S05-pre-launch-checklist.md) | §一 PC-1 | 前置硬性依赖 |
| 3 | [Git 提交治理规范](./how-to/git-commit-governance.md) | §二 2.B Tag 信息格式 | Tag message 模板 |

---

## 一、前置条件（Prerequisites）

| # | 条件 | 验证 | 通过 |
|---|------|------|------|
| PC-1 | **S05 已 PASS**：`docs/reports/pre-launch/<日期>_<版本>/07-go-nogo-minutes.md` 结论 = GO（或 CONDITIONAL-GO + 双签已齐） | 打开文件，最后一行签字确认有效 | 人工 + 文件存在 |
| PC-2 | 当前 Git 状态干净：无 untracked / modified 文件，HEAD 与远端 release 分支 SHA 一致 | `git status -s ; git rev-parse HEAD ; git ls-remote origin release/<name>` | HEAD 相同 |
| PC-3 | 部署环境权限已就绪：CDN 账号登录态有效、Edge Pages / OSS 上传 STS Token 未过期（<24h） | 对应平台控制台登录或 `npx edge-pages whoami` | exit 0 |
| PC-4 | 回滚预案 **Pre-prepared**：上一版本（N-1）的构建产物 `archive/<N-1>_<sha7>.tar.gz` 存在且可解压，或 `dist/index-history-*.html` 保留可回滚入口 | `ls archive/` + `tar tzf archive/<prev>.tar.gz | head -5` | 文件存在 + 清单非空 |
| PC-5 | 值班表已排定：部署后 2 小时有人值守（非凌晨）、监控告警通道（飞书群 / SMS）已开通 | 查看值班文档 + 现场@1人确认 | 人工 |

---

## 二、操作步骤（4 大章节 · 10 子步骤）

### 2.A · SemVer 2.0 版本号规则（含 RC / HOTFIX 豁免）

**标准格式**：`MAJOR.MINOR.PATCH[-<PRERELEASE>][+<BUILDMETA>]`

| 版本类型 | 格式示例 | Bump 规则 | 适用条件 | 豁免说明 |
|---------|---------|----------|---------|---------|
| **正式版本** | `2.1.0` | MAJOR：不兼容变更；MINOR：新功能兼容；PATCH：Bug 修复兼容 | 常规季度 / 月度发版 | 无豁免 |
| **RC 候选** | `2.1.0-rc.3` | `-rc.N`，N 从 1 自增 | S05 结论 CONDITIONAL-GO 需多轮验证 | 豁免：**允许未到 2 周的 P1 遗留项**（需在 CHANGELOG 标注对应 RC 版） |
| **Beta** | `2.1.0-beta.1` | `-beta.N` | 面向种子用户的内测 | 豁免：**可信单元测试 98% 即可**（非 P0 环境默认 99.2%） |
| **Alpha** | `2.1.0-alpha.7` | `-alpha.N` | 内测冒烟 | 豁免：**真数测试 11 只集即可**（不强制 25 只全量） |
| **HOTFIX** | `2.0.1`、`2.0.1-hotfix.security` | 仅 PATCH 递增，严格从 main / release 分支出 hotfix 独立分支 | 线上 P0 Bug（崩溃 / 安全 / 数据错误） | 豁免：**S04/S05 可跳过非相关门禁**（例如纯安全补丁时真数测试跳过；跳过项 HOTFIX 审批 3 签） |

**HOTFIX 强制要求**：HOTFIX 分支合并后 **24 小时内** 必须补打 PATCH 正式 Tag，不得长期使用带 `-hotfix` 的 prerelease 标签。

### 2.B · 文件单向同步校验（🟥 禁止反向：先 Tag 再写文件）

> **单向顺序 = package.json → CHANGELOG.md → Git Tag。** 前一步不完成不进后一步。禁止「先 `git tag` 再改版本号」的反序操作（会导致 Tag 指向错误 commit）。

#### STEP B-1 — Bump `package.json` 版本号（BLOCK）

```powershell
# ——— 官方推荐：使用 npm version（自动改 package.json + 自动创建 commit + 自动打 Tag，
#     但本 SOP 拆成 3 步以便每步校验，因此加 --no-git-tag-version）———

# (1) 选择 bump 类型（按 2.A 规则）
$BumpType = 'minor'   # 可选: major / minor / patch / premajor / preminor / prepatch / prerelease

# (2) 仅修改 package.json，不自动 commit / tag
npm version $BumpType --no-git-tag-version --preid rc   # RC 时加 --preid rc
$NEW_VER = (node -e "console.log(require('./package.json').version)")
Write-Output "新版本号：$NEW_VER"
```

**校验（BLOCK）**：`node -e "console.log(require('semver').valid('$NEW_VER'))"` 输出 = `$NEW_VER`（格式合法）。

#### STEP B-2 — 写 `CHANGELOG.md`（BLOCK）

**写入位置**：CHANGELOG.md 顶部（Keep a Changelog 格式：`[x.y.z] - YYYY-MM-DD`，下方分 `Added / Changed / Fixed / Removed / Security` 5 小节）。  
**辅助命令**：

```powershell
# 提取本版本新增 commits（相对上一个 Tag）
$PREV_TAG = git describe --tags --abbrev=0
Write-Output "对比基准 Tag：$PREV_TAG"
git log "$PREV_TAG..HEAD" --oneline --no-merges --format='- %s (%h by %an)'
# → 将输出按 Added/Changed/Fixed/Removed/Security 五段粘贴到 CHANGELOG 顶部
```

**校验（BLOCK）**：`Get-Content CHANGELOG.md -TotalCount 5` 第一行 **必须** 含 `## [$NEW_VER] - $(Get-Date -Format 'yyyy-MM-dd')`。

#### STEP B-3 — 提交 + 打 Tag（BLOCK · 单向最后一步）

```powershell
# (1) Commit（提交消息必须严格匹配格式 release: v<ver>）
git add package.json CHANGELOG.md
git commit -m "release: v$NEW_VER"
$RELEASE_SHA = $(git rev-parse HEAD)

# (2) 打 Annotated Tag（强制签名 GPG 或至少 annotated，禁止 lightweight tag）
git tag -a "v$NEW_VER" -m @"
Release v$NEW_VER ($(Get-Date -Format 'yyyy-MM-dd'))
  Release SHA: $RELEASE_SHA
  Passed S05 Score: $(Get-Content docs/reports/pre-launch/*/06-scorecard.md -ErrorAction SilentlyContinue | Select-String '综合得分' | ForEach-Object { $_.Line })
  Owner: <Release Manager Name>
  Approvers: <Architect A>, <Architect B>, <Product Director>
"@

# (3) 单向反向防错：核对 Tag 指向的 commit 与 package.json 内容是否一致（BLOCK）
$TAG_VER = (git show "v$NEW_VER":package.json | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>console.log(JSON.parse(s).version))")
if ($TAG_VER -ne $NEW_VER) { Write-Host "❌ 单向同步破坏：Tag 内容版本 $TAG_VER ≠ 当前 package.json $NEW_VER" -Foreground Red; git tag -d "v$NEW_VER"; exit 1 }
git push --follow-tags
```

**通过标准**：`git ls-remote --tags origin "v$NEW_VER"` 返回 1 行且不是 `^{}` 标记的 lightweight tag。

---

### 2.C · 构建产物完整性三校验（BLOCK）

```powershell
# (1) 构建生产包（禁止 --mode development）
npm run build

# (2) C-1 清单校验：所有文件列清单（类型 + 大小）
node scripts/build-manifest.cjs --mode production --out temp/build-manifest.json
# → 输出清单需包含以下 MANDATORY 条目：
#   dist/index.html                     [HTML, ≥ 10KB]
#   dist/assets/index-*.js              [JS, main bundle, ≤ 6MB 压缩后]
#   dist/assets/V9-Logo-*.svg           [Logo]
#   dist/assets/hero-*.webp             [Hero 图]
#   manifest.webmanifest                [PWA]
#   favicon.ico                         [Icon]

# (3) C-2 哈希校验（SRI）——构建清单与实际文件 sha384 一一对应
node scripts/verify-build-sri.cjs --manifest temp/build-manifest.json
# → PASS 且 0 mismatches（禁止 mismatches ≥ 1，会导致 CDN SRI 校验失败）

# (4) C-3 HTML Entry 页面本地预校验（上线前 curl 等价命令）
#   本步骤对应 spec.md FR-12 的「部署后 HTML entry 命令 curl」
#   先本地用 http-server + powershell 模拟（之后 2.D-STEP 2 还会跑线上版本）
npx http-server dist -s -p 4173 &
Start-Sleep -Seconds 2
$Response = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/
$TitleOK = [regex]::Match($Response.Content, '<title>(.*?)</title>').Groups[1].Value -match 'V9|FinSight'
$StatusOK = [int]$Response.StatusCode -eq 200
Stop-Process -Name "node" -ErrorAction SilentlyContinue  # 停止 http-server（按 PID 更安全）
if (-not $TitleOK -or -not $StatusOK) { throw "HTML Entry 预校验失败：status=$($Response.StatusCode), title 不匹配" }
Write-Output "✅ C-3 本地 Entry 预校验通过：HTTP 200 + <title> 含 V9/FinSight"
```

**三校验全部 0 错误** 方可进入部署阶段。任一失败 → BLOCK（修复后从 `npm run build` 重新开始）。

---

### 2.D · 灰度 / 正式 / 回滚三段命令

> 本节步骤主体与 [DEPLOYMENT-CHECKLIST v1.0.0](../reports/testing/DEPLOYMENT-CHECKLIST-2026-08-14.md) §2 保持一致，命令行参数已对齐。

#### D-1 灰度发布（10% 流量，观察 ≥ 15 分钟）

```powershell
# —— 以 BytePlus Edge Pages 为例（其它平台对应命令：如 OSS 上传、Vercel 等）
# Edge Pages 提供 "灰度发布 = 高级路由 → 权重 90/10" 的原生模式
npx @byteplus/edge-pages-cli deploy              \
  --project=FinSightV9                            \
  --branch=release/$(node -e "console.log(require('./package.json').version.replace(/\..*/,''))") \
  --trafficWeight=10                              \
  --message="release: v$NEW_VER 灰度 10%"         \
  --backup-entry="index-history-$(Get-Date -Format 'yyyyMMddHHmmss').html"
# ↑ 关键 flag：--backup-entry 自动将原 index.html 重命名为带时间戳的备份（回滚方案 B 用）
```

**灰度观察 ≥ 15 分钟必查**（与 DEPLOYMENT-CHECKLIST §2.1 对齐）：
- ① Sentry 错误数：新 release 版本 vs 灰度前 15 分钟，增幅 ≤ 50%
- ② Apdex（若接入）：≥ 0.95
- ③ 10% 流量访问日志：`curl -H "Host: 灰度专属域名" https://.../health` 200 + JSON health OK
- ④ 飞书告警群：无 @all / P0 / P1 告警

**灰度 15 分钟内任一观察项违规** → 立即触发 回滚（见 D-3），不得等正式发布。

#### D-2 正式全量（100% 流量，灰度观察通过后）

```powershell
npx @byteplus/edge-pages-cli promote               \
  --project=FinSightV9                             \
  --deployment=<上一步灰度 Deployment ID>          \
  --trafficWeight=100                              \
  --message="release: v$NEW_VER 正式 100%"

# —— 上线后 HTML Entry 校验（spec.md FR-12 强制命令）
#    curl 部署域名，检查 HTTP 200 + <title> 包含 "V9" 或 "FinSight"
$DEPLOY_URL = "https://finsightv9.app.byteplus.com/"
$Res = Invoke-WebRequest -UseBasicParsing $DEPLOY_URL
$TitleMatch = [regex]::Match($Res.Content, '<title>(.*?)</title>').Groups[1].Value -match 'V9|FinSight'
if (($Res.StatusCode -ne 200) -or (-not $TitleMatch)) {
  Write-Host "❌ 上线入口校验失败（HTTP=$($Res.StatusCode) / Title不匹配）" -Foreground Red
  exit 1
}
Write-Output "✅ 正式发布 Entry 校验通过：HTTP 200 + Title OK"
```

**同步操作**：
- GitHub Release 页创建 Release，附 CHANGELOG 5 段 + `dist/` 产物哈希
- 飞书项目发布公告群 @channel，附版本号 + 亮点 + 已知遗留
- 部署前快照：`cp dist/index.html dist/index-history-$(Get-Date -Format 'yyyyMMddHHmmss').html`（与 `--backup-entry` 对应）

#### D-3 回滚双方案（一方案失败立即切换二方案，BLOCK）

**方案 A：镜像 Tag 回滚（推荐，≤ 3 分钟）**

```powershell
# 回滚到上一个已部署成功的版本号（N-1），前提：镜像保留
$ROLLBACK_VER = "$PREV_TAG"    # 例如 v2.0.0
$ROLLBACK_SHA = $(git rev-list -n 1 "$ROLLBACK_VER")
npx @byteplus/edge-pages-cli rollback  \
  --project=FinSightV9                  \
  --target-version="$ROLLBACK_VER"      \
  --target-commit="$ROLLBACK_SHA"       \
  --reason="P0 线上故障，紧急回滚"
```

**方案 B：index-history 文件替换回滚（方案 A 失败时使用，≤ 5 分钟）**

```powershell
# 前提：2.D-STEP 2 中的部署前快照文件（dist/index-history-<timestamp>.html）
#       或 Edge Pages --backup-entry 自动生成的备份
$BACKUP = Get-ChildItem dist/index-history-*.html | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Output "回滚用备份文件：$($BACKUP.Name)"

# (1) 将备份覆盖为最新 index.html（本地）
Copy-Item $BACKUP.FullName dist/index.html -Force
# (2) 快速推送（仅部署 index.html + 旧 assets 引用，无需全量）
npx @byteplus/edge-pages-cli deploy        \
  --project=FinSightV9                      \
  --skip-static-hash-check                  \
  --message="ROLLBACK → from v$NEW_VER to $PREV_TAG（方案B）"
```

**回滚后必做**：飞书群 @all 公告「已回滚，影响 X 分钟」；启动线上故障复盘流程；5 个工作日内产出 RCA。

---

## 三、通过标准

| 等级 | 子步骤 | 通过判定 |
|:---:|--------|---------|
| 🟥 BLOCK（7 项） | 2.A 版本号合法；2.B 单向同步（B1→B2→B3）；2.C 三校验（清单+哈希+Entry）；2.D-1 灰度通过；2.D-2 上线 Entry HTTP 200+Title；回滚方案 A/B 至少 1 项**成功验证通过** | 全部 7 项 0 错误 |
| 🟠 WARN（≤ 2） | 灰度 Sentry 错误数增幅 40%~50%（临界）；构建产物大小接近阈值（JS=5.8MB） | 登记 + 限期优化（≤ 1 个版本周期） |
| 🟡 INFO | 灰度观察第 14 分钟偶发超时（自动重试成功）；非核心文案更新 | 记录即可 |

**最终结论**：
```
BLOCK=0 → 发布成功，进入 S07 上线后运维
BLOCK>0 → 执行 D-3 回滚，回到 S05 阶段重新体检
```

---

## 四、常见失败与修复（Top 5）

| # | 失败症状 | 根因 | 修复 |
|---|---------|------|------|
| 1 | 单向同步校验失败（B-3 TAG_VER ≠ package.json） | 有人跳过 B-1 / B-2 直接改代码后打 Tag | `git tag -d vX.X.X && git push origin :refs/tags/vX.X.X` 删误 Tag，回到 B-1 按序重做 |
| 2 | C-2 SRI 哈希 mismatches | CI 缓存未清，旧 asset 与新 manifest 不符 | `rm -rf dist node_modules/.vite && npm ci && npm run build` 重新纯净构建 |
| 3 | Entry 200 但 Title 含 "Vite" 或 "Index" | `index.html` 未替换模板占位符 | 检查 `index.html` L5 `<title>{{V9_APP_TITLE}}</title>` 是否已被 `vite-plugin-html` 注入为 `FinSight V9 | 智能投研平台` |
| 4 | 灰度后 Sentry 错误暴增（> 100%）→ 必须回滚 | 新代码某模块未通过 S05（漏网） | 立即触发 D-3；失败 Case 回 S04 做集成测试 + S05 增补对应 STEP |
| 5 | 回滚方案 A 失败（镜像不存在）→ 立即切方案 B | 镜像保留期 < N-1 版本或清理策略过严 | 切 B；事后调整 CDN 保留期（≥ 90 天）与镜像策略 |

---

## 五、证据与归档

| # | 证据 | 命名模式 | 生成方式 |
|---|------|---------|---------|
| E1 | 版本号变更 diff（package.json + CHANGELOG） | `01-version-bump.patch` | `git show HEAD -- package.json CHANGELOG.md > 01-version-bump.patch` |
| E2 | Git Tag 校验结果 | `02-tag-verify.txt` | `git show "v$NEW_VER" --stat --format=medium > 02-tag-verify.txt` |
| E3 | 构建清单 + SRI 校验 | `03-build-manifest.json` + `04-sri-verify.log` | `cp temp/build-manifest.json 03-build-manifest.json` + 重定向 |
| E4 | 灰度观察 15 分钟截图（或 Sentry Apdex 导出） | `05-canary-15min.png / .csv` | Sentry 平台导出 |
| E5 | 正式发布 Entry curl 原始结果 | `06-entry-check.html` | `Invoke-WebRequest $DEPLOY_URL -OutFile 06-entry-check.html` |
| E6 | 双回滚预案可用性验证记录（必须记录方案 A/B 预演结果） | `07-rollback-verification.md` | 人工记录「方案 A 预演成功 / 方案 B 预演成功」双勾选 |

**归档目录**：`docs/reports/release/YYYY-MM-DD_v<版本号>/`

```powershell
$ver=$NEW_VER
$dir="docs/reports/release/$(Get-Date -Format 'yyyy-MM-dd')_v$ver"
New-Item -ItemType Directory -Force $dir
Move-Item 0[1-7]-* $dir
```

---

## 六、阶段跳转

- **前置**：[S05 上线前全面体检](./S05-pre-launch-checklist.md) PASS
- **成功**：发布成功 → [S07 上线后运维与应急 SOP](./S07-ops-incident-response.md) §2 上线后 48 小时值守
- **失败回退**：回滚 → 返回 S05 重新体检，同时触发 S07 §3 P0 应急流程

> **版本管理承诺**：本 SOP 发布流程与「不可变基础设施」原则对齐：Tag 一经推送不可修改（禁止 `git push -f --tags`）。若必须修正 Tag 文案，新增补丁 Tag `vX.Y.Z-rev2` 并在 CHANGELOG 注明修正说明。
