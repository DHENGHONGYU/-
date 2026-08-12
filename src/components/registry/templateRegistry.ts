/**
 * Template 层注册表 — 页面级布局
 * @doc [V9-DOC-FRONT-046]
 */
import type { ComponentEntry } from './registryTypes'

export const TEMPLATE_REGISTRY: ComponentEntry[] = [
  { name: 'PageContainer', level: 'template', sourcePath: 'src/components/templates/PageContainer.tsx', targetPath: 'src/components/templates/PageContainer.tsx', status: 'active', description: '页面内容容器', consumers: ['全页面通用', 'SidebarLayout', 'DashboardLayout'] },
  { name: 'DashboardLayout', level: 'template', sourcePath: 'src/components/templates/DashboardLayout.tsx', targetPath: 'src/components/templates/DashboardLayout.tsx', status: 'active', description: '仪表盘布局', consumers: ['DashboardPage', 'HealthDashboardPage', 'OutputHubPage'] },
  { name: 'SidebarLayout', level: 'template', sourcePath: 'src/components/templates/SidebarLayout.tsx', targetPath: 'src/components/templates/SidebarLayout.tsx', status: 'active', description: '侧边栏布局', consumers: ['全页面通用', 'PageContainer', 'CockpitLayout'] },
  { name: 'CockpitLayout', level: 'template', sourcePath: 'src/components/templates/CockpitLayout.tsx', targetPath: 'src/components/templates/CockpitLayout.tsx', status: 'active', description: '驾驶舱布局', consumers: ['CockpitShell', 'HomePage', 'PortalShell'] },
]
