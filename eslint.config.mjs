// @ts-check

import pluginJs from '@eslint/js'
import configPrettier from 'eslint-config-prettier'
import * as pluginImport from 'eslint-plugin-import'
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const longParentPath = Array.from({ length: 10 }, (_, i) => '../'.repeat(i + 1).slice(0, -1)).join(',')

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  pluginPrettierRecommended,
  configPrettier,

  // @ts-expect-error ...
  pluginImport.flatConfigs.recommended,

  {
    name: 'x-eslint',

    // files: ['**/*.{js,mjs,cjs,ts}'],
    ignores: ['node_modules/', '.nuxt/', 'build/', 'public/', 'dist/', '/ignore/', '/ignored/'],

    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    // linterOptions: {},
    // processor: {},
    plugins: {},

    settings: {
      'import/resolver': {
        // You will also need to install and configure the TypeScript resolver
        // See also https://github.com/import-js/eslint-import-resolver-typescript#configuration
        typescript: true,
        node: true
      }
    },
    rules: {
      // Eslint base rules
      // "no-unused-vars": 1,
      // "no-void": 1,
      'no-empty-pattern': 1,

      //
      // This rule extends the base eslint/no-unused-vars rule. It adds support for TypeScript features, such as types.
      // Note: you must disable the base rule as it can report incorrect errors
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 1,
      '@typescript-eslint/no-empty-object-type': 1,

      'prettier/prettier': [
        'warn',
        {},
        {
          usePrettierrc: true
        }
      ],

      'import/no-unassigned-import': ['error', { allow: ['**/polyfills/*', '**/*.{css,scss}'] }],
      // 'import/no-unused-modules': [
      //   'warn',
      //   {
      //     unusedExports: true,
      //     ignoreExports: []
      //   }
      // ],
      'import/order': [
        'error',
        {
          alphabetize: {
            caseInsensitive: true,
            order: 'asc'
          },
          groups: ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object'], // default: "builtin", "external", "parent", "sibling", "index"
          pathGroups: [
            {
              pattern: '{react,vue}*{,/**}',
              group: 'external',
              position: 'before'
            },
            {
              pattern: 'vite*{,/**}',
              group: 'external',
              position: 'before'
            },
            {
              pattern: '{next,nuxt}*{,/**}',
              group: 'external',
              position: 'before'
            },
            {
              pattern: `{**,.,${longParentPath}}{,/**}/polyfills/{**,*}`,
              group: 'object',
              position: 'after'
            },
            {
              pattern: `{**,.,${longParentPath}}{,/**}/*.{css,scss}`,
              group: 'object',
              position: 'after'
            }
          ],
          pathGroupsExcludedImportTypes: [],
          distinctGroup: false,
          'newlines-between': 'always',
          warnOnUnassignedImports: true
        }
      ]
    }
  }
]
