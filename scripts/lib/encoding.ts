/**
 * 编码自适应文件读写 helper
 *
 * ## 根因（系统性乱码之一）
 * 链接修复脚本族（fix-*.ts）原硬编码 `readFileSync(p, 'utf-8')` / `writeFileSync(p, c, 'utf-8')`。
 * 当文件实为 GBK（或其超集 gb18030）编码时，Node 的 UTF-8 读取遇非法字节会**静默替换为 U+FFFD**
 * 且不抛错 → 中文整篇变乱码，再 `writeFileSync(p, c, 'utf-8')` 写回 → **永久性二次损坏**。
 *
 * ## 本 helper 的确定性判据
 * - 读：先严格 UTF-8 解码；失败 → 回退严格 gb18030 解码；均失败 → 保底宽松 UTF-8（绝不抛错）。
 * - 写：恒以 UTF-8 写回（统一收敛到 UTF-8，避免 GBK 编码扩散）。
 *
 * 这样即便未来仓库里再次出现 GBK 文档，修复脚本也只会**正确读取**后再以 UTF-8 写回，
 * 绝不会把中文读成乱码再写回。
 */

import { readFileSync, writeFileSync } from 'fs';

/** 严格 UTF-8 解码：遇任何非法字节即抛错 */
function decodeStrictUtf8(buf: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(buf);
}

/** 严格 gb18030 解码（GBK 的完整超集，Node ICU 内置支持）：遇非法字节即抛错 */
function decodeStrictGb18030(buf: Buffer): string {
  return new TextDecoder('gb18030', { fatal: true }).decode(buf);
}

/**
 * 自适应读取文本文件，自动识别 UTF-8 / GBK(gb18030) 编码。
 * 优先 UTF-8（最常见）；非 UTF-8 则按 GBK 解读；都失败才宽松 UTF-8 保底（绝不抛错）。
 */
export function readTextAdaptive(path: string): string {
  const buf = readFileSync(path);

  // 1) 优先严格 UTF-8
  try {
    return decodeStrictUtf8(buf);
  } catch {
    // 不是合法 UTF-8，继续回退
  }

  // 2) 回退严格 gb18030（GBK 超集）
  try {
    return decodeStrictGb18030(buf);
  } catch {
    // GBK 也失败，继续保底
  }

  // 3) 保底宽松 UTF-8：保留尽可能多的内容，坏字节变为 U+FFFD，但绝不中断脚本
  return new TextDecoder('utf-8').decode(buf);
}

/**
 * 以 UTF-8 写回文本文件（统一收敛编码，杜绝 GBK 扩散）。
 */
export function writeTextUtf8(path: string, content: string): void {
  writeFileSync(path, content, 'utf-8');
}
