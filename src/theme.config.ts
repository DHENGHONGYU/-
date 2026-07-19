/**
 * @deprecated C8 字体/间距体系收敛：本文件为第三套并行体系，经全仓扫描 **零引用**（死代码）。
 *   颜色请用 `THEME_TOKENS` / `SEMANTIC_COLOR_ROLES`，字号请用 `TYPOGRAPHY_SCALE` + `text-*` 工具类，
 *   间距请用 `THEME_TOKENS.spacing/gap` 与 8px 刻度。计划在下一次清理窗口删除本文件。
 */
export const theme = {
  colors: {
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    card: 'hsl(var(--card))',
    'card-foreground': 'hsl(var(--card-foreground))',
    primary: 'hsl(var(--primary))',
    'primary-foreground': 'hsl(var(--primary-foreground))',
    secondary: 'hsl(var(--secondary))',
    'secondary-foreground': 'hsl(var(--secondary-foreground))',
    muted: 'hsl(var(--muted))',
    'muted-foreground': 'hsl(var(--muted-foreground))',
    accent: 'hsl(var(--accent))',
    'accent-foreground': 'hsl(var(--accent-foreground))',
    destructive: 'hsl(var(--destructive))',
    'destructive-foreground': 'hsl(var(--destructive-foreground))',
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    ring: 'hsl(var(--ring))',
    'ru-blue': 'hsl(var(--ru-blue))',
    'guan-green': 'hsl(var(--guan-green))',
    cinnabar: 'hsl(var(--cinnabar))',
    ivory: 'hsl(var(--ivory))',
    'warm-gray': 'hsl(var(--warm-gray))',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.625rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
  },
} as const

export type Theme = typeof theme
