import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tag } from '../ui'
import { client } from '../api'
import {
  Newspaper,
  StickyNote,
  FileText,
  BookOpen,
  Box,
  Search,
  RefreshCw,
} from 'lucide-react'

type MaterialType = 'news' | 'memos' | 'pages' | 'artifacts' | 'knowledge'
type TabKey = 'all' | MaterialType

interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  tags: string[]
  created_at: string
}

interface MemoItem {
  id: string
  content: string
  pinned: boolean
  tags_extracted: string[]
  created_at: string
}

interface PageItem {
  id: string
  title: string
  content_preview: string
  space_id: string
  updated_at: string
}

interface ArtifactItem {
  id: string
  title: string
  type: string
  content_preview: string
  created_at: string
}

interface KnowledgeItem {
  id: string
  title: string
  source_type: string
  chunk_count: number
  status: string
  created_at: string
}

type MaterialItem = NewsItem | MemoItem | PageItem | ArtifactItem | KnowledgeItem

interface Counts {
  news: number
  memos: number
  pages: number
  artifacts: number
  knowledge: number
}

interface MaterialsResponse {
  counts: Counts
  items: {
    news: NewsItem[]
    memos: MemoItem[]
    pages: PageItem[]
    artifacts: ArtifactItem[]
    knowledge: KnowledgeItem[]
  }
}


const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'news', label: '新闻' },
  { key: 'memos', label: '备忘' },
  { key: 'pages', label: '笔记' },
  { key: 'artifacts', label: '产出' },
  { key: 'knowledge', label: '知识' },
]

const TYPE_ICON: Record<MaterialType, typeof Newspaper> = {
  news: Newspaper,
  memos: StickyNote,
  pages: FileText,
  artifacts: Box,
  knowledge: BookOpen,
}

const TYPE_ACCENT: Record<MaterialType, string> = {
  news: 'var(--ht-accent2)',
  memos: 'var(--ht-accent)',
  pages: 'var(--ht-success)',
  artifacts: 'var(--ht-accent2-subtle)',
  knowledge: 'var(--ht-warning)',
}

const TYPE_ACCENT_BG: Record<MaterialType, string> = {
  news: 'var(--ht-accent2-subtle)',
  memos: 'var(--ht-accent-subtle)',
  pages: 'var(--ht-success-subtle)',
  artifacts: 'rgba(90,122,170,0.08)',
  knowledge: 'var(--ht-warning-subtle)',
}

const TYPE_LABEL: Record<MaterialType, string> = {
  news: '新闻',
  memos: '备忘',
  pages: '笔记',
  artifacts: '产出',
  knowledge: '知识',
}

function getItemTitle(item: MaterialItem, type: MaterialType): string {
  switch (type) {
    case 'memos':
      return (item as MemoItem).content.slice(0, 40) || '备忘'
    default:
      return (item as NewsItem | PageItem | ArtifactItem | KnowledgeItem).title || '无标题'
  }
}

function getItemPreview(item: MaterialItem, type: MaterialType): string {
  switch (type) {
    case 'news':
      return (item as NewsItem).summary || ''
    case 'memos':
      return (item as MemoItem).content.slice(0, 100)
    case 'pages':
      return (item as PageItem).content_preview || ''
    case 'artifacts':
      return (item as ArtifactItem).content_preview || ''
    case 'knowledge':
      return `共 ${(item as KnowledgeItem).chunk_count} 个分块 · ${(item as KnowledgeItem).status}`
  }
}

function getItemDate(item: MaterialItem, type: MaterialType): string {
  const raw =
    type === 'pages'
      ? (item as PageItem).updated_at
      : (item as NewsItem).created_at
  if (!raw) return ''
  const d = new Date(raw)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getItemTags(item: MaterialItem, type: MaterialType): string[] {
  switch (type) {
    case 'news':
      return (item as NewsItem).tags || []
    case 'memos':
      return (item as MemoItem).tags_extracted || []
    default:
      return []
  }
}

const PAGE_STYLE = `
.material-pool {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.material-pool-header {
  margin-bottom: 2rem;
}

.material-pool-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ht-text);
  margin: 0 0 0.25rem;
}

.material-pool-header p {
  font-size: 0.875rem;
  color: var(--ht-text-3);
  margin: 0;
}

.material-pool-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
  background: var(--ht-bg-subtle);
  border-radius: 999px;
  padding: 0.25rem;
}

.material-pool-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--ht-text-2);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.material-pool-tab:hover {
  color: var(--ht-text);
  background: var(--ht-overlay);
}

.material-pool-tab-active {
  background: var(--ht-surface);
  color: var(--ht-accent);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.material-pool-tab-active:hover {
  background: var(--ht-surface);
  color: var(--ht-accent);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--ht-overlay);
  color: var(--ht-text-3);
}

.material-pool-tab-active .tab-count {
  background: var(--ht-accent-subtle);
  color: var(--ht-accent);
}

.material-pool-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.material-pool-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid var(--ht-border);
  background: var(--ht-surface);
  transition: border-color 0.2s;
}

.material-pool-search:focus-within {
  border-color: var(--ht-accent);
}

.material-pool-search svg {
  color: var(--ht-text-3);
  flex-shrink: 0;
}

.material-pool-search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ht-text);
  font-size: 0.8125rem;
}

.material-pool-search input::placeholder {
  color: var(--ht-text-3);
}

.material-pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.material-card {
  position: relative;
  border-radius: 0.75rem;
  border: 1px solid var(--ht-border);
  background: var(--ht-surface);
  padding: 1rem 1rem 1rem 1.125rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  overflow: hidden;
}

.material-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}

.material-card[data-type="news"]::before { background: var(--ht-accent2); }
.material-card[data-type="memos"]::before { background: var(--ht-accent); }
.material-card[data-type="pages"]::before { background: var(--ht-success); }
.material-card[data-type="artifacts"]::before { background: var(--ht-accent2-subtle); }
.material-card[data-type="knowledge"]::before { background: var(--ht-warning); }

.material-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-color: var(--ht-border-strong);
}

.material-card-head {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin-bottom: 0.5rem;
}

.material-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.material-card-icon svg {
  width: 1rem;
  height: 1rem;
}

.material-card-title {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ht-text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.material-card-preview {
  font-size: 0.75rem;
  color: var(--ht-text-3);
  line-height: 1.5;
  margin-bottom: 0.625rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.material-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.material-card-date {
  font-size: 0.6875rem;
  color: var(--ht-text-3);
}

.material-card-tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.material-card-type-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  font-weight: 600;
}

.material-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--ht-text-3);
  text-align: center;
}

.material-empty svg {
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.4;
}

.material-empty p {
  font-size: 0.875rem;
  margin: 0 0 0.25rem;
}

.material-empty span {
  font-size: 0.75rem;
  opacity: 0.7;
}

@media (max-width: 640px) {
  .material-pool {
    padding: 1.25rem 1rem 3rem;
  }
  .material-pool-grid {
    grid-template-columns: 1fr;
  }
}
` as string

export default function MaterialPool() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [keyword, setKeyword] = useState('')
  const [counts, setCounts] = useState<Counts>({
    news: 0,
    memos: 0,
    pages: 0,
    artifacts: 0,
    knowledge: 0,
  })
  const [items, setItems] = useState<MaterialsResponse['items']>({
    news: [],
    memos: [],
    pages: [],
    artifacts: [],
    knowledge: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { limit: '50' }
      if (activeTab !== 'all') params.type = activeTab
      if (keyword.trim()) params.keyword = keyword.trim()
      const { data } = await client.get<MaterialsResponse>('/materials', { params })
      setCounts(data.counts)
      setItems(data.items)
    } catch {
      setError('加载素材失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [activeTab, keyword])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const visibleItems = (() => {
    if (activeTab === 'all') {
      const all: { item: MaterialItem; type: MaterialType }[] = []
      const types: MaterialType[] = ['news', 'memos', 'pages', 'artifacts', 'knowledge']
      for (const t of types) {
        for (const item of items[t]) {
          all.push({ item, type: t })
        }
      }
      all.sort((a, b) => {
        const dateA = new Date(getItemDate(a.item, a.type) || 0).getTime()
        const dateB = new Date(getItemDate(b.item, b.type) || 0).getTime()
        return dateB - dateA
      })
      return all
    }
    return items[activeTab].map((item) => ({
      item,
      type: activeTab as MaterialType,
    }))
  })()

  const totalCount =
    counts.news + counts.memos + counts.pages + counts.artifacts + counts.knowledge

  const handleCardClick = (_item: MaterialItem, type: MaterialType) => {
    if (type === 'pages' || type === 'memos') {
      navigate('/vault')
    }
  }

  return (
    <>
      <style>{PAGE_STYLE}</style>
      <div className="material-pool">
        <div className="material-pool-header">
          <h1>素材池</h1>
          <p>统一管理所有学习和研究素材</p>
        </div>

        <div className="material-pool-tabs">
          {TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? totalCount
                : counts[tab.key as MaterialType]
            return (
              <button
                key={tab.key}
                className={`material-pool-tab ${
                  activeTab === tab.key ? 'material-pool-tab-active' : ''
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className="tab-count">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="material-pool-toolbar">
          <div className="material-pool-search">
            <Search size={16} />
            <input
              placeholder="搜索素材..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={fetchMaterials}>
            <RefreshCw size={14} />
          </Button>
        </div>

        {error && (
          <div style={{ color: 'var(--ht-error)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="material-empty">
            <RefreshCw size={24} />
            <p>加载中...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="material-empty">
            <FileText size={24} />
            <p>暂无素材</p>
            <span>
              {activeTab === 'all'
                ? '还没有任何素材，开始添加吧'
                : `暂无${TYPE_LABEL[activeTab as MaterialType]}类型的素材`}
            </span>
          </div>
        ) : (
          <div className="material-pool-grid">
            {visibleItems.map(({ item, type }) => {
              const Icon = TYPE_ICON[type]
              const title = getItemTitle(item, type)
              const preview = getItemPreview(item, type)
              const date = getItemDate(item, type)
              const tags = getItemTags(item, type)

              return (
                <div
                  key={`${type}-${item.id}`}
                  className="material-card"
                  data-type={type}
                  onClick={() => handleCardClick(item, type)}
                >
                  <div className="material-card-head">
                    <div
                      className="material-card-icon"
                      style={{
                        background: TYPE_ACCENT_BG[type],
                        color: TYPE_ACCENT[type],
                      }}
                    >
                      <Icon />
                    </div>
                    <div className="material-card-title">{title}</div>
                  </div>

                  {preview && (
                    <div className="material-card-preview">{preview}</div>
                  )}

                  <div className="material-card-footer">
                    <div className="material-card-tags">
                      {tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} color="neutral">
                          {tag}
                        </Tag>
                      ))}
                    </div>
                    {date && <span className="material-card-date">{date}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
