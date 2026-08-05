# @finsightv9/safe-format

Safe number formatting utilities that prevent `TypeError`, `Infinity` display, and `RangeError` from raw `.toFixed()` calls.

Designed for financial UI applications where `null`/`undefined`/`NaN`/`Infinity` values are common and must not crash the page.

## Install

```bash
npm install @finsightv9/safe-format
# or
pnpm add @finsightv9/safe-format
# or
yarn add @finsightv9/safe-format
```

## Why

Raw `.toFixed()` has three critical risks in production:

| Risk | Trigger | Result |
|------|---------|--------|
| **TypeError** | `value` is `null` or `undefined` | Page crash |
| **Infinity display** | Division by zero | UI shows "Infinity" |
| **RangeError** | `decimals` is negative or >100 | Function throws |

`safeFormatNumber` eliminates all three:

```typescript
safeFormatNumber(null, 2)         // '--' (no crash)
safeFormatNumber(Infinity, 2)     // '--' (no "Infinity" display)
safeFormatNumber(42, -1)          // '42' (decimals clamped, no throw)
safeFormatNumber(3.14159, 2)      // '3.14' (normal formatting)
```

## API

### `safeFormatNumber(value, decimals, fallback?)`

```typescript
function safeFormatNumber(
  value: number | undefined | null,
  decimals: number,
  fallback?: string  // default: '--'
): string
```

Guards:
- `null`/`undefined`/`NaN`/`Infinity`/`-Infinity` → returns `fallback`
- `decimals` clamped to `[0, 20]` (negative→0, >20→20, float→truncated, NaN→0)

### `safeFormatPercent(value, decimals?, fallback?)`

```typescript
function safeFormatPercent(
  value: number | undefined | null,
  decimals?: number,  // default: 2
  fallback?: string   // default: '--'
): string
```

Same guards as `safeFormatNumber`, plus:
- Positive numbers get `+` prefix: `safeFormatPercent(1.5, 2)` → `'+1.50%'`
- Negative numbers: `safeFormatPercent(-1.5, 2)` → `'-1.50%'`

### `safeFormatCurrency(value, decimals?, fallback?)`

```typescript
function safeFormatCurrency(
  value: number | undefined | null,
  decimals?: number,  // default: 2
  fallback?: string   // default: '--'
): string
```

Same guards, plus locale-aware thousands separators:
- `safeFormatCurrency(1234567.89, 2)` → `'1,234,567.89'`

## Usage

```typescript
import { safeFormatNumber, safeFormatPercent } from '@finsightv9/safe-format'

// In JSX
<span>{safeFormatNumber(price, 2)}</span>
<span>{safeFormatPercent(changePct, 2)}</span>

// In template strings
const msg = `Score: ${safeFormatNumber(score, 2)}`
const desc = `Return: ${safeFormatPercent(returnRate, 2)}`

// With custom fallback
safeFormatNumber(null, 2, 'N/A')  // 'N/A'
```

## Migration from .toFixed()

```typescript
// Before
price.toFixed(2)                    // crashes if price is null
change.toFixed(2) + '%'             // crashes if change is undefined

// After
safeFormatNumber(price, 2)          // '--' if null
safeFormatPercent(change, 2)        // '--' if undefined
```

## Testing

```bash
npm test              # run tests
npm run test:coverage # run with coverage
```

63 test cases covering:
- null/undefined/NaN/Infinity inputs
- Normal number formatting (positive/zero/negative)
- decimals parameter clamping (negative/NaN/超大/小数/Infinity)
- Custom fallback
- Percentage sign prefix
- Currency thousands separators

## License

MIT
