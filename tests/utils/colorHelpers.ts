/**
 * @fileoverview 颜色转换工具
 * @description 提供 HEX/RGB 转换函数，避免在测试文件中重复定义
 */

/**
 * 将 HEX 颜色转换为 RGB 格式
 * @param hex HEX 颜色值（如 '#ef4444'）
 * @returns RGB 格式字符串（如 'rgb(239, 68, 68)'）
 * @example hexToRgb('#ef4444') => 'rgb(239, 68, 68)'
 */
export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * 将 RGB 字符串转换为 HEX 格式
 * @param rgb RGB 格式字符串（如 'rgb(239, 68, 68)'）
 * @returns HEX 颜色值（如 '#ef4444'）
 * @example rgbToHex('rgb(239, 68, 68)') => '#ef4444'
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) throw new Error(`Invalid RGB format: ${rgb}`)
  const r = parseInt(match[1]!, 10)
  const g = parseInt(match[2]!, 10)
  const b = parseInt(match[3]!, 10)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
