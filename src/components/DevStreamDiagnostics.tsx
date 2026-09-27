import { useEffect, useState } from 'react';

type Values = Record<string, string | number | undefined>;

interface PreviousSample {
  timestamp: number;
  bytes: number;
  frames: number;
  encodeTime?: number;
}

/** Development-only WebRTC stats overlay. It never changes encoder parameters. */
export function DevStreamDiagnostics({ track }: { track: any }) {
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

          setValues({
            Direção: sending ? 'Envio' : 'Recepção',
            Resolução: stat.frameWidth && stat.frameHeight ? `${stat.frameWidth} × ${stat.frameHeight}` : undefined,
            FPS: stat.framesPerSecond ?? (previous && elapsed > 0 ? Math.round((frames - previous.frames) / elapsed) : undefined),
            'Mbps reais': previous && elapsed > 0 ? Number((((bytes - previous.bytes) * 8 / elapsed) / 1e6).toFixed(2)) : undefined,
            Codec: codec?.mimeType,
            Encoder: sending ? stat.encoderImplementation : undefined,
            Decoder: sending ? undefined : stat.decoderImplementation,
            'FPS da fonte': stat.framesPerSecond,
            'Encoding ms/quadro': encodingMs !== undefined && encodingMs >= 0 ? Number(encodingMs.toFixed(2)) : undefined,
            Limitação: stat.qualityLimitationReason,
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
    {open && <div style={{ background: '#111f', color: '#fff', marginTop: 4, padding: 10, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ marginBottom: 6, opacity: 0.7 }}>Somente desenvolvimento local</div>
      {Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => <div key={key}>{key}: {value}</div>)}
      {!Object.keys(values).length && <div>Aguardando amostra…</div>}
    </div>}
  </div>;
}
