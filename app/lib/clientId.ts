const CLIENT_ID_KEY = 'srs-client-id';

/** Stable per-device id in localStorage so the same phone keeps its identity across tabs/reloads. */
export function getClientId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = sessionStorage.getItem(CLIENT_ID_KEY) ?? crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
