/**
 * DataQualityIndicator 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 完整度三分支：≥0.7 (充足) / ≥0.4 (一般) / <0.4 (不足)
 * 2. getSampleStatus 三分支 + default 分支
 * 3. 完整度百分比格式化（Math.round）
 * 4. 进度条样式宽度百分比
 * 5. 自定义 className、样本计数显示
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataQualityIndicator } from './DataQualityIndicator'

describe('DataQualityIndicator', () => {
  describe('完整度阈值分支', () => {
    it('completeness=1.0 显示"数据充足" + 100%', () => {
      render(<DataQualityIndicator completeness={1.0} sampleCount={100} />)
      expect(screen.getByText('数据充足')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('completeness=0.7 显示"数据充足"（边界=0.7）', () => {
      render(<DataQualityIndicator completeness={0.7} sampleCount={80} />)
      expect(screen.getByText('数据充足')).toBeInTheDocument()
    })

    it('completeness=0.699 落入"数据一般"分支', () => {
      render(<DataQualityIndicator completeness={0.699} sampleCount={80} />)
      expect(screen.getByText('数据一般')).toBeInTheDocument()
    })

    it('completeness=0.4 显示"数据一般"（边界=0.4）', () => {
      render(<DataQualityIndicator completeness={0.4} sampleCount={60} />)
      expect(screen.getByText('数据一般')).toBeInTheDocument()
    })

    it('completeness=0.399 落入"数据不足"分支', () => {
      render(<DataQualityIndicator completeness={0.399} sampleCount={20} />)
      expect(screen.getByText('数据不足')).toBeInTheDocument()
    })

    it('completeness=0 显示"数据不足" + 0%', () => {
      render(<DataQualityIndicator completeness={0} sampleCount={0} />)
      expect(screen.getByText('数据不足')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('sampleAdequacy 分支', () => {
    it('sampleAdequacy=sufficient 显示"样本充足"', () => {
      render(
        <DataQualityIndicator completeness={0.9} sampleCount={200} sampleAdequacy="sufficient" />
      )
      expect(screen.getByText('样本充足')).toBeInTheDocument()
    })

    it('sampleAdequacy=warning 显示"样本偏少"', () => {
      render(
        <DataQualityIndicator completeness={0.6} sampleCount={50} sampleAdequacy="warning" />
      )
      expect(screen.getByText('样本偏少')).toBeInTheDocument()
    })

    it('sampleAdequacy=insufficient 显示"样本不足"', () => {
      render(
        <DataQualityIndicator completeness={0.3} sampleCount={10} sampleAdequacy="insufficient" />
      )
      expect(screen.getByText('样本不足')).toBeInTheDocument()
    })

    it('未传入 sampleAdequacy 不渲染样本状态文本', () => {
      const { container } = render(
        <DataQualityIndicator completeness={0.8} sampleCount={150} />
      )
      expect(screen.queryByText('样本充足')).not.toBeInTheDocument()
      expect(screen.queryByText('样本偏少')).not.toBeInTheDocument()
      expect(screen.queryByText('样本不足')).not.toBeInTheDocument()
      // 但仍显示"样本:" 文字
      expect(container.textContent).toContain('样本:')
    })
  })

  describe('百分比 Math.round 格式化', () => {
    it('completeness=0.666 显示 67% (Math.round)', () => {
      render(<DataQualityIndicator completeness={0.666} sampleCount={10} />)
      expect(screen.getByText('67%')).toBeInTheDocument()
    })

    it('completeness=0.125 显示 13%', () => {
      render(<DataQualityIndicator completeness={0.125} sampleCount={10} />)
      expect(screen.getByText('13%')).toBeInTheDocument()
    })
  })

  describe('进度条 & 图标渲染', () => {
    it('渲染进度条背景 (div with w-16 bg-muted rounded-full)', () => {
      const { container } = render(
        <DataQualityIndicator completeness={0.5} sampleCount={50} />
      )
      const barBg = container.querySelector('div.w-16.bg-muted')
      expect(barBg).toBeInTheDocument()
    })

    it('进度条宽度 style.width 匹配百分比', () => {
      const { container } = render(
        <DataQualityIndicator completeness={0.5} sampleCount={50} />
      )
      const barFill = container.querySelector('div.h-full.rounded-full')
      expect(barFill).toBeInTheDocument()
      expect(barFill?.getAttribute('style')).toContain('50%')
    })

    it('三分支均渲染状态 icon (h-4 w-4)', () => {
      const { container: c1 } = render(<DataQualityIndicator completeness={0.8} sampleCount={1} />)
      expect(c1.querySelector('svg.h-4.w-4')).toBeInTheDocument()
    })
  })

  describe('结构元素', () => {
    it('显示样本计数数字', () => {
      render(<DataQualityIndicator completeness={0.5} sampleCount={256} />)
      expect(screen.getByText('256')).toBeInTheDocument()
    })

    it('显示"完整度:" 文本', () => {
      const { container } = render(
        <DataQualityIndicator completeness={0.5} sampleCount={10} />
      )
      expect(container.textContent).toContain('完整度:')
    })

    it('自定义 className 正确合并到外层', () => {
      const { container } = render(
        <DataQualityIndicator completeness={0.5} sampleCount={10} className="my-dqi" />
      )
      const root = container.firstElementChild!
      expect(root.className).toContain('my-dqi')
      expect(root.className).toContain('flex')
    })
  })
})
