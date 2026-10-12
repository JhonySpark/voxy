import { useEffect, useState } from 'react';

export interface StreamQualityOptions {
  track?: any;
  nativeTelemetry?: {
    fps?: number;
    width?: number;
    height?: number;
  } | null;
}

export function useStreamQuality({ track, nativeTelemetry }: StreamQualityOptions) {
  const [resolution, setResolution] = useState<string | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Se houver telemetria do pipeline nativo (NVENC Zero-Copy)
    if (nativeTelemetry) {
      if (nativeTelemetry.height) {
        setResolution(nativeTelemetry.height >= 1000 ? '1080p' : '720p');
      }
      if (nativeTelemetry.fps) {
        setFps(nativeTelemetry.fps >= 45 ? 60 : 30);
      }
      return;
    }

    if (!track) {
      setResolution(null);
      setFps(null);
      return;
    }

    // Lê configurações da fonte e WebRTC (como no DevStreamDiagnostics)
    const readSourceSettings = async () => {
      try {
        const trackSettings = track?.mediaStreamTrack?.getSettings?.() || {};

        if (trackSettings.height) {
          setResolution(trackSettings.height >= 1000 ? '1080p' : '720p');
        }
        if (trackSettings.frameRate) {
          setFps(trackSettings.frameRate >= 45 ? 60 : 30);
        }

        if (typeof track?.getRTCStatsReport === 'function') {
          const report: RTCStatsReport | undefined = await track.getRTCStatsReport();
          if (cancelled || !report) return;

          let mediaSourceStat: any;
          report.forEach((stat: any) => {
            if (stat.type === 'media-source' && stat.kind === 'video') {
              mediaSourceStat = stat;
            }
          });

          const sourceFps = trackSettings.frameRate ?? mediaSourceStat?.framesPerSecond;
          const sourceHeight = trackSettings.height ?? mediaSourceStat?.height;

          report.forEach((stat: any) => {
            if (!['outbound-rtp', 'inbound-rtp'].includes(stat.type) || (stat.kind ?? stat.mediaType) !== 'video') {
              return;
            }

            const h = sourceHeight ?? stat.frameHeight;
            const f = sourceFps ?? stat.framesPerSecond;

            if (h) {
              setResolution(h >= 1000 ? '1080p' : '720p');
            }
            if (f) {
              setFps(f >= 45 ? 60 : 30);
            }
          });
        }
      } catch (_) {}
    };

    void readSourceSettings();
    const interval = setInterval(readSourceSettings, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [track, nativeTelemetry]);

  const label = resolution && fps ? `${resolution} • ${fps} FPS` : resolution ? resolution : fps ? `${fps} FPS` : null;

  return { resolution, fps, label };
}
