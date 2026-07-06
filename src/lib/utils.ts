import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * 将 HEX 颜色值转换为带透明度的 RGBA 字符串
 * @param hex HEX 颜色值（如 #ef4444 或 ef4444）
 * @param alpha 透明度（0-1，默认 1）
 * @returns RGBA 字符串（如 rgba(239, 68, 68, 0.5)）
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const normalized = hex.replace(/^#/, '')
  const fullHex = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized
  const r = parseInt(fullHex.slice(0, 2), 16)
  const g = parseInt(fullHex.slice(2, 4), 16)
  const b = parseInt(fullHex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
