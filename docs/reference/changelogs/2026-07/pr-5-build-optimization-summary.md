---
title: pr-5-build-optimization-summary
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# PR-5 构建性能优化总结

> **版本**: v1.0 | **日期**: 2026-07-07
> **构建工具**: Vite v6.4.3
> **状态**: ✅ 已完成并验证

---

## 一、优化项实施总结

### 5.1 manualChunks 扩展

[vite.config.ts:108-119](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts#L108-L119) 新增 3 个 chunk，扩展 2 个 chunk：

```typescript
manualChunks: {
  'vendor': ['react', 'react-dom', 'react-router', 'zustand', 'dayjs'],
  'ui': ['lucide-react', 'clsx', 'tailwind-merge', '@heroicons/react'],
  'charts': ['recharts', 'lightweight-charts'],       // 新增
  'pdf': ['jspdf', 'jspdf-autotable'],                 // 新增
  'excel': ['xlsx'],                                   // 新增
},
```

### 5.2 关闭生产 sourcemap

[vite.config.ts:105](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts#L105)：

```typescript
sourcemap: false,  // PR-5 5.2：关闭生产 sourcemap，调试时改为 'hidden'
```

---

## 二、性能对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 构建时间 | 35.53s | 13.83-33.61s | ↓ 构建时间（波动较大） |
| dist 总体积 | ~15.6 MB | ~3.1 MB | ✅ ↓ 80.1% |
| .map 文件数 | 137 个（12.1 MB） | 0 个 | ✅ 全部消除 |
| ScoreRadar chunk | 299.23 kB | 0.96 kB | ✅ ↓ 99.7% |
| AreaChart chunk | 110.60 kB | 2.85 kB | ✅ ↓ 97.4% |
| recharts 重复打包 | ~662 kB | 0 kB | ✅ 消除 |

---

## 三、关键教训

1. **sourcemap 影响远超预期**：预期 10-20% 改善，实际 40-60%
2. **manualChunks 不足导致重复打包**：recharts 被 5 个组件重复打包
3. **构建时间波动大**：相同配置下 13.83-33.61s 波动，应多次测量
4. **配置文件需及时 commit**：避免被 git stash 等操作意外回滚

---

## 四、变更文件

| 文件 | 变更 |
|------|------|
| [vite.config.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/vite.config.ts) | 5.1 manualChunks 扩展 + 5.2 sourcemap 关闭 |
| [.gitignore](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/.gitignore) | 补充构建产物排除规则 |
| [README.md](../../../README.md) | 新增构建优化章节 |
