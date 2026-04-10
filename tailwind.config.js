/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/public/**/*.{jsx,js}'],
  theme: {
    extend: {
      colors: {
        f1: {
          bg: '#09090b',
          surface: '#111118',
          card: '#16161e',
          'card-hover': '#1e1e2a',
          border: 'rgba(255,255,255,0.06)',
          'border-light': 'rgba(255,255,255,0.1)',
          red: '#E10600',
          'red-dark': '#B00500',
          'red-glow': 'rgba(225,6,0,0.15)',
          muted: '#6b6b80',
          secondary: '#9a9aaf',
        },
        team: {
          redbull: '#3671C6',
          ferrari: '#E8002D',
          mercedes: '#27F4D2',
          mclaren: '#FF8000',
          aston: '#229971',
          alpine: '#0093CC',
          williams: '#64C4FF',
          rb: '#6692FF',
          sauber: '#52E252',
          haas: '#B6BABD',
        },
      },
      fontFamily: {
        f1: ['Titillium Web', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'count-up': 'countUp 0.6s ease-out',
        'pulse-red': 'pulseRed 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        countUp: { '0%': { opacity: '0', transform: 'scale(0.8)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseRed: { '0%,100%': { boxShadow: '0 0 0 0 rgba(225,6,0,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(225,6,0,0)' } },
        glow: { '0%': { boxShadow: '0 0 20px rgba(225,6,0,0.1)' }, '100%': { boxShadow: '0 0 30px rgba(225,6,0,0.25)' } },
      },
    },
  },
  plugins: [],
};
