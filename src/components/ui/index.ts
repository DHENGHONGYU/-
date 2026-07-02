/**
 * UI 组件库统一导出入口
 *
 * @module components/ui
 * v0.9.11 P2-CMP-004
 */

// 三态组件
export { LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'

export { ErrorState } from './ErrorState'
export type { ErrorStateProps } from './ErrorState'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps, EmptyStateAction } from './EmptyState'

export { DataState } from './DataState'
export type { DataStateProps } from './DataState'
export { LoadingErrorState } from './DataState'
export type { LoadingErrorStateProps } from './DataState'
export { LoadingEmptyState } from './DataState'
export type { LoadingEmptyStateProps } from './DataState'

// 基础 UI 组件
export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from './Card'

export { Input } from './Input'

export { Label } from './Label'

export { Select, SelectItem } from './Select'

export { RadioGroup, Radio } from './Radio'
export type { RadioGroupProps, RadioProps } from './Radio'

export { Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'

export { Menu, MenuItem, SubMenu } from './Menu'
export type { MenuProps, MenuItemProps, SubMenuProps } from './Menu'

export { DatePicker } from './DatePicker'
export type { DatePickerProps } from './DatePicker'

export { Badge } from './Badge'

export { Skeleton } from './Skeleton'

export { Progress } from './Progress'

export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs'

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table'

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './Breadcrumb'

export { Checkbox } from './Checkbox'

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog'

export { Separator } from './Separator'

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './Sheet'

export { Slider } from './Slider'

export { Switch } from './Switch'

export { Textarea } from './Textarea'

export { Toggle } from './Toggle'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

// 增强 UI 组件
export { Popover } from './Popover'
export type { PopoverProps, PopoverPlacement, PopoverTrigger } from './Popover'

// 警告提示组件 (P1)
export { Alert, AlertTitle, AlertDescription } from './Alert'
export type { AlertProps, AlertTitleProps, AlertDescriptionProps } from './Alert'

export { Grid, Row, Col } from './Grid'
export type { GridProps, RowProps, ColProps } from './Grid'

export { Result } from './Result'
export type { ResultProps, ResultStatus } from './Result'

export { List, ListItem } from './List'
export type { ListProps, ListItemProps } from './List'
