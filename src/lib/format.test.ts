import { describe, it, expect } from "vitest"
import {
  formatFieldValue,
  formatRelativeTime,
  safeFormatNumber,
  safeFormatPercent,
  safeFormatInt,
  isValidNumber,
} from "./format"

describe("formatFieldValue()", () => {
  it("undefined/null 返回 —", () => {
    expect(formatFieldValue(undefined)).toBe("—")
    expect(formatFieldValue(null)).toBe("—")
  })
  it("数字转为字符串", () => {
    expect(formatFieldValue(42)).toBe("42")
    expect(formatFieldValue(0)).toBe("0")
    expect(formatFieldValue(-3.14)).toBe("-3.14")
  })
  it("字符串原值返回", () => {
    expect(formatFieldValue("hello")).toBe("hello")
    expect(formatFieldValue("")).toBe("")
  })
  it("布尔值转为字符串", () => {
    expect(formatFieldValue(true)).toBe("true")
    expect(formatFieldValue(false)).toBe("false")
  })
  it("bigint 转为字符串", () => {
    expect(formatFieldValue(BigInt(123))).toBe("123")
  })
  it("symbol 转为字符串", () => {
    expect(formatFieldValue(Symbol("test"))).toBe("Symbol(test)")
  })
  it("对象调用 String()", () => {
    expect(formatFieldValue({})).toBe("[object Object]")
    expect(formatFieldValue([1, 2, 3])).toBe("1,2,3")
  })
})

describe("formatRelativeTime()", () => {
  it("未来时间戳 → 未来", () => {
    const now = Date.now()
    expect(formatRelativeTime(now + 1)).toBe("未来")
    expect(formatRelativeTime(now + 60_000)).toBe("未来")
    expect(formatRelativeTime(now + 3_600_000)).toBe("未来")
    expect(formatRelativeTime(now + 86_400_000)).toBe("未来")
  })
  it("未来边界 diff=-1ms → 未来", () => {
    expect(formatRelativeTime(Date.now() + 1)).toBe("未来")
  })
  it("当前时间戳 → 刚刚", () => {
    expect(formatRelativeTime(Date.now())).toBe("刚刚")
  })
  it("1 秒前 → 刚刚", () => {
    expect(formatRelativeTime(Date.now() - 1_000)).toBe("刚刚")
  })
  it("59 秒前 → 刚刚", () => {
    expect(formatRelativeTime(Date.now() - 59_999)).toBe("刚刚")
  })
  it("1 分钟前 → 1分钟前", () => {
    expect(formatRelativeTime(Date.now() - 60_000)).toBe("1分钟前")
  })
  it("5 分钟前 → 5分钟前", () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe("5分钟前")
  })
  it("1 小时前 → 1小时前", () => {
    expect(formatRelativeTime(Date.now() - 3_600_000)).toBe("1小时前")
  })
  it("3 小时前 → 3小时前", () => {
    expect(formatRelativeTime(Date.now() - 3 * 3_600_000)).toBe("3小时前")
  })
  it("1 天前 → 1天前", () => {
    expect(formatRelativeTime(Date.now() - 86_400_000)).toBe("1天前")
  })
  it("7 天前 → 7天前", () => {
    expect(formatRelativeTime(Date.now() - 7 * 86_400_000)).toBe("7天前")
  })
})

describe("safeFormatNumber()", () => {
  it("null → --", () => expect(safeFormatNumber(null, 2)).toBe("--"))
  it("undefined → --", () => expect(safeFormatNumber(undefined, 2)).toBe("--"))
  it("NaN → --", () => expect(safeFormatNumber(NaN, 2)).toBe("--"))
  it("Infinity → --", () => expect(safeFormatNumber(Infinity, 2)).toBe("--"))
  it("-Infinity → --", () => expect(safeFormatNumber(-Infinity, 2)).toBe("--"))
  it("正常 → toFixed", () => {
    expect(safeFormatNumber(3.14159, 2)).toBe("3.14")
    expect(safeFormatNumber(0, 2)).toBe("0.00")
    expect(safeFormatNumber(-3.14, 1)).toBe("-3.1")
  })
  it("自定义 fallback", () => {
    expect(safeFormatNumber(null, 2, "N/A")).toBe("N/A")
    expect(safeFormatNumber(NaN, 2, "N/A")).toBe("N/A")
  })
  it("decimals=0", () => {
    expect(safeFormatNumber(3.99, 0)).toBe("4")
    expect(safeFormatNumber(3.14, 0)).toBe("3")
  })
  it("默认 fallback", () => expect(safeFormatNumber(null, 0)).toBe("--"))
})

describe("safeFormatPercent()", () => {
  it("null → --", () => expect(safeFormatPercent(null)).toBe("--"))
  it("undefined → --", () => expect(safeFormatPercent(undefined)).toBe("--"))
  it("NaN → --", () => expect(safeFormatPercent(NaN)).toBe("--"))
  it("Infinity → --", () => expect(safeFormatPercent(Infinity)).toBe("--"))
  it("-Infinity → --", () => expect(safeFormatPercent(-Infinity)).toBe("--"))
  it("正数 → +前缀", () => {
    expect(safeFormatPercent(3.14)).toBe("+3.14%")
    expect(safeFormatPercent(0.5, 1)).toBe("+0.5%")
  })
  it("零 → 无前缀", () => expect(safeFormatPercent(0)).toBe("0.00%"))
  it("负数 → -前缀", () => {
    expect(safeFormatPercent(-2.5)).toBe("-2.50%")
    expect(safeFormatPercent(-0.1, 1)).toBe("-0.1%")
  })
  it("自定义 decimals", () => expect(safeFormatPercent(3.14159, 4)).toBe("+3.1416%"))
  it("自定义 fallback", () => {
    expect(safeFormatPercent(null, 2, "无数据")).toBe("无数据")
    expect(safeFormatPercent(NaN, 2, "无数据")).toBe("无数据")
  })
  it("默认值", () => {
    expect(safeFormatPercent(1.5)).toBe("+1.50%")
    expect(safeFormatPercent(null)).toBe("--")
  })
})

describe("safeFormatInt()", () => {
  it("null → --", () => expect(safeFormatInt(null)).toBe("--"))
  it("undefined → --", () => expect(safeFormatInt(undefined)).toBe("--"))
  it("NaN → --", () => expect(safeFormatInt(NaN)).toBe("--"))
  it("Infinity → --", () => expect(safeFormatInt(Infinity)).toBe("--"))
  it("正常 → 整数", () => {
    expect(safeFormatInt(42)).toBe("42")
    expect(safeFormatInt(3.99)).toBe("4")
    expect(safeFormatInt(-7.1)).toBe("-7")
  })
  it("零 → 0", () => expect(safeFormatInt(0)).toBe("0"))
  it("自定义 fallback", () => {
    expect(safeFormatInt(null, "N/A")).toBe("N/A")
    expect(safeFormatInt(NaN, "N/A")).toBe("N/A")
  })
  it("默认 fallback", () => expect(safeFormatInt(null)).toBe("--"))
})

describe("isValidNumber()", () => {
  it("undefined → false", () => {
    const v: number | undefined = undefined
    expect(isValidNumber(v)).toBe(false)
  })
  it("null → false", () => {
    const v: number | null = null
    expect(isValidNumber(v)).toBe(false)
  })
  it("NaN → false", () => expect(isValidNumber(NaN)).toBe(false))
  it("Infinity → false", () => expect(isValidNumber(Infinity)).toBe(false))
  it("-Infinity → false", () => expect(isValidNumber(-Infinity)).toBe(false))
  it("正常 → true", () => {
    expect(isValidNumber(42)).toBe(true)
    expect(isValidNumber(3.14)).toBe(true)
    expect(isValidNumber(-100)).toBe(true)
  })
  it("零 → true", () => expect(isValidNumber(0)).toBe(true))
  it("类型守卫 true 分支", () => {
    const v: number | undefined | null = 42
    if (isValidNumber(v)) expect(v.toFixed(2)).toBe("42.00")
    else expect.fail("应进入 true 分支")
  })
  it("类型守卫 false 分支", () => {
    const v: number | undefined | null = undefined
    if (!isValidNumber(v)) expect(v).toBeUndefined()
    else expect.fail("应进入 false 分支")
  })
})
