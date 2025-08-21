module.exports = {
  ...require('@edenlabs/config/eslint-api'),
  parserOptions: {
    root: true,
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.lint.json'],
  },
}
