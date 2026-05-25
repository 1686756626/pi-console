import { useEffect, useState, useCallback, useRef } from "react";
import { api, type Space, type Memo, type KnowledgeDocument } from "../api";
import {
  Search, Trash2, FileText, Edit3, Check, X,
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Sparkles, Newspaper, BookOpen, StickyNote,
  PanelLeftClose, PanelLeft, Plus, FilePlus,
  Loader,
} from "lucide-react";
import MarkdownPreview from "../components/MarkdownPreview";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

type VaultItemType = "wiki-page" | "memo" | "knowledge-doc" | "news-item";

interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  content: string;
  parentId?: string | null;
  children?: VaultItem[];
  meta?: Record<string, unknown>;
}

interface VaultFolder {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: VaultItem[];
}

function buildWikiTree(raw: any[]): VaultItem[] {
  const map = new Map<string, VaultItem>();
  raw.forEach((p: any) => map.set(p.id, {
    id: p.id,
    type: "wiki-page" as const,
    title: p.title,
    content: p.content || "",
    parentId: p.parent_id,
    children: [],
    meta: { space_id: p.space_id },
  }));
  const roots: VaultItem[] = [];
  map.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
}

export default function Vault() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [activeItem, setActiveItem] = useState<VaultItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["notes", "memos", "knowledge", "news"]));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: VaultItemType; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [wikiTrees, setWikiTrees] = useState<Map<string, VaultItem[]>>(new Map());
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [sp, memos, kDocs, newsList] = await Promise.all([
        api.wiki.listSpaces(),
        api.memos.list({ limit: 100 }),
        api.knowledge.list(),
        api.news.list(),
      ]);
      setSpaces(sp);

      const treeMap = new Map<string, VaultItem[]>();
      for (const space of sp) {
        try {
          const pages = await api.wiki.listPages(space.id);
          treeMap.set(space.id, buildWikiTree(pages));
        } catch {
          treeMap.set(space.id, []);
        }
      }
      setWikiTrees(treeMap);

      const builtFolders: VaultFolder[] = [];

      builtFolders.push({
        key: "notes",
        label: "笔记",
        icon: <FileText size={14} />,
        items: sp.map((s) => ({
          id: `space:${s.id}`,
          type: "wiki-page" as const,
          title: s.name,
          content: "",
          children: treeMap.get(s.id) || [],
          meta: { space_id: s.id, is_space: true },
        })),
      });

      builtFolders.push({
        key: "memos",
        label: "备忘",
        icon: <StickyNote size={14} />,
        items: (memos || []).map((m: Memo) => ({
          id: m.id,
          type: "memo" as const,
          title: m.content.slice(0, 50).replace(/[#\n]/g, " ").trim() || "备忘",
          content: m.content,
          meta: { pinned: m.pinned, tags: m.tags_extracted },
        })),
      });

      builtFolders.push({
        key: "knowledge",
        label: "知识库",
        icon: <BookOpen size={14} />,
        items: (kDocs || []).map((d: KnowledgeDocument) => ({
          id: d.id,
          type: "knowledge-doc" as const,
          title: d.title,
          content: "",
          meta: { source_type: d.source_type, chunk_count: d.chunk_count, status: d.status },
        })),
      });

      builtFolders.push({
        key: "news",
        label: "新闻",
        icon: <Newspaper size={14} />,
        items: (newsList || []).map((n: any) => ({
          id: n.id,
          type: "news-item" as const,
          title: n.title,
          content: n.summary || "",
          meta: { source: n.source, url: n.url, published_at: n.published_at },
        })),
      });

      setFolders(builtFolders);
    } catch (e: any) {
      toast("加载失败: " + (e.message || ""), "error");
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSpaceExpand = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const handleSelectItem = async (item: VaultItem) => {
    if (item.meta?.is_space) {
      toggleSpaceExpand((item.meta as any).space_id);
      return;
    }
    if (item.children && item.children.length > 0 && !item.content && item.type === "wiki-page") {
      const spaceId = findSpaceId(item.id);
      if (spaceId) {
        toggleSpaceExpand(item.id);
      }
      return;
    }

    let fullContent = item.content;
    let fullTitle = item.title;

    if (item.type === "wiki-page") {
      try {
        const page = await api.wiki.getPage(item.id);
        fullContent = page.content || "";
        fullTitle = page.title;
      } catch {}
    } else if (item.type === "knowledge-doc") {
      try {
        const doc = await api.knowledge.getContent(item.id);
        fullContent = doc.content || "";
        fullTitle = doc.title;
      } catch {}
    }

    setActiveItem({ ...item, content: fullContent, title: fullTitle });
    setEditContent(fullContent);
    setEditTitle(fullTitle);
    setEditing(false);
  };

  const findSpaceId = (pageId: string): string | null => {
    for (const [spaceId, items] of wikiTrees.entries()) {
      if (findInTree(items, pageId)) return spaceId;
    }
    return null;
  };

  const findInTree = (items: VaultItem[], id: string): boolean => {
    for (const item of items) {
      if (item.id === id) return true;
      if (item.children && findInTree(item.children, id)) return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!activeItem) return;
    setSaving(true);
    try {
      if (activeItem.type === "wiki-page") {
        await api.wiki.updatePage(activeItem.id, { title: editTitle, content: editContent });
      } else if (activeItem.type === "memo") {
        await api.memos.update(activeItem.id, { content: editContent });
      } else if (activeItem.type === "news-item") {
        await api.news.update(activeItem.id, { title: editTitle, summary: editContent });
      }
      setActiveItem((prev) => prev ? { ...prev, content: editContent, title: editTitle } : prev);
      setEditing(false);
      toast("保存成功", "success");
    } catch (e: any) {
      toast("保存失败: " + (e.message || ""), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "wiki-page") {
        await api.wiki.deletePage(deleteTarget.id);
      } else if (deleteTarget.type === "memo") {
        await api.memos.delete(deleteTarget.id);
      } else if (deleteTarget.type === "knowledge-doc") {
        await api.knowledge.delete(deleteTarget.id);
      } else if (deleteTarget.type === "news-item") {
        toast("新闻条目暂不支持删除", "error");
        setDeleteTarget(null);
        return;
      }
      toast("已删除", "success");
      if (activeItem?.id === deleteTarget.id) setActiveItem(null);
      loadData();
    } catch {
      toast("删除失败", "error");
    }
    setDeleteTarget(null);
  };

  const handleCreatePage = async (parentId?: string) => {
    const spaceId = spaces.length === 1 ? spaces[0].id : spaces[0]?.id;
    if (!spaceId) {
      toast("请先创建笔记空间", "error");
      return;
    }
    try {
      const page = await api.wiki.createPage({
        space_id: spaceId,
        parent_id: parentId,
        title: "未命名笔记",
        content: "",
      });
      await loadData();
      handleSelectItem({
        id: page.id,
        type: "wiki-page",
        title: page.title,
        content: page.content || "",
        meta: { space_id: spaceId },
      });
      setEditing(true);
    } catch {
      toast("创建失败", "error");
    }
  };

  const handleCreateMemo = async () => {
    try {
      const memo = await api.memos.create({ content: "新备忘" });
      await loadData();
      handleSelectItem({
        id: memo.id,
        type: "memo",
        title: "新备忘",
        content: memo.content,
      });
      setEditing(true);
    } catch {
      toast("创建失败", "error");
    }
  };

  const allItems = folders.flatMap((f) => f.items);
  const filteredItems = searchQuery.trim()
    ? allItems.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const typeLabel: Record<VaultItemType, string> = {
    "wiki-page": "笔记",
    "memo": "备忘",
    "knowledge-doc": "知识",
    "news-item": "新闻",
  };

  const renderTreeItem = (item: VaultItem, depth: number) => {
    const hasChildren = (item.children && item.children.length > 0) || !!item.meta?.is_space;
    const isFolder = hasChildren && !item.content;
    const isExpanded = item.meta?.is_space
      ? expandedSpaces.has((item.meta as any).space_id)
      : expanded.has(item.id);
    const isActive = activeItem?.id === item.id;

    return (
      <div key={item.id}>
        <div
          onClick={() => hasChildren && isFolder ? (item.meta?.is_space ? toggleSpaceExpand((item.meta as any).space_id) : toggleExpand(item.id)) : handleSelectItem(item)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 8px 5px " + (depth * 16 + 8) + "px",
            cursor: "pointer",
            fontSize: 13,
            borderRadius: "var(--ht-radius-md)",
            background: isActive ? "var(--ht-accent-muted)" : "transparent",
            color: isActive ? "var(--ht-accent)" : "var(--ht-fg)",
            fontWeight: isActive ? 600 : 400,
            transition: "background 0.12s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--ht-accent-subtle)"; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.4 }} /> : <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
          ) : <span style={{ width: 12, flexShrink: 0 }} />}
          {isFolder ? (
            isExpanded ? <FolderOpen size={13} style={{ opacity: 0.5, flexShrink: 0 }} /> : <Folder size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          ) : item.type === "memo" ? (
            <StickyNote size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          ) : item.type === "knowledge-doc" ? (
            <BookOpen size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          ) : item.type === "news-item" ? (
            <Newspaper size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          ) : (
            <FileText size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {item.title}
          </span>
          {!isFolder && activeItem?.id === item.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: item.type, id: item.id }); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.3, display: "flex" }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && item.children?.map((child) => renderTreeItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", minHeight: 500, margin: "-20px" }}>
      {sidebarOpen && (
        <div style={{
          width: 260, flexShrink: 0,
          background: "var(--ht-surface)",
          borderRight: "1px solid var(--ht-border)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--ht-border)" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, opacity: 0.35 }} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                style={{
                  width: "100%", padding: "8px 10px 8px 32px",
                  border: "1px solid var(--ht-border)",
                  borderRadius: "var(--ht-radius-lg)", fontSize: 13,
                  background: "var(--ht-bg)",
                  color: "var(--ht-fg)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {searchQuery.trim() ? (
              filteredItems.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, opacity: 0.35 }}>无匹配结果</div>
              ) : filteredItems.map((item) => renderTreeItem(item, 0))
            ) : (
              folders.map((folder) => (
                <div key={folder.key} style={{ marginBottom: 4 }}>
                  <div
                    onClick={() => toggleExpand(folder.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 8px", cursor: "pointer",
                      borderRadius: "var(--ht-radius-md)", fontSize: 13, fontWeight: 600,
                      userSelect: "none",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ht-accent-subtle)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {expanded.has(folder.key) ? <ChevronDown size={12} style={{ opacity: 0.4 }} /> : <ChevronRight size={12} style={{ opacity: 0.4 }} />}
                    {folder.icon as React.ReactElement}
                    {folder.label}
                    <span style={{ fontSize: 11, opacity: 0.35, marginLeft: "auto" }}>{folder.items.length}</span>
                  </div>
                  {expanded.has(folder.key) && folder.items.map((item) => renderTreeItem(item, 1))}
                </div>
              ))
            )}
          </div>

          <div style={{
            padding: "8px 12px", borderTop: "1px solid var(--ht-border)",
            display: "flex", gap: 6,
          }}>
            <button
              onClick={() => handleCreatePage()}
              title="新建笔记"
              style={{
                flex: 1, padding: "6px 0", borderRadius: "var(--ht-radius-md)",
                border: "1px solid var(--ht-border)",
                background: "transparent", cursor: "pointer",
                fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                color: "var(--ht-fg)",
              }}
            >
              <FilePlus size={12} /> 笔记
            </button>
            <button
              onClick={handleCreateMemo}
              title="新建备忘"
              style={{
                flex: 1, padding: "6px 0", borderRadius: "var(--ht-radius-md)",
                border: "1px solid var(--ht-border)",
                background: "transparent", cursor: "pointer",
                fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                color: "var(--ht-fg)",
              }}
            >
              <Plus size={12} /> 备忘
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--ht-bg)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 20px",
          borderBottom: "1px solid var(--ht-border)",
          background: "var(--ht-surface)",
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, color: "var(--ht-fg)", opacity: 0.4, borderRadius: "var(--ht-radius-md)" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          {activeItem ? (
            editing ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    flex: 1, padding: "4px 8px", border: "1px solid var(--ht-border)",
                    borderRadius: "var(--ht-radius-md)", fontSize: 14, fontWeight: 600,
                    background: "var(--ht-bg)", color: "var(--ht-fg)", outline: "none",
                  }}
                />
                <button onClick={handleSave} disabled={saving} style={{
                  padding: "4px 12px", borderRadius: "var(--ht-radius-md)", fontSize: 12,
                  background: "var(--ht-accent)", color: "var(--ht-on-accent)", border: "none",
                  cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4,
                }}>
                  {saving ? <Loader size={12} className="pi-spin" /> : <Check size={12} />}
                  保存
                </button>
                <button onClick={() => { setEditing(false); setEditContent(activeItem.content); setEditTitle(activeItem.title); }} style={{
                  padding: "4px 8px", borderRadius: "var(--ht-radius-md)", fontSize: 12,
                  background: "transparent", color: "var(--ht-fg)", border: "1px solid var(--ht-border)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <X size={12} /> 取消
                </button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{activeItem.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1 }}>
                    {typeLabel[activeItem.type]}
                    {activeItem.meta?.source ? ` | ${String(activeItem.meta.source)}` : ""}
                    {activeItem.meta?.chunk_count ? ` | ${String(activeItem.meta.chunk_count)} 片段` : ""}
                  </div>
                </div>
                {activeItem.type !== "knowledge-doc" && (
                  <button onClick={() => setEditing(true)} style={{
                    padding: "4px 12px", borderRadius: "var(--ht-radius-md)", fontSize: 12,
                    background: "var(--ht-accent-subtle)",
                    color: "var(--ht-accent)", border: "1px solid var(--ht-border)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Edit3 size={12} /> 编辑
                  </button>
                )}
              </>
            )
          ) : (
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, opacity: 0.4 }}>知识库</div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {!activeItem ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", opacity: 0.35 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "var(--ht-radius-lg)",
                  background: "var(--ht-accent-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Sparkles size={24} style={{ color: "var(--ht-accent)" }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>知识库</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  统一管理笔记、备忘、知识文档和新闻<br />
                  <span style={{ fontSize: 11 }}>从左侧选择内容开始浏览或编辑</span>
                </div>
              </div>
            </div>
          ) : editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="输入 Markdown 内容..."
                style={{
                  minHeight: 500,
                  width: "100%",
                  padding: 16,
                  border: "1px solid var(--ht-border)",
                  borderRadius: "var(--ht-radius-lg)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: "monospace",
                  background: "var(--ht-surface)",
                  color: "var(--ht-fg)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
          ) : activeItem.content ? (
            <div style={{ background: "var(--ht-surface)", border: "1px solid var(--ht-border)", borderRadius: "var(--ht-radius-lg)", padding: 24 }}>
              <MarkdownPreview content={activeItem.content} />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.35, fontSize: 13 }}>
              {activeItem.type === "knowledge-doc" ? "知识文档内容加载中..." : "暂无内容"}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message="确定要删除这个内容吗？此操作不可撤销。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
