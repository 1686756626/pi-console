import { useEffect, useState, useRef } from "react";
import { api, type Memo, type DailyReview, type TagItem } from "../api";
import { Card, Button, Tag } from "../ui";
import {
  Pin, Trash2, Send, Calendar, Hash,
  FileText, Zap, BookOpen, Clock,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import MarkdownPreview from "../components/MarkdownPreview";
import { toast } from "../components/Toast";

export default function Memos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [newContent, setNewContent] = useState("");
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState<DailyReview | null>(null);
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMemos();
    api.tags.list().then(setAllTags);
  }, [filterTag]);

  useEffect(() => {
    if (showReview) {
      api.memos.dailyReview(reviewDate).then(setReview);
    }
  }, [showReview, reviewDate]);

  async function loadMemos() {
    const params: any = { limit: 50 };
    if (filterTag) params.tag = filterTag;
    const data = await api.memos.list(params);
    setMemos(data);
  }

  async function handleCreate() {
    if (!newContent.trim()) return;
    const tempContent = newContent;
    const tempMemo: Memo = {
      id: `temp-${Date.now()}`,
      content: tempContent,
      visibility: "private",
      pinned: false,
      tags_extracted: null,
      parent_id: null,
      source: "web",
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMemos((prev) => [tempMemo, ...prev]);
    setNewContent("");
    try {
      await api.memos.create({ content: tempContent });
      loadMemos();
      toast("备忘已创建", "success");
    } catch {
      setMemos((prev) => prev.filter((m) => m.id !== tempMemo.id));
      toast("创建失败", "error");
    }
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    await api.memos.update(id, { pinned: !pinned });
    loadMemos();
  }

  async function handleDelete(id: string) {
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      await api.memos.delete(id);
      toast("已删除", "info");
    } catch {
      loadMemos();
      toast("删除失败", "error");
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleCreate();
    }
  };

  return (
    <div>
      <PageHeader title="备忘" subtitle={`${memos.length} 条`} action={
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" onClick={() => setShowReview(!showReview)}>
            <Calendar size={14} style={{ marginRight: 4 }} />
            {showReview ? "关闭回顾" : "每日回顾"}
          </Button>
        </div>
      } />

      {showReview && review && (
        <Card variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Calendar size={16} />
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              style={{ fontSize: 14, border: "1px solid var(--ht-border)", borderRadius: 6, padding: "4px 8px", color: "var(--ht-fg)", background: "var(--ht-bg)" }}
            />
            <span style={{ fontWeight: 600 }}>{review.date}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--ht-surface)", border: "1px solid var(--ht-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, opacity: 0.6 }}>
                <BookOpen size={12} /> 备忘 ({review.memos.length})
              </div>
              {review.memos.map((m) => (
                <div key={m.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--ht-border)" }}>
                  {m.pinned && <Pin size={10} style={{ marginRight: 4, opacity: 0.6 }} />}
                  {m.content.substring(0, 60)}{m.content.length > 60 ? "..." : ""}
                </div>
              ))}
              {review.memos.length === 0 && <div style={{ fontSize: 12, opacity: 0.3 }}>无备忘</div>}
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--ht-surface)", border: "1px solid var(--ht-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, opacity: 0.6 }}>
                <Zap size={12} /> 运行 ({review.runs.length})
              </div>
              {review.runs.map((r) => (
                <div key={r.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--ht-border)" }}>
                  {r.name} - <span style={{ opacity: 0.5 }}>{r.status}</span>
                </div>
              ))}
              {review.runs.length === 0 && <div style={{ fontSize: 12, opacity: 0.3 }}>无运行</div>}
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--ht-surface)", border: "1px solid var(--ht-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, opacity: 0.6 }}>
                <FileText size={12} /> 文档更新 ({review.pages_updated.length})
              </div>
              {review.pages_updated.map((p) => (
                <div key={p.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--ht-border)" }}>
                  {p.title}
                </div>
              ))}
              {review.pages_updated.length === 0 && <div style={{ fontSize: 12, opacity: 0.3 }}>无更新</div>}
            </div>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: 16 }}>
        <Card variant="outlined" style={{ padding: 12 }}>
          <textarea
            ref={inputRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="写点什么... 用 #标签 来标记分类，Ctrl+Enter 发布"
            style={{
              width: "100%", minHeight: 60, border: "none", outline: "none",
              fontSize: 14, lineHeight: 1.6, resize: "vertical",
              color: "var(--ht-fg)", background: "transparent",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.3 }}>支持 #标签 和 Markdown</div>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newContent.trim()}>
              <Send size={12} style={{ marginRight: 4 }} /> 发布
            </Button>
          </div>
        </Card>
      </div>

      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <Hash size={14} style={{ opacity: 0.3, marginTop: 3 }} />
          <button
            onClick={() => setFilterTag(null)}
            style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              border: "1px solid", fontWeight: 500,
              borderColor: !filterTag ? "var(--ht-accent)" : "var(--ht-border)",
              background: !filterTag ? "var(--ht-accent-subtle)" : "transparent",
              color: !filterTag ? "var(--ht-accent)" : "var(--ht-fg)",
            }}
          >
            全部
          </button>
          {allTags.slice(0, 15).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterTag(t.name)}
              style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                border: "1px solid", fontWeight: 500,
                borderColor: filterTag === t.name ? "var(--ht-accent)" : "var(--ht-border)",
                background: filterTag === t.name ? "var(--ht-accent-subtle)" : "transparent",
                color: filterTag === t.name ? "var(--ht-accent)" : "var(--ht-fg)",
              }}
            >
              #{t.name} ({t.usage_count})
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {memos.map((memo) => (
          <Card key={memo.id} variant="outlined" style={{
            padding: 14,
            borderLeft: memo.pinned ? "3px solid var(--ht-accent)" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6, color: "var(--ht-fg)" }}>
                <MarkdownPreview content={memo.content} maxHeight={200} />
              </div>
              <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleTogglePin(memo.id, memo.pinned)}
                  style={{ background: "none", border: "none", cursor: "pointer", opacity: memo.pinned ? 1 : 0.3, color: "var(--ht-fg)" }}
                >
                  <Pin size={14} />
                </button>
                <button
                  onClick={() => handleDelete(memo.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.2, color: "var(--ht-fg)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {memo.tags.map((t) => (
                <Tag key={t} color="accent2">{t}</Tag>
              ))}
              {memo.tags_extracted?.map((t) => (
                !memo.tags.includes(t) && <span key={t} style={{ fontSize: 11, opacity: 0.3 }}>#{t}</span>
              ))}
              <span style={{ fontSize: 11, opacity: 0.3, marginLeft: "auto" }}>
                <Clock size={10} style={{ marginRight: 3 }} />
                {new Date(memo.created_at).toLocaleString("zh-CN")}
              </span>
            </div>
          </Card>
        ))}
        {memos.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.3 }}>
            <BookOpen size={32} style={{ marginBottom: 8 }} />
            <div>还没有备忘，写第一条吧</div>
          </div>
        )}
      </div>
    </div>
  );
}
