export function onNavigate(cb: (href: string) => void): () => void {
  const handler = (): void => cb(location.href);
  document.addEventListener('yt-navigate-finish', handler);
  return () => document.removeEventListener('yt-navigate-finish', handler);
}

export function videoIdFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}
