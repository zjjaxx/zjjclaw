const BASE_URL = '/api'

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API Error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export type Novel = {
  id: string
  title: string
  template: string
  createdAt: string
  updatedAt: string
  status?: string
}

export type NovelDetail = Novel & {
  world?: unknown
  powerSystem?: unknown
  characters?: unknown
  outline?: unknown
  chapters?: unknown[]
}

export const novelsApi = {
  list: () => apiFetch<Novel[]>('/novels'),
  get: (id: string) => apiFetch<NovelDetail>(`/novels/${id}`),
  create: (body: { title: string; template: string; premise?: string }) =>
    apiFetch<Novel>('/novels', { method: 'POST', body: JSON.stringify(body) }),
  exportUrl: (id: string) => `${BASE_URL}/novels/${id}/export`,
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
