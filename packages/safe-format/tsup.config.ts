import { defineConfig } from 'tsup'

/**
 * tsup 构建配置 — 同时产出 ESM 和 CJS 格式
 *
 * 产出文件：
 *   dist/index.js      — ESM 格式（import/export）
 *   dist/index.cjs     — CJS 格式（require/module.exports）
 *   dist/index.d.ts    — TypeScript 类型声明
 *   dist/index.js.map  — ESM source map
 *   dist/index.cjs.map — CJS source map
 *
 * 对应 package.json exports 映射：
 *   "exports": {
 *     ".": {
 *       "types":   "./dist/index.d.ts",
 *       "import":  "./dist/index.js",
 *       "require": "./dist/index.cjs"
 *     }
 *   }
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
})
