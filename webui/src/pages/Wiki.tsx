import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { api, type Space, type WikiPage, type Artifact, type SearchResult, type TagItem, type PageRevision, type PageRevisionDetail } from "../api";
import { Button, Tag } from "../ui";
import {
  Search, Trash2, FileText,
  ChevronRight, ChevronDown, Folder, Edit3, Check, X, Import,
  Sparkles, Hash, History, RotateCcw, Eye, FolderPlus, FilePlus,
  PanelLeftClose, PanelLeft,
} from "lucide-react";
import MarkdownPreview from "../components/MarkdownPreview";
import MilkdownEditor from "../components/MilkdownEditorLazy";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

function buildTree(raw: any[]): WikiPage[] {
  const map = new Map<string, WikiPage>();
  raw.forEach((p: any) => map.set(p.id, { ...p, children: [] }));
  const roots: WikiPage[] = [];
  map.forEach((p) => {
    if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id)!.children.push(p);
    else roots.push(p);
  });
  return roots;
}

export default function Wiki() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pageTags, setPageTags] = useState<string[]>([]);
  const [, setAllTags] = useState<TagItem[]>([]);
  const [tagging, setTagging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<PageRevision[]>([]);
  const [previewRevision, setPreviewRevision] = useState<PageRevisionDetail | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string; isFolder: boolean } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contextMenu) {
      function close() { setContextMenu(null); }
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!showSearch) return;
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearch]);

  useEffect(() => {
    api.wiki.listSpaces().then((s) => {
      setSpaces(s);
      if (s.length > 0 && !activeSpace) setActiveSpace(s[0]);
    });
    api.documents.list().then(setArtifacts);
    api.tags.list().then(setAllTags);
  }, []);

  useEffect(() => {
    if (activeSpace) {
      api.wiki.listPages(activeSpace.id).then((raw) => {
        setPages(buildTree(raw));
        setExpanded((prev) => {
          const n = new Set(prev);
          raw.filter((p: any) => p.children_count > 0 || n.has(p.id)).forEach((p: any) => n.add(p.id));
          return n;
        });
      });
      setActivePage(null);
    }
  }, [activeSpace?.id]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const t = setTimeout(() => {
        api.wiki.search(searchQuery).then(setSearchResults);
      }, 300);
      return () => clearTimeout(t);
    }
    setSearchResults([]);
  }, [searchQuery]);

  useEffect(() => {
    if (activePage) {
      api.tags.aiTag("page", activePage.id).then((r) => {
        setPageTags(r.tags);
      }).catch(() => setPageTags([]));
    } else {
      setPageTags([]);
    }
  }, [activePage?.id]);

  const reloadPages = useCallback(async () => {
    if (!activeSpace) return;
    const raw = await api.wiki.listPages(activeSpace.id);
    setPages(buildTree(raw));
  }, [activeSpace?.id]);

  async function handleCreateFolder(parentId?: string) {
    if (!activeSpace) return;
    const folder = await api.wiki.createPage({
      space_id: activeSpace.id,
      parent_id: parentId,
      title: "新建文件夹",
      content: "",
    });
    await reloadPages();
    setExpanded((prev) => {
      const n = new Set(prev);
      if (parentId) n.add(parentId);
      return n;
    });
    setActivePage(folder);
    setEditTitle(folder.title);
    setEditContent("");
    setEditing(true);
    toast("文件夹已创建", "success");
  }

  async function handleCreateNote(parentId?: string) {
    if (!activeSpace) return;
    const page = await api.wiki.createPage({
      space_id: activeSpace.id,
      parent_id: parentId,
      title: "未命名笔记",
      content: "",
    });
    await reloadPages();
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    setActivePage(page);
    setEditTitle(page.title);
    setEditContent("");
    setEditing(true);
    toast("笔记已创建", "success");
  }

  async function handleSave() {
    if (!activePage) return;
    const updated = await api.wiki.updatePage(activePage.id, {
      title: editTitle,
      content: editContent,
    });
    setActivePage(updated);
    setEditing(false);
    await reloadPages();
    toast("已保存", "success");
  }

  async function handleDeletePage(id: string) {
    await api.wiki.deletePage(id);
    setDeleteTarget(null);
    if (activePage?.id === id) setActivePage(null);
    await reloadPages();
    toast("已删除", "info");
  }

  async function handleImport() {
    if (!activeSpace || selectedArtifacts.size === 0) return;
    const imported = await api.wiki.importArtifacts(activeSpace.id, Array.from(selectedArtifacts));
    setShowImport(false);
    setSelectedArtifacts(new Set());
    await reloadPages();
    toast(`已导入 ${imported.length} 篇文档`, "success");
  }

  async function handleAiTag() {
    if (!activePage) return;
    setTagging(true);
    try {
      const result = await api.tags.aiTag("page", activePage.id);
      setPageTags(result.tags);
      toast(`已生成 ${result.tags.length} 个标签`, "success");
    } catch {
      toast("AI 标签生成失败", "error");
    } finally {
      setTagging(false);
    }
  }

  async function handleShowHistory() {
    if (!activePage) return;
    setShowHistory(true);
    setPreviewRevision(null);
    const revs = await api.wiki.listRevisions(activePage.id);
    setRevisions(revs);
  }

  async function handlePreviewRevision(revisionId: string) {
    if (!activePage) return;
    const detail = await api.wiki.getRevision(activePage.id, revisionId);
    setPreviewRevision(detail);
  }

  async function handleRestoreRevision(revisionId: string) {
    if (!activePage) return;
    setRestoring(true);
    try {
      await api.wiki.restoreRevision(activePage.id, revisionId);
      toast("版本已恢复", "success");
      const updated = await api.wiki.getPage(activePage.id);
      setActivePage(updated);
      setEditTitle(updated.title);
      setEditContent(updated.content || "");
      const revs = await api.wiki.listRevisions(activePage.id);
      setRevisions(revs);
      setPreviewRevision(null);
    } catch {
      toast("恢复失败", "error");
    } finally {
      setRestoring(false);
    }
  }

  function handleSelectPage(page: WikiPage) {
    const isFolder = !page.content && page.children.length > 0;
    if (isFolder) {
      toggleExpand(page.id);
    } else {
      setExpanded((prev) => {
        const n = new Set(prev);
        if (page.parent_id) n.add(page.parent_id);
        return n;
      });
      api.wiki.getPage(page.id).then((p) => {
        setActivePage(p);
        setEditTitle(p.title);
        setEditContent(p.content || "");
        setEditing(false);
      });
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function handleContextMenu(e: React.MouseEvent, page: WikiPage) {
    e.preventDefault();
    e.stopPropagation();
    const isFolder = !page.content && page.children.length > 0;
    setContextMenu({ x: e.clientX, y: e.clientY, pageId: page.id, isFolder });
  }

  const typeTagColor: Record<string, "accent" | "accent2" | "success" | "warning" | "neutral"> = {
    news: "warning", research_report: "accent2",
    article_draft: "accent", journal_summary: "success",
  };

  const unimportedArtifacts = useMemo(() => {
    const importedIds = new Set(
      pages.map((p) => p.source_artifact_id).filter(Boolean) as string[]
    );
    return artifacts.filter((a) => !importedIds.has(a.id));
  }, [artifacts, pages]);

  const handleContentChange = useCallback((markdown: string) => {
    setEditContent(markdown);
  }, []);

  const countAllPages = (items: WikiPage[]): number => {
    let c = 0;
    for (const p of items) {
      if (p.content || p.children.length === 0) c++;
      c += countAllPages(p.children);
    }
    return c;
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", margin: "-20px", borderRadius: 0 }}>
      {contextMenu && (
        <div style={{
          position: "fixed", left: contextMenu.x, top: contextMenu.y,
          zIndex: 999, background: "var(--ht-surface)",
          border: "1px solid var(--ht-border)",
          borderRadius: "var(--ht-radius-lg)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          minWidth: 160, padding: 4,
        }} onClick={(e) => e.stopPropagation()}>
          <button onClick={async () => { await handleCreateNote(contextMenu.pageId); setContextMenu(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--ht-fg)", borderRadius: "var(--ht-radius-md)" }}>
            <FilePlus size={14} style={{ opacity: 0.5 }} /> 在此新建笔记
          </button>
          <button onClick={async () => { await handleCreateFolder(contextMenu.pageId); setContextMenu(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--ht-fg)", borderRadius: "var(--ht-radius-md)" }}>
            <FolderPlus size={14} style={{ opacity: 0.5 }} /> 在此新建文件夹
          </button>
          <div style={{ height: 1, background: "var(--ht-border)", margin: "4px 8px" }} />
          <button onClick={() => { setDeleteTarget(contextMenu.pageId); setContextMenu(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#e54", borderRadius: "var(--ht-radius-md)" }}>
            <Trash2 size={14} style={{ opacity: 0.6 }} /> 删除
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: "1px solid var(--ht-border)",
          display: "flex", flexDirection: "column",
          background: "var(--ht-surface)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "14px 14px 10px",
            borderBottom: "1px solid var(--ht-border)",
          }}>
            <button onClick={() => setSidebarOpen(false)} style={{
              background: "none", border: "none", cursor: "pointer", opacity: 0.4,
              display: "flex", padding: 2, borderRadius: "var(--ht-radius-md)",
            }}>
              <PanelLeftClose size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>笔记</div>
              <div style={{ fontSize: 11, opacity: 0.35, marginTop: 1 }}>
                {countAllPages(pages)} 篇笔记
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid var(--ht-border)" }}>
            {spaces.map((s) => (
              <button key={s.id} onClick={() => setActiveSpace(s)} style={{
                padding: "4px 10px", borderRadius: "var(--ht-radius-md)", fontSize: 12, cursor: "pointer",
                border: "1px solid",
                borderColor: activeSpace?.id === s.id ? "var(--ht-accent)" : "var(--ht-border)",
                background: activeSpace?.id === s.id ? "var(--ht-accent)" : "transparent",
                color: activeSpace?.id === s.id ? "#fff" : "var(--ht-fg)",
                fontWeight: 500,
              }}>
                {s.name}
              </button>
            ))}
          </div>

          <div style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--ht-border)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: "var(--ht-radius-md)",
              background: "var(--ht-bg)",
              border: "1px solid var(--ht-border)",
            }}>
              <Search size={13} style={{ opacity: 0.35, flexShrink: 0 }} />
              <input
                type="text" placeholder="搜索笔记..." value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => searchQuery && setShowSearch(true)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, width: "100%", color: "var(--ht-fg)" }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setShowSearch(false); }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, padding: 0, display: "flex" }}>
                  <X size={12} />
                </button>
              )}
            </div>
            {showSearch && searchResults.length > 0 && (
              <div style={{ position: "absolute", left: 10, right: 10, zIndex: 100, background: "var(--ht-surface)", border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-md)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: 2 }}>
                {searchResults.map((r) => (
                  <button key={r.id} onClick={async () => {
                    const p = await api.wiki.getPage(r.id);
                    setActivePage(p); setEditTitle(p.title); setEditContent(p.content || ""); setEditing(false); setShowSearch(false);
                  }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: "var(--ht-fg)", borderBottom: "1px solid var(--ht-border)" }}>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{r.title}</div>
                    <div style={{ fontSize: 10, opacity: 0.35, marginTop: 2 }}>{r.snippet.substring(0, 60)}...</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
            {pages.map((page) => (
              <PageTreeItem
                key={page.id} page={page} depth={0}
                activeId={activePage?.id}
                expanded={expanded}
                onSelect={handleSelectPage}
                onToggle={toggleExpand}
                onDelete={(id) => setDeleteTarget(id)}
                onContextMenu={handleContextMenu}
              />
            ))}
            {pages.length === 0 && (
              <div style={{ opacity: 0.3, fontSize: 12, padding: 20, textAlign: "center", lineHeight: 1.6 }}>
                暂无内容<br />点击下方按钮开始
              </div>
            )}
          </div>

          <div style={{
            display: "flex", gap: 4, padding: "8px 10px",
            borderTop: "1px solid var(--ht-border)",
          }}>
            <button onClick={() => handleCreateFolder()} title="新建文件夹" style={{
              flex: 1, padding: "7px 0", borderRadius: "var(--ht-radius-md)", fontSize: 12,
              border: "1px dashed var(--ht-border)",
              background: "transparent", cursor: "pointer",
              color: "var(--ht-accent)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <FolderPlus size={13} /> 文件夹
            </button>
            <button onClick={() => handleCreateNote()} title="新建笔记" style={{
              flex: 1, padding: "7px 0", borderRadius: "var(--ht-radius-md)", fontSize: 12,
              border: "1px dashed var(--ht-border)",
              background: "transparent", cursor: "pointer",
              color: "var(--ht-accent)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <FilePlus size={13} /> 笔记
            </button>
            <button onClick={() => setShowImport(!showImport)} title="导入" style={{
              padding: "7px 10px", borderRadius: "var(--ht-radius-md)", fontSize: 12,
              border: "1px dashed var(--ht-border)",
              background: showImport ? "var(--ht-accent-subtle)" : "transparent",
              cursor: "pointer", color: "var(--ht-accent)", display: "flex", alignItems: "center",
            }}>
              <Import size={13} />
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--ht-bg)", overflow: "hidden" }}>
        {!sidebarOpen && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--ht-border)", background: "var(--ht-surface)" }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, display: "flex", padding: 2 }}>
              <PanelLeft size={16} />
            </button>
          </div>
        )}

        {showImport && (
          <div style={{ padding: 16, background: "var(--ht-surface)", borderBottom: "1px solid var(--ht-border)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>从产出导入到当前空间</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflow: "auto" }}>
              {unimportedArtifacts.map((a) => (
                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--ht-radius-md)", cursor: "pointer", background: selectedArtifacts.has(a.id) ? "var(--ht-accent-subtle)" : "transparent" }}>
                  <input type="checkbox" checked={selectedArtifacts.has(a.id)} onChange={() => {
                    setSelectedArtifacts((prev) => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; });
                  }} />
                  <span style={{ fontSize: 12, flex: 1 }}>{a.title}</span>
                  <Tag color={typeTagColor[a.type] || "accent"}>{a.type}</Tag>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" size="sm" onClick={handleImport} disabled={selectedArtifacts.size === 0}>
                <Import size={12} style={{ marginRight: 4 }} /> 导入 {selectedArtifacts.size} 篇
              </Button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto" }}>
          {activePage ? (
            <div style={{ padding: "24px 32px", maxWidth: 800, margin: "0 auto" }}>
              {editing ? (
                <div>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ fontSize: 24, fontWeight: 700, border: "none", outline: "none", width: "100%", marginBottom: 16, color: "var(--ht-fg)", background: "transparent" }}
                    placeholder="标题"
                  />
                  <MilkdownEditor value={editContent} onChange={handleContentChange} />
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <Button variant="primary" size="sm" onClick={handleSave}>
                      <Check size={14} style={{ marginRight: 4 }} /> 保存
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                      <X size={14} style={{ marginRight: 4 }} /> 取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{activePage.title}</h1>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 16 }}>
                      <button onClick={handleAiTag} disabled={tagging} style={{
                        background: "none", border: "1px solid var(--ht-border)",
                        borderRadius: "var(--ht-radius-md)", cursor: "pointer", padding: "5px 8px",
                        fontSize: 12, color: "var(--ht-fg)", display: "flex", alignItems: "center", gap: 4, opacity: tagging ? 0.5 : 0.7,
                      }}>
                        <Sparkles size={12} /> {tagging ? "分析中" : "AI 标签"}
                      </button>
                      <button onClick={handleShowHistory} style={{
                        background: "none", border: "1px solid var(--ht-border)",
                        borderRadius: "var(--ht-radius-md)", cursor: "pointer", padding: "5px 8px",
                        fontSize: 12, color: "var(--ht-fg)", display: "flex", alignItems: "center", gap: 4, opacity: 0.7,
                      }}>
                        <History size={12} /> 历史
                      </button>
                      <button onClick={() => setEditing(true)} style={{
                        background: "var(--ht-accent)", border: "none",
                        borderRadius: "var(--ht-radius-md)", cursor: "pointer", padding: "5px 12px",
                        fontSize: 12, color: "var(--ht-on-accent)", display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Edit3 size={12} /> 编辑
                      </button>
                    </div>
                  </div>

                  {pageTags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                      <Hash size={13} style={{ opacity: 0.3, marginTop: 2 }} />
                      {pageTags.map((t) => <Tag key={t} color="accent2">{t}</Tag>)}
                    </div>
                  )}

                  {activePage.content ? (
                    <MarkdownPreview content={activePage.content} />
                  ) : (
                    <div style={{ opacity: 0.3, fontSize: 14, padding: "40px 0", textAlign: "center" }}>
                      空白笔记，点击「编辑」开始书写
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.25 }}>
              <div style={{ textAlign: "center" }}>
                <FileText size={40} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 500 }}>选择或创建一篇笔记</div>
                <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                  左侧栏底部新建文件夹或笔记<br />右键文件夹可在内部创建
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showHistory && activePage && (
        <div className="animate-fade-in" style={{
          position: "fixed", top: 0, right: 0, width: 400, height: "100vh",
          background: "var(--ht-surface)", borderLeft: "1px solid var(--ht-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", zIndex: 200,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--ht-border)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <History size={16} /> 版本历史
            </div>
            <button onClick={() => { setShowHistory(false); setPreviewRevision(null); }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
            {previewRevision ? (
              <div>
                <button onClick={() => setPreviewRevision(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ht-accent)", marginBottom: 10, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> 返回列表
                </button>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  版本 #{previewRevision.revision_number} - {previewRevision.title}
                </div>
                <div style={{ fontSize: 11, opacity: 0.35, marginBottom: 10 }}>
                  {new Date(previewRevision.created_at).toLocaleString("zh-CN")}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, padding: 10, borderRadius: "var(--ht-radius-md)", background: "var(--ht-bg)", border: "1px solid var(--ht-border)", maxHeight: 380, overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {previewRevision.content || "(空)"}
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button variant="primary" size="sm" onClick={() => handleRestoreRevision(previewRevision.id)} disabled={restoring}>
                    <RotateCcw size={14} style={{ marginRight: 4 }} /> {restoring ? "恢复中..." : "恢复到此版本"}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {revisions.length === 0 && <div style={{ opacity: 0.3, fontSize: 12, textAlign: "center", padding: 20 }}>暂无历史版本</div>}
                {revisions.map((rev) => (
                  <button key={rev.id} onClick={() => handlePreviewRevision(rev.id)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: "var(--ht-radius-md)",
                    border: "1px solid var(--ht-border)",
                    background: "transparent", cursor: "pointer",
                    color: "var(--ht-fg)", textAlign: "left", width: "100%",
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "var(--ht-radius-md)", background: "var(--ht-accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Eye size={12} style={{ color: "var(--ht-accent)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>版本 #{rev.revision_number}</div>
                      <div style={{ fontSize: 10, opacity: 0.35, marginTop: 1 }}>
                        {new Date(rev.created_at).toLocaleString("zh-CN")} | {rev.content_length} 字
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除"
        message="确定要删除吗？此操作不可撤销。"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => deleteTarget && handleDeletePage(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function PageTreeItem({ page, depth, activeId, expanded, onSelect, onToggle, onDelete, onContextMenu }: {
  page: WikiPage; depth: number; activeId?: string;
  expanded: Set<string>;
  onSelect: (p: WikiPage) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, page: WikiPage) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasChildren = page.children && page.children.length > 0;
  const isFolder = !page.content && hasChildren;
  const isExpanded = expanded.has(page.id);
  const isActive = activeId === page.id;

  return (
    <div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 3,
          padding: "5px 6px", borderRadius: "var(--ht-radius-md)", cursor: "pointer",
          background: isActive ? "var(--ht-accent)" : hovered ? "var(--ht-accent-subtle)" : "transparent",
          color: isActive ? "#fff" : "var(--ht-fg)",
          paddingLeft: 6 + depth * 14,
          transition: "background 0.1s ease",
        }}
        onClick={() => onSelect(page)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={(e) => onContextMenu(e, page)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle(page.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit", opacity: 0.5 }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        {isFolder ? (
          <Folder size={13} style={{ opacity: isActive ? 0.8 : 0.4, flexShrink: 0 }} />
        ) : (
          <FileText size={13} style={{ opacity: isActive ? 0.8 : 0.35, flexShrink: 0 }} />
        )}
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontSize: 13, fontWeight: isActive ? 600 : 400,
        }}>
          {page.title}
        </span>
        {hovered && !isActive && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", opacity: 0.3, display: "flex", color: "inherit" }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {hasChildren && isExpanded && page.children.map((child) => (
        <PageTreeItem key={child.id} page={child} depth={depth + 1} activeId={activeId} expanded={expanded} onSelect={onSelect} onToggle={onToggle} onDelete={onDelete} onContextMenu={onContextMenu} />
      ))}
    </div>
  );
}
