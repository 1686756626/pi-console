import { useEffect, useState, useCallback } from 'react'
import { Button, Tag, inputStyle } from '../ui'
import { client } from '../api'
import {
  Plus,
  PenTool,
  FileText,
  BookOpen,
  Sparkles,
  Trash2,
  ArrowRight,
  Check,

  Loader,
  Inbox,
  Send,
} from 'lucide-react'
import MarkdownPreview from '../components/MarkdownPreview'

type WritingStatus = 'topic' | 'gathering' | 'outline' | 'drafting' | 'reviewing' | 'published'

interface WritingProject {
  id: string
  title: string
  topic: string | null
  status: WritingStatus
  outline: string | null
  tags: string[]
  final_content: string | null
  created_at: string
  updated_at: string
  drafts?: Draft[]
  materials?: Material[]
}

interface Draft {
  id: string
  version: number
  label: string | null
  content: string
  created_at: string
}

interface Material {
  id: string
  source_type: string
  source_id: string | null
  title: string
  snippet: string | null
  relevance_note: string | null
  created_at: string
}


const STATUS_LABEL: Record<WritingStatus, string> = {
  topic: '选题中',
  gathering: '素材收集中',
  outline: '撰写提纲',
  drafting: '写作中',
  reviewing: '审阅中',
  published: '已发布',
}

const STATUS_TAG_COLOR: Record<WritingStatus, 'accent' | 'success' | 'warning' | 'info' | 'neutral'> = {
  topic: 'neutral',
  gathering: 'info',
  outline: 'warning',
  drafting: 'accent',
  reviewing: 'warning',
  published: 'success',
}

const STATUS_FLOW: WritingStatus[] = ['topic', 'gathering', 'outline', 'drafting', 'reviewing', 'published']

const TAB_LIST = [
  { key: 'topic', label: '选题' },
  { key: 'gathering', label: '素材' },
  { key: 'outline', label: '提纲' },
  { key: 'drafting', label: '草稿' },
  { key: 'complete', label: '完成' },
]

const SOURCE_ACCENT: Record<string, string> = {
  news: 'var(--ht-accent2)',
  memos: 'var(--ht-accent)',
  pages: 'var(--ht-success)',
  knowledge: 'var(--ht-warning)',
  web: 'var(--ht-info)',
}

const PAGE_STYLE = `
.wr-layout {
  display: flex;
  height: calc(100vh - 120px);
  min-height: 500px;
  border: 1px solid var(--ht-border);
  border-radius: var(--ht-radius-lg);
  overflow: hidden;
  background: var(--ht-bg);
}

.wr-sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--ht-surface);
  border-right: 1px solid var(--ht-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wr-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--ht-border);
}

.wr-sidebar-header h2 {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--ht-text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.wr-sidebar-header h2 svg {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--ht-accent);
}

.wr-project-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.wr-project-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border-radius: var(--ht-radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
  border: 1px solid transparent;
  margin-bottom: 0.25rem;
}

.wr-project-item:hover {
  background: var(--ht-overlay);
}

.wr-project-item-active {
  background: var(--ht-accent-subtle);
  border-color: var(--ht-accent);
}

.wr-project-item-active:hover {
  background: var(--ht-accent-subtle);
}

.wr-project-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ht-text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wr-project-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wr-project-date {
  font-size: 0.6875rem;
  color: var(--ht-text-3);
}

.wr-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wr-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem 0;
  border-bottom: 1px solid var(--ht-border);
}

.wr-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--ht-text-3);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 999px 999px 0 0;
  transition: all 0.15s ease;
  position: relative;
}

.wr-tab:hover {
  color: var(--ht-text-2);
}

.wr-tab-active {
  color: var(--ht-accent);
  font-weight: 600;
}

.wr-tab-active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0.5rem;
  right: 0.5rem;
  height: 2px;
  background: var(--ht-accent);
  border-radius: 2px;
}

.wr-tab-current {
  background: var(--ht-accent-subtle);
  color: var(--ht-accent);
}

.wr-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  position: relative;
}

.wr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ht-text-3);
  text-align: center;
  gap: 0.75rem;
}

.wr-empty svg {
  width: 2.5rem;
  height: 2.5rem;
  opacity: 0.35;
}

.wr-empty p {
  font-size: 0.9375rem;
  margin: 0;
}

.wr-section {
  margin-bottom: 1.5rem;
}

.wr-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ht-text-3);
  margin-bottom: 0.75rem;
}

.wr-field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ht-text-2);
  margin-bottom: 0.375rem;
}

.wr-material-card {
  position: relative;
  padding: 0.875rem 1rem 0.875rem 1.125rem;
  border: 1px solid var(--ht-border);
  border-radius: var(--ht-radius-md);
  background: var(--ht-surface);
  margin-bottom: 0.5rem;
  border-left: 3px solid var(--ht-border-strong);
  transition: box-shadow 0.15s ease;
}

.wr-material-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.wr-material-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ht-text);
  margin-bottom: 0.25rem;
}

.wr-material-snippet {
  font-size: 0.75rem;
  color: var(--ht-text-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.wr-material-relevance {
  font-size: 0.6875rem;
  color: var(--ht-text-3);
  font-style: italic;
}

.wr-draft-item {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--ht-border);
  border-radius: var(--ht-radius-md);
  background: var(--ht-surface);
  margin-bottom: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wr-draft-version {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ht-accent);
}

.wr-draft-label {
  font-size: 0.8125rem;
  color: var(--ht-text);
  flex: 1;
  margin-left: 0.75rem;
}

.wr-draft-date {
  font-size: 0.6875rem;
  color: var(--ht-text-3);
}

.wr-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--ht-border);
  background: var(--ht-surface);
}

.wr-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--ht-text-3);
}

@media (max-width: 768px) {
  .wr-layout {
    flex-direction: column;
    height: auto;
    min-height: auto;
  }
  .wr-sidebar {
    width: 100%;
    min-width: auto;
    max-height: 240px;
    border-right: none;
    border-bottom: 1px solid var(--ht-border);
  }
}
` as string

export default function WritingRoom() {
  const [projects, setProjects] = useState<WritingProject[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [project, setProject] = useState<WritingProject | null>(null)
  const [, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gathering, setGathering] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<{ key: string; content: string } | null>(null)
  const [activeTab, setActiveTab] = useState<string>('topic')
  const [editTitle, setEditTitle] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [editOutline, setEditOutline] = useState('')
  const [editDraft, setEditDraft] = useState('')

  const fetchProjects = useCallback(async () => {
    setListLoading(true)
    try {
      const { data } = await client.get<WritingProject[]>('/writing/projects')
      setProjects(data)
    } catch {
      setProjects([])
    } finally {
      setListLoading(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const fetchProject = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const { data } = await client.get(`/writing/projects/${id}`)
      setProject(data)
      setEditTitle(data.title)
      setEditTopic(data.topic || '')
      setEditOutline(data.outline || '')
      const latestDraft = data.drafts && data.drafts.length > 0
        ? data.drafts[data.drafts.length - 1]
        : null
      setEditDraft(latestDraft ? latestDraft.content : '')
      syncTabToStatus(data.status)
    } catch {
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const syncTabToStatus = (status: WritingStatus) => {
    if (status === 'reviewing' || status === 'published') {
      setActiveTab('complete')
    } else {
      setActiveTab(status)
    }
  }

  const selectProject = async (id: string) => {
    setActiveId(id)
    await fetchProject(id)
  }

  const handleCreate = async () => {
    try {
      const { data } = await client.post('/writing/projects', {
        title: '新写作项目',
      })
      setProjects((prev) => [data, ...prev])
      selectProject(data.id)
    } catch {}
  }

  const handleDelete = async (id: string) => {
    try {
      await client.delete(`/writing/projects/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (activeId === id) {
        setActiveId(null)
        setProject(null)
      }
    } catch {}
  }

  const handlePatch = async (patch: Partial<WritingProject>) => {
    if (!project) return
    setSaving(true)
    try {
      await client.patch(`/writing/projects/${project.id}`, patch)
      await fetchProject(project.id)
      fetchProjects()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTopic = () => {
    handlePatch({ title: editTitle, topic: editTopic })
  }

  const handleNextStage = () => {
    if (!project) return
    const idx = STATUS_FLOW.indexOf(project.status)
    if (idx < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[idx + 1]
      handlePatch({ status: next })
    }
  }

  const handleSaveOutline = () => {
    handlePatch({ outline: editOutline })
  }

  const handleSaveDraft = async () => {
    if (!project || !editDraft.trim()) return
    setSaving(true)
    try {
      await client.post(`/writing/projects/${project.id}/drafts`, {
        content: editDraft,
      })
      await fetchProject(project.id)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleAutoGather = async () => {
    if (!project) return
    setGathering(true)
    try {
      await client.post(`/writing/projects/${project.id}/auto-gather`)
      await fetchProject(project.id)
    } catch {
    } finally {
      setGathering(false)
    }
  }

  const handlePublish = () => {
    handlePatch({ status: 'published' })
  }

  const callAi = async (action: string, extraBody?: Record<string, string>) => {
    if (!project) return
    setAiLoading(action)
    setAiResult(null)
    try {
      const { data } = await client.post(
        `/writing/projects/${project.id}/ai/${action}`,
        extraBody || {},
      )
      const content = data.skeleton || data.counter_arguments || data.content
        || (data.checks ? Object.entries(data.checks as Record<string, string>)
          .map(([k, v]) => `## ${k === 'fact' ? '事实核查' : k === 'logic' ? '逻辑检查' : '风格审查'}\n${v}`)
          .join('\n\n---\n\n') : '')
      setAiResult({ key: action, content })
      if (data.draft_id) {
        await fetchProject(project.id)
      }
    } catch (e: any) {
      setAiResult({ key: action, content: `AI 调用失败: ${e.response?.data?.detail || e.message}` })
    } finally {
      setAiLoading(null)
    }
  }

  const currentStatusIdx = project ? STATUS_FLOW.indexOf(project.status) : 0
  const tabStatusIdx = (tabKey: string): number => {
    if (tabKey === 'complete') return STATUS_FLOW.indexOf('reviewing')
    return STATUS_FLOW.indexOf(tabKey as WritingStatus)
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <style>{PAGE_STYLE}</style>
      <div className="wr-layout">
        <div className="wr-sidebar">
          <div className="wr-sidebar-header">
            <h2>
              <PenTool />
              写作室
            </h2>
            <Button variant="ghost" size="sm" onClick={handleCreate}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="wr-project-list">
            {listLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader size={18} style={{ color: 'var(--ht-text-3)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : projects.length === 0 ? (
              <div className="wr-empty" style={{ height: 'auto', padding: '2rem 1rem' }}>
                <Inbox size={20} />
                <p style={{ fontSize: '0.8125rem' }}>暂无项目</p>
              </div>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className={`wr-project-item ${activeId === p.id ? 'wr-project-item-active' : ''}`}
                  onClick={() => selectProject(p.id)}
                >
                  <div className="wr-project-title">{p.title}</div>
                  <div className="wr-project-meta">
                    <Tag color={STATUS_TAG_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Tag>
                    <span className="wr-project-date">{formatDate(p.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="wr-workspace">
          {!project ? (
            <div className="wr-empty">
              <BookOpen size={28} />
              <p>创建一个写作项目开始</p>
            </div>
          ) : (
            <>
              <div className="wr-tabs">
                {TAB_LIST.map((tab) => {
                  const sIdx = tabStatusIdx(tab.key)
                  const isCurrent =
                    tab.key === 'complete'
                      ? project.status === 'reviewing' || project.status === 'published'
                      : tab.key === project.status
                  const isReached = sIdx <= currentStatusIdx
                  return (
                    <button
                      key={tab.key}
                      className={`wr-tab ${activeTab === tab.key ? 'wr-tab-active' : ''} ${isCurrent ? 'wr-tab-current' : ''}`}
                      onClick={() => setActiveTab(tab.key)}
                      disabled={!isReached}
                      style={!isReached ? { opacity: 0.35, cursor: 'default' } : undefined}
                    >
                      {tab.label}
                      {isCurrent && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--ht-accent)',
                          }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="wr-content">
                {aiLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--ht-bg) 85%, transparent)',
                    borderRadius: 'inherit',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ht-accent)' }}>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {aiLoading === 'skeleton' ? '生成论点骨架...'
                          : aiLoading === 'counter-arguments' ? '分析反方观点...'
                          : aiLoading === 'generate-draft' ? '生成草稿...'
                          : '检查中...'}
                      </span>
                    </div>
                  </div>
                )}
                {aiResult && !aiLoading && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0, zIndex: 10,
                    width: '50%', maxWidth: 560, maxHeight: '90%',
                    overflow: 'auto', margin: '0.75rem',
                    padding: '1rem', borderRadius: 'var(--ht-radius-lg)',
                    border: '1px solid var(--ht-border)',
                    background: 'var(--ht-surface)',
                    boxShadow: 'var(--ht-shadow)',
                    fontSize: '0.8125rem', lineHeight: 1.7,
                    color: 'var(--ht-text)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--ht-accent)' }}>
                        AI 分析结果
                      </span>
                      <button
                        onClick={() => setAiResult(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ht-text-3)', fontSize: '0.75rem' }}
                      >
                        关闭
                      </button>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{aiResult.content}</div>
                  </div>
                )}
                {activeTab === 'topic' && (
                  <div>
                    <div className="wr-section">
                      <label className="wr-field-label">标题</label>
                      <input
                        style={inputStyle}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="输入文章标题..."
                      />
                    </div>
                    <div className="wr-section">
                      <label className="wr-field-label">选题 / 方向</label>
                      <textarea
                        style={{
                          ...inputStyle,
                          minHeight: 160,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          lineHeight: 1.6,
                        }}
                        value={editTopic}
                        onChange={(e) => setEditTopic(e.target.value)}
                        placeholder="描述写作主题、目标读者、核心观点..."
                      />
                    </div>
                    {project.tags && project.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {project.tags.map((t) => (
                          <Tag key={t} color="accent2">{t}</Tag>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" onClick={handleSaveTopic} disabled={saving}>
                        {saving ? <Loader size={12} /> : <Check size={12} />}
                        保存
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextStage}>
                        下一步: 素材收集
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'gathering' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div className="wr-section-title" style={{ marginBottom: 0 }}>
                        已采集素材 {(project.materials?.length || 0) > 0 ? `(${project.materials!.length})` : ''}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleAutoGather} disabled={gathering}>
                        {gathering ? <Loader size={12} /> : <Sparkles size={12} />}
                        {gathering ? '采集中...' : '自动采集'}
                      </Button>
                    </div>
                    {(!project.materials || project.materials.length === 0) ? (
                      <div className="wr-empty" style={{ height: 'auto', padding: '3rem 1rem' }}>
                        <Inbox size={20} />
                        <p style={{ fontSize: '0.8125rem' }}>暂无素材，点击"自动采集"开始收集</p>
                      </div>
                    ) : (
                      project.materials!.map((m) => (
                        <div
                          key={m.id}
                          className="wr-material-card"
                          style={{ borderLeftColor: SOURCE_ACCENT[m.source_type] || 'var(--ht-border-strong)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <FileText size={12} style={{ color: 'var(--ht-text-3)' }} />
                            <div className="wr-material-title">{m.title}</div>
                            <Tag color="neutral">{m.source_type}</Tag>
                          </div>
                          {m.snippet && <div className="wr-material-snippet">{m.snippet}</div>}
                          {m.relevance_note && <div className="wr-material-relevance">相关性: {m.relevance_note}</div>}
                        </div>
                      ))
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <Button variant="ghost" size="sm" onClick={() => callAi('counter-arguments')} disabled={!!aiLoading}>
                        <Sparkles size={12} />
                        反方观点分析
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextStage}>
                        下一步: 撰写提纲
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'outline' && (
                  <div>
                    <div className="wr-section">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <label className="wr-field-label" style={{ marginBottom: 0 }}>文章提纲</label>
                        <Button variant="ghost" size="sm" onClick={() => callAi('skeleton')} disabled={!!aiLoading}>
                          <Sparkles size={12} />
                          AI 生成骨架
                        </Button>
                      </div>
                      <textarea
                        style={{
                          ...inputStyle,
                          minHeight: 320,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          lineHeight: 1.8,
                        }}
                        value={editOutline}
                        onChange={(e) => setEditOutline(e.target.value)}
                        placeholder="编写文章提纲...&#10;&#10;一、引言&#10;二、正文&#10;  2.1 ...&#10;  2.2 ...&#10;三、总结"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" onClick={handleSaveOutline} disabled={saving}>
                        {saving ? <Loader size={12} /> : <Check size={12} />}
                        保存提纲
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextStage}>
                        下一步: 开始写作
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'drafting' && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <Button variant="ghost" size="sm" onClick={() => callAi('generate-draft')} disabled={!!aiLoading}>
                        <Sparkles size={12} />
                        AI 生成草稿
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => callAi('check', { check_type: 'all', draft_content: editDraft })} disabled={!!aiLoading || !editDraft.trim()}>
                        <Sparkles size={12} />
                        三检（事实/逻辑/文风）
                      </Button>
                    </div>
                    {project.drafts && project.drafts.length > 0 && (
                      <div className="wr-section">
                        <div className="wr-section-title">历史版本 ({project.drafts.length})</div>
                        {project.drafts.map((d) => (
                          <div key={d.id} className="wr-draft-item">
                            <span className="wr-draft-version">v{d.version}</span>
                            <span className="wr-draft-label">{d.label || `版本 ${d.version}`}</span>
                            <span className="wr-draft-date">{formatDate(d.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="wr-section">
                      <label className="wr-field-label">当前草稿</label>
                      <textarea
                        style={{
                          ...inputStyle,
                          width: '100%',
                          minHeight: 400,
                          resize: 'vertical',
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                          fontSize: '0.8125rem',
                          lineHeight: 1.8,
                          tabSize: 2,
                        }}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        placeholder="开始写作..."
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button variant="primary" size="sm" onClick={handleSaveDraft} disabled={saving || !editDraft.trim()}>
                        {saving ? <Loader size={12} /> : <Send size={12} />}
                        保存为新版本
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextStage}>
                        下一步: 审阅
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'complete' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <Tag color={STATUS_TAG_COLOR[project.status]}>
                          {STATUS_LABEL[project.status]}
                        </Tag>
                      </div>
                      {project.status === 'reviewing' && (
                        <Button variant="primary" size="sm" onClick={handlePublish} disabled={saving}>
                          <Check size={12} />
                          发布
                        </Button>
                      )}
                    </div>
                    {project.final_content ? (
                      <MarkdownPreview content={project.final_content} maxHeight={600} />
                    ) : project.drafts && project.drafts.length > 0 ? (
                      <MarkdownPreview
                        content={project.drafts[project.drafts.length - 1].content}
                        maxHeight={600}
                      />
                    ) : (
                      <div className="wr-empty" style={{ height: 'auto', padding: '3rem 1rem' }}>
                        <FileText size={20} />
                        <p style={{ fontSize: '0.8125rem' }}>暂无内容</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="wr-toolbar">
                <div className="wr-toolbar-left">
                  <span>
                    状态: {STATUS_LABEL[project.status]}
                  </span>
                  {project.updated_at && (
                    <span>
                      更新于 {formatDate(project.updated_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                    style={{ color: 'var(--ht-error)' }}
                  >
                    <Trash2 size={13} />
                    删除
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
