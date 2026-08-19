/**
 * Template 层注册表 — 页面级布局
 * @doc [V9-DOC-FRONT-046]
 */
import type { ComponentEntry } from './registryTypes'

export const TEMPLATE_REGISTRY: ComponentEntry[] = [
  { name: 'PageContainer', level: 'template', sourcePath: 'src/components/templates/PageContainer.tsx', targetPath: 'src/components/templates/PageContainer.tsx', status: 'active', description: '页面内容容器', consumers: ['全页面通用', 'SidebarLayout', 'DashboardLayout'] }
]
