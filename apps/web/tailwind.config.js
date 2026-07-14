/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pp: {
          canvas: '#eceff3',
          shell: '#f4f5f7',
          panel: '#f9fafb',
          editor: '#ffffff',
          line: 'rgba(15, 23, 42, 0.08)',
          lineStrong: 'rgba(15, 23, 42, 0.12)',
          muted: '#6b7285',
          faint: '#9aa1b2',
          ink: '#111827',
          accent: '#0d7370',
          accentHover: '#0a5f5c',
          accentSoft: 'rgba(13, 115, 112, 0.1)',
          warn: '#8a6a1f',
          string: '#0f7a5c',
          keyword: '#2f5fb5',
          number: '#8a6420',
          comment: '#8b93a7',
          console: '#0f1218',
          consoleFg: '#c9d0dc',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'shell-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'panel-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        caret: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'shell-in': 'shell-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-in': 'panel-in 220ms ease-out both',
        caret: 'caret 1.1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};
