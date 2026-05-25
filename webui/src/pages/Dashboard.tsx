import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Dashboard as DashboardData, type Pipeline } from "../api";
import { Button, Card } from "../ui";
import { Play, Activity, AlertTriangle, Clock, FileOutput, ChevronRight, Zap } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import PipelineFlow from "../components/PipelineFlow";
import { toast } from "../components/Toast";
import Select from "../components/Select";

const statConfigs = [
  { label: "运行中", icon: Activity, colorVar: "var(--ht-accent)", bgVar: "var(--ht-accent-muted)" },
  { label: "失败", icon: AlertTriangle, colorVar: "var(--ht-error)", bgVar: "var(--ht-error-bg)" },
  { label: "待确认", icon: Clock, colorVar: "var(--ht-warning)", bgVar: "var(--ht-warning-bg)" },
  { label: "今日产出", icon: FileOutput, colorVar: "var(--ht-success)", bgVar: "var(--ht-success-bg)" },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("standard");
  const [hoveredRun, setHoveredRun] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard.get().then(setData);
    api.pipelines.list().then(setPipelines);
    const id = setInterval(() => api.dashboard.get().then(setData), 5000);
    return () => clearInterval(id);
  }, []);

  const handleCreateRun = async () => {
    setLoading(true);
    try {
      const run = await api.runs.create(
        selectedPipeline,
        `${pipelines.find((p) => p.id === selectedPipeline)?.label || "流水线"} ${new Date().toLocaleDateString("zh-CN")}`,
      );
      toast("流水线已启动", "success");
      navigate(`/runs/${run.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div style={{ textAlign: "center", opacity: 0.3 }}>
          <Activity size={32} style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
          <div style={{ fontSize: 13, marginTop: 12 }}>加载中...</div>
        </div>
      </div>
    );
  }

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);
  const statValues = [
    data.running_count,
    data.failed_count,
    data.waiting_confirmation_count,
    data.today_artifacts_count,
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--ht-fg)" }}>
          控制台
        </h1>
        <div style={{ fontSize: 14, color: "var(--ht-fg-secondary)", marginTop: 6 }}>
          Pi Console 智能体控制中心
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {statConfigs.map((cfg, i) => {
          const Icon = cfg.icon;
          return (
            <Card key={cfg.label} variant="outlined" style={{
              padding: 20,
              borderRadius: "var(--ht-radius-lg)",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: -8, right: -8,
                width: 56, height: 56, borderRadius: "50%",
                background: cfg.bgVar, opacity: 0.5,
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "var(--ht-radius-md)",
                    background: cfg.bgVar,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: cfg.colorVar,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {statValues[i]}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ht-fg-secondary)", marginTop: 4 }}>{cfg.label}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="outlined" style={{ padding: 20, marginBottom: 24, borderRadius: "var(--ht-radius-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "var(--ht-radius-md)",
            background: "var(--ht-accent-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ht-accent)",
          }}>
            <Zap size={14} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>快速启动</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={selectedPipeline}
            onChange={setSelectedPipeline}
            options={pipelines.map((p) => ({ value: p.id, label: p.label, description: p.description }))}
          />
          <Button variant="primary" onClick={handleCreateRun} disabled={loading}>
            <Play size={15} style={{ marginRight: 4 }} />
            {loading ? "启动中..." : "运行流水线"}
          </Button>
        </div>
        {currentPipeline && (
          <div style={{ marginTop: 16 }}>
            <PipelineFlow pipeline={currentPipeline} />
            <div style={{ fontSize: 12, color: "var(--ht-fg-secondary)", marginTop: 8 }}>
              {currentPipeline.description}
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ht-fg)" }}>最近运行</div>
            <button
              onClick={() => navigate("/runs")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--ht-accent)", display: "flex", alignItems: "center", gap: 2 }}
            >
              查看全部 <ChevronRight size={12} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.latest_runs.length === 0 && (
              <EmptyState message="暂无运行记录" />
            )}
            {data.latest_runs.map((run) => (
              <Card
                key={run.id}
                variant="outlined"
                style={{
                  padding: "14px 18px",
                  cursor: "pointer",
                  borderRadius: "var(--ht-radius-md)",
                  transition: "all 0.15s ease",
                  boxShadow: hoveredRun === run.id ? "0 2px 8px rgba(0,0,0,0.04)" : undefined,
                  borderColor: hoveredRun === run.id ? "var(--ht-accent)" : undefined,
                }}
                onClick={() => navigate(`/runs/${run.id}`)}
                onMouseEnter={() => setHoveredRun(run.id)}
                onMouseLeave={() => setHoveredRun(null)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 3 }}>
                      {run.trigger_type} &middot; {new Date(run.created_at).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 12 }}>
                    <StatusBadge status={run.status} pulse={run.status === "running"} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ht-fg)" }}>最近产出</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.latest_artifacts.length === 0 && (
              <EmptyState message="暂无产出" />
            )}
            {data.latest_artifacts.map((a) => (
              <Card key={a.id} variant="outlined" style={{ padding: "14px 18px", borderRadius: "var(--ht-radius-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ht-fg-secondary)", marginTop: 3 }}>
                      {a.type} &middot; {new Date(a.created_at).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <a
                    href={api.artifacts.exportUrl(a.id)}
                    style={{ fontSize: 12, color: "var(--ht-accent)", flexShrink: 0, marginLeft: 12, textDecoration: "none" }}
                  >
                    导出
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
