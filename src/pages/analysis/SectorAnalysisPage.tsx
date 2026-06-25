import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function SectorAnalysisPage(): React.JSX.Element {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>行业与板块分析</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            板块轮动与行业评分模块（待实现）
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
