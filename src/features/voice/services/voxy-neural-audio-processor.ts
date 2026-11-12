import {
  Track,
  type AudioProcessorOptions,
  type TrackProcessor,
} from 'livekit-client';
import rnnoiseWasmUrl from '@jitsi/rnnoise-wasm/dist/rnnoise.wasm?url';
import {
  voiceAudioSettingsService,
  type VoiceAudioSettings,
} from '../../../core/services/voice-audio-settings.service';

const WORKLET_PROCESSOR_NAME = 'voxy-rnnoise-worklet-processor';

let cachedWasmBuffer: ArrayBuffer | null = null;
let wasmLoadPromise: Promise<ArrayBuffer | null> | null = null;
const registeredContexts = new WeakSet<BaseAudioContext>();

async function loadRnnoiseWasmBinary(): Promise<ArrayBuffer | null> {
  if (cachedWasmBuffer) return cachedWasmBuffer;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    try {
      const response = await fetch(rnnoiseWasmUrl);
      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > 1000) {
          cachedWasmBuffer = buf;
          return buf;
        }
      }
    } catch (_) {
      // Fallback para leitura via fs do Electron quando rodando em protocolo file://
    }

    try {
      const win = window as unknown as {
        require?: (mod: string) => any;
      };
      if (win.require) {
        const fs = win.require('node:fs');
        const urlMod = win.require('node:url');
        const resolvedUrl = new URL(rnnoiseWasmUrl, window.location.href).href;
        const filePath = resolvedUrl.startsWith('file:')
          ? urlMod.fileURLToPath(resolvedUrl)
          : resolvedUrl;
        if (fs.existsSync(filePath)) {
          const nodeBuf: Uint8Array = fs.readFileSync(filePath);
          const copy = new Uint8Array(nodeBuf.byteLength);
          copy.set(nodeBuf);
          cachedWasmBuffer = copy.buffer;
          return copy.buffer;
        }
      }
    } catch (err) {
      console.warn('[Voxy DSP] Fallback fs para rnnoise.wasm falhou:', err);
    }

    return null;
  })();

  return wasmLoadPromise;
}

/**
 * Código do AudioWorkletProcessor que roda na thread de áudio dedicada (48 kHz).
 * Combina:
 *  1. RNNoise C/WASM (Rede Neural Recorrente da Xiph.org) em blocos de 480 amostras (10ms)
 *  2. Detector Neural de Voz (VAD probability 0.0 -> 1.0) + Confirmação anti-transiente (teclado/cliques)
 *  3. Noise Gate / Expander com Histerese controlado pela Sensibilidade de Entrada (0..100%)
 *  4. Soft Limiter para evitar clipping
 */
const WORKLET_CODE = `
class VoxyRnnoiseWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.FRAME_SIZE = 480;
    this.PCM_SCALE = 32768.0;
    this.INV_PCM_SCALE = 1.0 / 32768.0;

    this.inputRing = new Float32Array(this.FRAME_SIZE * 4);
    this.outputRing = new Float32Array(this.FRAME_SIZE * 4);
    this.inputWritePos = 0;
    this.inputReadPos = 0;
    this.inputAvailable = 0;

    this.outputWritePos = 0;
    this.outputReadPos = 0;
    this.outputAvailable = 0;

    // Pré-aloca 1 frame (10ms) de latência inicial para evitar underrun entre blocos de 128 e 480 amostras
    this.outputWritePos = this.FRAME_SIZE;
    this.outputAvailable = this.FRAME_SIZE;

    // Estado do WASM RNNoise
    this.wasmReady = false;
    this.wasmExports = null;
    this.wasmMemory = null;
    this.HEAPU8 = null;
    this.HEAPF32 = null;
    this.rnnState = 0;
    this.pcmPtr = 0;
    this.pcmFloatOffset = 0;

    // Configurações dinâmicas vindas do SettingsModal
    this.noiseSuppression = true;
    this.inputSensitivity = 72; // 0 a 100

    // Estado do Noise Gate / Expander
    this.gateGain = 0.0;
    this.holdCounter = 0;
    this.speechConfirmCount = 0;
    this.smoothedVad = 0.0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'INIT_WASM' && data.wasmBuffer) {
        this.initWasm(data.wasmBuffer);
      } else if (data.type === 'CONFIG') {
        if (typeof data.noiseSuppression === 'boolean') {
          this.noiseSuppression = data.noiseSuppression;
        }
        if (typeof data.inputSensitivity === 'number') {
          this.inputSensitivity = Math.max(0, Math.min(100, data.inputSensitivity));
        }
      } else if (data.type === 'DESTROY') {
        this.cleanupWasm();
      }
    };
  }

  updateMemoryViews() {
    if (!this.wasmMemory) return;
    this.HEAPU8 = new Uint8Array(this.wasmMemory.buffer);
    this.HEAPF32 = new Float32Array(this.wasmMemory.buffer);
  }

  initWasm(wasmBuffer) {
    try {
      const importObj = {
        a: {
          a: (requestedSize) => {
            try {
              const pages = (requestedSize - this.wasmMemory.buffer.byteLength + 65535) >>> 16;
              this.wasmMemory.grow(pages);
              this.updateMemoryViews();
              return 1;
            } catch (_) {
              return 0;
            }
          },
          b: (dest, src, num) => {
            this.HEAPU8.copyWithin(dest, src, src + num);
          }
        }
      };

      WebAssembly.instantiate(wasmBuffer, importObj).then(({ instance }) => {
        const exp = instance.exports;
        this.wasmExports = exp;
        this.wasmMemory = exp.c;
        this.updateMemoryViews();

        // Inicializa construtores C do RNNoise
        if (typeof exp.d === 'function') exp.d();

        this.rnnState = exp.f(0); // _rnnoise_create(0)
        this.pcmPtr = exp.g(this.FRAME_SIZE * 4); // _malloc(1920)
        this.pcmFloatOffset = this.pcmPtr >> 2;
        this.wasmReady = Boolean(this.rnnState && this.pcmPtr);
      }).catch(() => {
        this.wasmReady = false;
      });
    } catch (_) {
      this.wasmReady = false;
    }
  }

  cleanupWasm() {
    if (this.wasmReady && this.wasmExports) {
      try {
        if (this.pcmPtr) this.wasmExports.i(this.pcmPtr);
        if (this.rnnState) this.wasmExports.h(this.rnnState);
      } catch (_) {}
    }
    this.wasmReady = false;
    this.rnnState = 0;
    this.pcmPtr = 0;
  }

  /**
   * Converte inputSensitivity (0..100) em limiar dBFS do Noise Gate.
   * - 100% -> -64 dB (super sensível, abre com qualquer sussurro)
   * - 72% (padrão) -> -46 dB (corta música de vizinho, cooler e ruído ambiente)
   * - 50% -> -35 dB (exige fala próxima ao microfone)
   * - 0% -> -16 dB (só abre falando alto bem perto do microfone)
   */
  getGateOpenThresholdDb() {
    if (this.inputSensitivity >= 99) return -80.0;
    return -16.0 - (this.inputSensitivity / 100.0) * 48.0;
  }

  processFrame480() {
    const cap = this.inputRing.length;
    let vadProb = 1.0;

    if (this.noiseSuppression && this.wasmReady && this.HEAPF32) {
      const base = this.pcmFloatOffset;
      for (let i = 0; i < this.FRAME_SIZE; i++) {
        const sample = this.inputRing[(this.inputReadPos + i) % cap];
        this.HEAPF32[base + i] = sample * this.PCM_SCALE;
      }

      // Executa a Rede Neural RNNoise in-place e obtém a probabilidade de voz humana (0.0 a 1.0)
      vadProb = this.wasmExports.j(this.rnnState, this.pcmPtr, this.pcmPtr);
    } else {
      vadProb = 1.0;
    }

    this.smoothedVad = this.smoothedVad * 0.6 + vadProb * 0.4;

    // Calcula RMS pós-RNNoise (em dBFS)
    let sumSq = 0.0;
    const base = this.pcmFloatOffset;
    const useWasmOut = this.noiseSuppression && this.wasmReady && this.HEAPF32;

    for (let i = 0; i < this.FRAME_SIZE; i++) {
      const s = useWasmOut
        ? this.HEAPF32[base + i] * this.INV_PCM_SCALE
        : this.inputRing[(this.inputReadPos + i) % cap];
      sumSq += s * s;
    }

    const rms = Math.sqrt(sumSq / this.FRAME_SIZE);
    const rmsDb = rms > 1e-7 ? 20.0 * Math.log10(rms) : -100.0;

    // Lógica do Noise Gate Inteligente + Anti-Teclado + Anti-Música de Fundo
    const openThresholdDb = this.getGateOpenThresholdDb();
    const closeThresholdDb = openThresholdDb - 5.0; // Histerese de 5 dB

    // Quando a supressão neural está ativa, exige que o RNNoise reconheça formantes de voz
    // (impede que batidas de teclado mecânico ou música abafada de vizinho abram o gate)
    const minVadForOpen = this.noiseSuppression && this.wasmReady ? 0.38 : 0.0;
    const isStrongVoice = vadProb >= 0.58 || (rmsDb >= openThresholdDb && this.smoothedVad >= minVadForOpen);

    if (rmsDb >= openThresholdDb && isStrongVoice) {
      this.speechConfirmCount = Math.min(5, this.speechConfirmCount + 1);
    } else {
      this.speechConfirmCount = 0;
    }

    // Abre imediatamente se a voz for muito clara (vad >= 0.58) ou após 2 frames (20ms) acima do limiar
    // Isso descarta cliques isolados de teclado/mouse que duram < 15ms!
    if (this.speechConfirmCount >= 2 || (rmsDb >= openThresholdDb && vadProb >= 0.58)) {
      this.holdCounter = 16; // Mantém aberto por pelo menos 160ms após parar de falar
    } else if (this.holdCounter > 0 && rmsDb >= closeThresholdDb) {
      this.holdCounter = Math.max(this.holdCounter - 1, 6);
    } else if (this.holdCounter > 0) {
      this.holdCounter--;
    }

    const targetGateGain = this.holdCounter > 0 ? 1.0 : 0.0;

    // Suavização sample-by-sample do envelope do Gate (ataque rápido ~3ms, release suave ~90ms)
    const attackCoeff = 0.015;
    const releaseCoeff = 0.0008;

    for (let i = 0; i < this.FRAME_SIZE; i++) {
      let s = useWasmOut
        ? this.HEAPF32[base + i] * this.INV_PCM_SCALE
        : this.inputRing[(this.inputReadPos + i) % cap];

      if (targetGateGain > this.gateGain) {
        this.gateGain += attackCoeff * (targetGateGain - this.gateGain);
      } else {
        this.gateGain += releaseCoeff * (targetGateGain - this.gateGain);
      }

      s *= this.gateGain;

      // Soft limiter para proteção de pico
      if (s > 0.95) {
        s = 0.95 + 0.05 * Math.tanh((s - 0.95) / 0.05);
      } else if (s < -0.95) {
        s = -0.95 + 0.05 * Math.tanh((s + 0.95) / 0.05);
      }

      this.outputRing[(this.outputWritePos + i) % cap] = s;
    }

    this.inputReadPos = (this.inputReadPos + this.FRAME_SIZE) % cap;
    this.inputAvailable -= this.FRAME_SIZE;

    this.outputWritePos = (this.outputWritePos + this.FRAME_SIZE) % cap;
    this.outputAvailable += this.FRAME_SIZE;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const inChannel = input[0];
    const outChannel = output[0];
    const blockLen = inChannel.length;
    const cap = this.inputRing.length;

    // 1. Empurra amostras de entrada para o buffer circular
    for (let i = 0; i < blockLen; i++) {
      this.inputRing[this.inputWritePos] = inChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % cap;
    }
    this.inputAvailable += blockLen;

    // 2. Processa blocos completos de 480 amostras (10ms a 48kHz)
    while (this.inputAvailable >= this.FRAME_SIZE) {
      this.processFrame480();
    }

    // 3. Copia amostras processadas para todos os canais de saída
    if (this.outputAvailable >= blockLen) {
      for (let i = 0; i < blockLen; i++) {
        const val = this.outputRing[this.outputReadPos];
        this.outputReadPos = (this.outputReadPos + 1) % cap;
        outChannel[i] = val;
      }
      this.outputAvailable -= blockLen;

      for (let ch = 1; ch < output.length; ch++) {
        output[ch].set(outChannel);
      }
    } else {
      outChannel.fill(0);
    }

    return true;
  }
}

registerProcessor('${WORKLET_PROCESSOR_NAME}', VoxyRnnoiseWorkletProcessor);
`;

async function ensureWorkletRegistered(audioContext: BaseAudioContext): Promise<void> {
  if (registeredContexts.has(audioContext)) return;
  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    await audioContext.audioWorklet.addModule(blobUrl);
    registeredContexts.add(audioContext);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Processador Neural de Áudio do Voxy (RNNoise WASM + High-Pass 85Hz + Noise Gate com Histerese).
 * Implementa `TrackProcessor` do LiveKit para uso direto no `LocalAudioTrack` e também
 * expõe pipeline WebAudio para o medidor de teste em `SettingsModal`.
 */
export class VoxyNeuralAudioProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  public name = 'voxy-neural-rnnoise-processor';
  public processedTrack?: MediaStreamTrack;

  private audioContext?: AudioContext;
  private sourceNode?: MediaStreamAudioSourceNode;
  private highPassNode?: BiquadFilterNode;
  private lowPassNode?: BiquadFilterNode;
  private workletNode?: AudioWorkletNode;
  private destinationNode?: MediaStreamAudioDestinationNode;
  private unsubscribeSettings?: () => void;

  public async init(opts: AudioProcessorOptions): Promise<void> {
    await this.setupPipeline(opts.audioContext, opts.track);
  }

  public async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.setupPipeline(opts.audioContext, opts.track);
  }

  /**
   * Conecta um MediaStream arbitrário (ex: no teste de microfone do SettingsModal)
   * retornando o nó final processado pelo RNNoise + Noise Gate.
   */
  public async connectToContext(
    audioContext: AudioContext,
    rawTrack: MediaStreamTrack
  ): Promise<AudioNode> {
    await this.setupPipeline(audioContext, rawTrack);
    return this.workletNode || this.highPassNode || this.sourceNode!;
  }

  private async setupPipeline(
    audioContext: AudioContext,
    rawTrack: MediaStreamTrack
  ): Promise<void> {
    this.audioContext = audioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => undefined);
    }

    const currentSettings = voiceAudioSettingsService.getSettings();

    const stream = new MediaStream([rawTrack]);
    this.sourceNode = audioContext.createMediaStreamSource(stream);

    // 1. Filtro High-Pass Butterworth em 85 Hz:
    // Remove graves de batidas na mesa, vento no microfone e sub-grave de música na casa do vizinho
    this.highPassNode = audioContext.createBiquadFilter();
    this.highPassNode.type = 'highpass';
    this.highPassNode.frequency.value = currentSettings.noiseSuppression ? 85 : 20;
    this.highPassNode.Q.value = 0.707;

    // 2. Filtro Low-Pass suave em 14 kHz:
    // Remove chiado eletrônico agudo (coil whine) sem afetar a clareza da voz
    this.lowPassNode = audioContext.createBiquadFilter();
    this.lowPassNode.type = 'lowpass';
    this.lowPassNode.frequency.value = 14000;
    this.lowPassNode.Q.value = 0.707;

    this.destinationNode = audioContext.createMediaStreamDestination();

    try {
      await ensureWorkletRegistered(audioContext);
      const wasmBuffer = await loadRnnoiseWasmBinary();

      this.workletNode = new AudioWorkletNode(audioContext, WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });

      this.workletNode.port.postMessage({
        type: 'CONFIG',
        noiseSuppression: currentSettings.noiseSuppression,
        inputSensitivity: currentSettings.inputSensitivity,
      });

      if (wasmBuffer) {
        this.workletNode.port.postMessage({
          type: 'INIT_WASM',
          wasmBuffer: wasmBuffer.slice(0),
        });
      }

      this.sourceNode.connect(this.highPassNode);
      this.highPassNode.connect(this.lowPassNode);
      this.lowPassNode.connect(this.workletNode);
      this.workletNode.connect(this.destinationNode);
    } catch (err) {
      console.warn(
        '[Voxy DSP] Falha ao iniciar AudioWorklet RNNoise, usando filtros nativos:',
        err
      );
      this.sourceNode.connect(this.highPassNode);
      this.highPassNode.connect(this.lowPassNode);
      this.lowPassNode.connect(this.destinationNode);
    }

    this.processedTrack = this.destinationNode.stream.getAudioTracks()[0];

    // Escuta alterações em tempo real vindas do SettingsModal
    this.unsubscribeSettings = voiceAudioSettingsService.subscribe((updated) => {
      this.applyLiveSettings(updated);
    });
  }

  public applyLiveSettings(settings: VoiceAudioSettings): void {
    if (this.highPassNode && this.audioContext) {
      this.highPassNode.frequency.setTargetAtTime(
        settings.noiseSuppression ? 85 : 20,
        this.audioContext.currentTime,
        0.02
      );
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'CONFIG',
        noiseSuppression: settings.noiseSuppression,
        inputSensitivity: settings.inputSensitivity,
      });
    }
  }

  public async destroy(): Promise<void> {
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = undefined;
    }

    try {
      this.workletNode?.port.postMessage({ type: 'DESTROY' });
      this.workletNode?.disconnect();
    } catch (_) {}

    try {
      this.lowPassNode?.disconnect();
      this.highPassNode?.disconnect();
      this.sourceNode?.disconnect();
      this.destinationNode?.disconnect();
    } catch (_) {}

    if (this.processedTrack) {
      this.processedTrack.stop();
      this.processedTrack = undefined;
    }

    this.workletNode = undefined;
    this.lowPassNode = undefined;
    this.highPassNode = undefined;
    this.sourceNode = undefined;
    this.destinationNode = undefined;
  }
}
