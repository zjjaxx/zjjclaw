import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, MessageSquare, Zap } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">zjjclaw</h1>
        <p className="text-muted-foreground text-lg">
          AI 驱动的都市异能网文写作系统
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          to="/novels"
          icon={<BookOpen size={24} />}
          title="我的小说"
          description="管理项目，生成世界观、人物、大纲和章节"
        />
        <FeatureCard
          to="/market"
          icon={<MessageSquare size={24} />}
          title="市场分析"
          description="AI 对话分析网文市场趋势，辅助创作决策"
        />
        <FeatureCard
          to="/novels/new"
          icon={<Zap size={24} />}
          title="快速创建"
          description="一键启动新项目，自动完成全流程写作"
        />
      </div>
    </div>
  )
}

function FeatureCard({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="border rounded-lg p-6 hover:border-primary transition-colors group"
    >
      <div className="text-muted-foreground group-hover:text-primary mb-3 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}
