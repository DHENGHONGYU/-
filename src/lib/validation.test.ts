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
    expect(isValidSymbolWithExchange('600519.SH')).toBe(true)
    expect(isValidSymbolWithExchange('000001.SZ')).toBe(true)
    expect(isValidSymbolWithExchange('000001.BJ')).toBe(true)
    expect(isValidSymbolWithExchange('600519.HK')).toBe(false)
    expect(isValidSymbolWithExchange('60051')).toBe(false)
    expect(isValidSymbolWithExchange('')).toBe(false)
  })

  it('formatStockCode: 补零至 6 位', () => {
    expect(formatStockCode('600519')).toBe('600519')
    expect(formatStockCode(519)).toBe('000519')
    expect(formatStockCode('1')).toBe('000001')
  })

  it('formatStockCode: 非纯数字字符串原样返回（覆盖 L121）', () => {
    expect(formatStockCode('AAPL')).toBe('AAPL')
    expect(formatStockCode('00700.HK')).toBe('00700.HK')
    expect(formatStockCode('600519.SH')).toBe('600519.SH')
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

  it('isValidPercent: 非数字/NaN → false（覆盖 L167）', () => {
    expect(isValidPercent('50' as unknown as number)).toBe(false)
    expect(isValidPercent(NaN)).toBe(false)
    expect(isValidPercent(null as unknown as number)).toBe(false)
    expect(isValidPercent(undefined as unknown as number)).toBe(false)
  })

  it('isValidScore: 0-100 范围', () => {
    expect(isValidScore(0)).toBe(true)
    expect(isValidScore(100)).toBe(true)
    expect(isValidScore(-0.1)).toBe(false)
    expect(isValidScore(100.1)).toBe(false)
  })

  it('isValidScore: 非数字/NaN → false（覆盖 L173）', () => {
    expect(isValidScore('50' as unknown as number)).toBe(false)
    expect(isValidScore(NaN)).toBe(false)
    expect(isValidScore(null as unknown as number)).toBe(false)
    expect(isValidScore(undefined as unknown as number)).toBe(false)
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

  it('isSensitiveField: 非字符串输入 → false（覆盖 L357）', () => {
    expect(isSensitiveField(undefined as unknown as string)).toBe(false)
    expect(isSensitiveField(null as unknown as string)).toBe(false)
    expect(isSensitiveField(123 as unknown as string)).toBe(false)
    expect(isSensitiveField({} as unknown as string)).toBe(false)
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

    // 重排后：HTML 标签检测优先于 forbidden chars
    const xssResult = validateConfigName('<script>alert(1)</script>')
    expect(xssResult.error).toContain('HTML 标签')

    // 重排后：危险协议检测优先于 forbidden chars
    const protocolResult = validateConfigName('javascript:alert(1)')
    expect(protocolResult.error).toContain('危险协议')
  })


  describe('validateConfigName 防御性分支补全', () => {
    it('非字符串输入 → 名称必须为字符串（覆盖 L61）', () => {
      expect(validateConfigName(undefined as unknown as string).valid).toBe(false)
      expect(validateConfigName(null as unknown as string).valid).toBe(false)
      expect(validateConfigName(123 as unknown as string).valid).toBe(false)
      expect(validateConfigName({} as unknown as string).valid).toBe(false)
    })

    it('空字符串和纯空格 → 长度不足（覆盖 L71）', () => {
      expect(validateConfigName('').valid).toBe(false)
      expect(validateConfigName('   ').valid).toBe(false)
      expect(validateConfigName('\t\n').valid).toBe(false)
    })

    it('HTML 标签检测（覆盖 L88）', () => {
      expect(validateConfigName('<script>alert(1)</script>').valid).toBe(false)
      expect(validateConfigName('<img src=x>').valid).toBe(false)
    })

    it('危险协议检测（覆盖 L93）', () => {
      expect(validateConfigName('javascript:alert(1)').valid).toBe(false)
      expect(validateConfigName('data:text/html,<script>').valid).toBe(false)
      expect(validateConfigName('file:///etc/passwd').valid).toBe(false)
    })
  })

  describe('isValidLlmBaseURL 非白名单协议', () => {
    it('ftp/mailto 协议 → false（覆盖 L244）', () => {
      expect(isValidLlmBaseURL('ftp://example.com')).toBe(false)
      expect(isValidLlmBaseURL('mailto:test@example.com')).toBe(false)
      expect(isValidLlmBaseURL('ws://localhost:8080')).toBe(false)
    })
  })

})
