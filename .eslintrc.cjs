/* eslint-disable */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  overrides: [
    {
      // postcss.config.js, tailwind.config.js etc. are CommonJS Node scripts
      files: ['*.cjs', '*.config.js', 'tailwind.config.js', 'postcss.config.js'],
      env: { node: true, commonjs: true },
    },
  ],
}
