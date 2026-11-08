import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ImageCropModal.module.css';
import {
  X,
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImageCropModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void | Promise<void>;
  outputSize?: number;
}

const CROP_SIZE = 260;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageFile,
  onClose,
  onCropComplete,
  outputSize = 512,
}) => {
  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number }>({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    if (!isOpen || !imageFile) {
      setImageSrc(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImageSrc(objectUrl);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 0, height: 0 });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, imageFile]);

  const getBaseScale = useCallback(
    (width: number, height: number, rot: number) => {
      if (!width || !height) return 1;
      const isRotated90 = Math.abs(rot % 180) === 90;
      const effW = isRotated90 ? height : width;
      const effH = isRotated90 ? width : height;
      return Math.max(CROP_SIZE / effW, CROP_SIZE / effH);
    },
    [],
  );

  const clampOffset = useCallback(
    (
      nextOffset: { x: number; y: number },
      targetZoom: number,
      targetRotation: number,
      width: number,
      height: number,
    ) => {
      if (!width || !height) return { x: 0, y: 0 };
      const isRotated90 = Math.abs(targetRotation % 180) === 90;
      const effW = isRotated90 ? height : width;
      const effH = isRotated90 ? width : height;
      const baseScale = getBaseScale(width, height, targetRotation);
      const scale = baseScale * targetZoom;

      const dispW = effW * scale;
      const dispH = effH * scale;

      const maxOffsetX = Math.max(0, (dispW - CROP_SIZE) / 2);
      const maxOffsetY = Math.max(0, (dispH - CROP_SIZE) / 2);

      return {
        x: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextOffset.x)),
        y: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextOffset.y)),
      };
    },
    [getBaseScale],
  );

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imgRef.current = img;
    setNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setOffset({ x: 0, y: 0 });
  };

  const handleZoomChange = (nextZoomRaw: number) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoomRaw.toFixed(3))));
    setZoom(clampedZoom);
    setOffset((prev) =>
      clampOffset(prev, clampedZoom, rotation, naturalSize.width, naturalSize.height),
    );
  };

  const handleRotate90 = () => {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    setOffset((prev) =>
      clampOffset(prev, zoom, nextRotation, naturalSize.width, naturalSize.height),
    );
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isProcessing) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const rawNext = {
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    };
    setOffset(clampOffset(rawNext, zoom, rotation, naturalSize.width, naturalSize.height));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP * 1.5 : -ZOOM_STEP * 1.5;
    handleZoomChange(zoom + delta);
  };

  const handleApplyCrop = async () => {
    if (!imgRef.current || !naturalSize.width || !naturalSize.height || isProcessing) return;

    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to create 2D canvas context');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const baseScale = getBaseScale(naturalSize.width, naturalSize.height, rotation);
      const currentScale = baseScale * zoom;
      const ratio = outputSize / CROP_SIZE;

      ctx.save();
      ctx.translate(outputSize / 2 + offset.x * ratio, outputSize / 2 + offset.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(currentScale * ratio, currentScale * ratio);
      ctx.drawImage(
        imgRef.current,
        -naturalSize.width / 2,
        -naturalSize.height / 2,
        naturalSize.width,
        naturalSize.height,
      );
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.95),
      );

      if (!blob) {
        throw new Error('Failed to generate cropped image blob');
      }

      const baseName = imageFile?.name
        ? imageFile.name.replace(/\.[^/.]+$/, '')
        : 'avatar';
      const croppedFile = new File([blob], `${baseName}-cropped.png`, {
        type: 'image/png',
      });

      await onCropComplete(croppedFile);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageFile || !imageSrc) return null;

  const baseScale = getBaseScale(naturalSize.width, naturalSize.height, rotation);
  const totalScale = baseScale * zoom;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        e.stopPropagation();
        if (!isProcessing) onClose();
      }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Crop size={18} className={styles.headerIcon} />
            <h3>{t('user.cropAvatarTitle', 'Ajustar Imagem de Perfil')}</h3>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isProcessing}
            aria-label={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div
            className={`${styles.stageWrapper} ${
              isDragging ? styles.stageWrapperDragging : ''
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <img
              src={imageSrc}
              alt={t('user.cropAvatarTitle', 'Ajustar Imagem de Perfil')}
              onLoad={handleImageLoad}
              className={styles.cropImage}
              draggable={false}
              style={{
                width: naturalSize.width ? `${naturalSize.width}px` : 'auto',
                height: naturalSize.height ? `${naturalSize.height}px` : 'auto',
                opacity: naturalSize.width ? 1 : 0,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${totalScale})`,
              }}
            />

            <div className={styles.cropMaskCircle}>
              <div className={styles.cropGrid} />
            </div>
          </div>

          <p className={styles.hintText}>
            {t(
              'user.cropAvatarHint',
              'Arraste a imagem para posicionar e use o controle abaixo ou a roda do mouse para dar zoom.',
            )}
          </p>

          {/* Zoom Slider */}
          <div className={styles.controlsRow}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => handleZoomChange(zoom - 0.15)}
              disabled={zoom <= MIN_ZOOM || isProcessing}
              title={t('user.zoomOut', 'Diminuir zoom')}
            >
              <ZoomOut size={15} />
            </button>

            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className={styles.zoomSlider}
              disabled={isProcessing}
            />

            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => handleZoomChange(zoom + 0.15)}
              disabled={zoom >= MAX_ZOOM || isProcessing}
              title={t('user.zoomIn', 'Aumentar zoom')}
            >
              <ZoomIn size={15} />
            </button>

            <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          </div>

          {/* Rotate & Reset */}
          <div className={styles.secondaryActions}>
            <button
              type="button"
              className={styles.toolChipBtn}
              onClick={handleRotate90}
              disabled={isProcessing}
            >
              <RotateCw size={14} />
              <span>{t('user.rotateImage', 'Girar 90°')}</span>
            </button>

            <button
              type="button"
              className={styles.toolChipBtn}
              onClick={handleReset}
              disabled={
                isProcessing || (zoom === 1 && rotation === 0 && offset.x === 0 && offset.y === 0)
              }
            >
              <RotateCcw size={14} />
              <span>{t('user.resetCrop', 'Redefinir')}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isProcessing}
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            onClick={handleApplyCrop}
            disabled={isProcessing || !naturalSize.width}
          >
            {isProcessing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{t('common.saving', 'Salvando...')}</span>
              </>
            ) : (
              <>
                <Check size={15} />
                <span>{t('user.applyCrop', 'Aplicar')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

