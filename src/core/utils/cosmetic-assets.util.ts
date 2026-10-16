/**
 * Resolve assets bundled in `public/cosmetics` for both Vite's dev server and
 * Electron's `file://.../dist/index.html` production origin.
 *
 * Root-relative URLs (`/cosmetics/...`) work in a web server but point to the
 * filesystem root when Electron loads the renderer from disk.
 */
export function getCosmeticAssetUrl(assetPath: string): string {
  if (
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('data:') ||
    assetPath.startsWith('blob:')
  ) {
    return assetPath;
  }

  return new URL(assetPath.replace(/^\/+/, ''), window.location.href).toString();
}

/** Ensures assets embedded by an inline SVG resolve from the packaged dist directory. */
export function resolveInlineFrameAssets(svg: string): string {
  const framesBaseUrl = getCosmeticAssetUrl('cosmetics/frames/');

  return svg.replace(
    /((?:xlink:)?href\s*=\s*["'])\/cosmetics\/frames\//gi,
    `$1${framesBaseUrl}`,
  );
}
