import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorBody } from '@/types/api'

export function emptyConfig(url = '/todos'): InternalAxiosRequestConfig {
  return { url, headers: new AxiosHeaders() } as InternalAxiosRequestConfig
}

/**
 * A real AxiosError carrying the API's error envelope.
 *
 * It has to be a real one: the interceptor and the error helpers both gate on
 * `axios.isAxiosError`, so a plain `{ response: { status: 401 } }` object would
 * sail straight through unhandled and the test would prove nothing.
 */
export function axiosErrorWith(
  status: number,
  data: Partial<ApiErrorBody> = {},
  headers: Record<string, string> = {},
  config: InternalAxiosRequestConfig = emptyConfig(),
): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers,
    config,
    data,
  })
}

/** A request that never reached the server (DNS failure, offline, timeout). */
export function networkError(config: InternalAxiosRequestConfig = emptyConfig()): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', config)
}
