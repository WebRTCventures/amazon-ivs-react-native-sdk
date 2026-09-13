export const colors = {
  canvas: '#F2F2F7',
  card: '#FFFFFF',
  hairline: '#E5E5EA',
  fill: '#E5E5EA',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  textOnAccent: '#FFFFFF',
  accent: '#007AFF',
  danger: '#FF3B30',
  video: '#1C1C1E',
  overlay: 'rgba(28,28,30,0.62)',
  errorBanner: '#FFE5E3',
  errorText: '#C41A12',
} as const;

export const space = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  overline: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.37,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  callout: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
};
