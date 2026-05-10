/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // === NoorAI palette — strict black + bright yellow ===
        // Surfaces are pure neutral dark. No warm tint in surfaces or rules.
        // Yellow appears ONLY as an accent (CTAs, focus, active state).
        page:    '#000000',
        raised:  '#0A0A0A', // left sidebar
        elevated:'#111111', // cards
        float:   '#1A1A1A', // dialogs
        'panel-ai':'#0A0A0A',

        // Hairline rules — neutral white at low opacity (Airbnb-style)
        rule:        'rgba(255,255,255,0.10)',
        'rule-strong':'rgba(255,255,255,0.20)',

        // Text — Airbnb-grade neutral scale
        ink: {
          DEFAULT: '#FFFFFF',
          muted:   '#BFBFBF',
          dim:     '#8C8C8C',
          faint:   '#555555',
        },

        // Pure vivid yellow — modern luxury, no warm-amber tint
        accent: {
          DEFAULT:       '#FFD60A', // primary vivid yellow
          soft:          '#FFDD00', // hover / lifted
          bright:        '#FFE100', // brightest
          deep:          '#FFC300', // pressed
          // Back-compat aliases — all the same vivid yellow.
          purple:        '#FFD60A',
          'purple-soft': '#FFDD00',
          'purple-deep': '#FFC300',
          cyan:          '#FFD60A',
          'cyan-soft':   '#FFDD00',
          green:         '#FFD60A',
          rose:          '#FFD60A',
          amber:         '#FFD60A',
        },

        // Secondary accents — used very sparingly
        sage: {
          DEFAULT: '#889B85', // success / podcast guest
          soft:    '#28332A',
        },
        dusk: {
          DEFAULT: '#7A8A95', // info / links / podcast host
          soft:    '#22292E',
        },

        // === Legacy back-compat aliases (mapped to NoorAI surfaces) ===
        bg: {
          DEFAULT:  '#000000',
          panel:    '#0A0A0A',
          card:     '#111111',
          elevated: '#1A1A1A',
        },
        surface: {
          base:   '#000000',
          panel:  '#0A0A0A',
          raised: '#111111',
          high:   '#1A1A1A',
          float:  '#1A1A1A',
        },
        mode: {
          narration:   '#FFD60A',
          podcast:     '#FFD60A',
          visualize:   '#FFD60A',
          revision:    '#FFD60A',
          preparation: '#FFD60A',
        },

        // === NoorAI marketing scope — black + vivid yellow only ===
        echo: {
          bg:        '#000000',
          'bg-soft': '#0A0A0A',
          surface:   '#0A0A0A',
          'surface-2':'#111111',
          'surface-3':'#1A1A1A',
          accent:    '#FFD60A',
          'accent-soft':'#FFDD00',
          'accent-bright':'#FFE100',
          'accent-deep':'#FFC300',
          text:      '#FFFFFF',
          muted:     '#BFBFBF',
          dim:       '#8C8C8C',
          border:    'rgba(255,255,255,0.10)',
          'border-strong':'rgba(255,255,255,0.20)',
          'border-accent':'rgba(255,214,10,0.50)',
          glow:      'rgba(255,214,10,0.20)',
          'glow-strong':'rgba(255,221,0,0.40)',
          sage:      '#FFD60A',
          dusk:      '#FFD60A',
        },
      },
      fontFamily: {
        // sans = UI chrome (nav, buttons, panels)
        sans: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        // serif = long-form reading (narration pane, prose, headings)
        serif: ['"Source Serif 4"', '"Newsreader"', 'Charter', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Smaller, calmer than the previous theatrical scale
        display: ['clamp(2rem, 3.5vw, 2.625rem)', { lineHeight: '1.15', letterSpacing: '-0.012em', fontWeight: '500' }],
        title:   ['1.5rem',    { lineHeight: '1.3',  letterSpacing: '-0.005em', fontWeight: '500' }],
        heading: ['1.0625rem', { lineHeight: '1.4',  fontWeight: '500' }],
        body:    ['0.9375rem', { lineHeight: '1.55' }],
        prose:   ['1.0625rem', { lineHeight: '1.7' }],
        caption: ['0.8125rem', { lineHeight: '1.45', fontWeight: '500' }],
        eyebrow: ['0.6875rem', { lineHeight: '1.2',  letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: '500' }],
      },
      borderRadius: {
        sm:      '6px',
        md:      '10px',
        lg:      '14px',
        pill:    '9999px',
        // back-compat
        card:    '10px',
        capsule: '9999px',
        well:    '12px',
      },
      boxShadow: {
        soft:           '0 1px 2px rgba(0, 0, 0, 0.20)',
        floatSoft:      '0 8px 24px -8px rgba(0, 0, 0, 0.40), 0 2px 6px -2px rgba(0, 0, 0, 0.30)',
        // legacy aliases — all toned down to subtle warm-dark elevation
        glow:           '0 1px 2px rgba(0, 0, 0, 0.25)',
        'glow-cyan':    '0 1px 2px rgba(0, 0, 0, 0.25)',
        lift:           '0 2px 6px -1px rgba(0, 0, 0, 0.30)',
        float:          '0 8px 24px -8px rgba(0, 0, 0, 0.40)',
        hairline:       'inset 0 0 0 1px rgba(240, 233, 221, 0.05)',
        'hairline-soft':'inset 0 0 0 1px rgba(240, 233, 221, 0.03)',
        focus:          '0 0 0 2px #14110F, 0 0 0 4px rgba(200, 148, 92, 0.55)',
        spotlight:      '0 1px 2px rgba(0, 0, 0, 0.20)',
      },
      transitionTimingFunction: {
        expo:   'cubic-bezier(0.16, 1, 0.3, 1)',
        crisp:  'cubic-bezier(0.32, 0.72, 0, 1)',
        silk:   'cubic-bezier(0.22, 1, 0.36, 1)',
        settle: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        180: '180ms',
        250: '250ms',
        400: '400ms',
        600: '600ms',
        900: '900ms',
      },
      backdropBlur: {
        xs: '4px',
      },
      backgroundImage: {
        // strip the neon ambient washes (kept as no-ops for back-compat)
        'grad-aurora':      'linear-gradient(180deg, transparent, transparent)',
        'grad-spotlight':   'linear-gradient(180deg, #1B1714 0%, #14110F 100%)',
        'grad-purple-cyan': 'linear-gradient(135deg, #C8945C 0%, #889B85 100%)',
        'aura-narration':   'linear-gradient(180deg, transparent, transparent)',
        'aura-podcast':     'linear-gradient(180deg, transparent, transparent)',
        'aura-visualize':   'linear-gradient(180deg, transparent, transparent)',
        'aura-revision':    'linear-gradient(180deg, transparent, transparent)',
        'aura-preparation': 'linear-gradient(180deg, transparent, transparent)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // calm 1Hz pulse for live state dots (Ask Doubt mic, AI thinking)
        breathe: {
          '0%, 100%': { opacity: '0.50' },
          '50%':      { opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%':      { transform: 'translate3d(0,-6px,0)' },
        },
        'aurora-shift': {
          '0%, 100%': { opacity: '0' },
          '50%':      { opacity: '0' },
        },
        // Marketing-only ambient motion
        'echo-float': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%':      { transform: 'translate3d(0, -14px, 0)' },
        },
        'echo-float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
          '50%':      { transform: 'translate3d(8px, -10px, 0) rotate(2deg)' },
        },
        'echo-glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%':      { opacity: '1', transform: 'scale(1.08)' },
        },
        'echo-aurora': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.7' },
          '50%':      { transform: 'translate3d(20px, -20px, 0) scale(1.05)', opacity: '0.95' },
        },
        'echo-drift-x': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up':      'fade-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer:        'shimmer 2s linear infinite',
        breathe:        'breathe 1.6s ease-in-out infinite',
        drift:          'drift 8s ease-in-out infinite',
        'aurora-shift': 'aurora-shift 22s ease-in-out infinite',
        // Marketing-only
        'echo-float':       'echo-float 9s ease-in-out infinite',
        'echo-float-slow':  'echo-float-slow 13s ease-in-out infinite',
        'echo-glow-pulse':  'echo-glow-pulse 5s ease-in-out infinite',
        'echo-aurora':      'echo-aurora 18s ease-in-out infinite',
        'echo-drift-x':     'echo-drift-x 40s linear infinite',
      },
    },
  },
  plugins: [],
}
