import { useEffect, useState } from "react";
import { Card, Tag, inputStyle } from "../ui";
import { Shield, RefreshCw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Button } from "../ui";

interface AuditEntry {
  time: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  type: string;
}

const methodColors: Record<string, "accent" | "success" | "warning" | "accent2" | "neutral"> = {
  GET: "accent",
  POST: "success",
  PUT: "warning",
  PATCH: "accent2",
  DELETE: "neutral",
};

const statusColors: Record<string, string> = {
  "2": "var(--ht-success)",
  "3": "var(--ht-accent)",
  "4": "var(--ht-warning)",
  "5": "var(--ht-error)",
};

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchEntries();
  }, [hours]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const resp = await fetch(`/api/audit/logs?hours=${hours}&limit=200`);
      const data = await resp.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => e.type === filter);

  return (
    <div>
      <PageHeader
        title="审计日志"
        subtitle={`${filtered.length} 条记录 (最近 ${hours}h)`}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              style={{
                ...inputStyle,
                width: "auto",
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value={1}>1 小时</option>
              <option value={6}>6 小时</option>
              <option value={24}>24 小时</option>
              <option value={72}>3 天</option>
              <option value={168}>7 天</option>
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                ...inputStyle,
                width: "auto",
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="all">全部</option>
              <option value="write">写入操作</option>
              <option value="read">读取操作</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchEntries}>
              <RefreshCw size={14} style={{ marginRight: 4 }} /> 刷新
            </Button>
          </div>
        }
      />

      {filtered.length === 0 && !loading && (
        <EmptyState
          message="暂无审计日志"
          icon={<Shield size={40} />}
        />
      )}

      <Card variant="outlined" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ht-border)", background: "var(--ht-accent-subtle)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>时间</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>方法</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>路径</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>状态</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: 12 }}>耗时</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={`${e.time}-${e.path}-${i}`}
                style={{
                  borderBottom: "1px solid var(--ht-border)",
                  background: e.type === "write" ? "var(--ht-accent-subtle)" : "transparent",
                }}
              >
                <td style={{ padding: "6px 12px", whiteSpace: "nowrap", opacity: 0.6, fontSize: 12 }}>
                  {e.time ? new Date(e.time).toLocaleString("zh-CN") : "-"}
                </td>
                <td style={{ padding: "6px 12px" }}>
                  <Tag color={methodColors[e.method] || "neutral"}>{e.method}</Tag>
                </td>
                <td style={{ padding: "6px 12px", fontFamily: "monospace", fontSize: 12 }}>
                  {e.path}
                </td>
                <td style={{ padding: "6px 12px" }}>
                  <span style={{ color: statusColors[String(e.status)[0]] || "var(--ht-fg)", fontWeight: 600 }}>
                    {e.status}
                  </span>
                </td>
                <td style={{ padding: "6px 12px", textAlign: "right", opacity: 0.5, fontSize: 12 }}>
                  {e.duration_ms}ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
