/**
 * HotS 板块独立页（输入舱子页面）
 *
 * 从「录入看板」Tab 拆分出的独立路由页：
 * 与录入看板内的「自行意向输入」形成两个并列的标的来源入口，
 * 二者筛选出的股票都注入同一张「意向输入池」（/input/intention-pool）。
 *
 * 页面复用 HotSectorSection 的全部交互逻辑（板块多选 / 代表股抽取 / 批量纳入），
 * 仅在外层补充页面级标题与「前往意向输入池」跳转。
 *
 * @module apps/input/HotSectorPage
 */

import React from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { PageContainer, PageHeader } from '@/components/templates'
import { ArrowRight } from 'lucide-react'
import HotSectorSection from './HotSectorSection'

export default function HotSectorPage(): React.JSX.Element {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="热门板块"
        description="从热门赛道（五因子评分）筛选代表股，批量纳入意向候选池"
        actions={
          <Link to="/input/intention-pool">
            <Button variant="outline" size="sm" className="shadow-sm">
              意向输入池
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />
      <HotSectorSection />
    </PageContainer>
  )
}
