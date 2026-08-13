/**
 * 编码检测与修复服务
 *
 * 检测并修复因编码错误导致的中文乱码文本。常见场景为 GBK/GB18030 编码的
 * 数据被误当作 UTF-8 解析，产生形如"鏋"、"浠"、"鐜"等乱码字符。
 *
 * 在浏览器环境中使用 TextDecoder / TextEncoder 进行编码修复。
 *
 * @doc V9-DOC-QUALITY-017
 */

import { getLogger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 支持的编码类型 */
export type SupportedEncoding = 'utf-8' | 'gbk' | 'gb18030' | 'unknown';

/** 编码检测结果 */
export interface EncodingDetectionResult {
  /** 检测到的编码 */
  encoding: SupportedEncoding;
  /** 置信度 (0-1)，基于乱码字符占比估算 */
  confidence: number;
  /** 是否包含乱码字符 */
  isGarbled: boolean;
}

/** 编码问题统计 */
export interface EncodingStats {
  /** 累计检测到的乱码次数 */
  totalDetected: number;
  /** 成功修复的次数 */
  fixed: number;
  /** 修复失败的次数 */
  failed: number;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/**
 * GBK 被误解释为 UTF-8 时产生的常见乱码字符集合。
 *
 * 这些字符是 GBK 双字节序列被按 UTF-8 解码后产生的典型"火星文"，
 * 覆盖了常见中文高频字的乱码形态。
 */
const GARBLED_CHARS = new Set<string>([
  // 常见 GBK→UTF-8 乱码字
  '鏋', '浠', '鐜', '鏈', '鏄', '涓', '鏃', '鏂', '鍙', '鎴',
  '鏌', '鎺', '鍦', '鍚', '鍒', '鍏', '鍙', '鐢', '鎵', '鎻',
  '閮', '闂', '闇', '闄', '闈', '闉', '闋', '闌', '闍', '闎',
  '闏', '闐', '闑', '闒', '闓', '闔', '闕', '闖', '闗', '闘',
  '鐨', '鐩', '鐪', '鐫', '鐬', '鐭', '鐮', '鐯', '鐰', '鐱',
  '浣', '濂', '娑', '鐙', '闆', '鏉', '鍝', '鍥', '鍧', '鍨',
  '鎴', '鎵', '鎶', '鎷', '鎸', '鎹', '鎺', '鎻', '鎼', '鎽',
  '鏍', '鏎', '鏏', '鏐', '鏑', '鏒', '鏓', '鏔', '鏕', '鏖',
  '鏗', '鏘', '鏙', '鏚', '鏛', '鏜', '鏝', '鏞', '鏟', '鏠',
  '闂', '闃', '闄', '闅', '闆', '闇', '闈', '闉', '闊', '闋',
  '鐒', '鐓', '鐔', '鐕', '鐖', '鐗', '鐘', '鐙', '鐚', '鐛',
  '闁', '闂', '闃', '闄', '闅', '闆', '闇', '闈', '闉', '闊',
  '钀', '钁', '钂', '钃', '钄', '钅', '钆', '钇', '针', '钉',
  '鍒', '鍓', '鍔', '鍕', '鍖', '鍗', '鍘', '鍙', '鍚', '鍛',
  '鎴', '鎵', '鎶', '鎷', '鎸', '鎹', '鎺', '鎻', '鎼', '鎽',
  '鏋', '鏌', '鏍', '鏎', '鏏', '鏐', '鏑', '鏒', '鏓', '鏔',
  '闂', '闃', '闄', '闅', '闆', '闇', '闈', '闉', '闊', '闋',
  '閸', '閹', '閺', '閻', '閼', '閽', '閾', '閿', '闀', '闁',
  '鐜', '鐝', '鐞', '鐟', '鐠', '鐡', '鐢', '鐣', '鐤', '鐥',
  '楥', '楦', '楧', '楨', '楩', '楪', '楫', '楬', '業', '楮',
  '鏈', '鏉', '鏊', '鏋', '鏌', '鏍', '鏎', '鏏', '鏐', '鏑',
  '鏄', '鏅', '鏆', '鏇', '鏈', '鏉', '鏊', '鏋', '鏌', '鏍',
  '鍥', '鍦', '鍧', '鍨', '鍩', '鍪', '鍫', '鍬', '鍭', '鍮',
  '鎴', '鎵', '鎶', '鎷', '鎸', '鎹', '鎺', '鎻', '鎼', '鎽',
  '鐜', '鐝', '鐞', '鐟', '鐠', '鐡', '鐢', '鐣', '鐤', '鐥',
]);

/**
 * 被认为是正常编码的常见中文字符范围（Unicode 码点）。
 * 用于辅助判断文本是否已经是正常的 UTF-8 中文。
 */
const CJK_UNIFIED_IDEOGRAPHS_START = 0x4e00;
const CJK_UNIFIED_IDEOGRAPHS_END = 0x9fff;
const CJK_EXTENSION_A_START = 0x3400;
const CJK_EXTENSION_A_END = 0x4dbf;

// ---------------------------------------------------------------------------
// 内部状态
// ---------------------------------------------------------------------------

const logger = getLogger();

let encodingStats: EncodingStats = {
  totalDetected: 0,
  fixed: 0,
  failed: 0,
};

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

/**
 * 计算文本中乱码字符的占比。
 *
 * 将文本拆分为字符，统计其中出现在 GARBLED_CHARS 中的字符数量，
 * 返回占比 (0-1)。
 */
function computeGarbledRatio(text: string): number {
  if (!text || text.length === 0) return 0;

  let garbledCount = 0;
  // 遍历码点而非 UTF-16 码元，确保正确处理代理对
  for (const char of text) {
    if (GARBLED_CHARS.has(char)) {
      garbledCount++;
    }
  }

  return garbledCount / text.length;
}

/**
 * 判断单个字符是否属于正常的中文 CJK 范围。
 */
function isCJK(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= CJK_UNIFIED_IDEOGRAPHS_START && code <= CJK_UNIFIED_IDEOGRAPHS_END) ||
    (code >= CJK_EXTENSION_A_START && code <= CJK_EXTENSION_A_END)
  );
}

/**
 * 判断文本是否看起来是正常的 UTF-8 中文。
 *
 * 启发式：如果文本中包含正常 CJK 字符，且乱码占比很低，则认为是正常 UTF-8。
 */
function looksLikeValidUtf8(text: string): boolean {
  let cjkCount = 0;
  let garbledCount = 0;

  for (const char of text) {
    if (isCJK(char)) {
      cjkCount++;
    } else if (GARBLED_CHARS.has(char)) {
      garbledCount++;
    }
  }

  // 有正常 CJK 字符且乱码占比低
  if (cjkCount > 0 && garbledCount <= cjkCount * 0.1) {
    return true;
  }

  // 既没有 CJK 也没有乱码 → 可能是纯 ASCII 或非中文文本
  if (cjkCount === 0 && garbledCount === 0) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 检测文本的编码类型。
 *
 * 通过分析文本中是否包含 GBK 被误解释为 UTF-8 时产生的典型乱码字符，
 * 推断原始编码并给出置信度。
 *
 * @param text - 待检测的文本
 * @returns 编码检测结果，包含 encoding、confidence 和 isGarbled 标记
 */
export function detectEncoding(text: string): EncodingDetectionResult {
  if (!text || text.length === 0) {
    return { encoding: 'unknown', confidence: 1, isGarbled: false };
  }

  const garbledRatio = computeGarbledRatio(text);

  // 无明显乱码字符 → 可能是正常的 UTF-8
  if (garbledRatio === 0) {
    return { encoding: 'utf-8', confidence: 0.9, isGarbled: false };
  }

  const isGarbled = garbledRatio >= 0.05; // 5% 以上乱码即判定为乱码

  if (isGarbled) {
    encodingStats.totalDetected++;
    logger.debug(`[encoding] Detected garbled text, ratio=${(garbledRatio * 100).toFixed(1)}%`);
  }

  // 乱码比例越高，原始编码是 GBK/GB18030 的可能性越大
  // GB18030 是 GBK 的超集，当乱码比例较高时优先返回 gb18030
  if (garbledRatio > 0.3) {
    return {
      encoding: 'gb18030',
      confidence: Math.min(garbledRatio * 1.5, 1),
      isGarbled,
    };
  }

  if (garbledRatio >= 0.05) {
    return {
      encoding: 'gbk',
      confidence: garbledRatio,
      isGarbled,
    };
  }

  // 有少量可疑字符但未达到乱码阈值
  return { encoding: 'utf-8', confidence: 1 - garbledRatio, isGarbled: false };
}

/**
 * 修复编码错误的文本。
 *
 * 在浏览器环境中使用 TextDecoder / TextEncoder 进行编码转换。
 * 对于非浏览器环境，会尝试兜底处理。
 *
 * @param text         - 待修复的文本
 * @param fromEncoding - 原始编码（源编码）
 * @param toEncoding   - 目标编码（通常为 'utf-8'）
 * @returns 修复后的文本，修复失败时返回原始文本
 */
export function fixEncoding(
  text: string,
  fromEncoding: SupportedEncoding,
  toEncoding: SupportedEncoding = 'utf-8',
): string {
  if (!text || text.length === 0) return text;
  if (fromEncoding === toEncoding) return text;
  if (fromEncoding === 'unknown') return text;

  try {
    // 在浏览器环境中，TextDecoder/TextEncoder 是全局可用的
    if (typeof TextDecoder !== 'undefined' && typeof TextEncoder !== 'undefined') {
      // 将原始文本编码为字节（按 UTF-8），然后按源编码重新解码
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);

      const decoder = new TextDecoder(fromEncoding, { fatal: false });
      const decoded = decoder.decode(bytes);

      // 如果目标编码也是 UTF-8，则直接返回解码结果
      // 如需转换为其他编码，再做一次编码
      if (toEncoding === 'utf-8') {
        encodingStats.fixed++;
        logger.debug(`[encoding] Fixed text from ${fromEncoding} to utf-8`);
        return decoded;
      }

      // 需要转换为非 UTF-8 目标编码
      const targetEncoder = new TextEncoder();
      const targetBytes = targetEncoder.encode(decoded);
      const targetDecoder = new TextDecoder(toEncoding, { fatal: false });
      const result = targetDecoder.decode(targetBytes);

      encodingStats.fixed++;
      logger.debug(`[encoding] Fixed text from ${fromEncoding} to ${toEncoding}`);
      return result;
    }

    // 非浏览器环境：无法使用 TextDecoder/TextEncoder，返回原始文本
    logger.warn('[encoding] TextDecoder/TextEncoder not available, cannot fix encoding');
    encodingStats.failed++;
    return text;
  } catch (error) {
    logger.error(`[encoding] Failed to fix encoding: ${(error as Error).message}`);
    encodingStats.failed++;
    return text;
  }
}

/**
 * 对单个字段值进行编码修复。
 *
 * 自动检测字段值是否包含乱码，如果包含则尝试修复。
 * 适用于处理从外部数据源导入的字段值。
 *
 * @param value - 待处理的字段值（字符串或其他类型）
 * @returns 修复后的值。如果值不是字符串或无需修复，则原样返回
 */
export function sanitizeField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.length === 0) {
    return value;
  }

  // 先快速检查是否看起来正常
  if (looksLikeValidUtf8(value)) {
    return value;
  }

  const detection = detectEncoding(value);

  if (!detection.isGarbled) {
    return value;
  }

  // 尝试修复
  const fixed = fixEncoding(value, detection.encoding, 'utf-8');

  // 修复后再次检测，确认修复是否成功
  const recheck = detectEncoding(fixed);
  if (recheck.isGarbled) {
    // 修复后仍有乱码 → 尝试使用另一种编码
    const altEncoding: SupportedEncoding =
      detection.encoding === 'gbk' ? 'gb18030' : 'gbk';
    const altFixed = fixEncoding(value, altEncoding, 'utf-8');
    const altRecheck = detectEncoding(altFixed);

    if (altRecheck.isGarbled) {
      logger.warn(
        `[encoding] sanitizeField failed to fully repair text, keeping original (length=${value.length})`,
      );
      return value;
    }

    return altFixed;
  }

  return fixed;
}

/**
 * 获取编码检测与修复的统计信息。
 *
 * @returns 当前累计的编码问题统计
 */
export function getEncodingStats(): EncodingStats {
  return { ...encodingStats };
}

/**
 * 重置编码统计信息。
 */
export function resetEncodingStats(): void {
  encodingStats = { totalDetected: 0, fixed: 0, failed: 0 };
  logger.info('[encoding] Encoding stats reset');
}