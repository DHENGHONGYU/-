/**
 * ESLint 自定义规则插件：V9 Store 最佳实践规则集
 *
 * 规则列表：
 * 1. no-async-without-is-refreshing - async Store action 必须检查 isRefreshing 防重入锁
 *
 * 参考文档：
 * - docs/guides/standards/store-concurrency-safety-best-practices.md
 */

const STORE_FILE_PATTERN = /[A-Za-z]+Store\.ts$/;
const EXEMPT_FILES = [
  'useSearchStore',
  'useTokenStore',
  'useVoiceStore',
];

export default {
  rules: {
    /**
     * 规则 1：no-async-without-is-refreshing
     *
     * 检测目标：
     * - Store 文件中的 async action（Promise 返回函数）
     * - 必须在函数体前 5 行内检查 `isRefreshing` 防重入锁
     *
     * 豁免场景：
     * - 方法体内无 async IO 操作的纯函数
     * - 内部 helper 函数（以下划线开头的方法名）
     *
     * 严重级别：error（P0）
     */
    'no-async-without-is-refreshing': {
      meta: {
        type: 'problem',
        docs: {
          description: 'async Store action 必须在函数体首行检查 isRefreshing 防重入锁（模式 A）',
          category: 'V9 Best Practices',
          recommended: true,
        },
        fixable: null,
        schema: [
          {
            type: 'object',
            properties: {
              checkDepth: {
                type: 'number',
                description: '检查函数体前 N 行是否包含 isRefreshing 检查',
                default: 5,
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          missing: 'async action "{{name}}" 缺少 isRefreshing 防重入检查。请在函数体开头添加 `if (get().isRefreshing) { return; }` 或类似逻辑',
        },
      },

      create(context) {
        const filename = context.getFilename();
        const options = context.options[0] || {};
        const checkDepth = options.checkDepth || 5;

        // 只检查 Store 文件
        if (!STORE_FILE_PATTERN.test(filename)) {
          return {};
        }

        // 豁免特定文件
        const basename = filename.split(/[\\/]/).pop() || '';
        const baseNameWithoutExt = basename.replace('.ts', '');
        if (EXEMPT_FILES.some((exempt) => baseNameWithoutExt.includes(exempt))) {
          return {};
        }

        /**
         * 检查给定节点是否包含有效的防重入机制：
         * 1. isRefreshing 检查（标准模式 A）
         * 2. refreshCoordinator.coordinateRefresh（高级协调模式）
         * 3. _coordinator.coordinate（通用协调模式）
         */
        function containsIsRefreshingCheck(node) {
          const source = context.getSourceCode().getText(node);
          // 标准模式 A：isRefreshing 检查
          if (source.includes('isRefreshing')) {
            return true;
          }
          // 高级模式：RefreshCoordinator 协调
          if (source.includes('coordinateRefresh')) {
            return true;
          }
          // 通用模式：coordinator 协调
          if (source.includes('.coordinate(')) {
            return true;
          }
          return false;
        }

        /**
         * 检查函数体是否包含 isRefreshing 检查
         */
        function bodyHasIsRefreshingCheck(body) {
          if (!body || body.type !== 'BlockStatement') {
            return false;
          }

          const statements = body.body;
          const limit = Math.min(statements.length, checkDepth);

          for (let i = 0; i < limit; i++) {
            if (containsIsRefreshingCheck(statements[i])) {
              return true;
            }
          }

          return false;
        }

        // Store action 名称模式
        const actionNamePattern = /^(refresh|load|check|fetch|update|delete|add|save|remove|reset|run|execute|cancel|confirm|handle|generate|search|sync|import|export|start|stop|create|build|collect|scan|process|transfer|upload|download|send|receive|open|close|toggle|set|get|query|execute|submit|commit|dispatch|publish|subscribe)$/;

        return {
          // 匹配 Zustand create() 内的箭头函数属性
          Property(node) {
            if (!STORE_FILE_PATTERN.test(filename)) return;

            let isAsync = false;
            let funcBody = null;
            let actionName = '';

            if (node.value && node.value.type === 'ArrowFunctionExpression' && node.value.async) {
              isAsync = true;
              funcBody = node.value.body;
              actionName = node.key.name || node.key.value || 'unknown';
            } else if (node.method && node.value && node.value.type === 'FunctionExpression' && node.value.async) {
              isAsync = true;
              funcBody = node.value.body;
              actionName = node.key.name || node.key.value || 'unknown';
            }

            if (!isAsync || !funcBody) return;

            // 豁免内部 helper
            if (actionName.startsWith('_')) return;

            // 检查是否为 Store action
            if (!actionNamePattern.test(actionName)) return;

            // 检查函数体是否包含防重入
            if (!bodyHasIsRefreshingCheck(funcBody)) {
              context.report({
                node,
                messageId: 'missing',
                data: { name: actionName },
              });
            }
          },

          // 匹配异步方法声明
          MethodDefinition(node) {
            if (!STORE_FILE_PATTERN.test(filename)) return;

            if (!node.value || node.value.type !== 'FunctionExpression' || !node.value.async) return;

            const actionName = node.key.name || node.key.value || 'unknown';

            if (actionName.startsWith('_')) return;

            if (!actionNamePattern.test(actionName)) return;

            if (!bodyHasIsRefreshingCheck(node.value.body)) {
              context.report({
                node,
                messageId: 'missing',
                data: { name: actionName },
              });
            }
          },
        };
      },
    },
  },
};
