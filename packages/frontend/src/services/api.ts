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

export type GeneratedChapter = {
  number: number
  content: string
}

export type NovelDetail = Novel & {
  world?: string | null
  powerSystem?: string | null
  characters?: unknown[]
  outline?: Record<string, unknown> | null
  chapters?: GeneratedChapter[]
}

export type GenerateStepStatus = 'pending' | 'running' | 'completed' | 'failed'

export type GenerateStatus = {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'interrupted'
  currentStep: string | null
  failedStep: string | null
  failedError: string | null
  startedAt: string | null
  updatedAt: string | null
  completedSteps: string[]
  steps: Array<{
    name: string
    status: GenerateStepStatus
  }>
}

export const novelsApi = {
  list: () => apiFetch<{ data: Novel[] }>('/novels'),
  get: (id: string) => apiFetch<{ data: NovelDetail }>(`/novels/${id}`),
  getGenerateStatus: (id: string) => apiFetch<{ data: GenerateStatus }>(`/novels/${id}/generate/status`),
  interruptGenerate: (id: string) =>
    apiFetch<{ data: GenerateStatus }>(`/novels/${id}/generate/interrupt`, { method: 'POST' }),
  create: (body: { title: string; template: string; premise?: string }) =>
    apiFetch<Novel>('/novels', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/novels/${id}`, { method: 'DELETE' }),
  exportUrl: (id: string) => `${BASE_URL}/novels/${id}/export`,
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
