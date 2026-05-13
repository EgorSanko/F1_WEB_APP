/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // F1 Hub v2 design tokens (from /opt/f1-hub/redesign-v2-embed.html)
        bg: '#15151E',
        surface: '#1C1C28',
        'surface-2': '#262633',
        'surface-3': '#2F2F3E',
        text: '#FAFAFA',
        muted: '#A0A0B0',
        'muted-2': '#6B6B7B',
        red: {
          DEFAULT: '#E10600',
          hover: '#FF1A0D',
        },
        gold: '#FFCB05',
        line: 'rgba(255,255,255,0.06)',
        'line-strong': 'rgba(255,255,255,0.12)',
      },
      fontFamily: {
        sans: ['Manrope_400Regular', 'system-ui'],
        medium: ['Manrope_500Medium'],
        semibold: ['Manrope_600SemiBold'],
        bold: ['Manrope_700Bold'],
        extrabold: ['Manrope_800ExtraBold'],
      },
      fontSize: {
        eyebrow: ['11px', { letterSpacing: '0.18em', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
