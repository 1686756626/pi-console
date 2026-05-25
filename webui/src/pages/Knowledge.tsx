import { useEffect, useState } from "react";
import {
  api,
  type KnowledgeDocument,
  type KnowledgeQueryResult,
  type Artifact,
} from "../api";
import { Button, Card, Tag } from "../ui";
import {
  Search,
  BookOpen,
  Trash2,
  RefreshCw,
  Plus,
  FileText,
  Package,
  X,
  Layers,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { toast } from "../components/Toast";

export default function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeQueryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    api.knowledge.list().then(setDocs);
    api.documents.list().then(setArtifacts);
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.knowledge.query(query, 5);
      setResults(data.results);
    } catch {
      toast("查询失败", "error");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    try {
      const data = await api.knowledge.add({
        source_type: "artifact",
        source_ids: Array.from(selectedIds),
      });
      toast(`已添加 ${data.added.length} 篇文档到知识库`, "success");
      setShowAdd(false);
      setSelectedIds(new Set());
      api.knowledge.list().then(setDocs);
    } catch {
      toast("添加失败", "error");
    }
  }

  async function handleDelete(id: string) {
    await api.knowledge.delete(id);
    setDeleteTarget(null);
    api.knowledge.list().then(setDocs);
    toast("已删除", "info");
  }

  async function handleReindex() {
    setReindexing(true);
    try {
      await api.knowledge.reindex();
      toast("索引重建完成", "success");
      api.knowledge.list().then(setDocs);
    } catch {
      toast("重建失败", "error");
    } finally {
      setReindexing(false);
    }
  }

  const existingArtifactIds = new Set(docs.map((d) => d.source_id).filter(Boolean));
  const availableArtifacts = artifacts.filter((a) => !existingArtifactIds.has(a.id));

  return (
    <div>
      <PageHeader
        title="知识库"
        subtitle={`${docs.length} 篇文档`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={reindexing}
            >
              <RefreshCw
                size={14}
                style={{ marginRight: 4 }}
                className={reindexing ? "pi-spin" : ""}
              />{" "}
              {reindexing ? "重建中..." : "重建索引"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> 添加文档
            </Button>
          </div>
        }
      />

      <Card variant="outlined" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              border: "1px solid var(--ht-border)",
              borderRadius: 8,
              background: "var(--ht-surface)",
            }}
          >
            <Search size={16} style={{ opacity: 0.4 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="输入关键词搜索知识库..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                width: "100%",
                color: "var(--ht-fg)",
              }}
            />
          </div>
          <Button variant="primary" onClick={handleSearch} disabled={searching}>
            <BookOpen size={14} style={{ marginRight: 6 }} />
            {searching ? "搜索中..." : "搜索"}
          </Button>
        </div>
      </Card>

      {showAdd && (
        <Card variant="outlined" style={{ padding: 16, marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              从 Agent 产出添加到知识库
            </div>
            <button
              onClick={() => setShowAdd(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: 0.4,
              }}
            >
              <X size={16} />
            </button>
          </div>
          {availableArtifacts.length === 0 ? (
            <div style={{ opacity: 0.4, fontSize: 13, textAlign: "center", padding: 20 }}>
              所有产出文档已在知识库中
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {availableArtifacts.map((a) => (
                  <label
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: selectedIds.has(a.id)
                        ? "var(--ht-accent-subtle)"
                        : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          return n;
                        });
                      }}
                    />
                    <FileText size={13} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{a.title}</span>
                    <Tag color="accent">{a.type}</Tag>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  disabled={selectedIds.size === 0}
                >
                  <Package size={12} style={{ marginRight: 4 }} /> 添加{" "}
                  {selectedIds.size} 篇
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {results.length > 0 && (
        <Card variant="outlined" style={{ padding: 16, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              opacity: 0.6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Search size={14} /> 搜索结果 ({results.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((r, i) => (
              <div
                key={`${r.document_id}-${r.chunk_index}-${i}`}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--ht-bg)",
                  border: "1px solid var(--ht-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {r.title}
                  </span>
                  <Tag color="accent2">score: {r.score}</Tag>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    opacity: 0.8,
                    maxHeight: 120,
                    overflow: "auto",
                  }}
                >
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Layers size={16} /> 已索引文档
      </div>

      {docs.length === 0 && !showAdd ? (
        <EmptyState
          message="知识库为空，添加 Agent 产出或搜索文档"
          icon={<BookOpen size={40} />}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((doc) => (
            <Card
              key={doc.id}
              variant="outlined"
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--ht-accent-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText
                  size={18}
                  style={{ color: "var(--ht-accent)" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {doc.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.4,
                    marginTop: 2,
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <span>{doc.chunk_count} 个分块</span>
                  <span>{doc.source_type}</span>
                  {doc.created_at && (
                    <span>
                      {new Date(doc.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(doc.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  opacity: 0.3,
                  padding: 0,
                  display: "flex",
                }}
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除文档"
        message="确定要从知识库中删除这个文档吗？关联的分块也会被删除。"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
