import { useEffect, useState } from 'react';

type Values = Record<string, string | number | undefined>;

interface PreviousSample {
  timestamp: number;
  bytes: number;
  frames: number;
  encodeTime?: number;
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

          const sourceFps = trackSettings.frameRate ?? mediaSourceStat?.framesPerSecond;
          const sourceRes = (trackSettings.width && trackSettings.height) 
            ? `${trackSettings.width} × ${trackSettings.height}` 
            : (mediaSourceStat?.width && mediaSourceStat?.height ? `${mediaSourceStat.width} × ${mediaSourceStat.height}` : undefined);

          setValues({
            Direção: sending ? 'Envio (Transmitindo)' : 'Recepção (Assistindo)',
            'Resolução RTC': stat.frameWidth && stat.frameHeight ? `${stat.frameWidth} × ${stat.frameHeight}` : undefined,
            'Resolução da Fonte': sourceRes,
            FPS: stat.framesPerSecond ?? (previous && elapsed > 0 ? Math.round((frames - previous.frames) / elapsed) : undefined),
            'FPS da Fonte': sourceFps ? Math.round(sourceFps) : undefined,
            'Frames Codificados': sending ? stat.framesEncoded : undefined,
            'Frames Enviados': sending ? stat.framesSent : undefined,
            'Mbps reais': previous && elapsed > 0 ? Number((((bytes - previous.bytes) * 8 / elapsed) / 1e6).toFixed(2)) : undefined,
            Codec: codec?.mimeType,
            Encoder: sending ? stat.encoderImplementation : undefined,
            Decoder: sending ? undefined : stat.decoderImplementation,
            'Encoding ms/quadro': encodingMs !== undefined && encodingMs >= 0 ? Number(encodingMs.toFixed(2)) : undefined,
            'Gargalo / Limitação': stat.qualityLimitationReason,
            Transporte: candidate?.protocol,
            'RTT (ms)': pair?.currentRoundTripTime !== undefined ? Math.round(pair.currentRoundTripTime * 1000) : undefined,
            'Pacotes perdidos': stat.packetsLost,
            'Quadros descartados': stat.framesDropped,
            Travamentos: stat.freezeCount,
          });
          previous = { timestamp: stat.timestamp, bytes, frames, encodeTime: stat.totalEncodeTime };
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
