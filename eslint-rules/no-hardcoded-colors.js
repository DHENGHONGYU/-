/**
 * ESLint 规则：禁止硬编码颜色值
 * 
 * 检测并阻止在组件中直接使用 HEX、RGB、HSL 颜色值或 Tailwind 颜色类名。
 * 所有颜色必须通过 Design Tokens 引用。
 */

const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/
const RGB_COLOR_REGEX = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/
const RGBA_COLOR_REGEX = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/
const HSL_COLOR_REGEX = /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)/
const TAILWIND_COLOR_REGEX = /\b(text|bg|border|ring|from|to|via)-(red|blue|green|amber|purple|cyan|emerald|orange|pink|teal|indigo|gray|slate|yellow|orange|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/

// 豁免文件列表
const EXEMPTED_FILES = [
  'src/constants/theme.tokens.ts',
  'src/config/chartColors.ts',
  'src/config/themeRegistry.ts',
  'src/theme.config.ts',
  'src/generated/tokens.ts',
  'src/generated/tokens.css',
]

// 豁免目录
const EXEMPTED_DIRS = [
  'tests/',
  '__tests__/',
  '.test.',
  '.spec.',
]

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止硬编码颜色值，必须使用 Design Tokens',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noHexColor: '禁止使用硬编码 HEX 颜色值 "{{value}}"。请使用 COLOR_TOKENS 或 COLOR_SHADES 令牌。',
      noRgbColor: '禁止使用硬编码 RGB/RGBA 颜色值 "{{value}}"。请使用 COLOR_TOKENS 或 COLOR_SHADES 令牌。',
      noHslColor: '禁止使用硬编码 HSL 颜色值 "{{value}}"。请使用 COLOR_TOKENS 或 COLOR_SHADES 令牌。',
      noTailwindColor: '禁止使用硬编码 Tailwind 颜色类 "{{value}}"。请使用 COLOR_TOKENS、COLOR_SHADES 或 twText/twBg/twBorder 辅助函数。',
    },
  },
  create(context) {
    const filename = context.getFilename()
    
    // 检查是否在豁免列表中
    const isExempted = EXEMPTED_FILES.some(file => filename.includes(file)) ||
                       EXEMPTED_DIRS.some(dir => filename.includes(dir))
    
    if (isExempted) {
      return {}
    }

    return {
      // 检查字符串字面量
      Literal(node) {
        if (typeof node.value !== 'string') return

        const value = node.value

        // 检查 HEX 颜色
        if (HEX_COLOR_REGEX.test(value)) {
          context.report({
            node,
            messageId: 'noHexColor',
            data: { value },
          })
        }

        // 检查 RGB/RGBA 颜色
        if (RGB_COLOR_REGEX.test(value) || RGBA_COLOR_REGEX.test(value)) {
          context.report({
            node,
            messageId: 'noRgbColor',
            data: { value },
          })
        }

        // 检查 HSL 颜色
        if (HSL_COLOR_REGEX.test(value)) {
          context.report({
            node,
            messageId: 'noHslColor',
            data: { value },
          })
        }
      },

      // 检查 JSX 属性（className）
      JSXAttribute(node) {
        if (node.name.name !== 'className') return
        if (node.value.type !== 'Literal') return
        if (typeof node.value.value !== 'string') return

        const className = node.value.value

        // 检查 Tailwind 颜色类
        if (TAILWIND_COLOR_REGEX.test(className)) {
          context.report({
            node,
            messageId: 'noTailwindColor',
            data: { value: className },
          })
        }
      },

      // 检查模板字面量
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const value = quasi.value.raw

          // 检查 HEX 颜色
          if (HEX_COLOR_REGEX.test(value)) {
            context.report({
              node: quasi,
              messageId: 'noHexColor',
              data: { value: value.match(HEX_COLOR_REGEX)[0] },
            })
          }

          // 检查 Tailwind 颜色类
          if (TAILWIND_COLOR_REGEX.test(value)) {
            const matches = value.match(TAILWIND_COLOR_REGEX)
            if (matches) {
              context.report({
                node: quasi,
                messageId: 'noTailwindColor',
                data: { value: matches[0] },
              })
            }
          }
        }
      },
    }
  },
}
