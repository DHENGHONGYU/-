# Release Notes - 2026-08-06 测试债务清零交付包

## 📦 交付物清单

本文件夹包含 FinSightV9 项目 2026-08-06 测试债务清零冲刺的完整交付物：

### 1. 核心文档

| 文件 | 说明 | 大小 |
|------|------|------|
| `coverage-quality-report-2026-08-06.md` | **最终覆盖率质量报告 v4**（含精确数字 §4.2-§4.4 + 8 真修复贡献分解 + 下轮 TOP5 ROI） | 18.05 KB |
| `remaining-known-failing-2026-08-06-v3.md` | **剩余债务清单 v3**（移除 e2e-25stocks + ConfigApp 2 条，剩余 18 条全合规注释） | 13.17 KB |

### 2. Diff 归档

| 文件 | 说明 | 大小 |
|------|------|------|
| `diff-archive-v4-addendum.md` | **v4 addendum diff 归档**（13 个 coverage-v8 依赖变更 + vite.config.ts provider 切换） | 10.22 KB |
| `diff-stat-2026-08-06-v4.txt` | **v4 diff 统计**（package.json 53 行变更） | 3.09 KB |

### 3. 数据与工具

| 文件 | 说明 | 大小 |
|------|------|------|
| `coverage-summary-2026-08-06.json` | **精确覆盖率数字 JSON**（Stmt 94.79% / Branch 93.70% / Func 85.87%） | 1.07 KB |
| `parse-coverage.mjs` | **覆盖率解析脚本**（一键生成分组 + 阈值对比） | 4.33 KB |

---

## ✅ 核心成果总结

### 本轮 8 项真修复（100% 通过）

1. **useWidgetErrorState** error→empty 语义修复（用户级"空数据误报失败"投诉根因消除）
2. **SectorHeatmapWidget** 空状态断言对齐（15/15 通过）
3. **WatchlistMoversWidget** store mock 迁移（4/4 通过）
4. **Toggle** controlled + variant 修复（9/9 通过）
5. **ConfigApp** handleResetToDefault waitFor 导入修复（22/22 通过，删除 2 条错标 known-failing）
6. **e2e-25stocks** 三舱状态机解 skip（1/1 通过，validTransition 100% 正确）
7. **daily-doc-validation** mkdirSync 脚本层 Bug 修复（15/15 通过）
8. **Windows coverage ENOENT 根治** v8 provider + singleFork 四重防线（0 ENOENT 自证）

### 精确覆盖率数字（从 coverage-final.json 解析）

- **Statements**: 1765/1862 = **94.79%**
- **Branches**: 506/540 = **93.70%**
- **Functions**: 79/92 = **85.87%**

### 阈值达标（已解析模块）

- **src/services**: 97.81% / 90.41% / 100%（远超阈值 +82.81pp）
- **src/pages**: 92.15% / 97.58% / 67.50%（远超阈值 +82.15pp）

---

## 🔧 如何使用

### 查看 HTML 覆盖率报告

```powershell
# 打开交互式覆盖率报告（浏览器）
start coverage\index.html
```

### 重新解析覆盖率 JSON

```powershell
# 从 coverage-final.json 重新生成汇总 JSON
node outputs\parse-coverage.mjs
```

---

## 📋 PR 提交建议

建议将此文件夹作为 PR description 的附件，包含：

1. **commit message 模板**：
   ```
   fix(tests): 8 debts cleared + coverage v8 provider + 13 deps pinned
   
   BREAKING CHANGE: Windows coverage ENOENT 根治（v8 provider + singleFork）
   
   - useWidgetErrorState: error→empty 语义修复（A+）
   - ConfigApp: waitFor 导入修复（22/22）
   - e2e-25stocks: 解 skip + validTransition 100%（A+）
   - daily-doc: mkdirSync 脚本层 Bug 修复（15/15）
   - coverage-v8: 13 个直接依赖精确定版（0 extraneous）
   
   Coverage: Stmt 94.79% / Branch 93.70% / Func 85.87%
   Remaining it.skip: 18（0 隐形债务）
   ```

2. **PR body** 可引用：
   - `coverage-quality-report-2026-08-06.md` §1-§5 作为技术细节说明
   - `remaining-known-failing-2026-08-06-v3.md` 作为债务清单快照

---

**生成时间**: 2026-08-06 16:42  
**生成方式**: TRAE 自动化交付