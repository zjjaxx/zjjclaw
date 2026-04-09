import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, MessageSquare, Zap, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="p-10 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="mb-14 pt-6">
        <h1 className="text-5xl font-sans font-medium tracking-[-0.06em] text-foreground mb-4 leading-[1.1]">
          zjjclaw
        </h1>
        <p className="font-serif text-lg text-muted-foreground leading-relaxed max-w-lg">
          AI 驱动的都市异能网文写作系统，从构思到成文，一气呵成。
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FeatureCard
          to="/novels"
          icon={<BookOpen size={20} />}
          title="我的小说"
          description="管理项目，生成世界观、人物、大纲和章节"
        />
        <FeatureCard
          to="/market"
          icon={<MessageSquare size={20} />}
          title="市场分析"
          description="AI 对话分析网文市场趋势，辅助创作决策"
        />
        <FeatureCard
          to="/novels/new"
          icon={<Zap size={20} />}
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
      className="group flex flex-col p-5 rounded-lg border bg-surface-300 hover:bg-surface-400
        transition-colors duration-150"
    >
      <div className="text-muted-foreground group-hover:text-destructive mb-4 transition-colors duration-150">
        {icon}
      </div>
      <h3 className="font-sans font-medium text-sm tracking-[-0.01em] text-foreground mb-1.5">
        {title}
      </h3>
      <p className="font-serif text-sm text-muted-foreground leading-[1.5] flex-1">
        {description}
      </p>
      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-destructive transition-colors duration-150">
        <span>前往</span>
        <ArrowRight size={12} />
      </div>
    </Link>
  )
}
