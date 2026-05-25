
import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api";
import { Card, Button, Tag } from "../ui";
import {
  Activity,
  Newspaper,
  StickyNote,
  FileText,
  BookOpen,
  PenTool,
  Lightbulb,
  ArrowRight,
  RefreshCw,

  Sparkles,
  TrendingUp,
} from "lucide-react";

interface TodayOverview {
  date: string;
  stats: {
    news: number;
    memos: number;
    pages_updated: number;
    artifacts: number;
    runs: number;
    writing_active: number;
  };
  recent_news: {
    id: string;
    title: string;
    source: string;
    summary: string;
    created_at: string;
  }[];
  recent_memos: {
    id: string;
    content: string;
    pinned: boolean;
    created_at: string;
  }[];
  pending_writing: {
    id: string;
    title: string;
    status: string;
    updated_at: string;
  }[];
  suggestions: {
    type: "action" | "idea" | "reminder" | "review";
    message: string;
    action: string;
  }[];
}

interface TrendDay {
  date: string;
  news: number;
  memos: number;
  artifacts: number;
  runs: number;
}

const writingStatusLabels: Record<string, string> = {
  topic: "选题中",
  gathering: "收集中",
  outline: "提纲",
  drafting: "写作中",
  reviewing: "审阅中",
  published: "已发布",
};

const writingStatusTagColor = (status: string): "accent" | "warning" | "success" | "neutral" | "info" => {
  if (status === "published") return "success";
  if (status === "drafting" || status === "reviewing") return "accent";
  if (status === "topic" || status === "gathering") return "warning";
  if (status === "outline") return "info";
  return "neutral";
};

const suggestionIcon = {
  action: Sparkles,
  idea: Lightbulb,
  reminder: RefreshCw,
  review: TrendingUp,
};

const suggestionActionLabel: Record<string, string> = {
  refresh_news: "刷新新闻",
  new_writing: "新建写作",
  new_memo: "新建备忘",
  review_artifacts: "查看产出",
};

const statItems = [
  { key: "news" as const, label: "新闻", icon: Newspaper, color: "var(--ht-info)", bg: "var(--ht-info-bg)" },
  { key: "memos" as const, label: "备忘", icon: StickyNote, color: "var(--ht-warning)", bg: "var(--ht-warning-bg)" },
  { key: "pages_updated" as const, label: "页面更新", icon: BookOpen, color: "var(--ht-accent)", bg: "var(--ht-accent-muted)" },
  { key: "artifacts" as const, label: "产出", icon: FileText, color: "var(--ht-success)", bg: "var(--ht-success-bg)" },
  { key: "runs" as const, label: "运行", icon: Activity, color: "var(--ht-accent)", bg: "var(--ht-accent-muted)" },
  { key: "writing_active" as const, label: "活跃写作", icon: PenTool, color: "var(--ht-error)", bg: "var(--ht-error-bg)" },
];

const sectionHeader: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ht-fg)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 14,
};

const sectionIcon: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "var(--ht-radius-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function MiniBarChart({ data }: { data: TrendDay[] }) {
  if (!data || data.length === 0) return null;

  const keys: { key: "news" | "memos" | "artifacts" | "runs"; color: string; label: string }[] = [
    { key: "news", color: "var(--ht-info)", label: "新闻" },
    { key: "memos", color: "var(--ht-warning)", label: "备忘" },
    { key: "artifacts", color: "var(--ht-success)", label: "产出" },
    { key: "runs", color: "var(--ht-accent)", label: "运行" },
  ];

  const maxVal = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k.key])));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {keys.map((k) => (
          <div key={k.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ht-fg-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: k.color, display: "inline-block" }} />
            {k.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
        {data.map((day) => (
          <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 56 }}>
              {keys.map((k) => {
                const h = Math.max(2, (day[k.key] / maxVal) * 52);
                return (
                  <div
                    key={k.key}
                    style={{
                      width: 5,
                      height: h,
                      borderRadius: 2,
                      background: k.color,
                      opacity: 0.8,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: "var(--ht-fg-secondary)", whiteSpace: "nowrap" }}>{day.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TodayWorkbench() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    client.get<TodayOverview>("/today/overview").then((r) => setOverview(r.data));
    client.get<TrendDay[]>("/today/stats-trend", { params: { days: 7 } }).then((r) => setTrend(r.data));
  }, []);

  const handleSuggestionAction = (action: string) => {
    if (action === "refresh_news") navigate("/news");
    else if (action === "new_writing") navigate("/writing");
    else if (action === "new_memo") navigate("/memos");
    else if (action === "review_artifacts") navigate("/runs");
  };

  if (!overview) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div style={{ textAlign: "center", opacity: 0.3 }}>
          <Activity size={32} style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
          <div style={{ fontSize: 13, marginTop: 12 }}>加载中...</div>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(overview.date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--ht-fg)" }}>
          今日工作台
        </h1>
        <div style={{ fontSize: 14, color: "var(--ht-fg-secondary)", marginTop: 6 }}>{formattedDate}</div>
      </div>

      {overview.suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
          {overview.suggestions.map((s, i) => {
            const Icon = suggestionIcon[s.type] || Sparkles;
            return (
              <Card
                key={i}
                variant="outlined"
                style={{
                  padding: "14px 18px",
                  minWidth: 220,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: "var(--ht-radius-lg)",
                }}
              >
                <div
                  style={{
                    ...sectionIcon,
                    background: "var(--ht-accent-muted)",
                    color: "var(--ht-accent)",
                  }}
                >
                  <Icon size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ht-fg)", lineHeight: 1.4 }}>{s.message}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSuggestionAction(s.action)}
                  style={{ flexShrink: 0 }}
                >
                  {suggestionActionLabel[s.action] || "执行"}
                  <ArrowRight size={12} />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {statItems.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <Card key={cfg.key} variant="outlined" style={{ padding: 16, borderRadius: "var(--ht-radius-lg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    ...sectionIcon,
                    background: cfg.bg,
                    color: cfg.color,
                  }}
                >
                  <Icon size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{overview.stats[cfg.key]}</div>
                  <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 2 }}>{cfg.label}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card variant="outlined" style={{ padding: 20, borderRadius: "var(--ht-radius-lg)" }}>
            <div style={{ ...sectionHeader }}>
              <div style={{ ...sectionIcon, background: "var(--ht-info-bg)", color: "var(--ht-info)" }}>
                <Newspaper size={13} />
              </div>
              近期新闻
              <button
                onClick={() => navigate("/vault")}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--ht-accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                查看全部 <ArrowRight size={12} />
              </button>
            </div>
            {overview.recent_news.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ht-fg-secondary)", padding: "16px 0", textAlign: "center" }}>暂无新闻</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {overview.recent_news.map((n) => (
                <div
                  key={n.id}
                  onClick={() => navigate("/vault")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--ht-radius-md)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                    background: hovered === `news-${n.id}` ? "var(--ht-accent-subtle)" : "transparent",
                  }}
                  onMouseEnter={() => setHovered(`news-${n.id}`)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 3, display: "flex", gap: 8 }}>
                    <span>{n.source}</span>
                    <span>{new Date(n.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="outlined" style={{ padding: 20, borderRadius: "var(--ht-radius-lg)" }}>
            <div style={{ ...sectionHeader }}>
              <div style={{ ...sectionIcon, background: "var(--ht-error-bg)", color: "var(--ht-error)" }}>
                <PenTool size={13} />
              </div>
              进行中的写作
              <button
                onClick={() => navigate("/writing")}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--ht-accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                查看全部 <ArrowRight size={12} />
              </button>
            </div>
            {overview.pending_writing.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ht-fg-secondary)", padding: "16px 0", textAlign: "center" }}>暂无进行中的写作</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {overview.pending_writing.map((w) => (
                <div
                  key={w.id}
                  onClick={() => navigate("/writing")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--ht-radius-md)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                    background: hovered === `writing-${w.id}` ? "var(--ht-accent-subtle)" : "transparent",
                  }}
                  onMouseEnter={() => setHovered(`writing-${w.id}`)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 10 }}>
                      {w.title}
                    </div>
                    <Tag color={writingStatusTagColor(w.status)}>
                      {writingStatusLabels[w.status] || w.status}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 3 }}>
                    {new Date(w.updated_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card variant="outlined" style={{ padding: 20, borderRadius: "var(--ht-radius-lg)" }}>
            <div style={{ ...sectionHeader }}>
              <div style={{ ...sectionIcon, background: "var(--ht-warning-bg)", color: "var(--ht-warning)" }}>
                <StickyNote size={13} />
              </div>
              最近备忘
            </div>
            {overview.recent_memos.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ht-fg-secondary)", padding: "16px 0", textAlign: "center" }}>暂无备忘</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {overview.recent_memos.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--ht-radius-md)",
                    background: m.pinned ? "var(--ht-accent-subtle)" : "transparent",
                    borderLeft: m.pinned ? "3px solid var(--ht-accent)" : "3px solid transparent",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ht-fg)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {m.content}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 4 }}>
                    {new Date(m.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="outlined" style={{ padding: 20, borderRadius: "var(--ht-radius-lg)" }}>
            <div style={{ ...sectionHeader }}>
              <div style={{ ...sectionIcon, background: "var(--ht-success-bg)", color: "var(--ht-success)" }}>
                <TrendingUp size={13} />
              </div>
              7日趋势
            </div>
            {trend.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ht-fg-secondary)", padding: "16px 0", textAlign: "center" }}>暂无数据</div>
            ) : (
              <MiniBarChart data={trend} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
