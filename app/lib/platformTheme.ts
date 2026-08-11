export type KonstaTheme = 'ios' | 'material';

function platformFromQuery(value: string | null): KonstaTheme | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ios') return 'ios';
  if (normalized === 'android' || normalized === 'material') return 'material';
  return null;
}

function platformFromUserAgent(ua: string): KonstaTheme {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'material';
  return 'ios';
}

/** Resolve Konsta App theme from `?platform=` (ios|android|material) or UA. Desktop defaults to ios. */
export function resolveKonstaTheme(searchParams: URLSearchParams): KonstaTheme {
  const fromQuery = platformFromQuery(searchParams.get('platform'));
  if (fromQuery) return fromQuery;
  if (typeof navigator === 'undefined') return 'ios';
  return platformFromUserAgent(navigator.userAgent);
}
