/**
 * @fileoverview Breadcrumb Atom层组件（Atom层组件）
 * @module components/atoms/Breadcrumb
 *
 * V10: 新增 AutoBreadcrumb — 自动从路由注册表生成面包屑，支持废弃路由降级提示
 */

import { ChevronRight, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cloneElement, forwardRef, isValidElement, useMemo, type HTMLAttributes } from 'react'
import { useLocation, Link } from 'react-router'
import { getBreadcrumbs } from '@/config/routes'

/**
 * Breadcrumb
 */
export const Breadcrumb = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} aria-label="breadcrumb" className={cn('flex', className)} {...props} />
  ),
)
Breadcrumb.displayName = 'Breadcrumb'

/**
 * BreadcrumbList
 */
export const BreadcrumbList = forwardRef<HTMLOListElement, HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5',
        className,
      )}
      {...props}
    />
  ),
)
BreadcrumbList.displayName = 'BreadcrumbList'

/**
 * BreadcrumbItem
 */
export const BreadcrumbItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('inline-flex items-center gap-1.5 sm:gap-2.5', className)} {...props} />
  ),
)
BreadcrumbItem.displayName = 'BreadcrumbItem'

export interface BreadcrumbLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean
}

/**
 * BreadcrumbLink
 */
export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const classes = cn('transition-colors hover:text-foreground', className)

    if (asChild && isValidElement(children)) {
      return cloneElement(children, {
        className: cn(classes, (children.props as { className?: string }).className),
        ref,
        ...props,
      } as never)
    }

    return (
      <a ref={ref} className={classes} {...props}>
        {children}
      </a>
    )
  },
)
BreadcrumbLink.displayName = 'BreadcrumbLink'

/**
 * BreadcrumbPage
 */
export const BreadcrumbPage = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  ),
)
BreadcrumbPage.displayName = 'BreadcrumbPage'

/**
 * BreadcrumbSeparator
 */
export const BreadcrumbSeparator = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
      {...props}
    >
      <ChevronRight />
    </li>
  ),
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

/**
 * BreadcrumbEllipsis
 */
export const BreadcrumbEllipsis = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More</span>
    </span>
  ),
)
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis'

// ============================================================
// V10: AutoBreadcrumb — 自动路由感知面包屑
// ============================================================

/**
 * AutoBreadcrumb
 *
 * 从 ROUTE_REGISTRY 自动生成面包屑导航，无需手动传入路径段。
 * 废弃路由自动显示降级提示（⚠️ 已迁移至 …）。
 *
 * 用法：
 * <AutoBreadcrumb className="px-4 py-2" />
 */
export function AutoBreadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>): React.JSX.Element {
  const { pathname } = useLocation()
  const segments = useMemo(() => getBreadcrumbs(pathname), [pathname])

  // 首页不需要面包屑
  if (segments.length <= 1) {
    return <nav className={cn('flex', className)} {...props} />
  }

  return (
    <Breadcrumb className={className} {...props}>
      <BreadcrumbList>
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1

          return (
            <BreadcrumbItem key={segment.path}>
              {!isLast ? (
                <BreadcrumbLink asChild>
                  <Link to={segment.path} className="text-xs">
                    {segment.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-xs font-medium">
                  {segment.label}
                </BreadcrumbPage>
              )}

              {/* 废弃路由降级提示 */}
              {isLast && segment.deprecated && segment.redirectTo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning ml-1">
                  <AlertTriangle className="h-3 w-3" />
                  已迁移至{' '}
                  <Link
                    to={segment.redirectTo}
                    className="underline hover:text-warning/80"
                  >
                    {segment.redirectTo}
                  </Link>
                </span>
              )}

              {!isLast && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
