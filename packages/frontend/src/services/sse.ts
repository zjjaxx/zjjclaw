import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ChatMessage, Novel } from './api'

const BASE_URL = '/api'

export type SSEEvent =
  | { type: 'progress'; step: string; message: string }
  | { type: 'result'; data: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' }

export type SSEHandlers = {
  onMessage: (event: SSEEvent) => void
  onError?: (err: unknown) => void
  onClose?: () => void
}

export function streamNovelAction(
  novelId: string,
  action: string,
  body: Record<string, unknown>,
  handlers: SSEHandlers,
  signal?: AbortSignal,
) {
  return fetchEventSource(`${BASE_URL}/novels/${novelId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
    onmessage(ev) {
      try {
        const data = JSON.parse(ev.data) as SSEEvent
        handlers.onMessage(data)
      } catch {
        // ignore malformed events
      }
    },
    onerror(err) {
      handlers.onError?.(err)
      throw err // stop retrying
    },
    onclose() {
      handlers.onClose?.()
    },
  })
}

// ─── 全流程生成流 ────────────────────────────────────────────────────────────────

export type GenerateEvent =
  | { event: 'start'; data: { message: string } }
  | { event: 'step'; data: { step: string; message: string } }
  | { event: 'step_done'; data: { step: string } }
  | { event: 'step_retry'; data: { step: string; attempt: number; maxRetries: number; error: string; message: string } }
  | { event: 'step_error'; data: { step: string; error: string; message: string } }
  | { event: 'skip'; data: { step: string } }
  | { event: 'interrupted'; data: { step: string | null; message: string } }
  | { event: 'done'; data: { message: string } }
  | { event: 'error'; data: { message: string } }

export type GenerateHandlers = {
  onEvent: (ev: GenerateEvent) => void
  onClose?: () => void
}

export function streamGenerate(
  novelId: string,
  restart: boolean,
  handlers: GenerateHandlers,
  signal?: AbortSignal,
) {
  return fetchEventSource(`${BASE_URL}/novels/${novelId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restart }),
    signal,
    onmessage(ev) {
      try {
        const data = JSON.parse(ev.data)
        handlers.onEvent({ event: ev.event as GenerateEvent['event'], data } as GenerateEvent)
      } catch {
        // ignore malformed
      }
    },
    onerror(err) {
      handlers.onEvent({ event: 'error', data: { message: String(err) } })
      throw err
    },
    onclose() {
      handlers.onClose?.()
    },
  })
}

// ─── AG-UI 市场聊天流 ──────────────────────────────────────────────────────────

type AGUIChunk =
  | { type: 'RUN_STARTED'; runId: string }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: string }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | { type: 'RUN_FINISHED'; runId: string; finishReason: string }

export type MarketChatHandlers = {
  onDelta: (delta: string) => void
  onNovelCreated?: (novel: Novel) => void
  onDone?: () => void
  onError?: (err: unknown) => void
}

export function streamMarketChat(
  messages: ChatMessage[],
  autoCreate: boolean,
  handlers: MarketChatHandlers,
  signal?: AbortSignal,
) {
  return fetchEventSource(`${BASE_URL}/novels/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, autoCreate }),
    signal,
    onmessage(ev) {
      // terminal marker
      if (ev.data === '[DONE]') {
        handlers.onDone?.()
        return
      }
      // named event: novel_created
      if (ev.event === 'novel_created') {
        try {
          const payload = JSON.parse(ev.data) as { success: boolean; data: Novel }
          if (payload.success) handlers.onNovelCreated?.(payload.data)
        } catch { /* ignore */ }
        return
      }
      // AG-UI events (no event name, just data)
      try {
        const chunk = JSON.parse(ev.data) as AGUIChunk
        if (chunk.type === 'TEXT_MESSAGE_CONTENT') {
          handlers.onDelta(chunk.delta)
        } else if (chunk.type === 'RUN_FINISHED') {
          handlers.onDone?.()
        }
      } catch { /* ignore */ }
    },
    onclose() {
      handlers.onDone?.()
      throw new Error('stream closed')
    },
    onerror(err) {
      handlers.onError?.(err)
      throw err
    },
  })
}

