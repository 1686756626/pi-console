
import { useEffect, useState } from "react";
import { client } from "../api";
import { Card, Tag, statusTagColor } from "../ui";
import {
  Calendar,
  TrendingUp,
  AlertTriangle,
  Info,
  Bell,
  Heart,
  CheckCircle,
  Activity,
  Newspaper,
  StickyNote,
  FileText,
  PenTool,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import PageHeader from "../components/PageHeader";

interface DailyItem {
  date: string;
  today: boolean;
  summary: {
    news_count: number;
    memo_count: number;
    run_count: number;
    pages_updated_count: number;
    writing_updated_count: number;
  };
  news: { id: string; title: string; source: string }[];
  memos: { id: string; content: string }[];
  runs: { id: string; name: string; status: string }[];
  pages: { id: string; title: string }[];
  writing: { id: string; title: string; status: string }[];
}

interface Insight {
  type: "warning" | "info" | "reminder" | "encourage" | "review";
  message: string;
}

interface InsightsData {
  period: string;
  stats: {
    runs: number;
    failed_runs: number;
    news: number;
    memos: number;
    artifacts: number;
    writing_started: number;
    writing_completed: number;
  };
  insights: Insight[];
}

const statCards = [
  { key: "runs" as const, label: "运行次数", icon: Activity, colorVar: "var(--ht-accent)", bgVar: "var(--ht-accent-muted)" },
  { key: "failed_runs" as const, label: "失败次数", icon: AlertTriangle, colorVar: "var(--ht-error)", bgVar: "var(--ht-error-bg)" },
  { key: "news" as const, label: "新闻采集", icon: Newspaper, colorVar: "var(--ht-info)", bgVar: "var(--ht-info-bg)" },
  { key: "memos" as const, label: "备忘记录", icon: StickyNote, colorVar: "var(--ht-warning)", bgVar: "var(--ht-warning-bg)" },
  { key: "artifacts" as const, label: "产出文件", icon: FileText, colorVar: "var(--ht-success)", bgVar: "var(--ht-success-bg)" },
  { key: "writing_started" as const, label: "写作启动", icon: PenTool, colorVar: "var(--ht-accent)", bgVar: "var(--ht-accent-muted)" },
  { key: "writing_completed" as const, label: "写作完成", icon: CheckCircle, colorVar: "var(--ht-success)", bgVar: "var(--ht-success-bg)" },
];

const insightColors: Record<Insight["type"], { border: string; bg: string; color: string; icon: typeof Info }> = {
  warning: { border: "var(--ht-error)", bg: "var(--ht-error-bg)", color: "var(--ht-error)", icon: AlertTriangle },
  info: { border: "var(--ht-info)", bg: "var(--ht-info-bg)", color: "var(--ht-info)", icon: Info },
  reminder: { border: "var(--ht-accent)", bg: "var(--ht-accent-muted)", color: "var(--ht-accent)", icon: Bell },
  encourage: { border: "var(--ht-success)", bg: "var(--ht-success-bg)", color: "var(--ht-success)", icon: Heart },
  review: { border: "#8b5cf6", bg: "rgba(139,92,246,0.10)", color: "#8b5cf6", icon: TrendingUp },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
}

export default function ReviewRoom() {
  const [dailyData, setDailyData] = useState<DailyItem[]>([]);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    client.get<DailyItem[]>("/review/daily", { params: { days: 7 } }).then((r) => {
      setDailyData(r.data);
      setExpandedDays(new Set(r.data.filter((d) => d.today).map((d) => d.date)));
    });
    client.get<InsightsData>("/review/insights").then((r) => setInsightsData(r.data));
  }, []);

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div>
      <PageHeader title="复盘室" subtitle="回顾学习轨迹，发现成长规律" />

      {insightsData && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--ht-radius-md)",
                background: "var(--ht-accent-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ht-accent)",
              }}
            >
              <TrendingUp size={14} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>本周洞察</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {statCards.map((cfg) => {
              const Icon = cfg.icon;
              const value = insightsData.stats[cfg.key];
              return (
                <Card key={cfg.key} variant="outlined" style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--ht-radius-md)",
                        background: cfg.bgVar,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: cfg.colorVar,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 2 }}>{cfg.label}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {insightsData.insights.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insightsData.insights.map((insight, i) => {
                const cfg = insightColors[insight.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "var(--ht-radius-md)",
                      borderLeft: `3px solid ${cfg.border}`,
                      background: cfg.bg,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <Icon size={16} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13, color: "var(--ht-fg)", lineHeight: 1.5 }}>{insight.message}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--ht-radius-md)",
              background: "var(--ht-info-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ht-info)",
            }}
          >
            <Calendar size={14} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>每日回顾</div>
        </div>

        <div style={{ position: "relative", paddingLeft: 28 }}>
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 8,
              bottom: 8,
              width: 2,
              background: "var(--ht-border)",
              borderRadius: 1,
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {dailyData.map((day) => {
              const expanded = expandedDays.has(day.date);
              const s = day.summary;
              return (
                <div key={day.date} style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -28,
                      top: 14,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: day.today ? "var(--ht-accent)" : "var(--ht-surface)",
                      border: day.today ? "2px solid var(--ht-accent)" : "2px solid var(--ht-border)",
                      zIndex: 1,
                      transform: "translateX(-5px)",
                    }}
                  />

                  <Card variant="outlined" style={{ overflow: "hidden" }}>
                    <div
                      onClick={() => toggleDay(day.date)}
                      style={{
                        padding: "14px 18px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontWeight: day.today ? 700 : 500,
                            fontSize: 14,
                            color: day.today ? "var(--ht-accent)" : "var(--ht-fg)",
                          }}
                        >
                          {formatDate(day.date)}
                        </span>
                        {day.today && (
                          <Tag color="accent">今天</Tag>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--ht-fg-secondary)", display: "flex", gap: 8 }}>
                          {s.news_count > 0 && <span>{s.news_count}新闻</span>}
                          {s.memo_count > 0 && <span>{s.memo_count}备忘</span>}
                          {s.run_count > 0 && <span>{s.run_count}运行</span>}
                          {s.pages_updated_count > 0 && <span>{s.pages_updated_count}笔记</span>}
                          {s.writing_updated_count > 0 && <span>{s.writing_updated_count}写作</span>}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            color: "var(--ht-fg-secondary)",
                            transition: "transform 0.2s ease",
                            transform: expanded ? "rotate(0deg)" : "rotate(0deg)",
                          }}
                        >
                          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div
                        style={{
                          padding: "0 18px 16px",
                          borderTop: "1px solid var(--ht-border)",
                          paddingTop: 14,
                        }}
                      >
                        {day.news.length === 0 &&
                          day.memos.length === 0 &&
                          day.runs.length === 0 &&
                          day.pages.length === 0 &&
                          day.writing.length === 0 && (
                            <div style={{ fontSize: 13, color: "var(--ht-fg-secondary)", textAlign: "center", padding: "16px 0" }}>
                              当日暂无记录
                            </div>
                          )}

                        {day.news.length > 0 && (
                          <DaySection icon={<Newspaper size={13} />} title={`新闻 (${day.news.length})`}>
                            {day.news.map((n) => (
                              <div key={n.id} style={{ fontSize: 13, color: "var(--ht-fg)", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ht-info)", flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                                <span style={{ fontSize: 11, color: "var(--ht-fg-secondary)", flexShrink: 0 }}>{n.source}</span>
                              </div>
                            ))}
                          </DaySection>
                        )}

                        {day.memos.length > 0 && (
                          <DaySection icon={<StickyNote size={13} />} title={`备忘 (${day.memos.length})`}>
                            {day.memos.map((m) => (
                              <div key={m.id} style={{ fontSize: 13, color: "var(--ht-fg)", padding: "4px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ht-warning)", flexShrink: 0, marginTop: 7 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                  {m.content}
                                </span>
                              </div>
                            ))}
                          </DaySection>
                        )}

                        {day.runs.length > 0 && (
                          <DaySection icon={<Activity size={13} />} title={`运行 (${day.runs.length})`}>
                            {day.runs.map((r) => (
                              <div key={r.id} style={{ fontSize: 13, color: "var(--ht-fg)", padding: "4px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                <Tag color={statusTagColor(r.status)}>{r.status}</Tag>
                              </div>
                            ))}
                          </DaySection>
                        )}

                        {day.pages.length > 0 && (
                          <DaySection icon={<FileText size={13} />} title={`笔记更新 (${day.pages.length})`}>
                            {day.pages.map((p) => (
                              <div key={p.id} style={{ fontSize: 13, color: "var(--ht-fg)", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ht-success)", flexShrink: 0 }} />
                                <span>{p.title}</span>
                              </div>
                            ))}
                          </DaySection>
                        )}

                        {day.writing.length > 0 && (
                          <DaySection icon={<PenTool size={13} />} title={`写作项目 (${day.writing.length})`}>
                            {day.writing.map((w) => (
                              <div key={w.id} style={{ fontSize: 13, color: "var(--ht-fg)", padding: "4px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
                                <Tag color={statusTagColor(w.status)}>{w.status}</Tag>
                              </div>
                            ))}
                          </DaySection>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DaySection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ht-fg-secondary)",
          marginBottom: 6,
        }}
      >
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
