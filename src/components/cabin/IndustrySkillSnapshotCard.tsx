import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { SectorSkillAnalysis } from '@/data/sectorSkillData'

interface Props {
  sector: SectorSkillAnalysis
}

/**
 * IndustrySkillSnapshotCard
 */
export function IndustrySkillSnapshotCard({ sector }: Props): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>已有 SKILL 量化评分快照</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">十五五导向</p>
            <p className="text-xs text-muted-foreground">规划契合: {sector.planAlignment.score}</p>
            <p className="text-xs text-muted-foreground">政策支持: {sector.policySupport.score}</p>
            <p className="text-xs text-muted-foreground">中美对标: {sector.usChinaParity.score}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">SKILL-C 四维加权</p>
            <p className="text-xs text-muted-foreground">技术进步: {sector.skillC.techAdvancement.score}</p>
            <p className="text-xs text-muted-foreground">结构稀缺: {sector.skillC.structuralScarcity.score}</p>
            <p className="text-xs text-muted-foreground">国产壁垒: {sector.skillC.localizationBarrier.score}</p>
            <p className="text-xs text-muted-foreground">超车潜力: {sector.skillC.overtakingPotential.score}</p>
            <p className="text-xs font-medium">综合: {sector.skillC.composite} ({sector.skillC.grade})</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">SKILL-A 双维度量表</p>
            <p className="text-xs text-muted-foreground">核心价值: {sector.skillA.coreValue.score}</p>
            <p className="text-xs text-muted-foreground">稀缺价值: {sector.skillA.scarcityValue.score}</p>
            <p className="text-xs font-medium">定位: {sector.skillA.matrixPosition}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
