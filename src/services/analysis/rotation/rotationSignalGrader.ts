import { SIGNAL_GRADES } from '@/config/rotationConfig'
import type { RotationSignalGrade } from '@/data/types'

export function getSignalGrade(resonance: number): RotationSignalGrade {
  return (
    SIGNAL_GRADES.find((g) => resonance >= g.minResonance && resonance <= g.maxResonance) ?? SIGNAL_GRADES[4]
  ) as RotationSignalGrade
}
