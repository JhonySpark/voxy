// Identificador de inicialização da sessão para impedir que o navegador reutilize redirecionamentos 302 expirados de dias anteriores
const APP_SESSION_ID = Date.now();

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

  // Se for rota de storage do backend, anexa o identificador de sessão para ignorar 302s expirados no cache de disco
  if (normalizedPath.startsWith('/storage/')) {
    const separator = normalizedPath.includes('?') ? '&' : '?';
    return `${baseUrl}${normalizedPath}${separator}_sid=${APP_SESSION_ID}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

/**
 * Trata erros de carregamento de imagem (ex: 403 Forbidden por presigned URL expirada em cache).
 * Tenta recarregar uma vez com cache-buster antes de acionar o callback de fallback.
 */
export function handleMediaError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackCallback?: () => void
): void {
  const target = e.currentTarget;
  if (!target.dataset.retried) {
    target.dataset.retried = 'true';
    const separator = target.src.includes('?') ? '&' : '?';
    target.src = `${target.src}${separator}_retry=${Date.now()}`;
    return;
  }
  if (fallbackCallback) {
    fallbackCallback();
  }
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
