export interface VoiceRoomEventHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantConnected?: (participant: any) => void;
  onParticipantDisconnected?: (participant: any) => void;
  onTrackSubscribed?: (track: any, publication: any, participant: any) => void;
  onTrackUnsubscribed?: (track: any, publication: any, participant: any) => void;
  onActiveSpeakersChanged?: (speakers: any[]) => void;
  onError?: (error: Error) => void;
}

export interface IVoiceClientPort {
  connect(url: string, token: string, handlers?: VoiceRoomEventHandlers): Promise<any>;
  disconnect(): Promise<void>;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  setScreenShareEnabled(enabled: boolean, options?: any): Promise<void>;
  isMicrophoneEnabled(): boolean;
  isScreenShareEnabled(): boolean;
}
