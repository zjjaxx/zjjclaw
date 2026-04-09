import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { BookOpen, MessageSquare, Home } from 'lucide-react'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-14 md:w-52 shrink-0 flex flex-col gap-0.5 p-3 border-r bg-surface-300">
        {/* Logo */}
        <div className="mb-5 px-2 pt-4 pb-2 hidden md:block text-xl font-medium tracking-[-0.04em] text-foreground">
          zjjclaw
        </div>
        <div className="mb-4 pt-4 pb-2 md:hidden flex justify-center text-base font-semibold tracking-[-0.04em] text-foreground">
          z
        </div>

        <NavItem to="/" icon={<Home size={16} />} label="首页" />
        <NavItem to="/novels" icon={<BookOpen size={16} />} label="我的小说" />
        <NavItem to="/market" icon={<MessageSquare size={16} />} label="市场分析" />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-screen">
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
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground
        hover:text-destructive hover:bg-accent transition-colors duration-150
        [&.active]:text-foreground [&.active]:bg-accent [&.active]:font-medium"
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  )
}
