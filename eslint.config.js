import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

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
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-magic-numbers': ['warn', { ignore: [0, 1, 2, 3, 4, 5, 10, 20, 50, 60, 100, 1000], ignoreArrayIndexes: true, enforceConst: true, detectObjects: false }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
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