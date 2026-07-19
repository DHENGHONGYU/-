/**
 * ESLint 规则：禁止使用 `Record<string, string>` 作为配置映射表类型
 *
 * 背景：
 *   P3 教训 — DIMENSION_TO_ACTION: Record<string, string> = {
 *     '01': 'saveQuote', // 字面量类型 'saveQuote' 被宽化为 string，无法传递到 EnvelopeAction
 *   }
 *   当值被视为 branded type（如 EnvelopeAction）的实参时，'saveQuote' 应具有字面量类型
 *   'saveQuote' 而非宽类型 string。
 *
 * 检测模式：
 *   const xxx: Record<string, string> = { ... }
 *   当值中包含如 'saveQuote' / 'saveNews' / 'insert' / 'update' 等动作字面量时，
 *   应改为 Record<string, EnvelopeAction> 或 as const 字面量对象。
 *
 * 豁免：
 *   - 测试文件
 *   - src/generated/ 目录
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '禁止 Record<string, string> 作为 EnvelopeAction/branded type 的映射表类型',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      avoidRecordStringString:
        '{{ name }} 的类型为 Record<string, string>，但其值包含动作字面量。建议改为 Record<string, EnvelopeAction> 或移除显式类型标注让 TS 推断字面量类型。',
    },
    schema: [],
  },

  create(context) {
    /**
     * 检查字符串值是否看起来像 branded type 字面量（EnvelopeAction 等）
     */
    function looksLikeBrandedLiteral(value) {
      if (typeof value !== 'string') return false
      // EnvelopeAction 常见值
      const brandedPatterns = [
        /^save[A-Z]\w+$/, // saveNews, saveQuote, saveConfig ...
        /^insert[A-Z]\w+$/, // insertStock, insertSignal ...
        /^delete[A-Z]\w+$/, // deleteItem ...
        /^update[A-Z]\w+$/, // updateStatus ...
        /^fetch[A-Z]\w+$/, // fetchData ...
        /^calc[A-Z]\w+$/, // calcScore ...
      ]
      return brandedPatterns.some((p) => p.test(value))
    }

    return {
      VariableDeclarator(node) {
        // 只检查 Record<string, string> 类型标注
        if (!node.id.typeAnnotation) return
        const typeAnn = node.id.typeAnnotation.typeAnnotation
        if (!typeAnn) return

        // 匹配 Record<string, string>
        const isRecordStringString =
          typeAnn.type === 'TSTypeReference' &&
          typeAnn.typeName?.type === 'Identifier' &&
          typeAnn.typeName.name === 'Record' &&
          typeAnn.typeParameters?.params?.length === 2 &&
          typeAnn.typeParameters.params[0]?.type === 'TSStringKeyword' &&
          typeAnn.typeParameters.params[1]?.type === 'TSStringKeyword'

        if (!isRecordStringString) return

        // 检查赋值的对象字面量中是否包含 branded 值
        const init = node.init
        if (!init || init.type !== 'ObjectExpression') return

        const name = node.id.name
        const hasBrandedValue = init.properties.some((prop) => {
          if (prop.value?.type !== 'Literal') return false
          return looksLikeBrandedLiteral(prop.value.value)
        })

        if (hasBrandedValue) {
          context.report({
            node: node.id,
            messageId: 'avoidRecordStringString',
            data: { name },
          })
        }
      },
    }
  },
}
