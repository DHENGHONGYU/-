/**
 * 配置管理应用
 *
 * 功能：展示和修改系统配置项（交易配置、数据采集配置、显示配置）
 * 存储：所有配置保存在 localStorage，变更即时生效
 * 数据流：ConfigApp <-> localStorage
 *
 * @see docs/《功能模块数据契约》.md — 18. ConfigApp 模块契约（配置管理页）
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md — AppConfig 类型定义
 * @see docs/implementation/v9-system-blueprint.md — Phase 7 总控舱功能扩展
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Switch } from '@/components/ui/Switch'
import { Select, SelectItem } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'

// ============================================================
// 类型定义
// ============================================================

const STORAGE_KEY = 'v9-app-config'

interface AppConfig {
  // 交易配置
  portfolioValue: number
  maxSinglePositionPct: number
  maxDailyLossPct: number
  stopLossPct: number
  enablePaperTrading: boolean

  // 数据采集配置
  refreshInterval: number // 秒
  autoRefresh: boolean

  // 显示配置
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
}

const DEFAULT_CONFIG: AppConfig = {
  portfolioValue: 1_000_000,
  maxSinglePositionPct: 25,
  maxDailyLossPct: 3,
  stopLossPct: 7,
  enablePaperTrading: true,
  refreshInterval: 60,
  autoRefresh: true,
  theme: 'system',
  language: 'zh',
}

const REFRESH_INTERVAL_OPTIONS = [
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 300, label: '5 分钟' },
  { value: 900, label: '15 分钟' },
]

const THEME_OPTIONS = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
  { value: 'system', label: '跟随系统' },
]

const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
]

// ============================================================
// localStorage 工具
// ============================================================

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch {
    // 解析失败，使用默认值
  }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// ============================================================
// 主题即时应用
// ============================================================

function applyTheme(theme: AppConfig['theme']): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system: 跟随系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

// ============================================================
// ConfigApp 组件
// ============================================================

export default function ConfigApp(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig>(loadConfig)
  const [saved, setSaved] = useState(false)

  // 初始化时应用主题
  useEffect(() => {
    applyTheme(config.theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 监听系统主题变化（当 theme 为 system 时）
  useEffect(() => {
    if (config.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [config.theme])

  const updateField = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value }
      saveConfig(next)

      // 主题变更即时生效
      if (key === 'theme') {
        applyTheme(value as AppConfig['theme'])
      }

      setSaved(true)
      // 2 秒后隐藏保存成功提示
      setTimeout(() => setSaved(false), 2000)
      return next
    })
  }, [])

  const handleResetToDefault = useCallback(() => {
    if (!confirm('确定要将所有配置恢复为默认值吗？')) return
    const defaults = { ...DEFAULT_CONFIG }
    setConfig(defaults)
    saveConfig(defaults)
    applyTheme(defaults.theme)
  }, [])

  return (
    <div className="space-y-4 p-4">
      {/* 面包屑 */}
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
              <Link to="/command">总控舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>配置管理</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 + 操作 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">配置管理</h1>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-sm text-green-600">已自动保存</span>
          )}
          <Button variant="outline" size="sm" onClick={handleResetToDefault}>
            恢复默认
          </Button>
        </div>
      </div>

      {/* 交易配置组 */}
      <Card>
        <CardHeader>
          <CardTitle>交易配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 组合总资金 */}
            <div className="space-y-2">
              <Label htmlFor="portfolioValue">组合总资金（元）</Label>
              <Input
                id="portfolioValue"
                type="number"
                min={0}
                step={10000}
                value={config.portfolioValue}
                onChange={(e) => updateField('portfolioValue', Number(e.target.value))}
              />
            </div>

            {/* 单股最大仓位百分比 */}
            <div className="space-y-2">
              <Label htmlFor="maxSinglePositionPct">单股最大仓位百分比（%）</Label>
              <Input
                id="maxSinglePositionPct"
                type="number"
                min={1}
                max={100}
                step={1}
                value={config.maxSinglePositionPct}
                onChange={(e) => updateField('maxSinglePositionPct', Number(e.target.value))}
              />
            </div>

            {/* 单日最大亏损百分比 */}
            <div className="space-y-2">
              <Label htmlFor="maxDailyLossPct">单日最大亏损百分比（%）</Label>
              <Input
                id="maxDailyLossPct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={config.maxDailyLossPct}
                onChange={(e) => updateField('maxDailyLossPct', Number(e.target.value))}
              />
            </div>

            {/* 止损阈值百分比 */}
            <div className="space-y-2">
              <Label htmlFor="stopLossPct">止损阈值百分比（%）</Label>
              <Input
                id="stopLossPct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={config.stopLossPct}
                onChange={(e) => updateField('stopLossPct', Number(e.target.value))}
              />
            </div>
          </div>

          {/* 是否启用模拟交易 */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="enablePaperTrading">启用模拟交易</Label>
            <Switch
              id="enablePaperTrading"
              checked={config.enablePaperTrading}
              onChange={(e) => updateField('enablePaperTrading', e.target.checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 数据采集配置组 */}
      <Card>
        <CardHeader>
          <CardTitle>数据采集配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 数据刷新间隔 */}
            <div className="space-y-2">
              <Label htmlFor="refreshInterval">数据刷新间隔</Label>
              <Select
                id="refreshInterval"
                value={String(config.refreshInterval)}
                onChange={(e) => updateField('refreshInterval', Number(e.target.value))}
              >
                {REFRESH_INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 是否自动刷新 */}
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <Label htmlFor="autoRefresh">自动刷新数据</Label>
              <Switch
                id="autoRefresh"
                checked={config.autoRefresh}
                onChange={(e) => updateField('autoRefresh', e.target.checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 显示配置组 */}
      <Card>
        <CardHeader>
          <CardTitle>显示配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 主题 */}
            <div className="space-y-2">
              <Label htmlFor="theme">主题</Label>
              <Select
                id="theme"
                value={config.theme}
                onChange={(e) => updateField('theme', e.target.value as AppConfig['theme'])}
              >
                {THEME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 语言 */}
            <div className="space-y-2">
              <Label htmlFor="language">语言</Label>
              <Select
                id="language"
                value={config.language}
                onChange={(e) => updateField('language', e.target.value as AppConfig['language'])}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
