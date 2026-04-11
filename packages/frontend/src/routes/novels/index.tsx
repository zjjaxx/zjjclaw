import type { MouseEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { novelsApi, type Novel } from '@/services/api'
import { Plus, BookOpen, Clock, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/novels/')({
  component: NovelsPage,
})

const TEMPLATE_LABELS: Record<string, string> = {
  'urban-supernatural': '都市异能',
  'xianxia': '仙侠修真',
  'post-apocalyptic': '末日废土',
}

function NovelsPage() {
  const queryClient = useQueryClient()
  const { data: novelsData, isLoading, error } = useQuery({
    queryKey: ['novels'],
    queryFn: novelsApi.list,
  })
  const deleteMutation = useMutation({
    mutationFn: novelsApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['novels'] })
    },
  })
  const novels = novelsData?.data ?? []
  return (
    <div className="p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-sans font-medium text-2xl tracking-[-0.04em] text-foreground">
            我的小说
          </h1>
          <p className="font-serif text-sm text-muted-foreground mt-1">
            管理所有 AI 写作项目
          </p>
        </div>
        <Link
          to="/novels/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-sans font-medium
            border transition-colors duration-150 hover:text-destructive"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          <Plus size={15} />
          新建项目
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center font-serif text-sm text-muted-foreground py-20">
          加载中...
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="text-center font-serif text-sm py-20"
          style={{ color: 'var(--color-destructive)' }}
        >
          加载失败，请检查后端是否运行
        </div>
      )}

      {/* Empty state */}
      {novels && novels.length === 0 && (
        <div className="text-center py-20">
          <BookOpen
            className="mx-auto mb-4"
            size={40}
            style={{ color: 'var(--color-border-medium)' }}
          />
          <p className="font-serif text-sm text-muted-foreground mb-3">暂无小说项目</p>
          <Link
            to="/novels/new"
            className="font-sans text-sm transition-colors duration-150 hover:text-destructive"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            创建第一个项目 →
          </Link>
        </div>
      )}

      {/* Novel grid */}
      {novels && novels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {novels.map((novel) => (
            <NovelCard
              key={novel.id}
              novel={novel}
              onDelete={() => deleteMutation.mutate(novel.id)}
              deleting={deleteMutation.isPending && deleteMutation.variables === novel.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NovelCard({
  novel,
  onDelete,
  deleting,
}: {
  novel: Novel
  onDelete: () => void
  deleting: boolean
}) {
  const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (
      !window.confirm(
        `确定删除「${novel.title}」？本地章节与设定将一并删除，且不可恢复。`,
      )
    ) {
      return
    }
    onDelete()
  }

  return (
    <div
      className="group relative flex flex-col rounded-lg border bg-surface-300 hover:bg-surface-400
        transition-colors duration-150"
    >
      <Link
        to="/novels/$id"
        params={{ id: novel.id }}
        className="flex flex-col p-5 flex-1 min-w-0"
      >
        <h3
          className="font-sans font-medium text-sm tracking-[-0.01em] text-foreground mb-1 line-clamp-2 pr-8
            group-hover:text-destructive transition-colors duration-150"
        >
          {novel.title}
        </h3>
        <p
          className="text-xs font-sans rounded-full inline-block px-2 py-0.5 mb-3 w-fit"
          style={{
            backgroundColor: 'var(--color-surface-500)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          {TEMPLATE_LABELS[novel.template] ?? novel.template}
        </p>
        <div className="mt-auto flex items-center gap-1 text-xs text-muted-foreground font-sans">
          <Clock size={11} />
          <span>{new Date(novel.updatedAt ?? novel.createdAt).toLocaleDateString('zh-CN')}</span>
        </div>
      </Link>
      <button
        type="button"
        title="删除项目"
        disabled={deleting}
        onClick={handleDelete}
        className="absolute top-3 right-3 p-1.5 rounded-md border border-transparent
          text-muted-foreground hover:text-destructive hover:border-border-medium hover:bg-surface-500
          transition-colors duration-150 disabled:opacity-40"
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </div>
  )
}
