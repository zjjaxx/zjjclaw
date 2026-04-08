import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { novelsApi, type Novel } from '@/services/api'
import { Plus, BookOpen, Clock } from 'lucide-react'

export const Route = createFileRoute('/novels/')({
  component: NovelsPage,
})

function NovelsPage() {
  const { data: novels, isLoading, error } = useQuery({
    queryKey: ['novels'],
    queryFn: novelsApi.list,
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">我的小说</h1>
        <Link
          to="/novels/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          新建项目
        </Link>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-16">加载中...</div>
      )}

      {error && (
        <div className="text-center text-destructive py-16">
          加载失败，请检查后端是否运行
        </div>
      )}

      {novels && novels.length === 0 && (
        <div className="text-center text-muted-foreground py-16">
          <BookOpen className="mx-auto mb-3 opacity-30" size={48} />
          <p>暂无小说项目</p>
          <Link to="/novels/new" className="text-primary hover:underline text-sm mt-2 inline-block">
            创建第一个项目
          </Link>
        </div>
      )}

      {novels && novels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {novels.map((novel) => (
            <NovelCard key={novel.id} novel={novel} />
          ))}
        </div>
      )}
    </div>
  )
}

function NovelCard({ novel }: { novel: Novel }) {
  return (
    <Link
      to="/novels/$id"
      params={{ id: novel.id }}
      className="border rounded-lg p-5 hover:border-primary transition-colors group block"
    >
      <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors line-clamp-2">
        {novel.title}
      </h3>
      <p className="text-xs text-muted-foreground mb-3">{novel.template}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock size={12} />
        {new Date(novel.updatedAt ?? novel.createdAt).toLocaleDateString('zh-CN')}
      </div>
    </Link>
  )
}
