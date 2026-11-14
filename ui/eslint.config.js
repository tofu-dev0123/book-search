import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // 整形は Prettier に任せるので、ESLint の整形のルールは切る
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // 依存の向き（docs/coding-rules-ui.md）。lib/ を画面から切り離し、画面を描かずにテストできるようにする
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^|/)pages(/|$)', message: 'components/ から pages/ を import しない' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(react|react-dom|react-router)(/|$)',
              message: 'lib/ から React を import しない',
            },
            {
              regex: '(^|/)(components|pages)(/|$)',
              message: 'lib/ から components/・pages/ を import しない',
            },
            { regex: '\\.css$', message: 'lib/ から CSS を import しない' },
          ],
        },
      ],
    },
  },
])
