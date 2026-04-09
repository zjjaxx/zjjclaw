import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { novelsApi, type NovelDetail } from '@/services/api'
import { Download, BookOpen, Sparkles, FileText } from 'lucide-react'

export const Route = createFileRoute('/novels/$id')({
  component: NovelDetailPage,
})

const TEMPLATE_LABELS: Record<string, string> = {
  'urban-supernatural': '都市异能',
  'xianxia': '仙侠修真',
  'post-apocalyptic': '末日废土',
}

function NovelDetailPage() {
  const { id } = Route.useParams()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const { data: novelData, isLoading } = useQuery({
    queryKey: ['novels', id],
    queryFn: () => novelsApi.get(id),
  })
  const novel = novelData?.data ?? null
  const contentItems = novel ? buildContentItems(novel) : []
  const selectedItem =
    contentItems.find((item) => item.id === selectedItemId) ??
    contentItems[0] ??
    null

  if (isLoading) {
    return (
      <div className="p-10 font-serif text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (!novel) {
    return (
      <div className="p-10 font-serif text-sm" style={{ color: 'var(--color-destructive)' }}>
        项目不存在
      </div>
    )
  }


  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="font-sans font-medium text-3xl tracking-[-0.05em] text-foreground mb-2 leading-tight">
            {novel.title}
          </h1>
          <span
            className="text-xs font-sans px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--color-surface-400)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            {TEMPLATE_LABELS[novel.template] ?? novel.template}
          </span>
        </div>
        <a
          href={novelsApi.exportUrl(id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-sans
            text-muted-foreground hover:text-destructive transition-colors duration-150 bg-surface-300"
        >
          <Download size={13} />
          导出
        </a>
      </div>

      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: 'var(--color-surface-300)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={15} style={{ color: 'var(--color-muted-foreground)' }} />
          <span className="font-sans font-medium text-sm tracking-[-0.01em] text-foreground">
            一键生成全流程
          </span>
        </div>
        <p className="font-serif text-sm text-muted-foreground mb-5 leading-relaxed">
          自动依次完成世界观 → 能力体系 → 人物 → 大纲 → 章节规划 → 章节写作全流程
        </p>
        <Link
          to="/novels/$id/generate"
          params={{ id }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-sans font-medium
            transition-colors duration-150 hover:text-destructive"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          <Sparkles size={14} />
          开始全流程生成
        </Link>
      </div>

      <div
        className="rounded-lg border p-6 mt-6"
        style={{ backgroundColor: 'var(--color-surface-300)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} style={{ color: 'var(--color-muted-foreground)' }} />
          <span className="font-sans font-medium text-sm tracking-[-0.01em] text-foreground">
            已生成内容
          </span>
        </div>
        <p className="font-serif text-sm text-muted-foreground mb-5 leading-relaxed">
          在这里查看世界观、力量体系、角色、大纲和已写出的章节内容。
        </p>

        {contentItems.length === 0 ? (
          <p className="font-serif text-sm text-muted-foreground">
            暂无可查看内容，生成后会出现在这里。
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
            <div className="space-y-2">
              {contentItems.map((item) => {
                const active = item.id === selectedItem?.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className="w-full text-left rounded-lg border px-3 py-2.5 transition-colors duration-150 hover:text-destructive"
                    style={{
                      backgroundColor: active ? 'rgba(182, 96, 59, 0.08)' : 'var(--color-surface-400)',
                      borderColor: active ? 'var(--color-border-medium)' : 'var(--color-border-medium)',
                      boxShadow: active ? 'inset 3px 0 0 #b6603b' : 'none',
                    }}
                  >
                    <div className="font-sans text-sm text-foreground">{item.label}</div>
                    <div className="font-serif text-xs text-muted-foreground mt-1">{item.description}</div>
                  </button>
                )
              })}
            </div>

            <div
              className="rounded-lg border p-4 overflow-auto min-h-[320px]"
              style={{ backgroundColor: 'var(--color-surface-400)' }}
            >
              {selectedItem && (
                <>
                  <h3 className="font-sans font-medium text-sm text-foreground mb-3">
                    {selectedItem.label}
                  </h3>
                  <pre className="whitespace-pre-wrap wrap-break-word font-serif text-sm text-foreground">
                    {selectedItem.content}
                  </pre>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type ContentItem = {
  id: string
  label: string
  description: string
  content: string
}

function buildContentItems(novel: NovelDetail): ContentItem[] {
  const items: ContentItem[] = []

  if (novel.world) {
    items.push({
      id: 'world',
      label: '世界观',
      description: '查看世界设定',
      content: novel.world,
    })
  }

  if (novel.powerSystem) {
    items.push({
      id: 'power-system',
      label: '力量体系',
      description: '查看修炼与能力规则',
      content: novel.powerSystem,
    })
  }

  if (novel.characters && novel.characters.length > 0) {
    items.push({
      id: 'characters',
      label: '角色',
      description: `${novel.characters.length} 个角色`,
      content: JSON.stringify(novel.characters, null, 2),
    })
  }

  if (novel.outline) {
    items.push({
      id: 'outline',
      label: '大纲',
      description: '查看故事结构',
      content: JSON.stringify(novel.outline, null, 2),
    })
  }

  if (novel.chapters) {
    for (const chapter of novel.chapters) {
      items.push({
        id: `chapter-${chapter.number}`,
        label: `第${chapter.number}章`,
        description: '查看章节正文',
        content: chapter.content,
      })
    }
  }

  return items
}
