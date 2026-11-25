import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand / Primary (主幹色: クリーン健康社公式イメージカラー 緑系)
        primary: {
          50: '#ECFDF5',
          200: '#A7F3D0',
          500: '#059669',
          600: '#059669',
          700: '#047857',
          DEFAULT: '#059669',
        },
        brand: {
          main: '#059669',
          hover: '#047857',
          soft: '#ECFDF5',
          border: '#A7F3D0',
          text: '#047857',
          onPrimary: '#FFFFFF',
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
