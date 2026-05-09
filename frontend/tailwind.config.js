/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0d1a',
          panel: '#10142a',
          card: '#161a36',
          elevated: '#1c2148',
        },
        ink: {
          DEFAULT: '#e8ecf8',
          muted: '#9aa3c2',
          dim: '#5b6485',
          faint: '#383f5c',
        },
        accent: {
          purple: '#8b5cf6',
          'purple-soft': '#a78bfa',
          cyan: '#22d3ee',
          'cyan-soft': '#67e8f9',
          green: '#34d399',
          rose: '#fb7185',
          amber: '#fbbf24',
        },
        // semantic aliases — prefer these in new code
        surface: {
          base: '#0a0d1a',
          panel: '#10142a',
          raised: '#161a36',
          high: '#1c2148',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // tighter, more typographic display sizes
        display: ['clamp(2.75rem, 6vw, 4.75rem)', { lineHeight: '1.04', letterSpacing: '-0.03em', fontWeight: '700' }],
        title: ['clamp(1.875rem, 3vw, 2.5rem)', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '600' }],
        heading: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.55' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.04em', textTransform: 'uppercase' }],
      },
      borderRadius: {
        pill: '9999px',
        card: '1.25rem',
        capsule: '999px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139, 92, 246, 0.15), 0 18px 60px -12px rgba(139, 92, 246, 0.45)',
        'glow-cyan': '0 0 0 1px rgba(34, 211, 238, 0.15), 0 18px 60px -12px rgba(34, 211, 238, 0.45)',
        lift: '0 12px 40px -12px rgba(0, 0, 0, 0.5), 0 4px 14px -4px rgba(0, 0, 0, 0.4)',
        hairline: 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
        focus: '0 0 0 2px rgba(10, 13, 26, 1), 0 0 0 4px rgba(139, 92, 246, 0.5)',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
        crisp: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
        600: '600ms',
      },
      backgroundImage: {
        'grad-aurora': 'radial-gradient(80% 60% at 20% 10%, rgba(139,92,246,0.18) 0%, transparent 60%), radial-gradient(60% 80% at 90% 30%, rgba(34,211,238,0.14) 0%, transparent 55%), radial-gradient(70% 60% at 50% 100%, rgba(52,211,153,0.10) 0%, transparent 60%)',
        'grad-spotlight': 'radial-gradient(ellipse at top, #1a1f3f 0%, #0a0d1a 60%)',
        'grad-purple-cyan': 'linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2s linear infinite',
        breathe: 'breathe 3.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
