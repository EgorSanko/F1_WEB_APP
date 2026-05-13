/**
 * F1 Hub v2 design tokens.
 * Mirror of CSS variables in /opt/f1-hub/redesign-v2-embed.html.
 * Use these for inline styles / animated values where className isn't possible.
 */

export const colors = {
  bg: '#15151E',
  surface: '#1C1C28',
  surface2: '#262633',
  surface3: '#2F2F3E',
  text: '#FAFAFA',
  muted: '#A0A0B0',
  muted2: '#6B6B7B',
  red: '#E10600',
  redHover: '#FF1A0D',
  gold: '#FFCB05',
  line: 'rgba(255,255,255,0.06)',
  lineStrong: 'rgba(255,255,255,0.12)',
  overlayBackdrop: 'rgba(21,21,30,0.85)',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  '2xl': 40,
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 12,
  },
} as const;

export type Theme = {
  colors: typeof colors;
  radii: typeof radii;
  spacing: typeof spacing;
  fonts: typeof fonts;
  shadows: typeof shadows;
};

export const theme: Theme = { colors, radii, spacing, fonts, shadows };
