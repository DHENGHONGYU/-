/**
 * @test_id V9-TEST-ST-026
 * dataValidation 单元测试
 *
 * 覆盖场景：
 * 1. isValidStockCode / isValidStockCodeStrict / isValidSymbolWithExchange
 * 2. formatStockCode 补零
 * 3. 数值范围验证：isValidPercent / isValidScore / isValidPrice
 * 4. safeValue / safeParseNumber
 * 5. LLM 配置校验：isValidLlmBaseURL / isValidLlmApiKey / isValidLlmModel
 * 6. 敏感信息脱敏：maskApiKey / maskToken / isSensitiveField / sanitizeObject
  * @covers_docs []
*/
import { describe, it, expect } from 'vitest'
import {
  isValidStockCode,
  formatStockCode,
  isValidStockCodeStrict,
  isValidSymbolWithExchange,
  validateSymbolFormat,
  isValidPercent,
  isValidScore,
  isValidPrice,
  safeValue,
  safeParseNumber,
  isValidLlmBaseURL,
  isValidLlmApiKey,
  isValidLlmModel,
  maskApiKey,
  maskToken,
  isSensitiveField,
  sanitizeObject,
  validateConfigName,
} from './validation'

describe('股票代码验证', () => {
  it('isValidStockCode: 校验 A 股 6 位数字', () => {
    expect(isValidStockCode('600519')).toBe(true)
    expect(isValidStockCode('000001')).toBe(true)
    expect(isValidStockCode('12345')).toBe(false)
    expect(isValidStockCode('6005190')).toBe(false)
    expect(isValidStockCode('abcdef')).toBe(false)
  })

  it('isValidStockCodeStrict: 支持 A 股 / 港股 / 美股', () => {
    expect(isValidStockCodeStrict('600519', 'A')).toBe(true)
    expect(isValidStockCodeStrict('00700', 'HK')).toBe(true)
    expect(isValidStockCodeStrict('AAPL', 'US')).toBe(true)
    expect(isValidStockCodeStrict('AAPL.US', 'US')).toBe(true)
    // 默认仅校验 A 股
    expect(isValidStockCodeStrict('600519')).toBe(true)
    expect(isValidStockCodeStrict('00700')).toBe(false)
    // 空值与非字符串
    expect(isValidStockCodeStrict('', 'A')).toBe(false)
    expect(isValidStockCodeStrict('  600519  ', 'A')).toBe(true)
  })

  it('isValidSymbolWithExchange: 校验带交易所后缀', () => {
    // A股
    expect(isValidSymbolWithExchange('600519.SH')).toBe(true)
    expect(isValidSymbolWithExchange('000001.SZ')).toBe(true)
    expect(isValidSymbolWithExchange('000001.BJ')).toBe(true)
    // 港股
    expect(isValidSymbolWithExchange('00700.HK')).toBe(true)
    expect(isValidSymbolWithExchange('1.HK')).toBe(true)
    expect(isValidSymbolWithExchange('12345.HK')).toBe(true)
    // 美股
    expect(isValidSymbolWithExchange('AAPL.US')).toBe(true)
    expect(isValidSymbolWithExchange('GOOGL.US')).toBe(true)
    expect(isValidSymbolWithExchange('A.US')).toBe(true)
    // 非法格式
    expect(isValidSymbolWithExchange('600519.HK')).toBe(false)
    expect(isValidSymbolWithExchange('60051')).toBe(false)
    expect(isValidSymbolWithExchange('')).toBe(false)
    expect(isValidSymbolWithExchange('INVALID')).toBe(false)
    expect(isValidSymbolWithExchange('600519')).toBe(false)
  })

  it('validateSymbolFormat: 合法格式返回 null', () => {
    expect(validateSymbolFormat('600519.SH')).toBeNull()
    expect(validateSymbolFormat('000001.SZ')).toBeNull()
    expect(validateSymbolFormat('830799.BJ')).toBeNull()
    expect(validateSymbolFormat('00700.HK')).toBeNull()
    expect(validateSymbolFormat('AAPL.US')).toBeNull()
  })

  it('validateSymbolFormat: 非法格式返回错误信息', () => {
    // 无交易所后缀
    const r1 = validateSymbolFormat('600519')
    expect(r1).not.toBeNull()
    expect(r1).toContain('symbol 格式非法')

    // 完全非法字符串
    const r2 = validateSymbolFormat('INVALID')
    expect(r2).not.toBeNull()
    expect(r2).toContain('symbol 格式非法')

    // 空字符串
    const r3 = validateSymbolFormat('')
    expect(r3).not.toBeNull()
    expect(r3).toContain('不能为空')

    // 纯空格
    const r4 = validateSymbolFormat('   ')
    expect(r4).not.toBeNull()
    expect(r4).toContain('不能为空')

    // A股代码 + 港股后缀
    const r5 = validateSymbolFormat('600519.HK')
    expect(r5).not.toBeNull()
    expect(r5).toContain('symbol 格式非法')

    // 长度不足
    const r6 = validateSymbolFormat('12345.SH')
    expect(r6).not.toBeNull()
    expect(r6).toContain('symbol 格式非法')
  })

  it('formatStockCode: 补零至 6 位', () => {
    expect(formatStockCode('600519')).toBe('600519')
    expect(formatStockCode(519)).toBe('000519')
    expect(formatStockCode('1')).toBe('000001')
  })
})

describe('数值范围验证', () => {
  it('isValidPercent: 0-100 范围', () => {
    expect(isValidPercent(0)).toBe(true)
    expect(isValidPercent(100)).toBe(true)
    expect(isValidPercent(50.5)).toBe(true)
    expect(isValidPercent(-1)).toBe(false)
    expect(isValidPercent(101)).toBe(false)
  })

  it('isValidScore: 0-100 范围', () => {
    expect(isValidScore(0)).toBe(true)
    expect(isValidScore(100)).toBe(true)
    expect(isValidScore(-0.1)).toBe(false)
    expect(isValidScore(100.1)).toBe(false)
  })

  it('isValidPrice: 必须为正数且有限', () => {
    expect(isValidPrice(1)).toBe(true)
    expect(isValidPrice(0.01)).toBe(true)
    expect(isValidPrice(0)).toBe(false)
    expect(isValidPrice(-1)).toBe(false)
    expect(isValidPrice(Infinity)).toBe(false)
    expect(isValidPrice(NaN)).toBe(false)
  })

  it('safeValue: 空值回退', () => {
    expect(safeValue(null, 'fallback')).toBe('fallback')
    expect(safeValue(undefined, 0)).toBe(0)
    expect(safeValue('value', 'fallback')).toBe('value')
    expect(safeValue<number>(0, 0)).toBe(0)
  })

  it('safeParseNumber: 解析、过滤 NaN/Infinity、范围限制', () => {
    expect(safeParseNumber('123', 0)).toBe(123)
    expect(safeParseNumber(123, 0)).toBe(123)
    expect(safeParseNumber('abc', 0)).toBe(0)
    expect(safeParseNumber('', 0)).toBe(0)
    expect(safeParseNumber(null, 0)).toBe(0)
    expect(safeParseNumber(undefined, 0)).toBe(0)
    expect(safeParseNumber(Infinity, 0)).toBe(0)
    expect(safeParseNumber(NaN, 0)).toBe(0)
    // 范围限制
    expect(safeParseNumber(150, 0, 0, 100)).toBe(100)
    expect(safeParseNumber(-50, 0, 0, 100)).toBe(0)
    expect(safeParseNumber(50, 0, 0, 100)).toBe(50)
  })
})

describe('LLM 配置校验', () => {
  it('isValidLlmBaseURL: 仅允许 http/https 协议', () => {
    expect(isValidLlmBaseURL('https://api.openai.com')).toBe(true)
    expect(isValidLlmBaseURL('http://localhost:3000')).toBe(true)
    expect(isValidLlmBaseURL('javascript:alert(1)')).toBe(false)
    expect(isValidLlmBaseURL('data:text/html,<script>')).toBe(false)
    expect(isValidLlmBaseURL('vbscript:msgbox(1)')).toBe(false)
    expect(isValidLlmBaseURL('file:///etc/passwd')).toBe(false)
    expect(isValidLlmBaseURL('not a url')).toBe(false)
    expect(isValidLlmBaseURL('')).toBe(false)
    expect(isValidLlmBaseURL('   ')).toBe(false)
  })

  it('isValidLlmApiKey: 长度 8-256 且仅允许特定字符', () => {
    expect(isValidLlmApiKey('sk-abcdef123456')).toBe(true)
    expect(isValidLlmApiKey('ABCDEFGH')).toBe(true)
    expect(isValidLlmApiKey('a.b-c_d/e')).toBe(true)
    // 长度不足
    expect(isValidLlmApiKey('short')).toBe(false)
    // 含空白字符
    expect(isValidLlmApiKey('sk-abcdef 123456')).toBe(false)
    // 含引号
    expect(isValidLlmApiKey('sk-abc"def')).toBe(false)
    // 空值
    expect(isValidLlmApiKey('')).toBe(false)
  })

  it('isValidLlmModel: 长度 1-128 且仅允许特定字符', () => {
    expect(isValidLlmModel('gpt-4')).toBe(true)
    expect(isValidLlmModel('gpt-4-turbo:latest')).toBe(true)
    expect(isValidLlmModel('claude-3.5/sonnet')).toBe(true)
    expect(isValidLlmModel('')).toBe(false)
    expect(isValidLlmModel('   ')).toBe(false)
    expect(isValidLlmModel('model with space')).toBe(false)
    // 含尖括号
    expect(isValidLlmModel('model<evil>')).toBe(false)
  })
})

describe('敏感信息脱敏', () => {
  it('maskApiKey: 长度 ≤ 8 全替换，> 8 保留前后各 4 位', () => {
    expect(maskApiKey('short')).toBe('****')
    expect(maskApiKey('12345678')).toBe('****')
    expect(maskApiKey('123456789')).toBe('1234****6789')
    expect(maskApiKey('sk-abcdef1234567890')).toBe('sk-a****7890')
    expect(maskApiKey('')).toBe('(empty)')
  })

  it('maskToken: 与 maskApiKey 行为一致', () => {
    expect(maskToken('short')).toBe('****')
    expect(maskToken('123456789')).toBe('1234****6789')
    expect(maskToken('')).toBe('(empty)')
  })

  it('isSensitiveField: 识别常见敏感字段（大小写不敏感）', () => {
    expect(isSensitiveField('apiKey')).toBe(true)
    expect(isSensitiveField('API_KEY')).toBe(true)
    expect(isSensitiveField('api-key')).toBe(true)
    expect(isSensitiveField('token')).toBe(true)
    expect(isSensitiveField('accessToken')).toBe(true)
    expect(isSensitiveField('refresh_token')).toBe(true)
    expect(isSensitiveField('password')).toBe(true)
    expect(isSensitiveField('Authorization')).toBe(true)
    expect(isSensitiveField('cookie')).toBe(true)
    expect(isSensitiveField('sessionId')).toBe(true)
    expect(isSensitiveField('username')).toBe(false)
    expect(isSensitiveField('')).toBe(false)
  })

  it('sanitizeObject: 递归脱敏对象中的敏感字符串字段', () => {
    const obj = {
      apiKey: 'sk-abcdef1234567890',
      token: 'abcdefghij',
      user: {
        name: 'Alice',
        password: 'secret123',
      },
      list: [{ api_key: 'sk-list-key-12345' }, { name: 'item2' }],
      nonSensitive: 'normal value',
    }
    const result = sanitizeObject(obj)
    expect(result.apiKey).toBe('sk-a****7890')
    expect(result.token).toBe('abcd****ghij')
    expect(result.user.name).toBe('Alice')
    expect(result.user.password).toBe('secr****t123')
    expect(result.list?.[0]?.api_key).toBe('sk-l****2345')
    expect(result.list?.[1]?.name).toBe('item2')
    expect(result.nonSensitive).toBe('normal value')
  })

  it('sanitizeObject: 不修改原对象', () => {
    const obj = { apiKey: 'sk-abcdef1234567890' }
    const result = sanitizeObject(obj)
    expect(result.apiKey).toBe('sk-a****7890')
    expect(obj.apiKey).toBe('sk-abcdef1234567890')
  })

  it('sanitizeObject: 处理 null / undefined / 基本类型', () => {
    expect(sanitizeObject(null)).toBeNull()
    expect(sanitizeObject(undefined)).toBeUndefined()
    expect(sanitizeObject('string')).toBe('string')
    expect(sanitizeObject(123)).toBe(123)
  })

  it('sanitizeObject: 循环引用不导致栈溢出', () => {
    const obj: Record<string, unknown> = { name: 'cyclic' }
    obj.self = obj
    expect(() => sanitizeObject(obj)).not.toThrow()
    const result = sanitizeObject(obj)
    expect((result as Record<string, unknown>).name).toBe('cyclic')
    // 数组自引用也应安全
    const arr: unknown[] = ['a']
    arr.push(arr)
    expect(() => sanitizeObject(arr)).not.toThrow()
  })
})

describe('配置名称校验 validateConfigName', () => {
  it('应通过正常名称', () => {
    expect(validateConfigName('高频行情监控').valid).toBe(true)
    expect(validateConfigName('每日舆情分析').valid).toBe(true)
    expect(validateConfigName('基础行情采集').valid).toBe(true)
    expect(validateConfigName('  带空格的名称  ').valid).toBe(true)
    expect(validateConfigName('a').valid).toBe(true)
  })

  it('应拒绝空字符串和纯空格', () => {
    expect(validateConfigName('').valid).toBe(false)
    expect(validateConfigName('   ').valid).toBe(false)
    expect(validateConfigName('\t\n').valid).toBe(false)
  })

  it('应拒绝超长名称（> 50 字符）', () => {
    const longName = 'a'.repeat(51)
    const result = validateConfigName(longName)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('50')
  })

  it('应拒绝包含文件系统敏感字符的名称', () => {
    const forbiddenChars = ['<', '>', '{', '}', '[', ']', '|', '\\', ':', '*', '?', '"', '`']
    for (const char of forbiddenChars) {
      const result = validateConfigName(`test${char}name`)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('特殊字符')
    }
  })

  it('应拒绝包含控制字符的名称', () => {
    expect(validateConfigName('test\x00name').valid).toBe(false)
    expect(validateConfigName('test\x1Fname').valid).toBe(false)
    expect(validateConfigName('test\x7Fname').valid).toBe(false)
  })

  it('应拒绝包含 HTML 标签的名称（XSS 防护）', () => {
    expect(validateConfigName('<script>alert(1)</script>').valid).toBe(false)
    expect(validateConfigName('<img src=x onerror=alert(1)>').valid).toBe(false)
    expect(validateConfigName('正常名称<script>恶意</script>').valid).toBe(false)
  })

  it('应拒绝以危险协议开头的名称（XSS 防护）', () => {
    expect(validateConfigName('javascript:alert(1)').valid).toBe(false)
    expect(validateConfigName('data:text/html,<script>').valid).toBe(false)
    expect(validateConfigName('vbscript:msgbox(1)').valid).toBe(false)
    expect(validateConfigName('file:///etc/passwd').valid).toBe(false)
  })

  it('应允许包含常见安全字符的名称', () => {
    expect(validateConfigName('配置-V2.0').valid).toBe(true)
    expect(validateConfigName('策略_A/B').valid).toBe(true)
    expect(validateConfigName('监控 (实时)').valid).toBe(true)
    expect(validateConfigName('行情#1').valid).toBe(true)
    expect(validateConfigName('测试@2024').valid).toBe(true)
    expect(validateConfigName('名称!').valid).toBe(true)
  })

  it('应 trim 后校验长度', () => {
    // trim 后为空
    expect(validateConfigName('   ').valid).toBe(false)
    // trim 后合法
    expect(validateConfigName('  合法名称  ').valid).toBe(true)
  })

  it('应返回具体的错误信息', () => {
    const emptyResult = validateConfigName('')
    expect(emptyResult.error).toBe('名称不能为空')

    const longResult = validateConfigName('a'.repeat(51))
    expect(longResult.error).toContain('50')

    // < 和 > 属于禁止字符，优先于 HTML 标签检测
    const xssResult = validateConfigName('<script>alert(1)</script>')
    expect(xssResult.error).toContain('特殊字符')

    // javascript: 含 : 属于禁止字符，也会先被特殊字符检测拦截
    const protocolResult = validateConfigName('javascript:alert(1)')
    expect(protocolResult.error).toContain('特殊字符')
  })
})

// ====================================================================
// 缺口补全（STMTS uncov 10 / branches 126 → 目标清零）
// ====================================================================
describe('validation — gap coverage (branches 剩余未覆盖)', () => {
  describe('validateConfigName 非字符串参数（第 65 行 typeof check）', () => {
    it('非字符串（number/null/undefined/object）应返回「名称必须为字符串」', () => {
      // @ts-expect-error 故意传非法类型，校验运行时防护
      expect(validateConfigName(123).valid).toBe(false);
      expect(validateConfigName(123 as unknown as string).error).toBe('名称必须为字符串')
      // @ts-expect-error 故意传 null
      expect(validateConfigName(null).valid).toBe(false)
      // @ts-expect-error 故意传 undefined
      expect(validateConfigName(undefined).valid).toBe(false)
      // @ts-expect-error 故意传 object
      expect(validateConfigName({}).valid).toBe(false)
    })
  })

  describe('formatStockCode 非纯数字原样返回（第 126 行）', () => {
    it('非纯数字（如港股 00700.HK、美股 AAPL、字母）原样返回', () => {
      expect(formatStockCode('00700.HK')).toBe('00700.HK')
      expect(formatStockCode('AAPL')).toBe('AAPL')
      expect(formatStockCode('AAPL.US')).toBe('AAPL.US')
      expect(formatStockCode('600519.SH')).toBe('600519.SH')
      expect(formatStockCode('code123')).toBe('code123')
    })
  })

  describe('isValidStockCodeStrict / isValidSymbolWithExchange / validateSymbolFormat 非字符串参数', () => {
    it('isValidStockCodeStrict 非字符串或空字符串 → false', () => {
      // @ts-expect-error 故意传 number
      expect(isValidStockCodeStrict(600519 as unknown as string, 'A')).toBe(false)
      // @ts-expect-error 故意传 null
      expect(isValidStockCodeStrict(null as unknown as string)).toBe(false)
      expect(isValidStockCodeStrict('', 'A')).toBe(false)
    })
    it('isValidSymbolWithExchange 非字符串 → false', () => {
      // @ts-expect-error 故意传 number
      expect(isValidSymbolWithExchange(0 as unknown as string)).toBe(false)
    })
    it('validateSymbolFormat 非真值（null/undefined）应判空', () => {
      // @ts-expect-error 故意传 null
      expect(validateSymbolFormat(null as unknown as string)).toContain('不能为空')
      // @ts-expect-error 故意传 undefined
      expect(validateSymbolFormat(undefined as unknown as string)).toContain('不能为空')
    })
  })

  describe('isValidPercent / isValidScore / isValidPrice 非数字/NaN 分支', () => {
    it('非 number 或 NaN 应返回 false', () => {
      // @ts-expect-error 故意传字符串
      expect(isValidPercent('50')).toBe(false)
      // @ts-expect-error 故意传 NaN
      expect(isValidPercent(NaN as unknown as number)).toBe(false)
      // @ts-expect-error 故意传字符串 score
      expect(isValidScore('60')).toBe(false)
      // @ts-expect-error 故意传 NaN
      expect(isValidScore(NaN as unknown as number)).toBe(false)
    })
  })

  describe('isValidLlmApiKey 超长(> 256) + 非字符串', () => {
    it('长度 > 256 返回 false', () => {
      const long = 'a'.repeat(257)
      expect(isValidLlmApiKey(long)).toBe(false)
    })
    it('非字符串参数', () => {
      // @ts-expect-error 故意传 null
      expect(isValidLlmApiKey(null as unknown as string)).toBe(false)
      // @ts-expect-error 故意传 number
      expect(isValidLlmApiKey(123 as unknown as string)).toBe(false)
    })
  })

  describe('isValidLlmModel 超长(> 128) + 非字符串', () => {
    it('长度 > 128 返回 false', () => {
      const long = 'a'.repeat(129)
      expect(isValidLlmModel(long)).toBe(false)
    })
    it('非字符串参数', () => {
      // @ts-expect-error 故意传 number
      expect(isValidLlmModel(0 as unknown as string)).toBe(false)
    })
  })

  describe('isValidLlmBaseURL 非危险协议但不在白名单（例如 ftp:）', () => {
    it('ftp: 协议不被危险黑名单拦截 → try new URL → 不在 ALLOWED → false', () => {
      // ftp 不在 DANGEROUS（第 247 行），能通过第 266 行检查 → 进入 try URL 分支 → return false
      expect(isValidLlmBaseURL('ftp://files.example.com/model.bin')).toBe(false)
    })
    it('ws: / wss: 协议也返回 false（非 allowed list）', () => {
      expect(isValidLlmBaseURL('ws://localhost:8080')).toBe(false)
      expect(isValidLlmBaseURL('wss://chat.example.com')).toBe(false)
    })
  })

  describe('isSensitiveField 非字符串 + 词边界分支', () => {
    it('非字符串字段名返回 false（第 386 行）', () => {
      // @ts-expect-error 故意传 number
      expect(isSensitiveField(0 as unknown as string)).toBe(false)
      // @ts-expect-error 故意传 undefined
      expect(isSensitiveField(undefined as unknown as string)).toBe(false)
    })
    it('词边界匹配：前缀为连字符/点号时命中（x-token-x / .token. 等）', () => {
      expect(isSensitiveField('x-token-value')).toBe(true)
      expect(isSensitiveField('my.api_key.here')).toBe(true)
      expect(isSensitiveField('user/authorization/jwt')).toBe(true)
    })
    it('词边界反向：token 作为单词子串时命中不到（tokenize / authorize 等）', () => {
      // tokenize → "token" 后紧跟 ize（都是字母），不匹配 `[^a-z0-9_]` 边界 → 应为 false
      expect(isSensitiveField('tokenize')).toBe(false)
      // authorize 以 "auth" 开头但 "auth" 后是 orize（字母），无边界 → false
      expect(isSensitiveField('authorize')).toBe(false)
      // authentication 以 auth 开头，无边界 → false
      expect(isSensitiveField('authentication')).toBe(false)
    })
  })

  describe('sanitizeObject maxDepth < 0 返回原对象（第 422 行）', () => {
    it('传入 maxDepth=-1 时直接返回，不做遍历', () => {
      const obj = { apiKey: 'sk-abcdef1234567890', nested: { token: 'abcd12345678' } }
      const r = sanitizeObject(obj, -1)
      // 返回引用相同（实际返回原对象，不脱敏）
      expect(r).toBe(obj)
    })
  })
})
