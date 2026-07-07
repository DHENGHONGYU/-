/**
 * V9 模块 Mock 验证页面
 * 路径: /mock-test
 * 用途: 手动/自动化验证 Slider、Sheet、Toggle、Engine 的实际渲染与交互效果
 */
import { useState } from 'react'
import { Slider } from '@/components/ui/Slider'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'


// Mock EngineStore 用于可视化 Engine 状态
const useMockEngineStore = create<{
  started: boolean
  channels: number
  agents: number
  toggle: () => void
}>((set) => ({
  started: false,
  channels: 0,
  agents: 0,
  toggle: () => set((s) => ({ started: !s.started })),
}))

export default function MockTestPage() {
  const [sliderVal, setSliderVal] = useState(50)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toggleVal, setToggleVal] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])

  const { started, channels, agents, toggle: engineToggle } = useMockEngineStore()

  const addLog = (msg: string) => {
    setLogLines((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const handleSliderChange = (v: number) => {
    setSliderVal(v)
    addLog(`Slider → ${v}`)
  }

  const handleToggleChange = (v: boolean) => {
    setToggleVal(v)
    addLog(`Toggle → ${v ? 'ON' : 'OFF'}`)
  }

  const handleEngineToggle = () => {
    engineToggle()
    addLog(`Engine ${!started ? '启动' : '停止'}`)
    eventBus.emit(!started ? 'ENGINE_STARTED' : 'ENGINE_STOPPED', { timestamp: Date.now() })
  }

  return (
    <div className={`min-h-screen bg-background text-foreground p-8`}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* 页面标题 */}
        <div className="text-center">
          <h1 className={`text-3xl font-bold text-primary`}>V9 模块 Mock 验证页</h1>
          <p className={`text-muted-foreground mt-2`}>验证 Slider / Sheet / Toggle / Engine 的实际运行效果</p>
        </div>

        {/* 1. Slider 组件 */}
        <section className={`bg-card rounded-xl p-6 border-border`}>
          <h2 className={`text-xl font-semibold text-primary mb-4 flex items-center gap-2`}>
            <span>🎚️</span> Slider 滑动条组件
          </h2>

          <div className="space-y-4">
            <Label htmlFor="test-slider" className="text-foreground">
              选择数值（范围 0–100，步进 5）
            </Label>

            <Slider
              id="test-slider"
              data-testid="mock-slider"
              min={0}
              max={100}
              step={5}
              value={sliderVal}
              showTooltip
              onValueChange={handleSliderChange}
              className="w-full max-w-md"
            />

            <div className="flex items-center gap-4">
              <div className={`bg-muted px-6 py-3 rounded-lg text-2xl font-bold text-success`}>
                {sliderVal}
              </div>
              <span className="text-muted-foreground">← 当前 Slider 值</span>
            </div>

            {/* 快捷预设 */}
            <div className="flex gap-2 flex-wrap">
              {[0, 25, 50, 75, 100].map((v) => (
                <Button
                  key={v}
                  variant={sliderVal === v ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleSliderChange(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Sheet 侧边抽屉 */}
        <section className={`bg-card rounded-xl p-6 border-border`}>
          <h2 className={`text-xl font-semibold text-primary mb-4 flex items-center gap-2`}>
            <span>📋</span> Sheet 侧边抽屉组件
          </h2>

          <div className="flex gap-4">
            {(['right', 'left', 'top', 'bottom'] as const).map((side) => (
              <Button
                key={side}
                variant="outline"
                onClick={() => { setSheetOpen(true); addLog(`Sheet 打开（${side}）`) }}
              >
                打开 {side === 'right' ? '右' : side === 'left' ? '左' : side === 'top' ? '上' : '下'}
              </Button>
            ))}
          </div>

          <Sheet open={sheetOpen} onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) addLog('Sheet 已关闭')
          }}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>测试面板</SheetTitle>
              </SheetHeader>
              <div className={`mt-4 space-y-3 text-foreground`}>
                <p>这是 Sheet 抽屉的内容。</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>支持 ESC 关闭</li>
                  <li>点击遮罩关闭</li>
                  <li>四向滑出动画</li>
                </ul>
                <div className="pt-4">
                  <Button
                    variant="outline"
                    onClick={() => { setSheetOpen(false); addLog('Sheet 手动关闭') }}
                  >
                    关闭抽屉
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </section>

        {/* 3. Toggle 开关 */}
        <section className={`bg-card rounded-xl p-6 border-border`}>
          <h2 className={`text-xl font-semibold text-primary mb-4 flex items-center gap-2`}>
            <span>🔘</span> Toggle 开关组件
          </h2>

          <div className="flex items-center gap-6">
            <Toggle
              data-testid="mock-toggle"
              pressed={toggleVal}
              onPressedChange={handleToggleChange}
              variant="default"
            >
              {toggleVal ? '开启 ✓' : '关闭'}
            </Toggle>

            <Toggle
              pressed={!toggleVal}
              onPressedChange={(v) => handleToggleChange(!v)}
              variant="outline"
            >
              反向 Toggle
            </Toggle>

            <span className={`text-muted-foreground text-sm`}>
              当前状态: <span className={toggleVal ? 'text-success' : 'text-tertiary'}>
                {toggleVal ? 'ON' : 'OFF'}
              </span>
            </span>
          </div>
        </section>

        {/* 4. Engine Mock 状态 */}
        <section className={`bg-card rounded-xl p-6 border-border`}>
          <h2 className={`text-xl font-semibold text-primary mb-4 flex items-center gap-2`}>
            <span>⚙️</span> Engine 模块状态（Mock）
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className={`bg-muted rounded-lg p-4 text-center`}>
              <div className={`text-2xl font-bold text-success`}>{started ? '运行中' : '已停止'}</div>
              <div className={`text-xs text-muted-foreground mt-1`}>Engine 状态</div>
            </div>
            <div className={`bg-muted rounded-lg p-4 text-center`}>
              <div className={`text-2xl font-bold text-info`}>{channels}</div>
              <div className={`text-xs text-muted-foreground mt-1`}>DataFlow 通道</div>
            </div>
            <div className={`bg-muted rounded-lg p-4 text-center`}>
              <div className={`text-2xl font-bold text-warning`}>{agents}</div>
              <div className={`text-xs text-muted-foreground mt-1`}>Agent 实例</div>
            </div>
          </div>

          <Button
            variant={started ? 'danger' : 'primary'}
            onClick={handleEngineToggle}
          >
            {started ? '⏹ 停止 Engine' : '▶ 启动 Engine'}
          </Button>
        </section>

        {/* 5. 事件日志 */}
        <section className={`bg-card rounded-xl p-6 border-border`}>
          <h2 className={`text-xl font-semibold text-primary mb-4 flex items-center gap-2`}>
            <span>📝</span> 实时事件日志
          </h2>
          <div className={`bg-background rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm space-y-1`}>
            {logLines.length === 0 ? (
              <div className="text-tertiary">Interact with components above to see events here...</div>
            ) : (
              logLines.map((line, i) => (
                <div key={i} className={line.includes('→') ? 'text-success' : 'text-info'}>
                  {line}
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
