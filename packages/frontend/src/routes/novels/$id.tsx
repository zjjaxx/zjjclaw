import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { novelsApi } from '@/services/api'
import { Download, Globe, Users, BookOpen, List, Pen } from 'lucide-react'

export const Route = createFileRoute('/novels/$id')({
  component: NovelDetailPage,
})

type ActionItem = {
  to: string
  icon: React.ReactNode
  label: string
  description: string
}

function NovelDetailPage() {
  const { id } = Route.useParams()

  const { data: novel, isLoading } = useQuery({
    queryKey: ['novels', id],
    queryFn: () => novelsApi.get(id),
  })

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">加载中...</div>
  }

  if (!novel) {
    return <div className="p-8 text-destructive">项目不存在</div>
  }

  const actions: ActionItem[] = [
    {
      to: `/novels/${id}/world`,
      icon: <Globe size={20} />,
      label: '世界观',
      description: novel.world ? '已生成，点击查看/重新生成' : '尚未生成',
    },
    {
      to: `/novels/${id}/characters`,
      icon: <Users size={20} />,
      label: '人物',
      description: '管理主角、配角、反派',
    },
    {
      to: `/novels/${id}/outline`,
      icon: <List size={20} />,
      label: '大纲',
      description: '故事架构与情节规划',
    },
    {
      to: `/novels/${id}/chapters`,
      icon: <Pen size={20} />,
      label: '章节',
      description: '章节列表与写作',
    },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold">{novel.title}</h1>
          <p className="text-muted-foreground mt-1">{novel.template}</p>
        </div>
        <a
          href={novelsApi.exportUrl(id)}
          className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-accent transition-colors"
        >
          <Download size={14} />
          导出
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="border rounded-lg p-4 hover:border-primary transition-colors group"
          >
            <div className="text-muted-foreground group-hover:text-primary transition-colors mb-2">
              {action.icon}
            </div>
            <p className="font-medium text-sm mb-1">{action.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {action.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} />
          <span className="font-medium text-sm">一键生成</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          自动依次完成世界观 → 能力体系 → 人物 → 大纲 → 章节规划 → 章节写作全流程
        </p>
        <Link
          to={`/novels/${id}/generate`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          开始全流程生成
        </Link>
      </div>
    </div>
  )
}
