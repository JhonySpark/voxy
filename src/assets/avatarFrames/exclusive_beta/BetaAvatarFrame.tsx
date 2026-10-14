import type { CSSProperties } from "react";
import "./BetaAvatarFrame.css";

type Props = {
  avatarUrl: string;
  size?: number;
  animated?: boolean;
  className?: string;
};

export function BetaAvatarFrame({ avatarUrl, size = 128, animated = true, className = "" }: Props) {
  return (
    <div
      className={`voxy-beta ${animated ? "voxy-beta--animated" : ""} ${className}`}
      style={{ "--voxy-size": `${size}px` } as CSSProperties}
    >
      <img className="voxy-beta__avatar" src={avatarUrl} alt="" />
      <div className="voxy-beta__aura" aria-hidden="true" />
      <img className="voxy-beta__frame" src="/frames/beta.png" alt="" aria-hidden="true" />
      <div className="voxy-beta__gem voxy-beta__gem--top" aria-hidden="true" />
      <div className="voxy-beta__gem voxy-beta__gem--bottom" aria-hidden="true" />
      <span className="voxy-beta__spark voxy-beta__spark--1" aria-hidden="true" />
      <span className="voxy-beta__spark voxy-beta__spark--2" aria-hidden="true" />
      <span className="voxy-beta__spark voxy-beta__spark--3" aria-hidden="true" />
    </div>
  );
}
