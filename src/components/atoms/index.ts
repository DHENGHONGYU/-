/**
 * 原子组件统一导出入口
 *
 * 原子 = 不可再分的最小 UI 单元，禁止依赖 Store/Service/业务逻辑
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

export { Skeleton } from './Skeleton'

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

export { Popover } from './Popover'
export type { PopoverProps, PopoverPlacement, PopoverTrigger } from './Popover'

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './Sheet'

export type { Toast } from './Toast'

export { Menu, MenuItem, SubMenu } from './Menu'
export type { MenuProps, MenuItemProps, SubMenuProps } from './Menu'

export { Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './Breadcrumb'

export { Result } from './Result'
export type { ResultProps, ResultStatus } from './Result'

export { List, ListItem } from './List'
export type { ListProps, ListItemProps } from './List'

export { Grid, Row, Col } from './Grid'
export type { GridProps, RowProps, ColProps } from './Grid'

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table'

export { DatePicker } from './DatePicker'
export type { DatePickerProps } from './DatePicker'

export { StockPriceChange } from './StockPriceChange'

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
export { SignalSpectrum } from '../cockpit/SignalSpectrum'
export type { SignalSpectrumProps } from '../cockpit/SignalSpectrum'

// 安全状态组件（本地加密存储状态展示）
export { SecurityStatus, SecurityBadge } from '../cockpit/SecurityStatus'
export type { SecurityStatusProps, SecurityBadgeProps } from '../cockpit/SecurityStatus'

// 信息密度控制组件（渐进披露与自适应密度）
export { DensityToggle } from '../cockpit/DensityToggle'
export { DensityProvider, useDensity, useDensityConfig, useDensityClass } from '../cockpit/DensityContext'
export type { DensityLevel, DensityConfig } from '../cockpit/DensityContext'

// 交互状态组件（四态组件库：loading/empty/error/skeleton）
export { Loading, Empty, ErrorState } from '../molecules/states'
export type { LoadingProps, EmptyProps, ErrorStateProps } from '../molecules/states'
