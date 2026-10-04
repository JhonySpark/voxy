import { Room, RoomEvent } from 'livekit-client';
import type { IVoiceClientPort, VoiceRoomEventHandlers } from '../../../core/ports/voice-engine.port';
import { logger } from '../../../core/services/logger.service';

export class LivekitVoiceClientAdapter implements IVoiceClientPort {
  private room: Room | null = null;

  async connect(url: string, token: string, handlers?: VoiceRoomEventHandlers): Promise<Room> {
    if (this.room) {
      await this.disconnect();
    }

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    if (handlers) {
      if (handlers.onConnected) {
        this.room.on(RoomEvent.Connected, handlers.onConnected);
      }
      if (handlers.onDisconnected) {
        this.room.on(RoomEvent.Disconnected, handlers.onDisconnected);
      }
      if (handlers.onParticipantConnected) {
        this.room.on(RoomEvent.ParticipantConnected, handlers.onParticipantConnected);
      }
      if (handlers.onParticipantDisconnected) {
        this.room.on(RoomEvent.ParticipantDisconnected, handlers.onParticipantDisconnected);
      }
      if (handlers.onTrackSubscribed) {
        this.room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
          handlers.onTrackSubscribed?.(track, pub, participant);
        });
      }
      if (handlers.onTrackUnsubscribed) {
        this.room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
          handlers.onTrackUnsubscribed?.(track, pub, participant);
        });
      }
      if (handlers.onActiveSpeakersChanged) {
        this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          handlers.onActiveSpeakersChanged?.(speakers);
        });
      }
    }

    try {
      await this.room.connect(url, token);
      logger.logEvent('VOICE_ROOM_CONNECTED', { url });
      return this.room;
    } catch (err) {
      logger.error('Failed to connect to LiveKit voice room', err, { url });
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setScreenShareEnabled(enabled: boolean, options?: any): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setScreenShareEnabled(enabled, options);
  }

  isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant.isMicrophoneEnabled ?? false;
  }

  isScreenShareEnabled(): boolean {
    return this.room?.localParticipant.isScreenShareEnabled ?? false;
  }

  getRoom(): Room | null {
    return this.room;
  }
}

export const voiceClient = new LivekitVoiceClientAdapter();
