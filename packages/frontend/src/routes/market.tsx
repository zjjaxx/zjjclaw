import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, CheckCircle, Sparkles, ArrowRight } from 'lucide-react'
import { streamMarketChat } from '@/services/sse'
import { apiFetch } from '@/services/api'
import type { ChatMessage, Novel } from '@/services/api'

export const Route = createFileRoute('/market')({
  component: MarketPage,
})

type Message = ChatMessage & { pending?: boolean }

type NovelProposal = {
  id: number
  title: string
  template: 'urban-supernatural' | 'xianxia' | 'post-apocalyptic'
  tagline: string
  themes: string[]
  setting: string
  protagonist: string
  cheatType: string
  hooks: string[]
}

const TEMPLATE_LABELS: Record<string, string> = {
  'urban-supernatural': '都市异能',
  'xianxia': '玄幻修真',
  'post-apocalyptic': '末世重生',
}

function parseProposals(content: string): NovelProposal[] | null {
  const match = content.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    const data = JSON.parse(match[1].trim()) as unknown
    if (Array.isArray(data) && data.length > 0 && (data[0] as Record<string, unknown>).title) {
      return data as NovelProposal[]
    }
    return null
  } catch {
    return null
  }
}

const INITIAL_PROMPT = '请分析起点、番茄、七猫等平台当前最热门的小说类型，为我推荐 3-5 个最具市场潜力的小说题材方案，并输出 JSON。'

function MarketPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<NovelProposal | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdNovel, setCreatedNovel] = useState<Novel | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasAutoStarted = useRef(false)

  const sendMessage = useCallback((text: string, baseMessages?: Message[]) => {
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...(baseMessages ?? messages).filter((m) => !m.pending), userMsg]

    setMessages((m) => [...m.filter((x) => !x.pending), userMsg, { role: 'assistant', content: '', pending: true }])
    setStreaming(true)
    setCreatedNovel(null)

    abortRef.current = new AbortController()

    void streamMarketChat(
      history,
      false,
      {
        onDelta(delta) {
          setMessages((m) => {
            const copy = [...m]
            const last = copy[copy.length - 1]
            if (last?.pending) copy[copy.length - 1] = { ...last, content: last.content + delta }
            return copy
          })
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 10)
        },
        onDone() {
          setMessages((m) => m.map((msg) => (msg.pending ? { ...msg, pending: false } : msg)))
          setStreaming(false)
        },
        onError() {
          setMessages((m) =>
            m.map((msg) =>
              msg.pending ? { ...msg, content: msg.content || '请求失败，请重试', pending: false } : msg,
            ),
          )
          setStreaming(false)
        },
      },
      abortRef.current.signal,
    )
  }, [messages, streaming])

  // Auto-trigger on mount
  useEffect(() => {
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true
      sendMessage(INITIAL_PROMPT, [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setSelectedProposal(null)
    sendMessage(text)
  }, [input, sendMessage])

  function stop() {
    abortRef.current?.abort()
    setMessages((m) => m.map((msg) => (msg.pending ? { ...msg, pending: false } : msg)))
    setStreaming(false)
  }

  async function confirmCreate() {
    if (!selectedProposal || creating) return
    setCreating(true)
    try {
      const res = await apiFetch<{ success: boolean; data: Novel }>('/novels', {
        method: 'POST',
        body: JSON.stringify({
          title: selectedProposal.title,
          template: selectedProposal.template,
          setting: selectedProposal.setting,
          protagonist: selectedProposal.protagonist,
          cheatType: selectedProposal.cheatType,
          themes: selectedProposal.themes,
        }),
      })
      if (res.success && res.data) {
        setCreatedNovel(res.data)
        setSelectedProposal(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  // Find the last assistant message that has proposals
  const lastProposals = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant' && !m.pending) {
        const p = parseProposals(m.content)
        if (p) return { msgIndex: i, proposals: p }
      }
    }
    return null
  })()

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b p-4 font-semibold">市场分析助手</div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || '▋'}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>

            {/* Show proposal cards below the last assistant message with proposals */}
            {lastProposals?.msgIndex === i && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground px-1">选择一个题材方案，确认后自动创建项目：</p>
                {lastProposals.proposals.map((p) => {
                  const isSelected = selectedProposal?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProposal(isSelected ? null : p)}
                      className={`w-full text-left border rounded-lg p-4 transition-all hover:border-primary hover:bg-accent/40 ${
                        isSelected ? 'border-primary bg-accent/60 ring-1 ring-primary' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <span className="font-semibold text-sm">《{p.title}》</span>
                            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                              {TEMPLATE_LABELS[p.template] ?? p.template}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mb-2">{p.tagline}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {p.themes.map((t) => (
                              <span key={t} className="text-xs px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>主角：{p.protagonist} · 背景：{p.setting}</div>
                            <div>金手指：{p.cheatType}</div>
                            {p.hooks?.map((h, j) => (
                              <div key={j} className="text-foreground/70">· {h}</div>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckCircle size={18} className="text-primary" />
                          ) : (
                            <div className="w-[18px] h-[18px] rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* Confirm creation button */}
        {selectedProposal && !createdNovel && (
          <div className="flex justify-center py-2">
            <button
              onClick={confirmCreate}
              disabled={creating}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Sparkles size={16} />
              {creating ? '创建中...' : `确认创建《${selectedProposal.title}》`}
            </button>
          </div>
        )}

        {/* Success state */}
        {createdNovel && (
          <div className="flex justify-center py-2">
            <div className="bg-accent border border-primary/20 rounded-xl px-6 py-5 text-center max-w-xs">
              <CheckCircle size={24} className="text-primary mx-auto mb-2" />
              <p className="font-semibold mb-1">《{createdNovel.title}》已创建</p>
              <p className="text-xs text-muted-foreground mb-4">
                {TEMPLATE_LABELS[createdNovel.template] ?? createdNovel.template}
              </p>
              <Link
                to="/novels/$id"
                params={{ id: createdNovel.id }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                前往项目
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="继续对话，或告诉我你的偏好方向..."
          disabled={streaming}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        {streaming ? (
          <button
            onClick={stop}
            className="px-3 py-2 border rounded-md text-sm hover:bg-accent transition-colors"
          >
            停止
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!input.trim()}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
