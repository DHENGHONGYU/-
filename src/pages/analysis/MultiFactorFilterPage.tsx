/**
 * @module MultiFactorFilterPage
 * @description 多因子筛选页面（DA-007 四步集成合约：第 4 步 UI）。
 * 仅负责挂载已实现的 MultiFactorFilterPanel 并接入 multiFactorScreeningStore，
 * 业务行为与筛选逻辑全部由组件与 Store 承载，本文件不做额外逻辑。
 *
 * 关联：componentRegistry.ts 中 MultiFactorFilterPanel 的 suggestedTarget 指向本页。
 */

import { MultiFactorFilterPanel } from '@/components/analysis/screening/MultiFactorFilterPanel'

export default function MultiFactorFilterPage(): React.JSX.Element {
  return <MultiFactorFilterPanel />
}
