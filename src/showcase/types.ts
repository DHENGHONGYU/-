/**
 * @doc [V9-DOC-QA-066]
 */
import { LucideIcon } from 'lucide-react'

export interface ShowcaseItem {
  id: string
  title: string
  description?: string
  component: React.ReactNode
  codeSnippet?: string
}

export interface ShowcaseGroup {
  id: string
  title: string
  icon: LucideIcon
  items: ShowcaseItem[]
}
