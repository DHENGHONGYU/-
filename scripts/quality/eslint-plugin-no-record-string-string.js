/**
 * ESLint 自定义规则：禁止 Record<string, string> 作为 branded type 映射表
 *
 * 背景（P3 教训）：
 *   DIMENSION_TO_ACTION: Record<string, string> = { '01': 'saveQuote' }
 *   值 'saveQuote' 被 TS 宽化为 string，无法收窄为 EnvelopeAction 联合类型。
 *   应移除显式 Record<string, string> 标注，让 TS 推断字面量类型，
 *   或改为 Record<string, EnvelopeAction>。
 */

export default {
  rules: {
    'no-record-string-to-branded': {
      meta: {
        type: 'suggestion',
        docs: {
          description: '禁止 Record<string, string> 作为 branded type 映射表类型标注',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          avoidRecordStringString:
            '{{ name }} 标注为 Record<string, string> 但其属性值 {{ sampleValue }} 看起来是 branded type 字面量（动作/类型标识符）。建议移除类型标注让 TS 推断字面量类型，或改为精确的 Record<string, SpecificType>。',
        },
        schema: [],
      },

      create(context) {
        const sourceCode = context.getSourceCode()

        function looksLikeBrandedLiteral(value) {
          if (typeof value !== 'string') return false
          const brandedPatterns = [
            /^save[A-Z]\w+$/,
            /^insert[A-Z]\w+$/,
            /^delete[A-Z]\w+$/,
            /^update[A-Z]\w+$/,
            /^fetch[A-Z]\w+$/,
            /^calc[A-Z]\w+$/,
            /^create[A-Z]\w+$/,
            /^remove[A-Z]\w+$/,
            /^merge[A-Z]\w+$/,
            /^replace[A-Z]\w+$/,
            /^archive[A-Z]\w+$/,
          ]
          return brandedPatterns.some((p) => p.test(value))
        }

        return {
          VariableDeclarator(node) {
            // 必须有类型标注
            if (!node.id || !node.id.typeAnnotation) return
            const typeAnn = node.id.typeAnnotation.typeAnnotation
            if (!typeAnn) return

            // 必须有初始化对象
            const init = node.init
            if (!init || init.type !== 'ObjectExpression') return

            // 检查类型标注文本是否包含 Record<string, string>
            const typeText = sourceCode.getText(typeAnn)
            const isRecordStringString =
              /\bRecord\s*<\s*string\s*,\s*string\s*>/.test(typeText)
            if (!isRecordStringString) return

            // 检查是否有 branded 值
            const brandedProp = init.properties.find((prop) => {
              if (!prop.value || prop.value.type !== 'Literal') return false
              return looksLikeBrandedLiteral(prop.value.value)
            })

            if (brandedProp) {
              context.report({
                node: node.id,
                messageId: 'avoidRecordStringString',
                data: {
                  name: node.id.name,
                  sampleValue: String(brandedProp.value.value),
                },
              })
            }
          },
        }
      },
    },
  },
}
