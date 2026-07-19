---
title: visual-regression-guide
type: how-to
domain: qa
phase: development
tier: important
status: active
maintainer: V9 Architecture Team
summary: "视觉回归测试通过截图对比检�?UI 变更。但不同操作系统（Windows / macOS / Linux）的字体渲染、抗锯齿策略、浏览器实现存在差异，导致同一页面在不同机器上生成的截图有微小差异�?
tags: [project, test, testing, guide, audit, component, visualization]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-072
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 视觉回归基线管理规范

> **Version**: v1.0.0 | **日期**: 2026-07-12
> **适用范围**: 所有参�?V9 前端开发的团队成员

---

## 一、为什么需要统一基线环境�?
视觉回归测试通过截图对比检�?UI 变更。但不同操作系统（Windows / macOS / Linux）的字体渲染、抗锯齿策略、浏览器实现存在差异，导致同一页面在不同机器上生成的截图有微小差异�?
**问题**：如�?A �?Windows 上生成基线，B �?macOS 上修改代码后更新基线，CI �?Ubuntu 上比�?—�?三方基线互相冲突，产生大量无�?diff�?
**解决方案**：使�?**Docker 容器**作为唯一基线真相源，统一 Chromium + 字体 + 渲染环境�?
---

## 二、基线生成流程（强制�?
### 方式 A：Docker 本地（推荐）

```bash
# 1. 确保 Docker Desktop 已安装并运行
#    下载地址：https://www.docker.com/products/docker-desktop

# 2. 更新基线（Docker 统一环境�?npm run test:e2e:visual:docker:update

# 3. 提交基线�?git
git add e2e/visual-regression.spec.ts-snapshots/
git commit -m "chore: update visual baselines via Docker"
```

### 方式 B：GitHub Actions 手动触发（无 Docker 本地环境时）

1. 进入 GitHub 仓库 �?Actions �?**Visual Baseline Update**
2. 点击 **Run workflow**
3. 选择目标分支（默�?`main`�?4. 填写提交信息前缀（可选）
5. 点击 **Run workflow**
6. workflow 会自动在 Docker 容器中生成基线并提交到指定分�?
---

## 三、日常开发流�?
```
┌─────────────────────────────────────────────────────────────�?�? 修改 UI 代码（组�?页面样式变更�?                           �?�?        �?                                                  �?�? 本地验证：npm run test:e2e:visual:docker                   �?�?        �?                                                  �?�? 如果�?diff（预期内）：npm run test:e2e:visual:docker:update �?�?        �?                                                  �?�? 提交代码 + 基线一�?push                                   �?�?        �?                                                  �?�? CI 自动运行 visual-regression job（Docker 比对�?          �?�?        �?                                                  �?�? �?通过 �?合并                                             �?�? �?失败 �?检查是否遗漏了基线更新                           �?└─────────────────────────────────────────────────────────────�?```

### 关键规则

| 规则 | 说明 | 违反后果 |
|------|------|----------|
| **基线必须�?Docker 生成** | 禁止直接提交 Windows 本地生成的基�?| CI 比对大概率失败，阻塞合并 |
| **基线变更单独提交** | 建议 `chore: update visual baselines` 单独 commit | 便于 review 时区分代码变更和基线变更 |
| **基线 + 代码�?PR** | 基线更新必须与代码变更在同一 PR | 防止基线与代码版本不匹配 |
| **禁止修改既有基线** | 不要手动编辑/压缩 PNG 基线 | 破坏 Playwright 的像素比�?|

---

## 四、FAQ

### Q1：我�?Windows 上开发，没有 Docker 怎么办？

**A**：两种方式：
1. 安装 Docker Desktop（推荐，安装�?10 分钟，后续基线生成一劳永逸）
2. 使用 GitHub Actions 手动触发 workflow（无 Docker 环境也能更新基线�?
### Q2：为什�?CI 上的 visual-regression job 标记�?`continue-on-error: true`�?
**A**：当前处�?*实验过渡�?*。在 Docker 基线完全取代 Windows 基线之前，CI 上的比对可能因基线来源不一致而失败。待团队统一使用 Docker 生成基线后，将移除该标志，使视觉回归成为阻塞性检查�?
### Q3：新增了一个页面，如何添加到视觉回归？

**A**�?1. �?`e2e/visual-regression.spec.ts` 中新�?`test()` 用例
2. 使用 `waitForPageStable(page, /heading/i)` 等待页面稳定
3. 运行 `npm run test:e2e:visual:docker:update` 生成新基�?4. 提交代码 + 基线

### Q4：基线比对失败，�?diff 是由数据加载时间导致的（�?UI 变更�?
**A**�?1. 检�?`waitForPageStable` 是否足够（已设置 15s 超时覆盖 React.lazy�?2. 若页面依�?API 数据，考虑在测试前 mock 数据或等待特定元�?3. 若页面高度不稳定，考虑去掉 `fullPage: true`，只截取 viewport 区域

---

## 五、相关文件速查

| 文件 | 用�?|
|------|------|
| `e2e/visual-regression.spec.ts` | 测试用例定义�?0 场景�?|
| `e2e/visual-regression.spec.ts-snapshots/` | PNG 基线存储目录 |
| `e2e/Dockerfile` | Docker 镜像定义（Playwright 官方 + Node 20�?|
| `e2e/docker-compose.yml` | Docker Compose 服务（visual-test / visual-update�?|
| `.github/workflows/visual-baseline-update.yml` | GitHub Actions 手动触发基线更新 |
| `.github/workflows/quality-check.yml` | CI 回归比对（visual-regression job�?|
| `scripts/other/compare-visual-baselines.sh` | Windows vs Docker 基线对比脚本 |
| 本文�?| 团队规范与操作指�?|

---

## 六、去实验性标志路线图

| 阶段 | 条件 | 行动 |
|------|------|------|
| 当前 | 已配�?Docker 方案 | `continue-on-error: true` |
| 阶段1 | 50%+ 基线通过 Docker 生成 | 观察 CI 稳定�?|
| 阶段2 | 连续 5 �?CI 视觉回归 100% 通过 | 移除 `continue-on-error: true` |
| 阶段3 | 所有团队成员使�?Docker 生成基线 | 视觉回归成为 P0 阻塞性检�?|

---

## 七、紧急联�?
- 视觉回归 flaky 或无法通过：检�?`e2e/visual-regression.spec.ts` 中的 `waitForPageStable` 超时设置
- Docker 构建失败：检�?`e2e/Dockerfile` �?Node 版本与项目一�?- CI 比对失败但本地通过：确认本地使�?Docker 生成基线，而非 Windows 本地
