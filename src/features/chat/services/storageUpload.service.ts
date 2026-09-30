import axios from 'axios';
import api from '../../../api';
import { MediaCompressionService } from './mediaCompression.service';

export interface DirectUploadParams {
  file: File;
  channelId?: string;
  receiverId?: string;
  isAvatar?: boolean;
  onCompressProgress?: (progress: number) => void;
  onUploadProgress?: (progress: number) => void;
}

export interface DirectUploadResult {
  attachmentId?: string;
  fileKey: string;
  thumbnailKey?: string;
  fileName: string;
  fileType: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class StorageUploadService {
  /**
   * Pipeline completo de upload direto (Direct-to-R2):
   * 1. Comprime no cliente (WebP / 720p / etc)
   * 2. Gera miniatura/thumbnail leve (10-15KB) para exibição instantânea no chat
   * 3. Pede Pre-signed PUT URLs para o backend
   * 4. Faz upload DIRETO do cliente para o Cloudflare R2 (sem passar pela VPS)
   */
  static async uploadMedia(params: DirectUploadParams): Promise<DirectUploadResult> {
    const { file, channelId, receiverId, isAvatar, onCompressProgress, onUploadProgress } = params;

    const category = MediaCompressionService.classifyFile(file);

    // 1. Compressão local do arquivo principal
    const processed = await MediaCompressionService.processFile(
      file,
      isAvatar,
      onCompressProgress,
    );

    // 2. Geração da miniatura leve no cliente (se for imagem ou vídeo do chat)
    let thumbnailBlob: Blob | null = null;
    if (!isAvatar && (category === 'IMAGE' || category === 'VIDEO')) {
      try {
        if (category === 'IMAGE') {
          const thumb = await MediaCompressionService.generateImageThumbnail(processed.blob);
          thumbnailBlob = thumb.blob;
        } else if (category === 'VIDEO') {
          const thumb = await MediaCompressionService.generateVideoThumbnail(file);
          thumbnailBlob = thumb.blob;
        }
      } catch (err) {
        console.warn('Não foi possível gerar thumbnail local:', err);
      }
    }

    // 3. Obter URLs pré-assinadas de upload do backend
    const presignedRes = await api.post('/storage/presigned-upload', {
      fileName: processed.file.name,
      fileSize: processed.compressedSize,
      mimeType: processed.mimeType,
      channelId,
      receiverId,
      isAvatar,
      hasThumbnail: Boolean(thumbnailBlob),
    });

    const {
      uploadUrl,
      thumbnailUploadUrl,
      attachmentId,
      fileKey,
      thumbnailKey,
      fileType,
    } = presignedRes.data;

    // 4. Upload direto do navegador para o Cloudflare R2 via HTTP PUT
    const uploadPromises: Promise<any>[] = [];

    // Upload do arquivo principal
    uploadPromises.push(
      axios.put(uploadUrl, processed.blob, {
        headers: {
          'Content-Type': processed.mimeType,
        },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percent);
          }
        },
      }),
    );

    // Upload da miniatura/thumbnail em paralelo (se gerada)
    if (thumbnailUploadUrl && thumbnailBlob) {
      uploadPromises.push(
        axios.put(thumbnailUploadUrl, thumbnailBlob, {
          headers: {
            'Content-Type': 'image/webp',
          },
        }),
      );
    }

    await Promise.all(uploadPromises);

    return {
      attachmentId,
      fileKey,
      thumbnailKey,
      fileName: processed.file.name,
      fileType,
      originalSize: processed.originalSize,
      compressedSize: processed.compressedSize,
      compressionRatio: processed.compressionRatio,
    };
  }
}
