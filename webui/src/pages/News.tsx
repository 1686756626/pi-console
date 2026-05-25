import { useEffect, useState } from "react";
import { api, type Artifact } from "../api";
import { Card, Button, Tag } from "../ui";
import { RefreshCw, ExternalLink, Newspaper } from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import MarkdownPreview from "../components/MarkdownPreview";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  published_at: string | null;
  url: string;
  summary: string | null;
  tags: string[] | null;
  created_at: string;
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.news.list().then(setNews).catch(() => {});
    api.documents.list("news").then(setArtifacts);
  }, []);

  const hasNews = news.length > 0;
  const hasArtifacts = artifacts.length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.news.refresh();
      await api.news.list().then(setNews).catch(() => {});
      await api.documents.list("news").then(setArtifacts);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="新闻"
        subtitle={`${news.length + artifacts.length} 条新闻`}
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} style={{ marginRight: 6 }} className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "刷新中..." : "刷新"}
          </Button>
        }
      />

      {!hasNews && !hasArtifacts && (
        <EmptyState message="暂无新闻，触发新闻采集流水线或点击刷新" icon={<Newspaper size={40} />} />
      )}

      {hasNews && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: hasArtifacts ? 28 : 0 }}>
          {news.map((item) => (
            <Card key={item.id} variant="outlined" style={{ padding: "14px 18px" }} className="animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4, display: "flex", gap: 10 }}>
                    <span style={{ fontWeight: 500 }}>{item.source}</span>
                    {item.published_at && (
                      <span>{new Date(item.published_at).toLocaleDateString("zh-CN")}</span>
                    )}
                  </div>
                  {item.summary && (
                    <p style={{ fontSize: 13, opacity: 0.6, margin: "6px 0 0", lineHeight: 1.5 }}>{item.summary}</p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      {item.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--ht-accent-subtle)", color: "var(--ht-accent)" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ht-accent)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, border: "1px solid var(--ht-border)" }}>
                  <ExternalLink size={14} />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hasArtifacts && (
        <div>
          {hasNews && (
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.5 }}>
              新闻汇总文档
            </h2>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {artifacts.map((a) => {
              const isExpanded = expandedId === a.id;
              return (
                <div key={a.id}>
                  <Card variant="outlined" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</div>
                        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                          <Tag color="warning">news</Tag>
                          <span>{new Date(a.created_at).toLocaleString("zh-CN")}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        style={{ background: "none", border: "1px solid var(--ht-border)", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: isExpanded ? "var(--ht-accent)" : "var(--ht-fg)" }}
                      >
                        {isExpanded ? "收起" : "预览"}
                      </button>
                    </div>
                  </Card>
                  {isExpanded && a.markdown_content && (
                    <div style={{ marginTop: -1 }}>
                      <MarkdownPreview content={a.markdown_content} maxHeight={500} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
