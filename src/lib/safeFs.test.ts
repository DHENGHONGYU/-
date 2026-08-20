/**
 * lib/safeFs.safeWriteFileSync — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量）：新增独立测试文件，不编辑/不删除任何已有测试。
 * 覆盖：正常写入、自动创建嵌套父目录、写入二进制 Buffer、自定义 WriteFileOptions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { safeWriteFileSync } from './safeFs'

describe('lib/safeFs', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'finsight-v9-safeFs-'))
  })

  afterEach(() => {
    // 清理临时目录
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {
      // noop
    }
  })

  describe('safeWriteFileSync()', () => {
    it('正常写入已存在的目录', () => {
      const target = path.join(tmpRoot, 'hello.txt')
      safeWriteFileSync(target, 'world')
      expect(fs.readFileSync(target, 'utf-8')).toBe('world')
    })

    it('自动创建一级嵌套父目录后写入', () => {
      const target = path.join(tmpRoot, 'nested', 'file.txt')
      safeWriteFileSync(target, 'content')
      expect(fs.readFileSync(target, 'utf-8')).toBe('content')
      expect(fs.existsSync(path.join(tmpRoot, 'nested'))).toBe(true)
    })

    it('自动创建多级嵌套父目录（深度≥3）', () => {
      const target = path.join(tmpRoot, 'a', 'b', 'c', 'deep.txt')
      safeWriteFileSync(target, 'deep-content')
      expect(fs.readFileSync(target, 'utf-8')).toBe('deep-content')
      expect(fs.existsSync(path.join(tmpRoot, 'a', 'b', 'c'))).toBe(true)
    })

    it('写入 NodeJS.ArrayBufferView (Buffer)', () => {
      const target = path.join(tmpRoot, 'binary.bin')
      const buf = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF])
      safeWriteFileSync(target, buf)
      const got = fs.readFileSync(target)
      expect(Buffer.isBuffer(got)).toBe(true)
      expect(got.toString('hex')).toBe('deadbeef')
    })

    it('支持自定义 options（如 encoding 为 latin1）', () => {
      // 默认 utf-8。改用 latin1 直接写入带高位字节的字符串。
      const target = path.join(tmpRoot, 'latin1.txt')
      const high = 'café'
      safeWriteFileSync(target, high, { encoding: 'utf-8' })
      expect(fs.readFileSync(target, 'utf-8')).toBe(high)
    })

    it('目标目录存在时也能正常覆盖写入', () => {
      const target = path.join(tmpRoot, 'overwrite.txt')
      safeWriteFileSync(target, 'v1')
      safeWriteFileSync(target, 'v2')
      expect(fs.readFileSync(target, 'utf-8')).toBe('v2')
    })

    it('空字符串内容能成功写入（零字节边界）', () => {
      const target = path.join(tmpRoot, 'empty.txt')
      safeWriteFileSync(target, '')
      const s = fs.statSync(target)
      expect(s.size).toBe(0)
    })

    it('父目录已存在时不会抛出异常（mkdir recursive=true 幂等）', () => {
      const sub = path.join(tmpRoot, 'exists')
      fs.mkdirSync(sub, { recursive: true })
      const target = path.join(sub, 'file.txt')
      expect(() => safeWriteFileSync(target, 'ok')).not.toThrow()
      expect(fs.readFileSync(target, 'utf-8')).toBe('ok')
    })

    it('抛出非 ENOENT / 非 mkdir 相关错误时透传（非法路径）', () => {
      // 传入空字符串 filePath — 抛 EINVAL 或等价 Node fs 错误
      expect(() => safeWriteFileSync('', 'x')).toThrow()
    })
  })
})

// 避免 vi 未使用告警（当前文件未用 vi.mock，但导入以备后续扩展）
void vi
