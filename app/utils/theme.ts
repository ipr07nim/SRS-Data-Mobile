import type { AppTheme } from '../store';

export function resolveTheme(preference: AppTheme): 'dark' | 'light' {
  if (preference === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export function applyThemeToDocument(preference: AppTheme): void {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}
