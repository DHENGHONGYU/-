---
title: 设计令牌清理工作总结
code_version: 2.0.0-rc.2
version: v1.1.0
last_updated: 2026-08-23
change_log:
  - version: v1.1.0
    changes: "精简：删除自动生成提交链/文件列表/覆盖率细节，保留摘要与经验教训"
    date: 2026-08-23
---

# 设计令牌清理工作总结

> **日期**：2026-08-15 | **状态**：✅ 已完成 | **验证**：真实执行（build/tsc/test）

## 摘要

清除旧版双套令牌系统（slate + V5），确立 **V8 Apple Business Design Tokens** 唯一真相源，封装运行时验证 Utility 并集成主题切换自动重验证。

**4 次提交**（508c84f → 87ae340），涉及 37 个文件（删 5 / 增 12 / 改 20）。

### 关键成果

| 检查项 | 结果 |
|--------|------|
| `npm run build` | ✅ 通过（净省 ~1-2s/次，移除 generate:tokens 步骤） |
| 令牌单元测试 | ✅ 17/17（语句 95% / 行 96%） |
| `tsc:prod` | ✅ 通过 |
| 生产 Bundle | 零开销（验证逻辑 tree-shake 移除） |

---

## 经验教训（保留）

### 1. 删除脚本必须同步清理 package.json 引用

删除 `scripts/generate-tokens.ts` 后 `prebuild` 仍引用 `generate:tokens`，导致 `npm run build` 完全中断。**改进**：删除任何脚本时全局 grep `package.json` 的 `pre*/post*` 钩子。

### 2. tsc 增量缓存会产生幻影错误

`.tsbuildinfo` 缓存陈旧时会冒出与代码不符的错误。**改进**：验证脚本先清 `.tsbuildinfo` 或 `tsc --force`。

### 3. "声称通过" ≠ "实跑通过"

v3 报告标 ✅ 但实际构建是坏的。**改进**：验证结果必须有命令输出背书。

### 4. vitest coverage 必须收窄 include 范围

不指定 `--coverage.include` 会对全量 src 插桩，触发无关文件解析错误。**改进**：同步传 `--coverage.include=<file>`。

### 5. 测试-实现漂移是预存失败的常见根因

173 个失败中 36 个预存漂移 + 1 个本次自造（Card.test.tsx 断言 `border` 但实现改为 `shadow`）。**改进**：改实现必须同步改测试。

### 6. 子目录同名副本遗漏

删除脚本时遗漏 `scripts/generate/` 子目录同名副本。**改进**：清理类操作全局 Grep 同名文件。

### 7. IDE 并发 git 操作

IDE 后台 git 索引覆盖暂存区。**改进**：提交前 `git status` 确认，用 `git commit --only <paths>` 隔离。
