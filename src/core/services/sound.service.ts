import notificationSoundUrl from '../../assets/sounds/notification.wav';
import { UserStatusEnum } from '../enums';

/**
 * SoundService
 * Gerencia efeitos sonoros de notificação com:
 * 1. Bloqueio automático durante chamadas de voz ativas (Voice Room).
 * 2. Bloqueio quando o usuário estiver em status DND (Não Perturbe).
 * 3. Proteção anti-spam (cooldown de 2 segundos) para evitar poluição auditiva em rajadas de mensagens.
 */
class SoundService {
  private isInVoiceCall = false;
  private userStatus: string = UserStatusEnum.ONLINE;
  private lastPlayedAt = 0;
  private readonly cooldownMs = 2000;
  private audioElement: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioElement = new Audio(notificationSoundUrl);
        this.audioElement.volume = 0.6;
        this.audioElement.preload = 'auto';
      } catch (err) {
        console.warn('[SoundService] Falha ao pré-carregar áudio de notificação:', err);
      }
    }
  }

  /**
   * Atualiza se o usuário está atualmente conectado a uma sala/canal de voz.
   */
  public setIsInVoiceCall(inVoice: boolean): void {
    this.isInVoiceCall = inVoice;
  }

  public getIsInVoiceCall(): boolean {
    return this.isInVoiceCall;
  }

  /**
   * Atualiza o status de presença do usuário (ONLINE, IDLE, DND, OFFLINE).
   */
  public setUserStatus(status: string): void {
    this.userStatus = status;
  }

  /**
   * Reproduz o som de notificação respeitando todas as regras de silenciamento e anti-spam.
   * Retorna true se tocou, ou false se foi suprimido por alguma regra.
   */
  public playNotificationSound(forceBypassCooldown = false): boolean {
    // 1. Regra Crítica: Não tocar se estiver em call de voz
    if (this.isInVoiceCall) {
      return false;
    }

    // 2. Não tocar se estiver em modo Não Perturbe (DND)
    if (this.userStatus === UserStatusEnum.DND) {
      return false;
    }

    // 3. Regra Crítica: Anti-spam auditivo (cooldown)
    const now = Date.now();
    if (!forceBypassCooldown && now - this.lastPlayedAt < this.cooldownMs) {
      return false;
    }

    this.lastPlayedAt = now;

    try {
      if (!this.audioElement) {
        this.audioElement = new Audio(notificationSoundUrl);
        this.audioElement.volume = 0.6;
      }
      this.audioElement.currentTime = 0;
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignora silenciosamente restrições de autoplay do browser
        });
      }
      return true;
    } catch (err) {
      console.warn('[SoundService] Erro ao tocar som de notificação:', err);
      return false;
    }
  }

  /**
   * Permite ao usuário testar o som na tela de configurações.
   */
  public testSound(): void {
    this.playNotificationSound(true);
  }
}

export const soundService = new SoundService();
