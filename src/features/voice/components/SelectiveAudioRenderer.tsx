import React, { useEffect, useRef } from 'react';
import { useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

interface SelectiveAudioRendererProps {
  watchingStreams: Set<string>;
  streamVolumes: Record<string, number>;
  userVolumes: Record<string, number>;
}

export const SelectiveAudioRenderer: React.FC<SelectiveAudioRendererProps> = ({
  watchingStreams,
  streamVolumes,
  userVolumes,
}) => {
  const participants = useParticipants();
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Gerenciamento seletivo de áudio para cada participante remoto
  useEffect(() => {
    participants.forEach((p) => {
      if (p.isLocal) return;

      // 1. Áudio do Microfone: sempre subscrito e tocado
      const micPub = p.getTrackPublication(Track.Source.Microphone);
      if (micPub?.audioTrack) {
        const key = `${p.identity}-mic`;
        let el = audioElementsRef.current.get(key);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioElementsRef.current.set(key, el);
          micPub.audioTrack.attach(el);
        }
        const userVol = userVolumes[p.identity] ?? 100;
        const isMicMuted = userVol <= 0;
        const targetMicVol = isMicMuted ? 0 : Math.max(0, Math.min(1.0, userVol / 100));
        el.muted = isMicMuted;
        el.volume = targetMicVol;
        if (typeof (micPub.audioTrack as any).setVolume === 'function') {
          (micPub.audioTrack as any).setVolume(targetMicVol);
        }
      }

      // 2. Áudio da Transmissão de Tela: SÓ toca e SÓ subscreve se o usuário estiver assistindo!
      const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio) as any;
      if (screenAudioPub) {
        const streamOwnerId = p.identity.endsWith('#screen')
          ? p.identity.slice(0, -'#screen'.length)
          : p.identity;
        const isWatching = watchingStreams.has(streamOwnerId);
        const key = `${p.identity}-screen-audio`;

        // Ativa/desativa a subscrição no LiveKit SFU (economiza banda e processamento)
        if (typeof screenAudioPub.setSubscribed === 'function' && screenAudioPub.isSubscribed !== isWatching) {
          screenAudioPub.setSubscribed(isWatching);
        }

        let el = audioElementsRef.current.get(key);

        if (isWatching && screenAudioPub.audioTrack) {
          if (!el) {
            el = new Audio();
            el.autoplay = true;
            audioElementsRef.current.set(key, el);
            screenAudioPub.audioTrack.attach(el);
          }
          const streamVol = streamVolumes[streamOwnerId] ?? 100;
          const isMuted = streamVol <= 0;
          const targetVol = isMuted ? 0 : Math.max(0, Math.min(1.0, streamVol / 100));
          
          el.muted = isMuted;
          el.volume = targetVol;

          // Aplica também em todos os elementos de áudio anexados pelo LiveKit (ex: RoomAudioRenderer)
          if (Array.isArray(screenAudioPub.audioTrack.attachedElements)) {
            screenAudioPub.audioTrack.attachedElements.forEach((audioEl: HTMLAudioElement) => {
              audioEl.muted = isMuted;
              audioEl.volume = targetVol;
            });
          }

          // Aplica também diretamente no WebRTC AudioTrack do LiveKit caso suportado
          if (typeof (screenAudioPub.audioTrack as any).setVolume === 'function') {
            (screenAudioPub.audioTrack as any).setVolume(targetVol);
          }
        } else if (!isWatching && el) {
          // Desconecta e pausa o áudio imediatamente se parou de assistir
          el.pause();
          if (screenAudioPub.audioTrack) {
            screenAudioPub.audioTrack.detach(el);
          }
          el.srcObject = null;
          audioElementsRef.current.delete(key);
        }
      }
    });

    // Limpeza de participantes que saíram
    const currentIdentities = new Set(participants.map((p) => p.identity));
    audioElementsRef.current.forEach((el, key) => {
      const pId = key.split('-')[0];
      if (!currentIdentities.has(pId)) {
        el.pause();
        el.srcObject = null;
        audioElementsRef.current.delete(key);
      }
    });
  }, [participants, watchingStreams, streamVolumes, userVolumes]);

  // Limpeza ao desmontar a sala
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((el) => {
        el.pause();
        el.srcObject = null;
      });
      audioElementsRef.current.clear();
    };
  }, []);

  return null;
};
