# 统一错误处理补丁报告

> 生成时间：2026-07-12T06:41:54.485Z
> 修改文件：1
> 总修改数：1

## 安全工具函数

工具文件: `src/lib/safeCoerce.ts`

```typescript
export const fallback = {
  loading: '加载中…',
  empty: '暂无数据',
  error: '请求异常，请稍后重试',
  unknown: '未知',
  noContent: '无内容摘要',
}

export function getSafeString(value: string | undefined | null): string {
  return value ?? ''
}

export function getSafeNumber(value: number | undefined | null): number {
  return value ?? 0
}

export function getSafeArray<T>(value: T[] | undefined | null): T[] {
  return value ?? []
}
```

## 修改清单

- `src/components/widgets/WidgetShell.tsx`: 1 处

## 使用说明

1. 所有静默回退已替换为安全工具函数
2. 统一回退常量定义在 `src/lib/safeCoerce.ts`
3. 使用方式:
   ```typescript
   import { getSafeString, getSafeNumber, getSafeArray, fallback } from '@/lib/safeCoerce'
   ```

