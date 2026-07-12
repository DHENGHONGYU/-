# V9 整改工具包

本工具包包含整改过程中使用的补丁脚本和验证命令，可在新项目中直接复用。

## 目录结构

```
toolkit/
├── auto-register-scripts.js    # 未注册脚本自动注册工具
├── patch-error-handling-dynamic.ts  # 统一错误处理补丁工具
├── safeCoerce.ts                # 安全工具函数模板
├── verify.sh                    # Linux/macOS 验证脚本
├── verify.bat                   # Windows 验证脚本
└── README.md                    # 本说明文件
```

## 使用说明

### 1. 脚本自动注册

运行以下命令将未注册脚本添加到 package.json：

```bash
node auto-register-scripts.js
```

### 2. 统一错误处理补丁

运行以下命令修复静默回退模式：

```bash
npx tsx patch-error-handling-dynamic.ts --force --verbose
```

### 3. 安全工具函数

将 safeCoerce.ts 复制到项目的 src/lib/ 目录：

```bash
cp safeCoerce.ts ../src/lib/
```

### 4. 验证脚本

**Linux/macOS：**
```bash
chmod +x verify.sh
./verify.sh
```

**Windows：**
```cmd
verify.bat
```

## 验证命令说明

| 命令 | 用途 | 预期结果 |
|------|------|---------|
| `npx tsc --noEmit` | TypeScript 类型检查 | 零错误 |
| `npm run audit:hardcode` | 硬编码审计 | 零违规 |
| `npm run audit:layers` | 架构分层审计 | 零违规 |
| `npm run audit:deadcode` | 死代码审计 | 零违规 |
| `npm test -- --run` | 单元测试 | 全部通过 |

## 审计脚本前置条件

验证脚本依赖以下 npm scripts，需在新项目的 package.json 中配置：

```json
{
  "scripts": {
    "audit:hardcode": "npx tsx scripts/audit-hardcode.ts",
    "audit:layers": "npx tsx scripts/audit-layer-calls.ts",
    "audit:deadcode": "npx tsx scripts/audit-deadcode.ts"
  }
}
```

这些审计脚本可从 V9 项目的 `scripts/` 目录获取：
- [audit-hardcode.ts](https://github.com/your-repo/v9-system/tree/main/scripts/audit-hardcode.ts)
- [audit-layer-calls.ts](https://github.com/your-repo/v9-system/tree/main/scripts/audit-layer-calls.ts)
- [audit-deadcode.ts](https://github.com/your-repo/v9-system/tree/main/scripts/audit-deadcode.ts)

## 安全工具函数

```typescript
import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'

// 使用示例
const name = getSafeString(data.name)      // 安全获取字符串
const count = getSafeNumber(data.count)    // 安全获取数字
const list = getSafeArray(data.items)      // 安全获取数组
const msg = fallback.error                 // 使用统一回退消息
```

## 回退常量

```typescript
fallback = {
  loading: '加载中…',
  empty: '暂无数据',
  error: '请求异常，请稍后重试',
  unknown: '未知',
  noContent: '无内容摘要',
}
```

## 注意事项

1. 运行补丁脚本前建议先运行 `--dry-run` 预览效果
2. 确保项目已安装 jsPDF 依赖（用于 PDF 报告生成）
3. 验证脚本需要 Node.js 18+ 和 npm 环境
4. 建议在执行补丁前备份代码或提交 Git
