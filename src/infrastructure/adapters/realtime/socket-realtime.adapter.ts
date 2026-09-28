import { io, Socket } from 'socket.io-client';
import type { IRealtimeClientPort } from '../../../core/ports/realtime.port';

export class SocketRealtimeAdapter implements IRealtimeClientPort {
  private socket: Socket | null = null;
  private url: string;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private emitQueue: Array<{ event: string; args: any[] }> = [];

  constructor(url?: string) {
    this.url = url || import.meta.env.VITE_API_URL || 'http://localhost:3000';
  }

  connect(token: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.url, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Reanexa todos os ouvintes registrados
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const cb of callbacks) {
        this.socket.on(event, cb);
      }
    }

    this.socket.on('connect', () => {
      // Descarrega fila de eventos emitidos antes da conexão
      while (this.emitQueue.length > 0) {
        const item = this.emitQueue.shift();
        if (item && this.socket) {
          this.socket.emit(item.event, ...item.args);
        }
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else if (this.socket) {
      this.socket.emit(event, ...args);
    } else {
      this.emitQueue.push({ event, args });
    }
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  getRawSocket(): Socket | null {
    return this.socket;
  }
}

export const realtimeClient = new SocketRealtimeAdapter();
