import { useEffect, useState } from 'react';

type Values = Record<string, string | number | undefined>;

interface PreviousSample {
  timestamp: number;
  bytes: number;
  frames: number;
  encodeTime?: number;
  framesDropped?: number;
  freezeCount?: number;
  framesReceived?: number;
  framesRendered?: number;
  decodeTime?: number;
  processingDelay?: number;
}

export function DevStreamDiagnostics({
  track,
  nativeTelemetry,
}: {
  track: any;
  nativeTelemetry?: {
    fps: number;
    mbps: number;
    encodeMs: number;
    totalFrames: number;
    width?: number;
    height?: number;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>({});

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'F8' && event.code !== 'F8' && event.keyCode !== 119) || event.repeat) return;
      event.preventDefault();
      setOpen((visible) => !visible);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    if (!open || typeof track?.getRTCStatsReport !== 'function') return;

    let previous: PreviousSample | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const collect = async () => {
      try {
        const report: RTCStatsReport | undefined = await track.getRTCStatsReport();
        if (cancelled || !report) return;

        let mediaSourceStat: any;
        report.forEach((stat: any) => {
          if (stat.type === 'media-source' && stat.kind === 'video') {
            mediaSourceStat = stat;
          }
        });

        const trackSettings = track?.mediaStreamTrack?.getSettings?.() || {};

        report.forEach((stat: any) => {
          if (!['outbound-rtp', 'inbound-rtp'].includes(stat.type) || (stat.kind ?? stat.mediaType) !== 'video') return;

          const sending = stat.type === 'outbound-rtp';
          const bytes = sending ? stat.bytesSent ?? 0 : stat.bytesReceived ?? 0;
          const frames = sending ? stat.framesEncoded ?? 0 : stat.framesDecoded ?? 0;
          const elapsed = previous ? (stat.timestamp - previous.timestamp) / 1000 : 0;
          const codec = report.get(stat.codecId) as any;
          const transport = report.get(stat.transportId) as any;
          const pair = transport?.selectedCandidatePairId ? report.get(transport.selectedCandidatePairId) as any : undefined;
          const candidate = pair?.localCandidateId ? report.get(pair.localCandidateId) as any : undefined;
          const encodingMs = sending && previous && stat.totalEncodeTime !== undefined && frames > previous.frames
            ? (stat.totalEncodeTime - (previous.encodeTime ?? stat.totalEncodeTime)) * 1000 / (frames - previous.frames)
            : undefined;
          const decodedDelta = previous ? frames - previous.frames : 0;
          const receivedDelta = previous && stat.framesReceived !== undefined
            ? stat.framesReceived - (previous.framesReceived ?? stat.framesReceived)
            : 0;
          const renderedDelta = previous && stat.framesRendered !== undefined
            ? stat.framesRendered - (previous.framesRendered ?? stat.framesRendered)
            : 0;
          const decodeMs = !sending && previous && decodedDelta > 0 && stat.totalDecodeTime !== undefined
            ? (stat.totalDecodeTime - (previous.decodeTime ?? stat.totalDecodeTime)) * 1000 / decodedDelta
            : undefined;
          const processingMs = !sending && previous && decodedDelta > 0 && stat.totalProcessingDelay !== undefined
            ? (stat.totalProcessingDelay - (previous.processingDelay ?? stat.totalProcessingDelay)) * 1000 / decodedDelta
            : undefined;

          const rawSourceFps = Number(trackSettings.frameRate ?? mediaSourceStat?.framesPerSecond);
          const sourceFps = Number.isFinite(rawSourceFps) && rawSourceFps >= 0
            ? Math.round(rawSourceFps)
            : undefined;
          const sourceRes = (trackSettings.width && trackSettings.height) 
            ? `${trackSettings.width} × ${trackSettings.height}` 
            : (mediaSourceStat?.width && mediaSourceStat?.height ? `${mediaSourceStat.width} × ${mediaSourceStat.height}` : undefined);

          const droppedPerSecond = previous && elapsed > 0 && stat.framesDropped !== undefined
            ? Math.max(0, (stat.framesDropped - (previous.framesDropped ?? stat.framesDropped)) / elapsed)
            : undefined;
          const freezesPerSecond = previous && elapsed > 0 && stat.freezeCount !== undefined
            ? Math.max(0, (stat.freezeCount - (previous.freezeCount ?? stat.freezeCount)) / elapsed)
            : undefined;
          const averageJitterBufferMs = stat.jitterBufferDelay !== undefined && stat.jitterBufferEmittedCount > 0
            ? (stat.jitterBufferDelay / stat.jitterBufferEmittedCount) * 1000
            : undefined;

          setValues({
            Direção: sending ? 'Envio (Transmitindo)' : 'Recepção (Assistindo)',
            'Resolução RTC': stat.frameWidth && stat.frameHeight ? `${stat.frameWidth} × ${stat.frameHeight}` : undefined,
            'Resolução da Fonte': sourceRes,
            FPS: stat.framesPerSecond ?? (previous && elapsed > 0 ? Math.round((frames - previous.frames) / elapsed) : undefined),
            'FPS da Fonte': sourceFps,
            'Frames Codificados': sending ? stat.framesEncoded : undefined,
            'Frames Enviados': sending ? stat.framesSent : undefined,
            'Pacotes descartados': sending ? undefined : stat.packetsDiscarded,
            'Frames recebidos': sending ? undefined : stat.framesReceived,
            'Frames decodificados': sending ? undefined : stat.framesDecoded,
            'Frames renderizados': sending ? undefined : stat.framesRendered,
            'Recebidos/s': !sending && previous && elapsed > 0 ? Number((receivedDelta / elapsed).toFixed(2)) : undefined,
            'Decodificados/s': !sending && previous && elapsed > 0 ? Number((decodedDelta / elapsed).toFixed(2)) : undefined,
            'Renderizados/s': !sending && previous && elapsed > 0 && stat.framesRendered !== undefined
              ? Number((renderedDelta / elapsed).toFixed(2))
              : undefined,
            'Tempo total de decode (s)': !sending && Number.isFinite(stat.totalDecodeTime)
              ? Number(stat.totalDecodeTime.toFixed(3))
              : undefined,
            'Decode ms/quadro': decodeMs !== undefined && decodeMs >= 0 ? Number(decodeMs.toFixed(2)) : undefined,
            'Processamento ms/quadro': processingMs !== undefined && processingMs >= 0
              ? Number(processingMs.toFixed(2))
              : undefined,
            'Atraso medio do jitter buffer (ms)': averageJitterBufferMs !== undefined
              ? Number(averageJitterBufferMs.toFixed(2))
              : undefined,
            'Mbps reais': previous && elapsed > 0 ? Number((((bytes - previous.bytes) * 8 / elapsed) / 1e6).toFixed(2)) : undefined,
            Codec: codec?.mimeType,
            'Codec fmtp': codec?.sdpFmtpLine,
            Encoder: sending ? stat.encoderImplementation : undefined,
            Decoder: sending ? undefined : stat.decoderImplementation,
            'Encoding ms/quadro': encodingMs !== undefined && encodingMs >= 0 ? Number(encodingMs.toFixed(2)) : undefined,
            'Gargalo / Limitação': stat.qualityLimitationReason,
            Transporte: candidate?.protocol,
            'RTT (ms)': pair?.currentRoundTripTime !== undefined ? Math.round(pair.currentRoundTripTime * 1000) : undefined,
            'Pacotes perdidos': stat.packetsLost,
            'Quadros descartados': stat.framesDropped,
            'Descartados/s': droppedPerSecond !== undefined ? Number(droppedPerSecond.toFixed(2)) : undefined,
            Travamentos: stat.freezeCount,
            'Travamentos/s': freezesPerSecond !== undefined ? Number(freezesPerSecond.toFixed(2)) : undefined,
            'Duração total de travamentos (s)': stat.totalFreezesDuration,
            'Keyframes decodificados': sending ? undefined : stat.keyFramesDecoded,
            NACKs: sending ? undefined : stat.nackCount,
            PLIs: sending ? undefined : stat.pliCount,
            FIRs: sending ? undefined : stat.firCount,
          });
          previous = {
            timestamp: stat.timestamp,
            bytes,
            frames,
            encodeTime: stat.totalEncodeTime,
            framesDropped: stat.framesDropped,
            freezeCount: stat.freezeCount,
            framesReceived: stat.framesReceived,
            framesRendered: stat.framesRendered,
            decodeTime: stat.totalDecodeTime,
            processingDelay: stat.totalProcessingDelay,
          };
        });
      } catch (error) {
        if (!cancelled) setValues({ Estado: error instanceof Error ? error.message : 'Não foi possível ler as estatísticas.' });
      } finally {
        if (!cancelled) timer = setTimeout(collect, 1000);
      }
    };

    void collect();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, track]);

  if (!open) return null;

  return <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 50, maxWidth: 'calc(100% - 16px)' }}>
    <button type="button" onClick={() => setOpen(value => !value)} style={{ background: '#111e', color: '#fff', border: '1px solid #ffffff33', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
      {open ? 'Fechar diagnóstico' : 'Diagnóstico'}
    </button>
    {open && <div style={{ background: '#111f', color: '#fff', marginTop: 4, padding: 10, fontSize: 12, lineHeight: 1.45, borderRadius: 6, border: '1px solid #ffffff22' }}>
      <div style={{ marginBottom: 6, fontWeight: 'bold', color: '#38bdf8' }}>Somente desenvolvimento local</div>
      {nativeTelemetry && (
        <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #ffffff22' }}>
          <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: 4 }}>
            ⚡ Pipeline Nativo GPU (NVENC Zero-Copy)
          </div>
          <div>FPS Envio GPU: {nativeTelemetry.fps} FPS</div>
          <div>Encode Latência: {nativeTelemetry.encodeMs.toFixed(2)} ms/quadro</div>
          <div>Bitrate GPU: {nativeTelemetry.mbps.toFixed(2)} Mbps</div>
          {nativeTelemetry.width && nativeTelemetry.height && (
            <div>Resolução Codificada: {nativeTelemetry.width} × {nativeTelemetry.height}</div>
          )}
          <div>Total de Quadros: {nativeTelemetry.totalFrames}</div>
        </div>
      )}
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
        📡 Visualização no App (WebRTC Local):
      </div>
      {Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => <div key={key}>{key}: {value}</div>)}
      {!Object.keys(values).length && <div>Aguardando amostra WebRTC…</div>}
    </div>}
  </div>;
}
