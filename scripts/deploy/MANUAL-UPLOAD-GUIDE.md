# GitHub 手动上传 YAML 文件 — 详细步骤指南

> 适用于企业防火墙阻断 `git push` 的环境  
> 替代方案 C: GitHub Web UI 直接上传

---

## 📋 前置检查清单

在开始前，请确认：

- [ ] 你有 `DHENGHONGYU/-` 仓库的 **Write** 权限
- [ ] 你的浏览器（Chrome/Edge）已登录 GitHub
- [ ] 你可以在浏览器中访问 `https://github.com/DHENGHONGYU/-`
- [ ] 本地文件就绪：`D:\FinSightV9\.github\workflows\wiki-naming-conventions-sync.yml`

---

## 步骤 1：上传工作流 YAML 文件

### 1.1 打开仓库文件树

在浏览器中访问：
```
https://github.com/DHENGHONGYU/-/tree/main/.github/workflows/
```

你应该看到现有的工作流文件列表（`ci.yml`, `build-release.yml` 等）。

### 1.2 点击 "Add file"

在页面右上角找到绿色按钮 **"Add file"**，点击后在下拉菜单中选择 **"Upload files"**。

### 1.3 上传 YAML 文件

在打开的上传页面：

1. **拖拽** 或 **点击选择** 以下本地文件：
   ```
   D:\FinSightV9\.github\workflows\wiki-naming-conventions-sync.yml
   ```

2. 确认文件出现在上传列表中

3. 滚动到页面底部的 **"Commit changes"** 区域

### 1.4 填写提交信息

在 "Commit changes" 区域：

- **Commit message**: 
  ```
  feat(ci): add wiki naming conventions sync workflow with Confluence deployment
  ```

- **Choose a branch**: 保持 `main`

- 点击绿色按钮 **"Commit changes"**

### 1.5 验证上传成功

等待 30 秒后，访问：
```
https://github.com/DHENGHONGYU/-/actions/workflows/wiki-naming-conventions-sync.yml
```

**验证标准**：
- ✅ 页面不再显示 "This workflow does not exist."
- ✅ 显示工作流详情（触发器、Jobs 列表）
- ❌ 如果仍显示错误 → 等待 1 分钟后刷新

---

## 步骤 2：配置 Confluence GitHub Secrets

### 2.1 打开 Secrets 设置

访问：
```
https://github.com/DHENGHONGYU/-/settings/secrets/actions
```

### 2.2 添加 Secrets

点击 **"New repository secret"**，逐个添加以下 4 个 Secret：

| # | Name | Value |
|---|------|-------|
| 1 | `CONFLUENCE_URL` | `https://your-instance.atlassian.net` |
| 2 | `CONFLUENCE_TOKEN` | `your-api-token` |
| 3 | `CONFLUENCE_SPACE` | `ENG` |
| 4 | `CONFLUENCE_PARENT_ID` | (可选，留空或填父页面 ID) |

**注意**：
- Name 必须**完全匹配**上方（区分大小写）
- Value 是你 Confluence 的 API Token
- Token 获取方式: Confluence → Settings → API tokens → Create token

每个 Secret 添加后点击 **"Add secret"** 保存。

### 2.3 验证 Secrets

添加完成后，页面应显示 3-4 个 Secret 条目。

---

## 步骤 3：手动触发工作流

### 3.1 打开工作流页面

访问：
```
https://github.com/DHENGHONGYU/-/actions/workflows/wiki-naming-conventions-sync.yml
```

### 3.2 点击 "Run workflow"

在页面右侧/顶部找到 **"Run workflow"** 按钮：

- 选择 **Branch**: `main`
- 点击绿色 **"Run workflow"** 按钮

### 3.3 等待运行

工作流需要 2-5 分钟完成。期间可以看到：

- 状态: `queued` → `in progress` → `completed`
- 三个 Jobs: `sync-wiki`, `scheduled-sync`, `confluence-deploy`
- 每个 Job 右侧有状态图标: ⏳ 🔄 ✅ ❌

### 3.4 查看日志

点击任意 Job 名称查看详细日志：

- ✅ 绿色步骤 → 成功
- ❌ 红色步骤 → 失败（点击查看错误信息）

---

## 步骤 4：查看 Artifact 和 Confluence 结果

### 4.1 下载 Artifact

在工作流运行页面，滚动到底部的 **"Artifacts"** 区域：

- `wiki-deployment-package` — 点击下载 (ZIP)
- `wiki-metadata` — 点击下载 (ZIP)

解压验证内容完整性。

### 4.2 检查 Confluence 页面

如果配置了 Confluence Secrets 且 `confluence-deploy` Job 成功：

1. 打开你的 Confluence 实例
2. 导航到 Space `ENG`
3. 查找页面 "组件命名规范与文档模板标准"
4. 确认内容已更新（对比 `outputs/wiki-deploy/confluence-payload.html`）

---

## 步骤 5：更新远程脚本

工作流上传成功后，在你的本地终端执行：

```powershell
# 获取远程最新状态
git fetch origin

# 确认远程已更新
git log origin/main --oneline -5
# 应包含 wiki-naming-conventions-sync.yml 的提交

# 可选：将本地剩余文件推送到远程
git push origin main
```

---

## 🔧 故障排查

| 问题 | 解决方案 |
|------|----------|
| 浏览器也打不开 GitHub | 使用手机热点或其他网络；或联系 IT 开通 github.com 访问 |
| "Invalid workflow" 错误 | 检查 YAML 语法: https://yamllint.com/ |
| Secrets 页面找不到 | 仓库 Settings → Secrets and variables → Actions |
| 工作流一直 pending | 检查 GitHub Actions 状态: https://github.status.com/ |
| `confluence-deploy` 失败 | 检查 Secrets 是否正确，Token 是否有效 |
| Artifact 下载失败 | 在 Actions 运行页面直接点击下载 |

---

## ⏱️ 预计耗时

| 步骤 | 预计时间 |
|------|----------|
| 上传 YAML + 提交 | 1 分钟 |
| 配置 Secrets | 2 分钟 |
| 触发工作流运行 | 3-5 分钟 |
| 下载 Artifact 验证 | 1 分钟 |
| **总计** | **~8-10 分钟** |

---

## 📞 备用方案

如果 GitHub Web UI 也无法访问：

### 方案 D: 直接部署 Confluence (无需 GitHub)

```powershell
cd D:\FinSightV9
.\scripts\deploy\deploy-to-confluence-local.ps1 `
    -ConfluenceUrl "https://your-instance.atlassian.net" `
    -ConfluenceToken "your-api-token" `
    -SpaceKey "ENG" `
    -UpdateExisting
```

### 方案 E: 粘贴法 (最原始)

1. 打开 `D:\FinSightV9\outputs\wiki-deploy\confluence-payload.html`
2. Ctrl+A 全选 → Ctrl+C 复制
3. 登录 Confluence → 目标 Space → 创建/编辑页面
4. 右上角 `···` → **存储格式** → 粘贴 → 保存

---

*文档版本: v1.0 | 生成时间: 2026-08-15*