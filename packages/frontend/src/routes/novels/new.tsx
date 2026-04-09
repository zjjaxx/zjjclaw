import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { novelsApi } from '@/services/api'

const schema = z.object({
  title: z.string().min(1, '请输入标题').max(100),
  template: z.enum(['urban-supernatural', 'xianxia', 'post-apocalyptic']),
  premise: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof schema>

export const Route = createFileRoute('/novels/new')({
  component: NewNovelPage,
})

const TEMPLATES = [
  { value: 'urban-supernatural', label: '都市异能' },
  { value: 'xianxia', label: '仙侠修真' },
  { value: 'post-apocalyptic', label: '末日废土' },
] as const

function NewNovelPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { template: 'urban-supernatural' },
  })

  const mutation = useMutation({
    mutationFn: novelsApi.create,
    onSuccess: (novel) => {
      queryClient.invalidateQueries({ queryKey: ['novels'] })
      void navigate({ to: '/novels/$id', params: { id: novel.id } })
    },
  })

  return (
    <div className="p-10 max-w-xl mx-auto">
      <div className="mb-10">
        <h1 className="font-sans font-medium text-2xl tracking-[-0.04em] text-foreground mb-2">
          新建小说项目
        </h1>
        <p className="font-serif text-sm text-muted-foreground">
          填写基本信息，AI 将以此为基础生成完整的世界观与故事架构
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <Field label="标题" error={errors.title?.message}>
          <input
            {...register('title')}
            placeholder="输入小说名称"
            className="w-full rounded-lg px-3 py-2.5 text-sm font-sans border bg-surface-100
              focus:outline-none transition-colors duration-150 placeholder:text-muted-foreground
              text-foreground"
            style={{ borderColor: 'var(--color-border-medium)' }}
          />
        </Field>

        <Field label="模板类型" error={errors.template?.message}>
          <select
            {...register('template')}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-sans border bg-surface-100
              focus:outline-none transition-colors duration-150 text-foreground"
            style={{ borderColor: 'var(--color-border-medium)' }}
          >
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="故事前提（可选）" error={errors.premise?.message}>
          <textarea
            {...register('premise')}
            rows={5}
            placeholder="简述核心设定或故事方向，AI 将以此为基础进行创作..."
            className="w-full rounded-lg px-3 py-2.5 text-sm font-serif border bg-surface-100
              focus:outline-none transition-colors duration-150 resize-none
              placeholder:text-muted-foreground text-foreground leading-relaxed"
            style={{ borderColor: 'var(--color-border-medium)' }}
          />
        </Field>

        {mutation.error && (
          <p className="text-sm font-sans" style={{ color: 'var(--color-destructive)' }}>
            {String(mutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-sans font-medium
            transition-colors duration-150 disabled:opacity-50 hover:text-destructive"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          {mutation.isPending ? '创建中...' : '创建项目'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-sans font-medium text-foreground">{label}</label>
      {children}
      {error && (
        <p className="text-xs font-sans" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
