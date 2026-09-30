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
