/**
 * ESLint plugin: no-raw-tofixed
 *
 * 禁止直接使用 .toFixed()，必须使用 safeFormatNumber/safeFormatPercent。
 * 计算场景文件可通过 allowedPaths 豁免。
 *
 * @doc M3-D6 — safeFormatNumber 统一收口
 */

export default {
  rules: {
    'no-raw-tofixed': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止直接使用 .toFixed()，必须使用 safeFormatNumber/safeFormatPercent',
        },
        schema: [
          {
            type: 'object',
            properties: {
              allowedPaths: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          noRawToFixed:
            '禁止直接使用 .toFixed()，请使用 safeFormatNumber(value, digits) 或 safeFormatPercent(value, digits)。计算场景可通过 allowedPaths 豁免。',
        },
      },
      defaultOptions: [{ allowedPaths: [] }],
      create(context) {
        const options = context.options?.[0] ?? {}
        const filename = context.filename || (typeof context.getFilename === 'function' ? context.getFilename() : '')
        const normalizedFilename = filename.replace(/\\/g, '/')
        const allowed = options.allowedPaths ?? []

        // 豁免路径检查（标准化路径分隔符以兼容 Windows）
        if (allowed.some((p) => normalizedFilename.includes(p))) return {}

        return {
          CallExpression(node) {
            if (
              node.callee?.type === 'MemberExpression' &&
              node.callee.property?.type === 'Identifier' &&
              node.callee.property.name === 'toFixed'
            ) {
              context.report({ node, messageId: 'noRawToFixed' })
            }
          },
        }
      },
    },
  },
}
