export interface IRealtimeClientPort {
  connect(token: string): void;
  disconnect(): void;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback?: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  isConnected(): boolean;
}
