import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import noHardcodedColors from './scripts/quality/eslint-plugin-no-hardcoded-colors.js'

export default [
  { ignores: ['dist', 'node_modules', 'coverage', 'coverage_cmd', '.venv', '.husky', '.git', '.github', 'e2e', 'docs', 'scripts', 'public', 'test-results'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.test.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'no-hardcoded-colors': noHardcodedColors,
    },
    rules: {
      // 仅保留颜色硬编码门禁，其余规则全部关闭
      'no-hardcoded-colors/no-hardcoded-tailwind-colors': 'error',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'no-control-regex': 'off',
    },
  },
]
