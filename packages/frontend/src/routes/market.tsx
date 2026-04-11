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

const INITIAL_PROMPT = '请分析起点、番茄、七猫等平台当前最热门的小说类型，为我推荐 5 个最具市场潜力的小说题材方案，并输出 JSON。'

function MarketPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(INITIAL_PROMPT)
  const [streaming, setStreaming] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<NovelProposal | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdNovel, setCreatedNovel] = useState<Novel | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sendMessage = useCallback((text: string, baseMessages?: Message[]) => {
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...(baseMessages ?? messages).filter((m) => !m.pending), userMsg]

    setMessages((m) => [...m.filter((x) => !x.pending), userMsg, { role: 'assistant', content: '', pending: true }])
    setStreaming(true)
    setCreatedNovel(null)

    abortRef.current = new AbortController()

    streamMarketChat(
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-surface-200">
        <h1 className="font-sans font-medium text-base tracking-[-0.02em] text-foreground">
          市场分析助手
        </h1>
        <p className="font-serif text-xs text-muted-foreground mt-0.5">
          AI 分析平台热门趋势，推荐最具潜力的创作方向
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-6 py-6 space-y-5">
        {messages.map((m, i) => (
          <div key={i}>
            {/* Message bubble */}
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-foreground text-background font-sans'
                    : 'bg-surface-300 text-foreground border border-border font-serif'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none
                    prose-headings:font-sans prose-headings:tracking-tight
                    prose-p:font-serif prose-p:leading-relaxed
                    prose-code:font-mono prose-code:text-xs
                    prose-a:text-cursor-orange">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || '▋'}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>

            {/* Proposal cards */}
            {lastProposals?.msgIndex === i && (
              <div className="mt-5 space-y-2.5">
                <p className="text-xs text-muted-foreground font-sans px-1">
                  选择一个题材方案，确认后自动创建项目：
                </p>
                {lastProposals.proposals.map((p) => {
                  const isSelected = selectedProposal?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProposal(isSelected ? null : p)}
                      className={`w-full text-left rounded-lg p-4 border transition-all duration-150 ${
                        isSelected
                          ? 'bg-surface-300 border-border-medium'
                          : 'bg-background border-border hover:bg-surface-100 hover:border-border-medium'
                      }`}
                      style={isSelected ? { borderColor: 'var(--color-border-medium)' } : {}}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span className="font-sans font-medium text-sm tracking-[-0.01em] text-foreground">
                              《{p.title}》
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-sans"
                              style={{
                                backgroundColor: 'var(--color-surface-400)',
                                color: 'var(--color-muted-foreground)',
                              }}
                            >
                              {TEMPLATE_LABELS[p.template] ?? p.template}
                            </span>
                          </div>
                          <p className="font-serif text-sm text-foreground mb-2 leading-relaxed">
                            {p.tagline}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {p.themes.map((t) => (
                              <span
                                key={t}
                                className="text-xs px-1.5 py-0.5 rounded-full font-sans"
                                style={{
                                  backgroundColor: 'var(--color-surface-400)',
                                  color: 'var(--color-muted-foreground)',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground font-sans space-y-0.5">
                            <div>主角：{p.protagonist} · 背景：{p.setting}</div>
                            <div>金手指：{p.cheatType}</div>
                            {p.hooks?.map((h, j) => (
                              <div key={j} className="opacity-70">· {h}</div>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckCircle size={17} style={{ color: 'var(--color-cursor-success)' }} />
                          ) : (
                            <div
                              className="w-[17px] h-[17px] rounded-full border-2"
                              style={{ borderColor: 'var(--color-border-medium)' }}
                            />
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

        {/* Confirm creation */}
        {selectedProposal && !createdNovel && (
          <div className="flex justify-center py-2">
            <button
              onClick={confirmCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-sans text-sm font-medium
                transition-colors duration-150 disabled:opacity-50 hover:text-destructive"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-foreground)',
              }}
            >
              <Sparkles size={15} />
              {creating ? '创建中...' : `确认创建《${selectedProposal.title}》`}
            </button>
          </div>
        )}

        {/* Success state */}
        {createdNovel && (
          <div className="flex justify-center py-2">
            <div
              className="rounded-xl px-6 py-5 text-center max-w-xs border"
              style={{ backgroundColor: 'var(--color-surface-300)' }}
            >
              <CheckCircle size={22} className="mx-auto mb-2" style={{ color: 'var(--color-cursor-success)' }} />
              <p className="font-sans font-medium text-sm tracking-[-0.01em] mb-1 text-foreground">
                《{createdNovel.title}》已创建
              </p>
              <p className="font-sans text-xs text-muted-foreground mb-4">
                {TEMPLATE_LABELS[createdNovel.template] ?? createdNovel.template}
              </p>
              <Link
                to="/novels/$id"
                params={{ id: createdNovel.id }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-sans text-sm font-medium
                  transition-colors duration-150 hover:text-destructive"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-primary-foreground)',
                }}
              >
                前往项目
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t px-4 py-3 shrink-0 bg-surface-200">
        <div className="flex gap-2 max-w-3xl mx-auto">
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
            className="flex-1 rounded-lg px-3 py-2 text-sm font-sans border bg-background
              focus:outline-none disabled:opacity-50 transition-colors duration-150
              placeholder:text-muted-foreground"
            style={{ borderColor: 'var(--color-border-medium)' }}
          />
          {streaming ? (
            <button
              onClick={stop}
              className="px-3 py-2 rounded-lg border text-sm font-sans text-muted-foreground
                hover:text-destructive transition-colors duration-150 bg-surface-300"
            >
              停止
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-3 py-2 rounded-lg text-sm font-sans font-medium
                transition-colors duration-150 disabled:opacity-40 hover:text-destructive"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-foreground)',
              }}
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
