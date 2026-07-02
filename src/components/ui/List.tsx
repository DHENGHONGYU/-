import { type HTMLAttributes, type ReactNode, forwardRef, memo } from 'react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic default for flexible component typing
export interface ListProps<T = any> extends Omit<HTMLAttributes<HTMLDivElement>, 'dataSource' | 'renderItem'> {
  /** 数据源 */
  dataSource?: T[]
  /** 渲染函数 */
  renderItem?: (item: T, index: number) => ReactNode
  /** 是否加载中 */
  loading?: boolean
  /** 错误信息 */
  error?: ReactNode
  /** 空状态描述 */
  empty?: ReactNode
}

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  /** 操作列表 */
  actions?: ReactNode
  /** 额外内容 */
  extra?: ReactNode
}

export const ListItem = memo(forwardRef<HTMLDivElement, ListItemProps>(
  ({ className, actions, extra, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between py-3 px-4 border-b last:border-b-0',
        className,
      )}
      {...props}
    >
      <div className="flex-1">{children}</div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
      {extra && <div className="ml-4">{extra}</div>}
    </div>
  ),
))

ListItem.displayName = 'ListItem'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic type for component cast
type ListComponent = (<T = any>(props: ListProps<T> & { ref?: React.Ref<HTMLDivElement> }) => ReactNode) & {
  Item: typeof ListItem
  displayName: string
}

const ListInner = memo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic component internal cast
forwardRef<HTMLDivElement, ListProps<any>>(
    ({ className, dataSource = [], renderItem, loading, error, empty, ...props }, ref) => {
      if (loading) {
        return (
          <div ref={ref} className={cn('py-8 text-center text-muted-foreground', className)} {...props}>
            加载中...
          </div>
        )
      }

      if (error) {
        return (
          <div ref={ref} className={cn('py-8 text-center text-destructive', className)} {...props}>
            {error}
          </div>
        )
      }

      if (dataSource.length === 0) {
        return (
          <div ref={ref} className={cn('py-8 text-center text-muted-foreground', className)} {...props}>
            {empty ?? '暂无数据'}
          </div>
        )
      }

      return (
        <div ref={ref} className={cn('', className)} {...props}>
          {dataSource.map((item, index) => (
            <div key={index}>
              {renderItem ? renderItem(item, index) : String(item)}
            </div>
          ))}
        </div>
      )
    },
  ),
)

ListInner.displayName = 'List'

export const List = ListInner as unknown as ListComponent
List.Item = ListItem
List.displayName = 'List'
