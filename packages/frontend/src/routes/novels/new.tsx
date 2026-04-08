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
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">新建小说项目</h1>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <Field label="标题" error={errors.title?.message}>
          <input
            {...register('title')}
            placeholder="输入小说名称"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="模板类型" error={errors.template?.message}>
          <select
            {...register('template')}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        {mutation.error && (
          <p className="text-sm text-destructive">{String(mutation.error)}</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
