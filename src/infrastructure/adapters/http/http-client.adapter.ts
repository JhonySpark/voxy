import api from '../../../api';
import type { IHttpClientPort } from '../../../core/ports/http-client.port';


export class HttpClientAdapter implements IHttpClientPort {
  async get<T = any>(url: string, config?: any): Promise<T> {
    const res = await api.get<T>(url, config);
    return res.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const res = await api.post<T>(url, data, config);
    return res.data;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const res = await api.put<T>(url, data, config);
    return res.data;
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const res = await api.delete<T>(url, config);
    return res.data;
  }
}

export const httpClient: IHttpClientPort = new HttpClientAdapter();
