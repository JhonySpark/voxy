import React, { useEffect, useRef } from 'react';

interface VideoRendererProps {
  track: any;
  style?: React.CSSProperties;
  className?: string;
}

export const VideoRenderer: React.FC<VideoRendererProps> = ({ track, style, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return <video ref={videoRef} autoPlay playsInline muted style={style} className={className} />;
};
