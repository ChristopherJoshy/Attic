/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ========================================
        // BACKGROUND SURFACES
        // ========================================
        'bg-primary': '#000000',
        'bg-secondary': '#0A0A0A',
        'bg-tertiary': '#121212',
        'bg-elevated': '#1A1A1A',

        // ========================================
        // SURFACE (Cards, Panels)
        // ========================================
        'surface': {
          DEFAULT: 'rgba(255, 255, 255, 0.02)',
          hover: 'rgba(255, 255, 255, 0.05)',
          active: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.08)',
        },

        // ========================================
        // PRIMARY ACCENT (Rose - 5 step scale)
        // ========================================
        'primary': {
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
          DEFAULT: '#F43F5E',
        },

        // ========================================
        // SEMANTIC COLORS
        // ========================================
        'success': {
          DEFAULT: '#22C55E',
          muted: 'rgba(34, 197, 94, 0.15)',
          text: '#4ADE80',
        },
        'danger': {
          DEFAULT: '#EF4444',
          muted: 'rgba(239, 68, 68, 0.15)',
          text: '#F87171',
        },
        'warning': {
          DEFAULT: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.15)',
          text: '#FBBF24',
        },

        // ========================================
        // TEXT COLORS
        // ========================================
        'text': {
          primary: '#FFFFFF',
          secondary: '#A1A1A1',
          muted: '#525252',
          disabled: '#3F3F3F',
        },

        // ========================================
        // RANK COLORS
        // ========================================
        'rank': {
          unranked: '#71717A',
          bronze: '#CD7F32',
          silver: '#C0C0C0',
          gold: '#FFD700',
          platinum: '#E5E4E2',
          diamond: '#B9F2FF',
          ranker: '#A855F7',
        },

        // ========================================
        // OPPONENT INDICATORS
        // ========================================
        'opponent': {
          cursor: '#8B5CF6',
          highlight: 'rgba(139, 92, 246, 0.2)',
        },

        // ========================================
        // LEGACY ALIASES (for backward compat)
        // ========================================
        'accent-correct': '#22C55E',
        'accent-error': '#EF4444',
        'accent-focus': '#F43F5E',
        'accent-primary': '#F43F5E',
      },

      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },

      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1.1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      borderRadius: {
        '4xl': '2rem',
      },

      boxShadow: {
        'glow-sm': '0 0 4px 0 rgba(255, 255, 255, 0.5)',
        'glow-md': '0 0 8px 2px rgba(255, 255, 255, 0.6)',
        'glow-lg': '0 0 16px 4px rgba(255, 255, 255, 0.8)',
        'glow-primary': '0 0 20px rgba(244, 63, 94, 0.3)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.3)',
        'elevation-1': '0 1px 3px rgba(0, 0, 0, 0.5)',
        'elevation-2': '0 4px 6px rgba(0, 0, 0, 0.5)',
        'elevation-3': '0 10px 20px rgba(0, 0, 0, 0.5)',
      },

      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'caret-blink': 'blink 1s step-end infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'spin-reverse': 'spin-reverse 12s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },

      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },

      transitionDuration: {
        'instant': '50ms',
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'modal': '300',
        'popover': '400',
        'toast': '500',
        'tooltip': '600',
      },

      maxWidth: {
        'typing': '900px',
      },

      width: {
        'sidebar': '320px',
      },

      height: {
        'header': '72px',
        'leaderboard-row': '56px',
        'modal-row': '56px',
      },
    },
  },
  plugins: [],
}
