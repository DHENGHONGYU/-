# Changelog

All notable changes to **@finsightv9/safe-format** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] — 2026-08-06

### Summary
Patch release focused on **packaging & toolchain fixes** discovered during the first post-publish audit (P2 / P3 severity). No API changes and no behavioral changes to any formatting logic. Upgrading from `1.0.0` is **strongly recommended** for every consumer.

> ❗ **Why every 1.0.0 consumer should upgrade:**  
> In `1.0.0` the `exports.require` entry in `package.json` pointed at `./dist/index.cjs`, but the build only produced ESM (`./dist/index.js`). Any CommonJS consumer using `require('@finsightv9/safe-format')` would therefore crash with `MODULE_NOT_FOUND`. `1.0.1` ships both formats and fixes the issue at zero cost.

---

### Fixed

#### P2 — Broken `exports` / missing CJS build
| Item | Detail |
|------|--------|
| **Severity** | P2 — Affects every CommonJS consumer (Node.js <14 default, Jest, older bundlers, legacy scripts) |
| **Issue** | `package.json` declared dual ESM/CJS via the `exports` map (`".": { import: "./dist/index.js", require: "./dist/index.cjs" }`), but the `tsc`-based build step only emitted the ESM file. `require('@finsightv9/safe-format')` crashed with `Error: Cannot find module .../dist/index.cjs`. |
| **Root cause** | Build tool (`tsc`) configured for ESM-only output while the package manifest claimed CJS was also available. |
| **Fix** | Switched the build pipeline from `tsc -p tsconfig.json` to `tsup` and declared `format: ['esm', 'cjs']` so both module formats are produced from the same TypeScript source. |
| **Files touched** | New `tsup.config.ts` (ESM+CJS+DTS+sourcemap), updated `scripts.build` in `package.json`. |
| **New outputs in `dist/`** | `index.cjs`, `index.cjs.map`, `index.d.cts` (alongside the existing `index.js`, `index.js.map`, `index.d.ts`). |
| **Verification** | Added `examples/verify-cjs.cjs` which does `require('@finsightv9/safe-format')` and exercises all 3 public functions; output is validated end-to-end against known inputs. |

#### P3 — Dev dependency versions drifted from the parent monorepo
| Item | Detail |
|------|--------|
| **Severity** | P3 — Silent consistency / reproducibility issue (no runtime impact, CI/CD only) |
| **Issue** | The package's `devDependencies` (Node types, TypeScript, Vitest, tsup) were pinned to older major/minor lines than the parent FinSightV9 monorepo, meaning the package was built & tested locally against a different compiler/runtime than the rest of the project. |
| **Before** | `@types/node@^20.0.0`, `typescript@^5.4.0`, `vitest@^1.0.0`, `tsup@^8.0.0` |
| **After (aligned with root)** | `@types/node@^22.10.0`, `typescript@^5.7.0`, `vitest@^2.1.0`, `tsup@^8.5.0` |
| **Risk addressed** | Eliminates "works on my machine but fails in monorepo CI" caused by subtle TypeScript `lib` differences, Vitest API changes between 1.x and 2.x, or tsup ESM/CJS default behaviour shifts. |
| **Verification** | Fresh install + `npm run build` + `vitest run` (33/33 passing) inside the package directory after the version bump. |

---

### Build Artifact Comparison (1.0.0 → 1.0.1)

| Artifact in `dist/`     | 1.0.0 | 1.0.1 |
|-------------------------|:-----:|:-----:|
| `index.js`          (ESM) |   ✅  |   ✅  |
| `index.js.map`      (ESM) |   ✅  |   ✅  |
| `index.d.ts`        (ESM types) | ✅ |  ✅  |
| `index.cjs`         (CJS) |   ❌  |   ✅  **← P2 fix** |
| `index.cjs.map`     (CJS) |   ❌  |   ✅  |
| `index.d.cts`       (CJS types) | ❌ | ✅  |

---

### Tests Added / Updated in this Release
- ✅ `verify-cjs.cjs` — standalone runtime smoke test for the CJS entry point (covers `safeFormatNumber`, `safeFormatPercent`, `safeFormatCurrency` with null/valid/edge inputs).
- ✅ The existing 33 unit tests in `src/index.test.ts` were re-run with the aligned vitest 2.x + typescript 5.7 and **all 33 continue to pass** (no behavioural regressions).

---

### Upgrade Notes
- **`^1.0.0` consumers**: running `npm update @finsightv9/safe-format` (or re-resolving your lockfile) picks up `1.0.1` automatically — no code changes required.
- **TypeScript consumers**: no action needed — the shape of every public type/signature is byte-identical to `1.0.0`.
- **Bundler consumers (Vite / webpack / Rollup)**: with the fixed `exports` map, the ESM entry is still picked up automatically; bundlers that previously had to fall back to `main` now resolve the correct conditional export.
- **Jest / CJS consumers**: `require('@finsightv9/safe-format')` now works out of the box. No need for `interop: default` hacks.

---

## [1.0.0] — 2026-08-05

### Added
- Initial public release of the safe number-formatting helpers extracted from the FinSightV9 investment research platform.
- **Public API** (3 functions):
  - `safeFormatNumber(value, decimals, fallback?)` — null/NaN/Infinity-safe wrapper around `Number.prototype.toFixed`, with decimal clamping to `[0, 20]`.
  - `safeFormatPercent(value, decimals?, fallback?)` — builds on `safeFormatNumber` and prepends a `+` sign for strictly positive numbers, appends `%`.
  - `safeFormatCurrency(value, decimals?, fallback?)` — `Intl.NumberFormat('en-US')` thousand-grouped output with the same null-safety guarantees as the other two helpers.
- Default fallback string: `"--"` (configurable per-call).
- TypeScript `.d.ts` declarations shipped alongside the JS bundle.
- MIT license.
