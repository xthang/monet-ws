const longParentPath = Array.from({ length: 10 }, (_, i) => '../'.repeat(i + 1).slice(0, -1)).join(',')

module.exports = {
  env: {
    node: true
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['/node_modules/', 'dist', 'build', 'public', '/ignore/'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'import'],
  rules: {
    // Eslint base rules
    // "no-unused-vars": 1,
    // "no-void": 1,

    // Eslint Typescript rules
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
    '@typescript-eslint/no-explicit-any': 'warn',

    // Other rules

    'prettier/prettier': ['error'],

    'import/no-unassigned-import': ['error', { allow: ['**/polyfills/*', '**/*.{css,scss}'] }],
    // 'import/no-unused-modules': [
    //   'warn',
    //   {
    //     unusedExports: true,
    //     ignoreExports: [],
    //   },
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
            pattern: 'react*{,/**}',
            group: 'external',
            position: 'before'
          },
          {
            pattern: 'vite*{,/**}',
            group: 'external',
            position: 'before'
          },
          {
            pattern: 'next*{,/**}',
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
