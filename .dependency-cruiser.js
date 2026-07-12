export default {
  exclude: [
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /__tests__/,
    /node_modules/,
    /dist/,
  ],
  dependencyTypes: [
    'local',
    'npm',
    'npm-dev',
    'npm-peer',
    'npm-bundled',
  ],
  validate: true,
  rules: {
    'no-circular': {
      severity: 'error',
      comment: '禁止循环依赖',
    },
    'no-orphans': {
      severity: 'warn',
      comment: '未被引用的模块（可能是死代码）',
    },
    'no-unreachable': {
      severity: 'warn',
      comment: '无法从入口点到达的模块',
    },
    'no-deprecated': {
      severity: 'warn',
      comment: '使用了已废弃的模块',
    },
    'no-non-package-json': {
      severity: 'error',
      comment: '使用了未在 package.json 中声明的依赖',
    },
    'no-missing': {
      severity: 'error',
      comment: '缺失的依赖',
    },
    'no-external-circular': {
      severity: 'error',
      comment: '外部依赖循环',
    },
    'allow-unknown': {
      severity: 'info',
      comment: '允许未知类型的依赖',
    },
  },
  tsConfig: {
    fileName: 'tsconfig.json',
  },
  basePath: '.',
}