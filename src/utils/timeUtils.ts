/**
 * 统一时间处理工具
 * v0.9.11 P2-DATA001
 * 规范：所有时间戳以 UTC 存储，显示时转换至 Asia/Shanghai (UTC+8)
 * 库：dayjs + utc 插件 + timezone 插件
 */
import * as dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isBetween from 'dayjs/plugin/isBetween'
import 'dayjs/locale/zh-cn'

// 注册插件
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(isBetween)

// 默认时区
const DEFAULT_TIMEZONE = 'Asia/Shanghai'
dayjs.locale('zh-cn')

/**
 * 获取当前时间戳（毫秒，UTC）
 */
export function now(): number {
  return Date.now()
}

/**
 * 格式化时间（UTC → Asia/Shanghai）
 */
export function formatTime(
  timestamp: number | string | Date | undefined | null,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!timestamp) return '--'
  return dayjs(timestamp).tz(DEFAULT_TIMEZONE).format(format)
}

/**
 * 格式化日期（无时间）
 */
export function formatDate(
  timestamp: number | string | Date | undefined | null,
  format = 'YYYY-MM-DD',
): string {
  return formatTime(timestamp, format)
}

/**
 * 格式化相对时间（如"3分钟前"）
 */
export function formatRelativeTime(timestamp: number | string | Date | undefined | null): string {
  if (!timestamp) return '--'
  return dayjs(timestamp).tz(DEFAULT_TIMEZONE).fromNow()
}

/**
 * 判断是否在今天
 */
export function isToday(timestamp: number | string | Date | undefined | null): boolean {
  if (!timestamp) return false
  return dayjs(timestamp).tz(DEFAULT_TIMEZONE).isSame(dayjs().tz(DEFAULT_TIMEZONE), 'day')
}

/**
 * 判断是否在指定日期范围
 */
export function isInRange(
  timestamp: number | string | Date | undefined | null,
  start: number | string | Date,
  end: number | string | Date,
): boolean {
  if (!timestamp) return false
  return dayjs(timestamp).tz(DEFAULT_TIMEZONE).isBetween(start, end, 'day', '[]')
}

/**
 * 解析日期字符串（兼容多种格式）
 */
export function parseTime(value: string | number | Date): dayjs.Dayjs | null {
  const d = dayjs(value)
  return d.isValid() ? d : null
}

/**
 * 格式化股票交易日（格式：09:30:00）
 */
export function formatTradeTime(timestamp: number | string | Date | undefined | null): string {
  return formatTime(timestamp, 'HH:mm:ss')
}

// 交易日常量
export const TRADE_TIME = {
  MARKET_OPEN: '09:30:00',
  MARKET_CLOSE: '15:00:00',
  BREAK_START: '11:30:00',
  BREAK_END: '12:30:00',
} as const

// 时区常量
export const TIMEZONE = {
  UTC: 'UTC',
  SHANGHAI: 'Asia/Shanghai',
  HONGKONG: 'Asia/Hong_Kong',
  NEW_YORK: 'America/New_York',
} as const
