import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import noHardcodedColors from './scripts/eslint-plugin-no-hardcoded-colors.js'

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
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 20, 24, 25, 28, 30, 32, 36, 40, 44, 45, 48, 50, 52, 55, 56, 60, 64, 70, 72, 75, 80, 85, 90, 96, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000, 1500, 3000, 5000, 10000, 15000, 20000, 30000, 60000, 120000,
          -100, -50, -10, -5, -3, -2, -1,
          0.1, 0.01, 0.25, 0.3, 0.33, 0.5, 0.6, 0.75, 0.8, 0.9, 1.5, 2.5,
        ],
        ignoreArrayIndexes: true,
        enforceConst: true,
        detectObjects: false,
      }],
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-hardcoded-colors/no-hardcoded-tailwind-colors': 'warn',
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
        '@typescript-eslint/strict-boolean-expressions': 'warn',
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
    {
      files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/unbound-method': 'off',
        // 测试数据天然包含数字（如股票代码 600519、价格 50.5），豁免魔法数字规则
        'no-magic-numbers': 'off',
      },
    }
  )
)