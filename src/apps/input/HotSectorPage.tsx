/**
 * @fileoverview 输入舱 - 来源一：热门板块推荐独立页
 *
 * 将原 InputDashboard 内的「热门板块纳入」Tab 独立为整页（spec 2.4.15 双源输入）。
 * 用户在此浏览最新热门板块评分，一键将板块核心标的纳入意向候选池，
 * 纳入的标的以 screenSource='hot-sector' 标记（来源一）。
 *
 * @module apps/input/HotSectorPage
 * @see src/apps/input/HotSectorSection.tsx — 核心区块（板块勾选 + 成分股选择 + 批量加入）
 * @see src/services/input/hotSectorService.ts — 热门板块检索与纳入服务
 */
import React from 'react'
import { Link } from 'react-router'
import { Flame } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { Button } from '@/components/atoms/Button'
import { PageContainer, PageHeader } from '@/components/templates'
import HotSectorSection from './HotSectorSection'

/**
 * HotSectorPage —— 输入舱「来源一：热门板块核心标的」独立页
 */
export default function HotSectorPage(): React.JSX.Element {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/input">输入舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>热门板块推荐</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="热门板块推荐"
        description="来源一：热门板块核心标的 —— 按考核标准（五因子评分）抽取 15-20 只代表股，仅采用近一周评分，一键纳入意向候选池"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/input">
              <Flame className="mr-1.5 h-3.5 w-3.5" />
              来源二：自定义检索
            </Link>
          </Button>
        }
      />

      <HotSectorSection />
    </PageContainer>
  )
}
