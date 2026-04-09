import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader,
  SkipForward,
  AlertTriangle,
  Clock3,
} from 'lucide-react'
import { novelsApi, type GenerateStatus } from '@/services/api'
import { streamGenerate, type GenerateEvent } from '@/services/sse'

export const Route = createFileRoute('/novels/$id_/generate')({
  component: GeneratePage,
})

type LogEntry =
  | { kind: 'start'; message: string }
  | { kind: 'step'; step: string; message: string }
  | { kind: 'step_done'; step: string }
  | { kind: 'skip'; step: string }
  | { kind: 'step_retry'; step: string; attempt: number; maxRetries: number; message: string }
  | { kind: 'step_error'; step: string; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

type Status = 'idle' | 'running' | 'done' | 'error'

function GeneratePage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const generateStatusQuery = useQuery({
    queryKey: ['novels', id, 'generate-status'],
    queryFn: () => novelsApi.getGenerateStatus(id),
    refetchInterval: (query) => {
      const status = (query.state.data as { data: GenerateStatus } | undefined)?.data.status
      return status === 'running' ? 2000 : false
    },
  })

  const remoteStatus = generateStatusQuery.data?.data.status ?? 'idle'

  const novelQuery = useQuery({
    queryKey: ['novels', id],
    queryFn: () => novelsApi.get(id),
    refetchInterval: remoteStatus === 'running' ? 5000 : false,
  })

  const novel = novelQuery.data?.data ?? null
  const steps = generateStatusQuery.data?.data.steps ?? []
  const visibleSteps = getVisibleSteps(steps)

  const [log, setLog] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const hasBootstrapped = useRef(false)
  const hasAnnouncedExistingRun = useRef(false)

  function pushLog(entry: LogEntry) {
    setLog((prev) => [...prev, entry])
  }

  async function refreshGenerateState() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['novels', id] }),
      queryClient.invalidateQueries({ queryKey: ['novels', id, 'generate-status'] }),
    ])
  }

  async function startGenerate(restart = false) {
    setStatus('running')
    setCurrentStep(restart ? '正在重新开始...' : '正在继续生成...')
    setIsCheckingStatus(true)
    try {
      const latestStatus = (await novelsApi.getGenerateStatus(id)).data

      if (!restart && latestStatus.status === 'running') {
        setStatus('running')
        setCurrentStep(latestStatus.currentStep)
        if (!hasAnnouncedExistingRun.current) {
          hasAnnouncedExistingRun.current = true
          pushLog({ kind: 'start', message: '检测到已有生成任务正在执行，当前页面将只同步状态，不会重复触发。' })
        }
        await refreshGenerateState()
        return
      }

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setStatus('running')
      setCurrentStep(null)
      setLog([])
      hasAnnouncedExistingRun.current = false

      await streamGenerate(
        id,
        restart,
        {
          onEvent(ev: GenerateEvent) {
            switch (ev.event) {
              case 'start':
                pushLog({ kind: 'start', message: ev.data.message })
                void refreshGenerateState()
                break
              case 'step':
                setStatus('running')
                setCurrentStep(ev.data.step)
                pushLog({ kind: 'step', step: ev.data.step, message: ev.data.message })
                void refreshGenerateState()
                break
              case 'step_done':
                setCurrentStep(null)
                pushLog({ kind: 'step_done', step: ev.data.step })
                void refreshGenerateState()
                break
              case 'skip':
                pushLog({ kind: 'skip', step: ev.data.step })
                void refreshGenerateState()
                break
              case 'step_retry':
                pushLog({
                  kind: 'step_retry',
                  step: ev.data.step,
                  attempt: ev.data.attempt,
                  maxRetries: ev.data.maxRetries,
                  message: ev.data.message,
                })
                break
              case 'step_error':
                setStatus('error')
                pushLog({ kind: 'step_error', step: ev.data.step, message: ev.data.message })
                void refreshGenerateState()
                break
              case 'done':
                setCurrentStep(null)
                setStatus('done')
                pushLog({ kind: 'done', message: ev.data.message })
                void refreshGenerateState()
                break
              case 'error':
                setCurrentStep(null)
                setStatus('error')
                pushLog({ kind: 'error', message: ev.data.message })
                void refreshGenerateState()
                break
            }
          },
          onClose() {
            setCurrentStep(null)
            abortRef.current = null
            void refreshGenerateState()
          },
        },
        ctrl.signal,
      )
    } catch (error) {
      abortRef.current = null
      const message = String(error)
      if (message.includes('409')) {
        setStatus('running')
        if (!hasAnnouncedExistingRun.current) {
          hasAnnouncedExistingRun.current = true
          pushLog({ kind: 'start', message: '检测到已有生成任务正在执行，当前页面将只同步状态，不会重复触发。' })
        }
      } else if (!message.includes('AbortError')) {
        setStatus('error')
        setCurrentStep(null)
        pushLog({ kind: 'error', message })
      }
      await refreshGenerateState()
    } finally {
      setIsCheckingStatus(false)
    }
  }

  useEffect(() => {
    const latestStatus = generateStatusQuery.data?.data
    if (!latestStatus) return

    if (
      status === 'running' &&
      (isCheckingStatus || abortRef.current) &&
      (latestStatus.status === 'idle' || latestStatus.status === 'interrupted')
    ) {
      return
    }

    setCurrentStep(latestStatus.currentStep)

    if (latestStatus.status === 'running') {
      setStatus('running')
      return
    }
    if (latestStatus.status === 'completed') {
      setStatus('done')
      return
    }
    if (latestStatus.status === 'failed' || latestStatus.status === 'interrupted') {
      setStatus('error')
      return
    }
    setStatus('idle')
  }, [generateStatusQuery.data, isCheckingStatus, status])

  useEffect(() => {
    if (hasBootstrapped.current || generateStatusQuery.isLoading || !generateStatusQuery.data) return

    const latestStatus = generateStatusQuery.data.data
    hasBootstrapped.current = true

    if (latestStatus.status === 'idle') {
      void startGenerate(false)
      return
    }

    if (latestStatus.status === 'running' && !hasAnnouncedExistingRun.current) {
      hasAnnouncedExistingRun.current = true
      pushLog({ kind: 'start', message: '检测到已有生成任务正在执行，当前页面将只同步状态，不会重复触发。' })
    }
  }, [generateStatusQuery.data, generateStatusQuery.isLoading])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/novels/$id"
          params={{ id }}
          className="flex items-center gap-1.5 text-sm font-sans text-muted-foreground hover:text-destructive transition-colors duration-150"
        >
          <ArrowLeft size={14} />
          返回
        </Link>
        <span className="text-muted-foreground" style={{ opacity: 0.3 }}>/</span>
        <h1 className="font-sans font-medium text-lg tracking-[-0.03em] text-foreground">
          {novel ? `全流程生成 · ${novel.title}` : '全流程生成'}
        </h1>
      </div>

      <div
        className="flex items-center justify-between rounded-lg border px-4 py-3 mb-6"
        style={{ backgroundColor: 'var(--color-surface-300)' }}
      >
        <div className="flex items-center gap-2.5">
          {status === 'running' && (
            <>
              <Loader size={14} className="animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
              <span className="font-sans text-sm text-foreground">
                {currentStep ? `正在执行：${currentStep}` : '生成中...'}
              </span>
            </>
          )}
          {status === 'done' && (
            <>
              <CheckCircle size={14} style={{ color: 'var(--color-success, #1f8a65)' }} />
              <span className="font-sans text-sm text-foreground">全流程生成完成</span>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={14} style={{ color: 'var(--color-destructive)' }} />
              <span className="font-sans text-sm text-foreground">
                {generateStatusQuery.data?.data.failedStep ? `生成中断：${generateStatusQuery.data.data.failedStep}` : '生成中断'}
              </span>
            </>
          )}
          {status === 'idle' && (
            <>
              <Clock3 size={14} style={{ color: 'var(--color-muted-foreground)' }} />
              <span className="font-sans text-sm text-muted-foreground">正在检查生成状态...</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === 'done' && (
            <button
              onClick={() => void navigate({ to: '/novels/$id', params: { id } })}
              className="px-3 py-1.5 rounded-lg text-sm font-sans transition-colors duration-150 hover:text-destructive"
              style={{ backgroundColor: 'var(--color-surface-400)' }}
            >
              查看小说
            </button>
          )}
          {status !== 'running' && (
            <button
              onClick={() => void startGenerate(false)}
              disabled={isCheckingStatus}
              className="px-3 py-1.5 rounded-lg text-sm font-sans transition-colors duration-150 hover:text-destructive disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-surface-400)' }}
            >
              {isCheckingStatus ? '检查中...' : '继续生成'}
            </button>
          )}
          {status !== 'running' && (
            <button
              onClick={() => void startGenerate(true)}
              disabled={isCheckingStatus}
              className="px-3 py-1.5 rounded-lg text-sm font-sans transition-colors duration-150 hover:text-destructive disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-surface-400)' }}
            >
              从头重新生成
            </button>
          )}
          {status === 'running' && abortRef.current && (
            <button
              onClick={() => {
                abortRef.current?.abort()
                abortRef.current = null
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-sans transition-colors duration-150 hover:text-destructive"
              style={{ backgroundColor: 'var(--color-surface-400)' }}
            >
              停止跟随
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <section
          className="rounded-lg border p-5"
          style={{ backgroundColor: 'var(--color-surface-300)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock3 size={14} style={{ color: 'var(--color-muted-foreground)' }} />
              <h2 className="font-sans text-sm font-medium text-foreground">步骤状态</h2>
            </div>
            {steps.length > 0 && (
              <span className="text-xs font-sans text-muted-foreground">
                仅显示最近要执行的 10 个
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.length === 0 && (
              <p className="text-sm font-serif text-muted-foreground">正在读取流水线状态...</p>
            )}
            {visibleSteps.map((step, index) => (
              <StepStatusCard
                key={step.name}
                index={index}
                name={step.name}
                status={step.status}
              />
            ))}
          </div>
        </section>

        <section
          className="rounded-lg border font-mono text-xs leading-relaxed overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-surface-300)',
            maxHeight: '60vh',
            padding: '16px 20px',
          }}
        >
          {log.length === 0 && (
            <p className="text-muted-foreground">当前页暂无实时日志；生成结果请回到详情页点击查看。</p>
          )}
          {log.map((entry, i) => (
            <LogLine key={i} entry={entry} />
          ))}
          <div ref={logEndRef} />
        </section>
      </div>
    </div>
  )
}

function getVisibleSteps(steps: GenerateStatus['steps']) {
  const firstUpcomingIndex = steps.findIndex((step) => step.status !== 'completed')
  if (firstUpcomingIndex === -1) {
    return steps.slice(-10)
  }
  return steps.slice(firstUpcomingIndex, firstUpcomingIndex + 10)
}

function StepStatusCard({
  index,
  name,
  status,
}: {
  index: number
  name: string
  status: GenerateStatus['steps'][number]['status']
}) {
  const label =
    status === 'completed' ? '已完成' :
    status === 'running' ? '执行中' :
    status === 'failed' ? '失败' :
    '待执行'

  const icon =
    status === 'completed' ? <CheckCircle size={14} className="shrink-0" /> :
    status === 'running' ? <Loader size={14} className="animate-spin shrink-0" /> :
    status === 'failed' ? <XCircle size={14} className="shrink-0" /> :
    <Clock3 size={14} className="shrink-0" />

  const accentColor =
    status === 'completed' ? 'var(--color-success, #1f8a65)' :
    status === 'running' ? '#c85d1a' :
    status === 'failed' ? 'var(--color-destructive)' :
    'var(--color-muted-foreground)'

  const borderColor =
    status === 'running' ? '#c85d1a' :
    status === 'failed' ? 'var(--color-destructive)' :
    'var(--color-border-medium)'

  const backgroundColor =
    status === 'running' ? '#fff3e8' : 'var(--color-surface-400)'

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor,
        backgroundColor,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="flex items-center gap-2 text-sm font-sans"
          style={{ color: accentColor }}
        >
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {index + 1}
        </span>
      </div>
      <div className="font-sans text-sm text-foreground leading-relaxed">
        {name}
      </div>
    </div>
  )
}

function LogLine({ entry }: { entry: LogEntry }) {
  switch (entry.kind) {
    case 'start':
      return (
        <div className="mb-3 font-sans text-sm font-medium text-foreground">
          {entry.message}
        </div>
      )
    case 'step':
      return (
        <div className="flex items-start gap-2 py-0.5 text-muted-foreground">
          <Loader size={11} className="animate-spin mt-0.5 shrink-0" />
          <span>{entry.step}</span>
        </div>
      )
    case 'step_done':
      return (
        <div className="flex items-start gap-2 py-0.5" style={{ color: 'var(--color-success, #1f8a65)' }}>
          <CheckCircle size={11} className="mt-0.5 shrink-0" />
          <span>{entry.step} 完成</span>
        </div>
      )
    case 'skip':
      return (
        <div className="flex items-start gap-2 py-0.5 text-muted-foreground" style={{ opacity: 0.5 }}>
          <SkipForward size={11} className="mt-0.5 shrink-0" />
          <span>{entry.step} 已跳过（已存在）</span>
        </div>
      )
    case 'step_retry':
      return (
        <div className="flex items-start gap-2 py-0.5" style={{ color: '#c08532' }}>
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{entry.message}</span>
        </div>
      )
    case 'step_error':
      return (
        <div className="flex items-start gap-2 py-0.5" style={{ color: 'var(--color-destructive)' }}>
          <XCircle size={11} className="mt-0.5 shrink-0" />
          <span>{entry.message}</span>
        </div>
      )
    case 'done':
      return (
        <div className="mt-3 font-sans text-sm font-medium" style={{ color: 'var(--color-success, #1f8a65)' }}>
          {entry.message}
        </div>
      )
    case 'error':
      return (
        <div className="mt-3 font-sans text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>
          {entry.message}
        </div>
      )
    default:
      return null
  }
}
