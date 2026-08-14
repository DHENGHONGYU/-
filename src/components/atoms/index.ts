/**
 * 原子组件统一导出入口
 *
 * 原子 = 不可再分的最小 UI 单元，禁止依赖 Store/Service/业务逻辑
  * @doc [V9-DOC-FRONT-046]
*/

export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Input } from './Input'

export { Textarea } from './Textarea'

export { Select, SelectItem } from './Select'

export { Checkbox } from './Checkbox'

export { RadioGroup, Radio } from './Radio'
export type { RadioGroupProps, RadioProps } from './Radio'

export { Switch } from './Switch'

export { Slider } from './Slider'

export { Toggle } from './Toggle'

export { Label } from './Label'

export { Badge } from './Badge'
export type { BadgeVariant } from './Badge'

export { Progress } from './Progress'
export type { ProgressProps } from './Progress'

export { Separator } from './Separator'

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from './Card'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './Sheet'

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './Breadcrumb'

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table'

export { StockPriceChangeBadge } from './StockPriceChangeBadge'

export {
  DEFAULT_BADGE,
  PRIORITY_BADGE,
  SUGGESTION_STATUS_BADGE,
  CATEGORY_ICON_COLOR,
  CHANGELOG_TYPE_BADGE,
} from './statusColors'
export type { BadgeStyle } from './statusColors'

// 注：PageContainer 属模板层，已在 templates/index.ts 导出，原子桶不重复导出

// 全局签名母题：信号频谱（统一视觉锚点）

// 安全状态组件（本地加密存储状态展示）

// 信息密度控制组件（渐进披露与自适应密度）

// 交互状态组件（四态组件库：loading/empty/error/skeleton）
