/**
 * @doc [V9-DOC-PROJ-113, V9-DOC-PROJ-079, V9-DOC-BACK-004, V9-DOC-PROJ-066, V9-DOC-PROD-001]
 */
import { SIGNAL_GRADES } from '@/config/rotationConfig'
import type { RotationSignalGrade } from '@/data/types'

/**
 * getSignalGrade
 * @param resonance
 * @returns RotationSignalGrade
 */
export function getSignalGrade(resonance: number): RotationSignalGrade {
  return (
    SIGNAL_GRADES.find((g) => resonance >= g.minResonance && resonance <= g.maxResonance) ?? SIGNAL_GRADES[4]
  ) as RotationSignalGrade
}
