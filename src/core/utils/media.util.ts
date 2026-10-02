/**
 * Converte URLs relativas de mídias/storage para URLs completas apontando para o backend,
 * preservando URLs externas (http/https), blobs e data-urls.
 */
export function getMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const baseUrl = rawBase.replace(/\/$/, '');
  const cleanPath = url.replace(/^\/?api/, '');
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  return `${baseUrl}${normalizedPath}`;
}

const preloadedUrls = new Set<string>();

/**
 * Pré-carrega uma mídia no cache de memória do navegador para exibição instantânea (0 delay).
 */
export function preloadMedia(url?: string | null): void {
  const fullUrl = getMediaUrl(url);
  if (!fullUrl || preloadedUrls.has(fullUrl)) return;
  preloadedUrls.add(fullUrl);

  const img = new Image();
  img.decoding = 'async';
  img.src = fullUrl;
}

/**
 * Pré-carrega uma lista de mídias no cache de memória.
 */
export function preloadMediaList(urls: (string | null | undefined)[]): void {
  urls.forEach((u) => preloadMedia(u));
}
