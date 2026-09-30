/**
 * Audio Recorder Service (Estilo WhatsApp)
 * Grava áudio do microfone do usuário diretamente no formato comprimido Opus (32 kbps Mono)
 * resultando em áudios de altíssima fidelidade vocal pesando apenas ~240 KB por minuto.
 */

export interface RecordedVoiceNote {
  file: File;
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  /**
   * Inicia gravação de áudio com cancelamento de ruído e eco
   */
  async startRecording(onVolumeChange?: (volume: number) => void): Promise<void> {
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // Mono
      },
    });

    // Análise de volume para feedback visual em tempo real (ondas sonoras)
    if (onVolumeChange) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!this.analyser || !this.mediaRecorder || this.mediaRecorder.state !== 'recording')
            return;
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
          onVolumeChange(Math.min(100, Math.round((average / 128) * 100)));
          requestAnimationFrame(checkVolume);
        };
        requestAnimationFrame(checkVolume);
      } catch (_) {}
    }

    // Seleciona codec nativo suportado com Opus
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: 32000, // 32 kbps (WhatsApp standard para voz)
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(250);
  }

  /**
   * Finaliza gravação e retorna o arquivo comprimido
   */
  async stopRecording(): Promise<RecordedVoiceNote> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Nenhuma gravação em andamento.'));
      }

      this.mediaRecorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
        const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';

        const blob = new Blob(this.audioChunks, { type: mimeType });
        const fileName = `voice_${Date.now()}${ext}`;
        const file = new File([blob], fileName, { type: mimeType });

        this.cleanup();

        resolve({
          file,
          blob,
          durationSeconds,
          mimeType,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancela a gravação descartando os buffers
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => null);
      this.audioContext = null;
    }
    this.analyser = null;
    this.audioChunks = [];
    this.mediaRecorder = null;
  }
}
