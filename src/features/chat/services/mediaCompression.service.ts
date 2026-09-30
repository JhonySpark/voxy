/**
 * Media Compression Service (Client-Side / Frontend)
 * Executa compressão agressiva de mídia (estilo WhatsApp) diretamente na máquina do usuário,
 * aproveitando aceleração de hardware (GPU/CPU) para enviar arquivos leves diretamente ao R2
 * sem onerar o backend com consumo de CPU ou tráfego excessivo.
 */

export interface ProcessedMediaResult {
  file: File;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // Porcentagem economizada (ex: 80%)
  mimeType: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 a 1.0
  isAvatar?: boolean;
  minSizeThreshold?: number; // Limite mínimo em bytes para comprimir
}

export type MediaCategory = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.js',
  '.mjs',
  '.htm',
  '.html',
  '.php',
  '.jar',
  '.com',
  '.scr',
  '.msi',
]);

export class MediaCompressionService {
  /**
   * Classifica a categoria do arquivo a partir de seu MIME e nome
   */
  static classifyFile(file: File): MediaCategory {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;

    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`O envio de arquivos com a extensão ${ext} é bloqueado por segurança.`);
    }

    if (file.type.startsWith('image/')) return 'IMAGE';
    if (file.type.startsWith('audio/')) return 'AUDIO';
    if (file.type.startsWith('video/')) return 'VIDEO';

    return 'DOCUMENT';
  }

  /**
   * Comprime imagens no cliente via Canvas (WebP, strip EXIF, redimensionamento suave)
   * Se o arquivo já for leve (ex: <= 800 KB, como imagens vindas do WhatsApp),
   * a qualidade original é preservada sem re-compressão agressiva.
   */
  static async compressImage(
    file: File,
    options: ImageCompressionOptions = {},
  ): Promise<ProcessedMediaResult> {
    // 1. Preservar GIFs animados intactos para não perder a animação
    if (file.type === 'image/gif') {
      return {
        file,
        blob: file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        mimeType: file.type,
      };
    }

    // 2. Limite mínimo de tamanho para disparar compressão (configurável via .env)
    // Se a imagem já for leve (<= VITE_IMAGE_COMPRESS_THRESHOLD_KB, padrão 500 KB), mantém original com 100% de nitidez
    const envThresholdKb = Number(import.meta.env?.VITE_IMAGE_COMPRESS_THRESHOLD_KB);
    const defaultThreshold = (!isNaN(envThresholdKb) && envThresholdKb > 0 ? envThresholdKb : 500) * 1024;
    const minSizeThreshold = options.minSizeThreshold ?? defaultThreshold;

    if (!options.isAvatar && file.size <= minSizeThreshold) {
      return {
        file,
        blob: file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        mimeType: file.type || 'image/jpeg',
      };
    }

    const maxWidth = options.maxWidth ?? (options.isAvatar ? 256 : 2560);
    const maxHeight = options.maxHeight ?? (options.isAvatar ? 256 : 1440);

    const envQuality = Number(import.meta.env?.VITE_IMAGE_COMPRESS_QUALITY);
    const defaultQuality = !isNaN(envQuality) && envQuality > 0 && envQuality <= 1 ? envQuality : 0.85;
    const quality = options.quality ?? (options.isAvatar ? 0.8 : defaultQuality);

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        if (options.isAvatar) {
          // Avatar é sempre cortado centralizado em 256x256
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('Não foi possível obter contexto 2D do Canvas.'));
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 256, 256);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Falha ao exportar imagem comprimida.'));

              const safeName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              const compressedFile = new File([blob], safeName, { type: 'image/webp' });
              const saved = Math.max(0, Math.round(((file.size - blob.size) / file.size) * 100));

              resolve({
                file: compressedFile,
                blob,
                originalSize: file.size,
                compressedSize: blob.size,
                compressionRatio: saved,
                mimeType: 'image/webp',
              });
            },
            'image/webp',
            quality,
          );
          return;
        }

        // Redimensionamento proporcional mantendo aspecto (máx. 2560x1440)
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Não foi possível obter contexto 2D do Canvas.'));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao exportar imagem comprimida.'));

            // Se o arquivo gerado não for menor que o original, mantém o original
            if (blob.size >= file.size) {
              return resolve({
                file,
                blob: file,
                originalSize: file.size,
                compressedSize: file.size,
                compressionRatio: 0,
                mimeType: file.type || 'image/jpeg',
              });
            }

            const safeName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const compressedFile = new File([blob], safeName, { type: 'image/webp' });
            const saved = Math.max(0, Math.round(((file.size - blob.size) / file.size) * 100));

            resolve({
              file: compressedFile,
              blob,
              originalSize: file.size,
              compressedSize: blob.size,
              compressionRatio: saved,
              mimeType: 'image/webp',
            });
          },
          'image/webp',
          quality,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Falha ao ler o arquivo de imagem para compressão.'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Gera uma miniatura (thumbnail) ultraleve da imagem (máx. 320x320 px, ~10-15 KB WebP)
   */
  static async generateImageThumbnail(
    file: File | Blob,
    maxWidth = 320,
    maxHeight = 320,
  ): Promise<ProcessedMediaResult> {
    const virtualFile =
      file instanceof File ? file : new File([file], 'image.webp', { type: 'image/webp' });
    return this.compressImage(virtualFile, {
      maxWidth,
      maxHeight,
      quality: 0.65,
      minSizeThreshold: 0, // Miniatura sempre é gerada compacta para navegação rápida
    });
  }

  /**
   * Extrai um frame do vídeo e gera uma capa/thumbnail WebP ultraleve (~10-20 KB)
   */
  static async generateVideoThumbnail(
    file: File,
    timeSeconds = 0.5,
  ): Promise<ProcessedMediaResult> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadeddata = () => {
        video.currentTime = Math.min(timeSeconds, (video.duration || 1) / 2);
      };

      video.onseeked = () => {
        const maxWidth = 320;
        const maxHeight = 320;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('Não foi possível obter contexto 2D para thumbnail de vídeo.'));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) return reject(new Error('Falha ao exportar thumbnail do vídeo.'));

            const safeName = file.name.replace(/\.[^/.]+$/, '') + '_thumb.webp';
            const thumbFile = new File([blob], safeName, { type: 'image/webp' });

            resolve({
              file: thumbFile,
              blob,
              originalSize: file.size,
              compressedSize: blob.size,
              compressionRatio: Math.max(0, Math.round(((file.size - blob.size) / file.size) * 100)),
              mimeType: 'image/webp',
            });
          },
          'image/webp',
          0.65,
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Falha ao processar vídeo para geração de thumbnail.'));
      };
    });
  }

  /**
   * Compressor/Transcodificador de Vídeo no Cliente via Canvas + MediaRecorder
   * Converte para 720p máx com controle de bitrate (estilo WhatsApp)
   */
  static async compressVideo(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<ProcessedMediaResult> {
    // Se o vídeo já tiver menos de 2 MB, mantém original sem re-encodagem
    if (file.size <= 2 * 1024 * 1024) {
      return {
        file,
        blob: file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        mimeType: file.type || 'video/mp4',
      };
    }

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        const targetMaxWidth = 1280;
        const targetMaxHeight = 720;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > targetMaxWidth || height > targetMaxHeight) {
          const ratio = Math.min(targetMaxWidth / width, targetMaxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Garante dimensões pares (exigido por codecs de vídeo)
        width = width % 2 === 0 ? width : width - 1;
        height = height % 2 === 0 ? height : height - 1;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(video.src);
          // Fallback gracioso
          return resolve({
            file,
            blob: file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0,
            mimeType: file.type,
          });
        }

        const stream = canvas.captureStream(30);

        // Suporte aos formatos de gravação do Chromium/Electron
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 1200000, // 1.2 Mbps para 720p (ótima qualidade e peso baixo)
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          const blob = new Blob(chunks, { type: mimeType });
          const safeName = file.name.replace(/\.[^/.]+$/, '') + '.webm';
          const compressedFile = new File([blob], safeName, { type: mimeType });
          const saved = Math.max(0, Math.round(((file.size - blob.size) / file.size) * 100));

          resolve({
            file: compressedFile,
            blob,
            originalSize: file.size,
            compressedSize: blob.size,
            compressionRatio: saved,
            mimeType,
          });
        };

        recorder.start(100);

        const duration = video.duration || 1;
        let animationFrameId: number;

        const drawFrame = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, width, height);

          if (onProgress && duration > 0) {
            onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
          }

          animationFrameId = requestAnimationFrame(drawFrame);
        };

        video.onended = () => {
          cancelAnimationFrame(animationFrameId);
          if (recorder.state !== 'inactive') recorder.stop();
        };

        video.onerror = () => {
          cancelAnimationFrame(animationFrameId);
          URL.revokeObjectURL(video.src);
          // Fallback para arquivo original
          resolve({
            file,
            blob: file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0,
            mimeType: file.type,
          });
        };

        try {
          await video.play();
          drawFrame();
        } catch (_) {
          // Se não conseguir tocar em headless, fallback
          resolve({
            file,
            blob: file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0,
            mimeType: file.type,
          });
        }
      };
    });
  }

  /**
   * Roteador de compressão: seleciona a compressão apropriada com base na categoria
   */
  static async processFile(
    file: File,
    isAvatar = false,
    onProgress?: (progress: number) => void,
  ): Promise<ProcessedMediaResult> {
    const category = this.classifyFile(file);

    if (isAvatar || category === 'IMAGE') {
      return this.compressImage(file, { isAvatar });
    }

    if (category === 'VIDEO') {
      return this.compressVideo(file, onProgress);
    }

    // Para áudios pré-existentes ou documentos, mantém o blob original
    return {
      file,
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
      mimeType: file.type || 'application/octet-stream',
    };
  }
}
