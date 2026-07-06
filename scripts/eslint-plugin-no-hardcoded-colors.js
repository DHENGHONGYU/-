/**
 * ESLint 自定义规则：禁止硬编码 Tailwind 颜色类
 * 
 * 规则说明：
 * 禁止在 JSX className 属性中直接使用 Tailwind 颜色类（如 text-red-500, bg-blue-100）
 * 必须使用颜色令牌系统（COLOR_SHADES, twText, twBg, twBorder）
 * 
 * 豁免文件：
 * - src/constants/theme.tokens.ts（令牌定义文件）
 * - src/config/chartColors.ts（图表配色定义）
 * - tests/**（测试文件）
 */

const COLOR_PATTERNS = [
  // text-* 颜色类
  /(?:^|\s)text-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
  
  // bg-* 颜色类
  /(?:^|\s)bg-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
  
  // border-* 颜色类
  /(?:^|\s)border-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
  
  // hover: 变体
  /hover:(?:text|bg|border)-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
  
  // focus: 变体
  /focus:(?:text|bg|border)-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
  
  // dark: 变体
  /dark:(?:text|bg|border)-(?:red|green|blue|yellow|amber|gray|slate|purple|orange|cyan|emerald|indigo|teal|pink|rose|violet|fuchsia|lime|sky|zinc|neutral|stone)-\d+/,
];

const EXEMPT_FILES = [
  'src/constants/theme.tokens.ts',
  'src/config/chartColors.ts',
  'src/config/themeRegistry.ts',
  'src/theme.config.ts',
];

export default {
  rules: {
    'no-hardcoded-tailwind-colors': {
      meta: {
        type: 'suggestion',
        docs: {
          description: '禁止硬编码 Tailwind 颜色类，必须使用颜色令牌系统',
          category: 'Best Practices',
          recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
          noHardcodedColor: '禁止使用硬编码颜色类 "{{color}}"，请使用颜色令牌系统（COLOR_SHADES, twText, twBg, twBorder）。参考 AGENTS.md §3.5',
        },
      },
      
      create(context) {
        const filename = context.getFilename();
        
        // 豁免文件检查
        if (EXEMPT_FILES.some(exempt => filename.includes(exempt))) {
          return {};
        }
        
        // 测试文件豁免
        if (filename.includes('/tests/') || filename.endsWith('.test.ts') || filename.endsWith('.test.tsx')) {
          return {};
        }
        
        return {
          JSXAttribute(node) {
            // 只检查 className 属性
            if (node.name.name !== 'className') {
              return;
            }
            
            // 检查字符串字面量
            if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
              const classNameValue = node.value.value;
              
              for (const pattern of COLOR_PATTERNS) {
                const match = classNameValue.match(pattern);
                if (match) {
                  context.report({
                    node: node.value,
                    messageId: 'noHardcodedColor',
                    data: {
                      color: match[0].trim(),
                    },
                  });
                  break; // 只报告第一个匹配
                }
              }
            }
            
            // 检查模板字面量
            if (node.value && node.value.type === 'JSXExpressionContainer') {
              const expression = node.value.expression;
              
              if (expression.type === 'TemplateLiteral') {
                for (const quasi of expression.quasis) {
                  const rawValue = quasi.value.raw;
                  
                  for (const pattern of COLOR_PATTERNS) {
                    const match = rawValue.match(pattern);
                    if (match) {
                      context.report({
                        node: quasi,
                        messageId: 'noHardcodedColor',
                        data: {
                          color: match[0].trim(),
                        },
                      });
                      break;
                    }
                  }
                }
              }
            }
          },
        };
      },
    },
  },
};
