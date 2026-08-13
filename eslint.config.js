import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import noHardcodedColors from './scripts/quality/eslint-plugin-no-hardcoded-colors.js'
import noRecordStringString from './scripts/quality/eslint-plugin-no-record-string-string.js'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'no-hardcoded-colors': noHardcodedColors,
      'no-record-string-string': noRecordStringString,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // ── Tailwind CSS 设计系统数值（非业务魔法数字）──
      // Tailwind 颜色色阶：50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
      // Tailwind 间距/尺寸：0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
      // 常见阈值：15, 25, 30, 40, 45, 55, 70, 75, 80, 85, 90
      // 百分比/比例：0.1, 0.01, 0.25, 0.3, 0.33, 0.5, 0.6, 0.75, 0.8, 0.9, 1.5, 2.5
      // 超时时间（毫秒）：3000, 5000, 10000, 15000, 20000, 30000, 60000, 120000
      // 通用分值：-5, -3, -2, -1
      'no-magic-numbers': ['warn', {
        ignore: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 23, 24, 25, 26, 28, 30, 32, 33, 35, 36, 40, 44, 45, 48, 50, 51, 52, 55, 56, 59, 60, 61, 64, 65, 70, 72, 75, 78, 80, 85, 90, 92, 95, 96, 99, 100, 105, 120, 128, 130, 140, 150, 160, 200, 252, 255, 256, 300, 360, 365, 400, 500, 600, 700, 720, 800, 900, 950, 1000, 1024, 1200, 1500, 16000, 2000, 25000, 3000, 31000, 32000, 33000, 34000, 3500, 35000, 3600, 5000, 8000, 10000, 15000, 20000, 30000, 60000, 86400000, 120000,
          -5000, -200, -100, -60, -26, -25, -20, -19, -12, -8, -6, -4, -1,
          0.001, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.06, 0.07, 0.08, 0.1, 0.15, 0.16, 0.2, 0.25, 0.28, 0.3, 0.33, 0.4, 0.5, 0.6, 0.7, 0.75, 0.78, 0.8, 0.85, 0.9, 0.95, 0.99, 1.05, 1.15, 1.2, 1.4, 1.5, 1.56, 1.6, 2.35, 2.5, 3.5, 4.2, 4.5, 5.5,
        ],
        ignoreArrayIndexes: true,
        enforceConst: true,
        detectObjects: false,
      }],
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-hardcoded-colors/no-hardcoded-tailwind-colors': 'warn',
      'no-record-string-string/no-record-string-to-branded': 'error',
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-with': 'error',
      'no-implied-eval': 'error',
    },
  },
  tseslint.config(
    {
      extends: [...tseslint.configs.recommendedTypeChecked],
      files: ['src/**/*.{ts,tsx}'],
      ignores: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**/*'],
      languageOptions: {
        parserOptions: {
          project: ['./tsconfig.json', './tsconfig.test.json'],
        },
      },
      rules: {
        '@typescript-eslint/no-unnecessary-condition': 'warn',
        '@typescript-eslint/strict-boolean-expressions': ['warn', {
          allowNullableString: true,
          allowNullableNumber: true,
          allowNullableObject: true,
          allowNullableBoolean: true,
        }],
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',
        '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
        '@typescript-eslint/await-thenable': 'warn',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-misused-promises': 'warn',
        '@typescript-eslint/prefer-nullish-coalescing': 'warn',
        '@typescript-eslint/prefer-optional-chain': 'warn',
        '@typescript-eslint/unbound-method': 'warn',
        '@typescript-eslint/require-await': 'warn',
      },
    },
    // MCP 服务器：async 由接口契约约束（MCP Tool 必须返回 Promise），豁免 require-await
    {
      files: ['src/mcp/servers/**/*.ts'],
      rules: {
        '@typescript-eslint/require-await': 'off',
      },
    },
    // 数据/配置/常量文件：包含大量业务数据数值（股票代码、阈值、色阶），豁免 no-magic-numbers
    {
      files: ['src/data/**/*.ts', 'src/config/**/*.ts', 'src/constants/**/*.ts', 'src/fixtures/**/*.ts'],
      rules: {
        'no-magic-numbers': 'off',
      },
    },
    // 服务层：防御性空值检查在生产代码中是安全实践，豁免 no-unnecessary-condition
    // 服务层魔法数字多为业务阈值/超时/重试次数，豁免 no-magic-numbers
    {
      files: ['src/services/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unnecessary-condition': 'off',
        'no-magic-numbers': 'off',
      },
    },
    {
      files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/unbound-method': 'off',
        // 测试数据天然包含数字（如股票代码 600519、价格 50.5），豁免魔法数字规则
        'no-magic-numbers': 'off',
        // 测试文件大量使用 console.log 输出调试信息，豁免 no-console
        'no-console': 'off',
        // 测试文件可能有意使用 async 但不需要 await（如 mock 接口签名对齐）
        '@typescript-eslint/require-await': 'off',
        // 测试文件允许不必要的条件判断（mock 数据类型不精确）
        '@typescript-eslint/no-unnecessary-condition': 'off',
        // 测试文件允许非严格布尔表达式
        '@typescript-eslint/strict-boolean-expressions': 'off',
      },
    }
  )
)
