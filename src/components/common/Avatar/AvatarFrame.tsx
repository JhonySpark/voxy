import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';
import {
  getCosmeticAssetUrl,
  resolveInlineFrameAssets,
} from '../../../core/utils/cosmetic-assets.util';

export interface AvatarFrameProps {
  frameSlug?: string | null;
  className?: string;
  glow?: boolean;
  animated?: boolean;
}

const svgCache = new Map<string, string>();

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
  frameSlug,
  className = '',
  glow = true,
  animated,
}) => {
  const isRaster = frameSlug
    ? frameSlug.endsWith('.png') || frameSlug.endsWith('.webp')
    : false;

  const frameSrc = frameSlug && frameSlug !== 'none' && !isRaster
    ? getCosmeticAssetUrl(
        frameSlug.startsWith('/') || frameSlug.startsWith('http')
          ? frameSlug
          : `cosmetics/frames/${frameSlug}.svg`,
      )
    : null;

  const [svgContent, setSvgContent] = useState<string | null>(() => {
    if (!frameSrc) return null;
    return svgCache.get(frameSrc) || null;
  });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!frameSrc) {
      setSvgContent(null);
      setLoadError(false);
      return;
    }

    if (svgCache.has(frameSrc)) {
      setSvgContent(svgCache.get(frameSrc)!);
      setLoadError(false);
      return;
    }

    let isMounted = true;
    fetch(frameSrc)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load frame');
        return res.text();
      })
      .then((text) => {
        if (!isMounted) return;
        const resolvedSvg = resolveInlineFrameAssets(text);
        svgCache.set(frameSrc, resolvedSvg);
        setSvgContent(resolvedSvg);
        setLoadError(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [frameSrc]);

  if (!frameSlug || frameSlug === 'none') {
    return null;
  }

  const animationClass =
    animated === true
      ? styles.frameAnimated
      : animated === false
      ? styles.frameStatic
      : '';

  if (isRaster) {
    const src = getCosmeticAssetUrl(
      frameSlug.startsWith('/') || frameSlug.startsWith('http')
        ? frameSlug
        : `cosmetics/frames/${frameSlug}`,
    );

    return (
      <div
        className={`${styles.frameContainer} ${animationClass} ${
          glow ? styles.frameGlowPulse : ''
        } ${className}`}
        aria-hidden="true"
      >
        <img className={styles.frameImg} src={src} alt="Frame" aria-hidden="true" />
      </div>
    );
  }

  if (loadError || !svgContent) {
    return null;
  }

  return (
    <div
      className={`${styles.frameContainer} ${glow ? styles.frameGlowPulse : ''} ${animationClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      aria-hidden="true"
    />
  );
};
