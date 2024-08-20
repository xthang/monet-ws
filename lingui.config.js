console.log('--  lingui.config.js')

const locales = ['en-US', 'vi']

if (process.env.ENVIRONMENT !== 'production') {
  locales.push('pseudo')
}

/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  locales,
  fallbackLocales: {
    default: 'en-US'
  },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/node_modules/**', '**/src/lib/**', '**/*.d.ts', '**/*.js']
    }
  ],
  format: 'po',
  orderBy: 'messageId',
  rootDir: '.',
  runtimeConfigModule: ['@lingui/core', 'i18n'],
  sourceLocale: 'en-US',
  pseudoLocale: 'pseudo'
}
