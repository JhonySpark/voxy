import { io, Socket } from 'socket.io-client';
import type { IRealtimeClientPort } from '../../../core/ports/realtime.port';


export class SocketRealtimeAdapter implements IRealtimeClientPort {
  private socket: Socket | null = null;
  private url: string;

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
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.socket) return;
    this.socket.emit(event, ...args);
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  getRawSocket(): Socket | null {
    return this.socket;
  }
}

export const realtimeClient = new SocketRealtimeAdapter();
