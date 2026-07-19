/**
 * @test_id V9-TEST-ST-028
 * xssSanitizer 单元测试
 *
 * 覆盖场景：
 * 1. escapeHtml: 转义所有特殊字符
 * 2. escapeHtml: 处理空输入和非字符串
 * 3. sanitizeHtml: 移除 script 标签及内容
 * 4. sanitizeHtml: 移除 style 标签及 HTML 注释
 * 5. sanitizeHtml: 移除危险协议与 on* 事件处理器
 * 6. sanitizeMarkdown: 保留 Markdown 语法但移除危险 HTML
 * 7. sanitizeMarkdown: 净化链接中的 javascript: 协议
 * 8. sanitizeSearchQuery: 移除控制字符与 HTML 标签
 * 9. sanitizeSearchQuery: 限制最大长度
 * 10. sanitizeHtml: 处理空输入与非字符串
  * @covers_docs []
*/
import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  sanitizeHtml,
  sanitizeMarkdown,
  sanitizeSearchQuery,
} from '@/lib/xssSanitizer'

describe('escapeHtml', () => {
  it('应正确转义所有特殊字符', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;&#x2F;script&gt;',
    )
    expect(escapeHtml("a'b`c/d")).toBe('a&#x27;b&#x60;c&#x2F;d')
    expect(escapeHtml('a & b > c < d')).toBe('a &amp; b &gt; c &lt; d')
  })

  it('应处理空输入和非字符串', () => {
    expect(escapeHtml('')).toBe('')
    // @ts-expect-error 测试非字符串输入
    expect(escapeHtml(null)).toBe('')
    // @ts-expect-error 测试 undefined 输入
    expect(escapeHtml(undefined)).toBe('')
  })

  it('对无特殊字符的字符串应原样返回', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123')
  })
})

describe('sanitizeHtml', () => {
  it('应移除 script 标签及其内容', () => {
    const input = '<script>alert("xss")</script>正常文本'
    expect(sanitizeHtml(input)).toBe('正常文本')
  })

  it('应移除 style 标签、HTML 注释与所有 HTML 标签', () => {
    const input = '<style>body{color:red}</style><!--注释--><b>粗体</b><p>段落</p>'
    const result = sanitizeHtml(input)
    expect(result).toBe('粗体段落')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('应移除危险协议（javascript:/vbscript:/data:）', () => {
    const input = 'javascript:alert(1) vbscript:msgbox(2) data:text/html,<script>'
    const result = sanitizeHtml(input)
    expect(result.toLowerCase()).not.toContain('javascript:')
    expect(result.toLowerCase()).not.toContain('vbscript:')
    expect(result.toLowerCase()).not.toContain('data:')
  })

  it('应处理空输入与非字符串', () => {
    expect(sanitizeHtml('')).toBe('')
    // @ts-expect-error 测试非字符串输入
    expect(sanitizeHtml(null)).toBe('')
  })

  it('应处理多层嵌套的恶意 HTML', () => {
    const input = '<div><span onclick="evil()">文本</span></div>'
    const result = sanitizeHtml(input)
    expect(result).toBe('文本')
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('<')
  })
})

describe('sanitizeMarkdown', () => {
  it('应保留 Markdown 语法（#、*、`、>、-）但移除 HTML 标签', () => {
    const input = '# 标题\n\n**加粗** `代码` > 引用\n\n- 列表项\n<b>html</b>'
    const result = sanitizeMarkdown(input)
    expect(result).toContain('# 标题')
    expect(result).toContain('**加粗**')
    expect(result).toContain('`代码`')
    expect(result).toContain('> 引用')
    expect(result).toContain('- 列表项')
    expect(result).toContain('html')
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('</b>')
  })

  it('应移除 script/iframe/object 等危险标签及其内容', () => {
    const input = '<script>alert(1)</script>\n<iframe src="evil"></iframe>\n正常文本'
    const result = sanitizeMarkdown(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('<iframe')
    expect(result).toContain('正常文本')
  })

  it('应净化 Markdown 链接中的 javascript: 协议', () => {
    const input = '[点击](javascript:alert(1))'
    const result = sanitizeMarkdown(input)
    expect(result).toBe('[点击](#))')
    expect(result.toLowerCase()).not.toContain('javascript:')
  })

  it('应保留合法的 Markdown 链接', () => {
    const input = '[官网](https://example.com)'
    expect(sanitizeMarkdown(input)).toBe('[官网](https://example.com)')
  })

  it('应处理空输入与非字符串', () => {
    expect(sanitizeMarkdown('')).toBe('')
    // @ts-expect-error 测试非字符串输入
    expect(sanitizeMarkdown(123)).toBe('')
  })
})

describe('sanitizeSearchQuery', () => {
  it('应移除控制字符（保留 \\t \\n \\r）', () => {
    const input = '查询\x00词\x07语\t换行\n回车\r'
    const result = sanitizeSearchQuery(input)
    expect(result).toBe('查询词语\t换行\n回车\r')
  })

  it('应移除 HTML 标签', () => {
    const input = '<script>alert(1)</script>搜索词'
    const result = sanitizeSearchQuery(input)
    expect(result).toBe('alert(1)搜索词')
    expect(result).not.toContain('<')
  })

  it('应限制最大长度', () => {
    const input = 'a'.repeat(200)
    const result = sanitizeSearchQuery(input, 50)
    expect(result).toHaveLength(50)
  })

  it('应使用默认最大长度 100', () => {
    const input = 'b'.repeat(150)
    expect(sanitizeSearchQuery(input)).toHaveLength(100)
  })

  it('应处理空输入与非字符串', () => {
    expect(sanitizeSearchQuery('')).toBe('')
    // @ts-expect-error 测试非字符串输入
    expect(sanitizeSearchQuery(null)).toBe('')
  })
})
