/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        'ru-blue': 'hsl(var(--ru-blue))',
        'guan-green': 'hsl(var(--guan-green))',
        cinnabar: 'hsl(var(--cinnabar))',
        ivory: 'hsl(var(--ivory))',
        'warm-gray': 'hsl(var(--warm-gray))',

        // ===== 统一设计系统 · 语义色角色 =====
        /** 次级表面：卡片内嵌 / 悬浮底 / 嵌套区块 */
        'surface-2': 'hsl(var(--surface-2))',
        /** 三级文字：辅助说明 / 占位 */
        tertiary: 'hsl(var(--text-tertiary))',
        /** 强边框：分区强调 / 聚焦态 */
        divider: 'hsl(var(--divider))',
        /** 正向 / 成功 */
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        /** 警示 / 注意 */
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        /** 信息 / 链接 */
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // ===== 统一设计系统 · 层级阴影 =====
        'elevation-1': 'var(--shadow-sm)',
        'elevation-2': 'var(--shadow-md)',
        'elevation-3': 'var(--shadow-lg)',
        // ===== V6: surface depth =====
        'surface-elevated': 'var(--surface-elevated)',
        'surface-floating': 'var(--surface-floating)',
      },
      fontFamily: {
        sans: ['DM Sans', 'SF Pro Display', 'Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        // ===== 统一设计系统 · 排版阶梯（单一信息层级） =====
        /** 页面主标题 / 英雄区（CJK 字距 0，不再负字距） */
        display: ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '0em' }],
        /** 一级标题 */
        h1: ['1.5rem', { lineHeight: '1.25', fontWeight: '700', letterSpacing: '0em' }],
        /** 二级标题 */
        h2: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        /** 三级标题 */
        h3: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        /** 四级标题（16px/600，与 body-lg 同字号但字重更高，靠 weight 区分） */
        h4: ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        /** 五级标题（15px/500，介于 h4 与 body 之间的次级小标题） */
        h5: ['0.9375rem', { lineHeight: '1.4', fontWeight: '500' }],
        /** 六级标题（13px/600，最小标题层级，与 body-sm 同字号靠 weight 区分） */
        h6: ['0.8125rem', { lineHeight: '1.4', fontWeight: '600' }],
        /** 正文（大） */
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        /** 正文（默认） */
        body: ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        /** 正文（小） */
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        /** 辅助文字 / 说明 */
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
        /** 标签 / 微型标注 */
        overline: ['0.6875rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.08em' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        'container': '1200px',
        'portal': '1440px',
      },
    },
  },
  plugins: [],
}
