import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { BookOpen, MessageSquare, Home } from 'lucide-react'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 border-r flex flex-col gap-1 p-3 shrink-0">
        <div className="mb-4 px-2 py-3 font-bold text-lg hidden md:block">
          zjjclaw
        </div>
        <NavItem to="/" icon={<Home size={18} />} label="首页" />
        <NavItem to="/novels" icon={<BookOpen size={18} />} label="我的小说" />
        <NavItem to="/market" icon={<MessageSquare size={18} />} label="市场分析" />
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-2 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors [&.active]:bg-accent [&.active]:text-accent-foreground"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </Link>
  )
}
