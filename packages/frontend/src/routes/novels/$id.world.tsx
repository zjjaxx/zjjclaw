import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { streamNovelAction, type SSEEvent } from '@/services/sse'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const Route = createFileRoute('/novels/$id/world')({
  component: WorldPage,
})

function WorldPage() {
  const { id } = Route.useParams()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle')
  const [log, setLog] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  function start() {
    setContent('')
    setLog([])
    setStatus('streaming')
    abortRef.current = new AbortController()

    void streamNovelAction(id, 'world', {}, {
      onMessage(event: SSEEvent) {
        if (event.type === 'progress') {
          setLog((l) => [...l, event.message])
        } else if (event.type === 'result') {
          const data = event.data as { content?: string } | string
          const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          setContent(text)
        } else if (event.type === 'done') {
          setStatus('done')
        } else if (event.type === 'error') {
          setLog((l) => [...l, `错误: ${event.message}`])
          setStatus('error')
        }
      },
      onClose() {
        setStatus('done')
      },
      onError() {
        setStatus('error')
      },
    }, abortRef.current.signal)
  }

  function stop() {
    abortRef.current?.abort()
    setStatus('idle')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">世界观生成</h1>
        <div className="flex gap-2">
          {status === 'streaming' ? (
            <button
              onClick={stop}
              className="px-4 py-2 border rounded-md text-sm hover:bg-accent transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              onClick={start}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {content ? '重新生成' : '开始生成'}
            </button>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-md text-xs text-muted-foreground space-y-1">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {content && (
        <div className="border rounded-lg p-6 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}

      {!content && status === 'idle' && (
        <div className="text-center text-muted-foreground py-20">
          点击「开始生成」让 AI 构建世界观
        </div>
      )}
    </div>
  )
}
