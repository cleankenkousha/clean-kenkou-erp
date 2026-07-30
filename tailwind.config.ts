import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand / Primary (主幹色)
        primary: {
          50: '#F8FAFC',
          500: '#0F172A',
          DEFAULT: '#0F172A',
        },
        // Neutral (ベース/テキスト)
        surface: '#F9FAFB',
        main: '#111827',
        sub: '#6B7280',
        border: {
          DEFAULT: '#E5E7EB',
          custom: '#E5E7EB',
        },
        // Semantic (状態色)
        semantic: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '"Hiragino Sans"',
          '"BIZ UDPGothic"',
          'Meiryo',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '6px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config
