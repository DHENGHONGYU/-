import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function BacktestPage(): React.JSX.Element {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>策略回测</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            历史数据策略验证模块（待实现）
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
